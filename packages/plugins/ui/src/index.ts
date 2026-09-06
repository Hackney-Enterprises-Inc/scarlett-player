/**
 * UI Controls Plugin for Scarlett Player
 *
 * Provides a complete, themeable video player control interface.
 * Modern design with progress bar above controls.
 *
 * @packageDocumentation
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { enterFullscreen, exitFullscreen, isFullscreen } from '@scarlett-player/core';
import type {
  IUIPlugin,
  ControlSlot,
  ThemeConfig,
  UIPluginConfig,
} from './types';
import type { Control } from './controls';
import type { FitExit, FitItem, FitPlan, FitRank } from './fit';
import { planFit, resolveFitItems } from './fit';
import { styles } from './styles';
import { icons } from './icons';
import {
  PlayButton,
  SkipButton,
  ProgressBar,
  TimeDisplay,
  VolumeControl,
  LiveIndicator,
  QualityMenu,
  SettingsMenu,
  CaptionsButton,
  CastButton,
  PipButton,
  FullscreenButton,
  Spacer,
  ErrorOverlay,
  BandwidthIndicator,
  BigPlayButton,
  OverflowTray,
} from './controls';
import { getControlFactory, onControlRegistered } from './control-registry';
import { PKG_VERSION } from './version';

export type {
  IUIPlugin,
  ControlSlot,
  BuiltinControlSlot,
  ControlFactory,
  LayoutConfig,
  ThemeConfig,
  UIPluginConfig,
  Control,
} from './types';
export {
  registerControl,
  unregisterControl,
  getControlFactory,
  resetControlRegistry,
} from './control-registry';
export { icons } from './icons';
export { styles } from './styles';
export { formatTime, formatLiveTime } from './utils';
export { DEFAULT_PRIORITY, planFit, resolveFitItems } from './fit';
export type {
  FitExit,
  FitItem,
  FitPlan,
  FitRank,
  FitRule,
  FitTemplate,
} from './fit';

/** Default control layout (progress bar is separate, above controls) */
const DEFAULT_LAYOUT: ControlSlot[] = [
  'play',
  'skip-backward',
  'skip-forward',
  'volume',
  'time',
  'live-indicator',
  'bandwidth-indicator',
  'spacer',
  'settings',
  'captions',
  'chromecast',
  'airplay',
  'pip',
  'fullscreen',
];

/** Default hide delay in ms */
const DEFAULT_HIDE_DELAY = 3000;

/**
 * Width assumed for a control that has never been measured inside the bar.
 *
 * A control that starts life in the tray (registered after the first fit, or
 * hidden while the bar was first measured) has no rendered width to read: it is
 * inside a `visibility: hidden` strip, where `getBoundingClientRect()` answers
 * zero. 48 is a 44px button plus the 4px gap that follows it, which is what
 * every icon button in this bar actually costs.
 */
const UNMEASURED_CONTROL_WIDTH = 48;

/** Width of the tray button when it is hidden and cannot be measured (44px, like every other button). */
const OVERFLOW_BUTTON_WIDTH = 44;

/** Horizontal padding of the control bar, used when the environment cannot report it. */
const FALLBACK_BAR_PADDING_X = 24;

/** Flex gap between bar items, used when the environment cannot report it. */
const FALLBACK_BAR_GAP = 4;

/**
 * Vertical room a popover menu gives up to the control bar.
 *
 * 56 for the bar (a 44px button plus its 12px bottom padding), 8 for the gap
 * the menus already sit above it by, and 8 of margin so a bounded menu does not
 * touch the top edge of the player.
 */
const MENU_HEIGHT_RESERVE = 72;

/** Floor for the bounded menu height, so a very short player still shows a scrollable menu. */
const MIN_MENU_HEIGHT = 120;

/**
 * One control in the bar, with everything the fit loop needs to place it.
 */
interface ControlEntry {
  /** Layout slot this control was created for. */
  slot: ControlSlot;
  /** The control instance, kept so the entry survives a rebuild. */
  control: Control;
  /** The element the control rendered. */
  el: HTMLElement;
  /** How eagerly it leaves the bar. */
  rank: FitRank;
  /** Where it goes when it leaves. */
  exit: FitExit;
  /** Last width measured while it was in the bar; -1 until measured once. */
  width: number;
}

/**
 * Create a UI controls plugin instance.
 *
 * @example
 * ```ts
 * import { createPlayer } from '@scarlett-player/core';
 * import { uiPlugin } from '@scarlett-player/ui';
 *
 * const player = await createPlayer({
 *   container: '#player',
 *   plugins: [
 *     uiPlugin({
 *       hideDelay: 3000,
 *       theme: { accentColor: '#e50914' },
 *     }),
 *   ],
 * });
 * ```
 */
export function uiPlugin(config: UIPluginConfig = {}): IUIPlugin {
  let api: IPluginAPI;
  let controlBar: HTMLDivElement | null = null;
  let gradient: HTMLDivElement | null = null;
  let progressBar: ProgressBar | null = null;
  let bufferingIndicator: HTMLDivElement | null = null;
  let errorOverlay: ErrorOverlay | null = null;
  let bigPlayButton: BigPlayButton | null = null;
  let styleEl: HTMLStyleElement | null = null;
  let controls: Control[] = [];
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let stateUnsubscribe: (() => void) | null = null;
  let controlRegistryUnsubscribe: (() => void) | null = null;
  let errorUnsubscribe: (() => void) | null = null;
  let reconnectingUnsubscribe: (() => void) | null = null;
  let recoveredUnsubscribe: (() => void) | null = null;
  let controlsVisible = true;
  let rafHandle: number | null = null;
  let tray: OverflowTray | null = null;
  let entries: ControlEntry[] = [];
  let timeEntry: ControlEntry | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let barPaddingX = FALLBACK_BAR_PADDING_X;
  let barGap = FALLBACK_BAR_GAP;
  /** Visibility signature the last fit ran against; null until the first fit. */
  let lastFitSignature: string | null = null;
  /** Set when the container resized, or before the first fit, so the next update refits. */
  let fitPending = true;

  const layout = config.controls || DEFAULT_LAYOUT;
  const hideDelay = config.hideDelay ?? DEFAULT_HIDE_DELAY;
  const showBigPlayButton = config.bigPlayButton !== false;
  const responsive = config.responsive !== false;

  /**
   * Create a control instance for a given slot.
   */
  const createControl = (slot: ControlSlot): Control | null => {
    switch (slot) {
      case 'play':
        return new PlayButton(api);
      case 'skip-backward':
        return new SkipButton(api, 'backward');
      case 'skip-forward':
        return new SkipButton(api, 'forward');
      case 'volume':
        return new VolumeControl(api);
      case 'progress':
        // Progress bar is now created separately
        return null;
      case 'time':
        return new TimeDisplay(api);
      case 'live-indicator':
        return new LiveIndicator(api);
      case 'bandwidth-indicator':
        return new BandwidthIndicator(api);
      case 'quality':
        return new QualityMenu(api);
      case 'settings':
        return new SettingsMenu(api);
      case 'captions':
        return new CaptionsButton(api);
      case 'chromecast':
        return new CastButton(api, 'chromecast');
      case 'airplay':
        return new CastButton(api, 'airplay');
      case 'pip':
        return new PipButton(api);
      case 'fullscreen':
        return new FullscreenButton(api);
      case 'spacer':
        return new Spacer();
      default: {
        // Not a built-in - fall through to whatever a plugin registered.
        const factory = getControlFactory(slot);
        if (factory) {
          try {
            return factory(api);
          } catch (error) {
            api.logger.error(`Control factory for "${slot}" threw`, { error });
            return null;
          }
        }

        api.logger.warn(`Unknown control slot: ${slot}`);
        return null;
      }
    }
  };

  /**
   * Fill the control bar from the active layout.
   *
   * The progress bar is deliberately excluded - it is rendered separately,
   * above the control bar.
   */
  const populateControlBar = (): void => {
    if (!controlBar) {
      return;
    }

    const rules = new Map(
      resolveFitItems(layout, config.priority).map((template) => [template.id, template])
    );

    for (const slot of layout) {
      const control = createControl(slot);
      if (!control) {
        continue;
      }

      controls.push(control);
      const el = control.render();
      controlBar.appendChild(el);

      const rule = rules.get(slot);
      const entry: ControlEntry = {
        slot,
        control,
        el,
        rank: rule?.rank ?? 'never',
        exit: rule?.exit ?? 'overflow',
        width: -1,
      };
      entries.push(entry);

      if (slot === 'time') {
        timeEntry = entry;
      }
    }

    // The tray is a permanent bar child, hidden until the fit puts something in
    // it. Created last so it can be placed relative to the controls that exist.
    if (responsive) {
      tray = new OverflowTray(api);
      controls.push(tray);
      controlBar.appendChild(tray.render());
      placeTrayButton();
    }
  };

  /**
   * Keep the tray button immediately before the fullscreen control.
   *
   * Fullscreen is pinned and is the rightmost control in every layout that has
   * one, so the tray reads as the last item before it rather than as something
   * appended after the bar ends. Layouts without a fullscreen control get it
   * last. The move is guarded because `insertBefore` on an element that is
   * already in place still detaches and re-inserts it, which drops focus.
   */
  const placeTrayButton = (): void => {
    if (!controlBar || !tray) {
      return;
    }

    const trayEl = tray.render();
    const fullscreen = entries.find((entry) => entry.slot === 'fullscreen');
    const before =
      fullscreen && fullscreen.el.parentNode === controlBar ? fullscreen.el : null;

    if (before) {
      if (trayEl.nextSibling !== before) {
        controlBar.insertBefore(trayEl, before);
      }
      return;
    }

    if (controlBar.lastChild !== trayEl) {
      controlBar.appendChild(trayEl);
    }
  };

  /**
   * A cheap, layout-free description of what the bar currently shows.
   *
   * Controls hide and show themselves constantly (captions appear when tracks
   * load, the cast buttons when a device answers, the live indicator when the
   * stream goes live), and each change moves the fit. Reading geometry on every
   * `updateControls()` would mean a forced layout several times a second,
   * because `timeupdate` alone drives one. This reads no geometry at all: the
   * per-control display flags, plus the length of the time readout, which is
   * the only bar item whose width changes without its visibility changing (it
   * grows at 10:00 and again at 1:00:00).
   *
   * @returns A signature that differs whenever a refit is worth the layout read
   */
  const visibilitySignature = (): string => {
    let flags = '';

    for (const entry of entries) {
      flags += entry.el.style.display === 'none' ? '0' : '1';
    }

    return `${flags}:${timeEntry?.el.textContent?.length ?? 0}`;
  };

  /**
   * Put every control where the plan says it goes, touching only what moved.
   *
   * @param plan - Target placement from {@link planFit}
   */
  const applyFit = (plan: FitPlan): void => {
    if (!controlBar || !tray) {
      return;
    }

    const overflow = new Set(plan.overflow);
    const hidden = new Set(plan.hidden);

    for (const entry of entries) {
      if (entry.slot === 'spacer') {
        continue;
      }

      if (hidden.has(entry.slot)) {
        if (tray.holds(entry.el)) {
          returnToBar(entry);
        }
        entry.el.classList.add('sp-control--collapsed');
        continue;
      }

      entry.el.classList.remove('sp-control--collapsed');

      if (overflow.has(entry.slot)) {
        if (!tray.holds(entry.el)) {
          tray.adopt(entry.el);
        }
      } else if (tray.holds(entry.el)) {
        returnToBar(entry);
      }
    }

    tray.refresh();
    placeTrayButton();
  };

  /**
   * Move one control out of the tray and back into its layout position.
   *
   * The element goes before the next control (in layout order) that is still a
   * child of the bar, so a control that comes back lands where the host put it
   * rather than at the end. The spacer counts as an anchor here even though it
   * takes no part in the fit: without it a left-hand control returning to a bar
   * whose left group is empty would be inserted after the spacer and jump to
   * the right-hand group.
   *
   * @param entry - The control returning to the bar
   */
  const returnToBar = (entry: ControlEntry): void => {
    if (!controlBar || !tray) {
      return;
    }

    const el = tray.release(entry.el);
    const trayEl = tray.render();
    let before: Node | null = trayEl.parentNode === controlBar ? trayEl : null;

    for (let i = entries.indexOf(entry) + 1; i < entries.length; i++) {
      if (entries[i].el.parentNode === controlBar) {
        before = entries[i].el;
        break;
      }
    }

    controlBar.insertBefore(el, before);
  };

  /**
   * Measure the bar and apply the resulting plan.
   *
   * The only geometry read in the plugin. Widths are cached per control so a
   * control sitting in the closed tray (where it measures zero) keeps the width
   * it had in the bar, which is what lets it come back when the player is
   * widened.
   */
  const fitControls = (): void => {
    if (!responsive || !controlBar || !tray) {
      return;
    }

    // Zero width is a bar nobody has laid out yet (detached, display: none,
    // an embed before its container is sized), not a bar that does not fit.
    if (controlBar.clientWidth === 0) {
      return;
    }

    const available = controlBar.clientWidth - barPaddingX;
    const items: FitItem[] = [];

    for (const entry of entries) {
      // The spacer's rendered width is exactly the bar's slack, so counting it
      // would make a comfortably fitting bar measure as exactly full and
      // nothing would ever come back out of the tray.
      if (entry.slot === 'spacer') {
        continue;
      }

      const visible = entry.el.style.display !== 'none';
      const measurable =
        visible &&
        entry.el.parentNode === controlBar &&
        !entry.el.classList.contains('sp-control--collapsed');

      if (measurable) {
        entry.width = entry.el.getBoundingClientRect().width;
      } else if (entry.width < 0) {
        entry.width = UNMEASURED_CONTROL_WIDTH;
      }

      items.push({
        id: entry.slot,
        rank: entry.rank,
        exit: entry.exit,
        width: entry.width,
        visible,
      });
    }

    const trayEl = tray.render();
    const trayWidth =
      trayEl.style.display === 'none' ? 0 : trayEl.getBoundingClientRect().width;

    applyFit(planFit(items, available, barGap, trayWidth || OVERFLOW_BUTTON_WIDTH));

    lastFitSignature = visibilitySignature();
    fitPending = false;
  };

  /**
   * Refit only when something that can change the answer has changed.
   *
   * @see visibilitySignature for why this is not simply "fit on every update"
   */
  const maybeFit = (): void => {
    if (!responsive) {
      return;
    }

    if (!fitPending && visibilitySignature() === lastFitSignature) {
      return;
    }

    fitControls();
  };

  /**
   * Bound the popover menus to the player's height.
   *
   * The settings menu's Speed sub-panel is 253px tall against a 211px portrait
   * phone player, so the host's `overflow: hidden` cut off its Back header and
   * the first three speeds: the speed control existed and could not be reached
   * (measured at 375x211 on 2026-09-05). The menus read this variable through
   * `max-height`, and behave exactly as before wherever it is unset.
   *
   * @param height - Current container height in px
   */
  const applyMenuBounds = (height: number): void => {
    api?.container?.style.setProperty(
      '--sp-menu-max-height',
      `${Math.max(MIN_MENU_HEIGHT, Math.round(height) - MENU_HEIGHT_RESERVE)}px`
    );
  };

  /**
   * Tear down and rebuild the control bar in place.
   *
   * Used when a control in this layout registers after init. Rebuilding the
   * whole bar rather than splicing one control in keeps the rendered order
   * matching the configured layout.
   */
  const rebuildControlBar = (): void => {
    if (!controlBar) {
      return;
    }

    controls.forEach((c) => c.destroy());
    controls = [];
    entries = [];
    timeEntry = null;
    tray = null;
    controlBar.replaceChildren();

    // Everything the previous fit knew (cached widths, the signature, which
    // element sat where) described elements that no longer exist, so the
    // rebuilt bar is fitted from scratch by the updateControls() below.
    lastFitSignature = null;
    fitPending = true;

    populateControlBar();
    updateControls();
  };

  /**
   * Update all controls with current state.
   */
  const updateControls = (): void => {
    controls.forEach((c) => c.update());
    progressBar?.update();

    // Update buffering indicator
    // Only show spinner when video is actually stalled (waiting), not during normal fragment loading
    const waiting = api?.getState('waiting');
    const seeking = api?.getState('seeking');
    const playbackState = api?.getState('playbackState');
    const isLoading = playbackState === 'loading';
    const showSpinner = waiting || (seeking && !api?.getState('paused')) || isLoading;
    bufferingIndicator?.classList.toggle('sp-buffering--visible', !!showSpinner);

    // Update error overlay (auto-hide on recovery)
    errorOverlay?.update();

    // After the overlay, so the button sees the visibility the viewer will:
    // it stands down while an error is on screen.
    bigPlayButton?.update();

    // Last, so the fit measures the visibility the controls just settled on.
    maybeFit();
  };

  /**
   * Queue a control render for the next animation frame.
   *
   * State changes arrive individually (a single `timeupdate` alone touches
   * several keys, several times a second). Rendering synchronously on each one
   * re-renders every control dozens of times per second for no visual gain.
   * Coalescing to one render per frame keeps the DOM quiet, which also keeps
   * pointer interactions on the controls from being disturbed mid-gesture.
   */
  const scheduleUpdate = (): void => {
    if (rafHandle !== null) return;
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      updateControls();
    });
  };

  /**
   * Show the control bar.
   */
  const showControls = (): void => {
    if (controlsVisible) {
      resetHideTimer();
      return;
    }
    controlsVisible = true;

    controlBar?.classList.add('sp-controls--visible');
    controlBar?.classList.remove('sp-controls--hidden');
    gradient?.classList.add('sp-gradient--visible');
    progressBar?.show();

    api?.setState('controlsVisible', true);
    resetHideTimer();
  };

  /**
   * Hide the control bar.
   */
  const hideControls = (): void => {
    const paused = api?.getState('paused');
    // Don't hide when paused or when not playing
    if (paused) return;

    controlsVisible = false;
    controlBar?.classList.remove('sp-controls--visible');
    controlBar?.classList.add('sp-controls--hidden');
    gradient?.classList.remove('sp-gradient--visible');
    progressBar?.hide();

    api?.setState('controlsVisible', false);
  };

  /**
   * Reset the auto-hide timer.
   */
  const resetHideTimer = (): void => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    hideTimeout = setTimeout(hideControls, hideDelay);
  };

  /** Pointer type of the most recent interaction, so touch can be told from mouse. */
  let last_pointer_type: string | null = null;

  /**
   * Record what kind of pointer is driving the current interaction.
   *
   * Input type, never the user agent: a touchscreen laptop must behave as a
   * mouse when a mouse is used and as touch when a finger is used, and it can
   * be both within one session.
   *
   * Bound to `pointermove` as well as `pointerdown`, and that matters on a
   * hybrid device. Tracking only presses leaves the value stuck at 'touch' after
   * a tap, so the next mouse hover would be read as touch and the controls would
   * never come back. A real mouse move reports `pointerType: 'mouse'` and clears
   * it; a legacy mouse event synthesised from a tap fires no pointer event at
   * all, so it cannot flip this the wrong way.
   */
  const handlePointerActivity = (event: PointerEvent): void => {
    last_pointer_type = event.pointerType;
  };

  /**
   * Handle mouse/touch interaction.
   *
   * When a gestures plugin is installed it owns touch taps: tapping has to mean
   * "toggle", and if both ran, every tap would show the controls here and the
   * gesture plugin's hide would fight it. Mouse and hover behaviour is
   * untouched, and with no gestures plugin registered this is exactly as before.
   */
  const handleInteraction = (): void => {
    if (last_pointer_type === 'touch') {
      const gestures = api?.getPlugin<{ ownsTapInteraction(): boolean }>('gestures');
      if (gestures?.ownsTapInteraction()) return;
    }

    showControls();
  };

  /**
   * Handle mouse leave.
   */
  const handleMouseLeave = (): void => {
    // Immediately try to hide (will be blocked if paused)
    hideControls();
  };

  /**
   * Handle keyboard shortcuts.
   */
  const handleKeyDown = (e: KeyboardEvent): void => {
    // Only handle when focused on container or its children
    if (!api.container.contains(document.activeElement)) return;

    // Don't intercept keys when user is typing in an input field
    const activeEl = document.activeElement;
    if (
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      activeEl instanceof HTMLSelectElement ||
      (activeEl as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    const video = api.container.querySelector('video');
    if (!video) return;

    const live = api.getState('live');
    const seekableRange = api.getState('seekableRange');

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        // play() rejections (autoplay policy, AbortError) must never
        // escape as unhandled rejections
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        break;
      case 'm':
        e.preventDefault();
        video.muted = !video.muted;
        break;
      case 'f':
        e.preventDefault();
        // The same core helpers the fullscreen button uses, so the shortcut
        // reaches the iPhone's native player too. Fullscreen promises reject
        // when the browser denies the request; swallow them the same way
        // FullscreenButton does.
        if (isFullscreen(api.container)) {
          exitFullscreen(api.container).catch(() => {});
        } else {
          enterFullscreen(api.container).catch(() => {});
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (live && seekableRange) {
          video.currentTime = Math.max(seekableRange.start, video.currentTime - 5);
        } else {
          video.currentTime = Math.max(0, video.currentTime - 5);
        }
        showControls();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (live && seekableRange) {
          video.currentTime = Math.min(seekableRange.end, video.currentTime + 5);
        } else {
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
        }
        showControls();
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        showControls();
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        showControls();
        break;
    }
  };

  return {
    id: 'ui-controls',
    name: 'UI Controls',
    type: 'ui',
    version: PKG_VERSION,

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;

      // Inject styles
      styleEl = document.createElement('style');
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);

      // Apply initial theme
      if (config.theme) {
        this.setTheme(config.theme);
      }

      // Get container
      const container = api.container;
      if (!container) {
        api.logger.error('UI plugin: container not found');
        return;
      }

      // Ensure container has relative positioning
      const containerStyle = getComputedStyle(container);
      if (containerStyle.position === 'static') {
        container.style.position = 'relative';
      }

      // Check if video is already playing (autoplay case)
      const isPlaying = api.getState('playing');

      // Create gradient overlay
      gradient = document.createElement('div');
      gradient.className = isPlaying ? 'sp-gradient' : 'sp-gradient sp-gradient--visible';
      container.appendChild(gradient);

      // Create buffering indicator
      bufferingIndicator = document.createElement('div');
      bufferingIndicator.className = 'sp-buffering';
      bufferingIndicator.innerHTML = icons.spinner;
      bufferingIndicator.setAttribute('aria-hidden', 'true');
      container.appendChild(bufferingIndicator);

      // Create error overlay
      errorOverlay = new ErrorOverlay(api);
      container.appendChild(errorOverlay.render());

      // Listen for fatal errors to show the overlay. The event payload is the
      // structured PlayerError itself; the state key is populated by the core
      // from the same event, so either source carries the error code.
      errorUnsubscribe = api.on('error', (payload: { fatal?: boolean; message?: string; code?: string }) => {
        if (payload?.fatal) {
          const error = api.getState('error') || payload;
          errorOverlay?.show(error);
        }
      });

      // While the provider auto-reconnects, tell the viewer the player is
      // working on it instead of presenting a dead-end error.
      //
      // Taking this state back down needs no separate listener: a reconnect
      // cycle always terminates in either 'error:recovered' (handled below)
      // or 'error:reconnect-exhausted', and the provider always follows
      // exhaustion with a final fatal 'error', which the handler above
      // renders through show() - that clears the reconnecting presentation
      // and re-enables Try Again.
      reconnectingUnsubscribe = api.on('error:reconnecting', () => {
        errorOverlay?.showReconnecting();
      });

      // Hide the overlay as soon as playback recovers
      recoveredUnsubscribe = api.on('error:recovered', () => {
        errorOverlay?.hide();
      });

      // Big play button, over the poster. Rendered into the container like
      // the error overlay rather than into a control-bar slot: it is an
      // overlay on the picture, not a control in the bar. It asks the overlay
      // whether it is showing, because `error` state alone cannot tell a live
      // error from one the viewer already dismissed.
      if (showBigPlayButton) {
        bigPlayButton = new BigPlayButton(api, () => errorOverlay?.isVisible() ?? false);
        container.appendChild(bigPlayButton.render());
      }

      // Create progress bar (positioned above controls)
      progressBar = new ProgressBar(api);
      container.appendChild(progressBar.render());
      // Only show initially if not already playing (autoplay case)
      if (!isPlaying) {
        progressBar.show();
      }

      // Create control bar
      controlBar = document.createElement('div');
      // Hide controls initially if already playing (autoplay case)
      controlBar.className = isPlaying
        ? 'sp-controls sp-controls--hidden'
        : 'sp-controls sp-controls--visible';
      controlBar.setAttribute('role', 'toolbar');
      controlBar.setAttribute('aria-label', 'Video controls');

      // Create controls (excluding progress bar which is separate)
      populateControlBar();

      container.appendChild(controlBar);

      // Read the bar's own box once, now that it is in the document: the fit
      // needs the padding to know the inner width and the gap to know what each
      // item really costs, and a host is free to restyle both. The constants are
      // this stylesheet's own values, for environments that cannot resolve a
      // computed style.
      const barStyle = getComputedStyle(controlBar);
      const paddingLeft = parseFloat(barStyle.paddingLeft);
      const paddingRight = parseFloat(barStyle.paddingRight);
      const gap = parseFloat(barStyle.columnGap || barStyle.gap);
      barPaddingX =
        Number.isFinite(paddingLeft) && Number.isFinite(paddingRight)
          ? paddingLeft + paddingRight
          : FALLBACK_BAR_PADDING_X;
      barGap = Number.isFinite(gap) ? gap : FALLBACK_BAR_GAP;

      // One observer for both jobs: refitting the bar and bounding the menus.
      // Guarded because jsdom has no ResizeObserver; without it the fit still
      // runs at init and whenever a control shows or hides itself, which is
      // every case except the player being resized after load.
      if (responsive && typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver((observed) => {
          applyMenuBounds(observed[0]?.contentRect.height ?? container.clientHeight);

          // Coalesced into the render frame the plugin already schedules,
          // rather than measuring inside the observer callback.
          fitPending = true;
          scheduleUpdate();
        });
        resizeObserver.observe(container);
      }

      // Plugin init order is not guaranteed, so a control this layout asks for
      // may register after the bar was already built. Rebuild when that happens.
      controlRegistryUnsubscribe = onControlRegistered((id) => {
        if (!layout.includes(id)) {
          return;
        }

        api.logger.debug(`Control "${id}" registered after init, rebuilding control bar`);
        rebuildControlBar();
      });

      // Set up interaction handlers
      container.addEventListener('pointerdown', handlePointerActivity, { passive: true });
      container.addEventListener('pointermove', handlePointerActivity, { passive: true });
      container.addEventListener('mousemove', handleInteraction);
      container.addEventListener('mouseenter', handleInteraction);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('touchstart', handleInteraction, { passive: true });
      container.addEventListener('click', handleInteraction);
      document.addEventListener('keydown', handleKeyDown);

      // Subscribe to state changes (coalesced to one render per frame)
      stateUnsubscribe = api.subscribeToState(scheduleUpdate);

      // Listen for fullscreen changes
      document.addEventListener('fullscreenchange', scheduleUpdate);

      // Initial update (synchronous so controls are correct on first paint)
      updateControls();

      // Make container focusable for keyboard events
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '0');
      }

      // Initialize controls visibility based on playing state
      controlsVisible = !isPlaying;
      api.setState('controlsVisible', controlsVisible);

      // Start hide timer if already playing (autoplay case)
      if (isPlaying) {
        resetHideTimer();
      }

      api.logger.debug('UI controls plugin initialized');
    },

    async destroy(): Promise<void> {
      // Clear timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      // Cancel any queued render
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }

      resizeObserver?.disconnect();
      resizeObserver = null;

      // The container belongs to the host and may be reused for a second
      // player, which would read this one's menu bound until its own observer
      // first fires.
      api?.container?.style.removeProperty('--sp-menu-max-height');

      // Remove state subscription
      stateUnsubscribe?.();
      stateUnsubscribe = null;

      // Remove error listeners
      errorUnsubscribe?.();
      errorUnsubscribe = null;
      reconnectingUnsubscribe?.();
      reconnectingUnsubscribe = null;
      recoveredUnsubscribe?.();
      recoveredUnsubscribe = null;

      // Remove event listeners
      if (api?.container) {
        api.container.removeEventListener('pointerdown', handlePointerActivity);
        api.container.removeEventListener('pointermove', handlePointerActivity);
        api.container.removeEventListener('mousemove', handleInteraction);
        api.container.removeEventListener('mouseenter', handleInteraction);
        api.container.removeEventListener('mouseleave', handleMouseLeave);
        api.container.removeEventListener('touchstart', handleInteraction);
        api.container.removeEventListener('click', handleInteraction);
      }
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', scheduleUpdate);

      controlRegistryUnsubscribe?.();
      controlRegistryUnsubscribe = null;

      // Destroy controls (the overflow tray is one of them)
      controls.forEach((c) => c.destroy());
      controls = [];
      entries = [];
      timeEntry = null;
      tray = null;

      // Destroy progress bar
      progressBar?.destroy();
      progressBar = null;

      // Destroy error overlay
      errorOverlay?.destroy();
      errorOverlay = null;

      // Destroy big play button
      bigPlayButton?.destroy();
      bigPlayButton = null;

      // Remove DOM elements
      controlBar?.remove();
      controlBar = null;
      gradient?.remove();
      gradient = null;
      bufferingIndicator?.remove();
      bufferingIndicator = null;
      styleEl?.remove();
      styleEl = null;

      api?.logger.debug('UI controls plugin destroyed');
    },

    // Public API
    show(): void {
      showControls();
    },

    hide(): void {
      // Force hide even when paused
      controlsVisible = false;
      controlBar?.classList.remove('sp-controls--visible');
      controlBar?.classList.add('sp-controls--hidden');
      gradient?.classList.remove('sp-gradient--visible');
      progressBar?.hide();
      api?.setState('controlsVisible', false);
    },

    setTheme(theme: ThemeConfig): void {
      const root = api?.container || document.documentElement;

      if (theme.primaryColor) {
        root.style.setProperty('--sp-color', theme.primaryColor);
      }
      if (theme.accentColor) {
        root.style.setProperty('--sp-accent', theme.accentColor);
      }
      if (theme.backgroundColor) {
        root.style.setProperty('--sp-bg', theme.backgroundColor);
      }
      if (theme.controlBarHeight) {
        root.style.setProperty('--sp-control-height', `${theme.controlBarHeight}px`);
      }
      if (theme.iconSize) {
        root.style.setProperty('--sp-icon-size', `${theme.iconSize}px`);
      }
    },

    getControlBar(): HTMLElement | null {
      return controlBar;
    },
  };
}

export default uiPlugin;
