/**
 * UI Controls Plugin for Scarlett Player
 *
 * Provides a complete, themeable video player control interface.
 * Modern design with progress bar above controls.
 *
 * @packageDocumentation
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type {
  IUIPlugin,
  ControlSlot,
  ThemeConfig,
  UIPluginConfig,
} from './types';
import type { Control } from './controls';
import { styles } from './styles';
import { icons } from './icons';
import {
  PlayButton,
  ProgressBar,
  TimeDisplay,
  VolumeControl,
  LiveIndicator,
  QualityMenu,
  CastButton,
  PipButton,
  FullscreenButton,
  Spacer,
} from './controls';

export type {
  IUIPlugin,
  ControlSlot,
  LayoutConfig,
  ThemeConfig,
  UIPluginConfig,
  Control,
} from './types';
export { icons } from './icons';
export { styles } from './styles';
export { formatTime, formatLiveTime } from './utils';

/** Default control layout (progress bar is separate, above controls) */
const DEFAULT_LAYOUT: ControlSlot[] = [
  'play',
  'volume',
  'time',
  'live-indicator',
  'spacer',
  'quality',
  'chromecast',
  'airplay',
  'pip',
  'fullscreen',
];

/** Default hide delay in ms */
const DEFAULT_HIDE_DELAY = 3000;

/**
 * Create a UI controls plugin instance.
 *
 * @example
 * ```ts
 * import { uiPlugin } from '@scarlett-player/ui';
 *
 * const player = new ScarlettPlayer({
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
  let styleEl: HTMLStyleElement | null = null;
  let controls: Control[] = [];
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let stateUnsubscribe: (() => void) | null = null;
  let controlsVisible = true;

  const layout = config.controls || DEFAULT_LAYOUT;
  const hideDelay = config.hideDelay ?? DEFAULT_HIDE_DELAY;

  /**
   * Create a control instance for a given slot.
   */
  const createControl = (slot: ControlSlot): Control | null => {
    switch (slot) {
      case 'play':
        return new PlayButton(api);
      case 'volume':
        return new VolumeControl(api);
      case 'progress':
        // Progress bar is now created separately
        return null;
      case 'time':
        return new TimeDisplay(api);
      case 'live-indicator':
        return new LiveIndicator(api);
      case 'quality':
        return new QualityMenu(api);
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
      default:
        return null;
    }
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

  /**
   * Handle mouse/touch interaction.
   */
  const handleInteraction = (): void => {
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

    const video = api.container.querySelector('video');
    if (!video) return;

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        video.paused ? video.play() : video.pause();
        break;
      case 'm':
        e.preventDefault();
        video.muted = !video.muted;
        break;
      case 'f':
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          api.container.requestFullscreen?.();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        showControls();
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
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
    version: '1.0.0',

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
      for (const slot of layout) {
        const control = createControl(slot);
        if (control) {
          controls.push(control);
          controlBar.appendChild(control.render());
        }
      }

      container.appendChild(controlBar);

      // Set up interaction handlers
      container.addEventListener('mousemove', handleInteraction);
      container.addEventListener('mouseenter', handleInteraction);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('touchstart', handleInteraction, { passive: true });
      container.addEventListener('click', handleInteraction);
      document.addEventListener('keydown', handleKeyDown);

      // Subscribe to state changes
      stateUnsubscribe = api.subscribeToState(updateControls);

      // Listen for fullscreen changes
      document.addEventListener('fullscreenchange', updateControls);

      // Initial update
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

      // Remove state subscription
      stateUnsubscribe?.();
      stateUnsubscribe = null;

      // Remove event listeners
      if (api?.container) {
        api.container.removeEventListener('mousemove', handleInteraction);
        api.container.removeEventListener('mouseenter', handleInteraction);
        api.container.removeEventListener('mouseleave', handleMouseLeave);
        api.container.removeEventListener('touchstart', handleInteraction);
        api.container.removeEventListener('click', handleInteraction);
      }
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', updateControls);

      // Destroy controls
      controls.forEach((c) => c.destroy());
      controls = [];

      // Destroy progress bar
      progressBar?.destroy();
      progressBar = null;

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
