/**
 * Gestures Plugin for Scarlett Player
 *
 * Double-tap the right of the picture to jump forward, the left to jump back,
 * and keep tapping to go further. This is the interaction every phone viewer
 * already knows from YouTube, and on a PPV stream watched mostly on phones it
 * is the difference between scrubbing blind and landing where you meant to.
 *
 * Touch only, by input type rather than user agent: a mouse or pen never
 * triggers any of it, so desktop behaviour is unchanged.
 *
 * @example
 * ```ts
 * import { createPlayer } from '@scarlett-player/core';
 * import { createGesturesPlugin } from '@scarlett-player/gestures';
 *
 * const player = await createPlayer({
 *   container: '#player',
 *   plugins: [uiPlugin(), createGesturesPlugin({ seekSeconds: 10 })],
 * });
 * ```
 */

import type { IPluginAPI, Plugin, PluginType } from '@scarlett-player/core';
import type { GesturesPluginConfig, GestureZone, PointerRecord } from './types';
import { createRecognizer, DEFAULT_RECOGNIZER_OPTIONS } from './recognizer';
import type { Recognizer } from './recognizer';
import { GestureOverlay } from './overlay';
import { PKG_VERSION } from './version';

export type { GesturesPluginConfig, GestureZone, PointerRecord, RecognizerEvent } from './types';
export { createRecognizer, zoneFor, DEFAULT_RECOGNIZER_OPTIONS } from './recognizer';
export type { Recognizer } from './recognizer';
export { GestureOverlay } from './overlay';

/** Public surface, including the ownership hook the UI package checks. */
export interface GesturesPlugin extends Plugin {
  /**
   * Whether this plugin is handling taps right now.
   *
   * The UI package calls this before running its own show-controls logic on a
   * touch interaction. Structural check, no package dependency in either
   * direction.
   */
  ownsTapInteraction(): boolean;
}

/**
 * Does this device have a coarse pointer?
 *
 * Used only for the `'auto'` default. Per-gesture filtering still checks
 * `pointerType`, so a hybrid laptop behaves correctly with either input.
 *
 * @returns true when the primary pointer is coarse
 */
function hasCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * Create a Gestures Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Gestures Plugin instance
 */
export function createGesturesPlugin(config: GesturesPluginConfig = {}): GesturesPlugin {
  let api: IPluginAPI | null = null;
  let overlay: GestureOverlay | null = null;
  let recognizer: Recognizer | null = null;
  let active = false;
  /** Seconds this accumulation run has moved so far, for the cumulative label. */
  let runSeconds = 0;
  /** Set while a tap could still turn into a double tap, so controls do not flash. */
  let pendingHide: ReturnType<typeof setTimeout> | null = null;

  const seekSeconds = config.seekSeconds ?? 10;
  const doubleTapWindowMs = config.doubleTapWindowMs ?? DEFAULT_RECOGNIZER_OPTIONS.doubleTapWindowMs;
  const leftZone = config.zones?.left ?? DEFAULT_RECOGNIZER_OPTIONS.leftZone;
  const rightZone = config.zones?.right ?? DEFAULT_RECOGNIZER_OPTIONS.rightZone;
  const feedback = config.feedback !== false;
  const haptics = config.haptics !== false;
  const tapToToggleControls = config.tapToToggleControls !== false;

  /**
   * Whether seeking by gesture is allowed at all right now.
   *
   * Live without a DVR window has nowhere to seek to, and while casting the
   * local video element is not the surface the viewer is watching.
   */
  const canSeek = (): boolean => {
    if (!api) return false;

    if (api.getState('chromecastActive') || api.getState('airplayActive')) return false;

    const live = api.getState('live');
    const seekableRange = api.getState('seekableRange');

    if (live && !seekableRange) return false;

    const duration = api.getState('duration');
    if (!live && (!duration || !Number.isFinite(duration))) return false;

    return true;
  };

  /**
   * Apply a seek step, clamped to the media.
   *
   * @param zone - Which side was tapped
   * @returns true when the playhead actually moved
   */
  const applySeek = (zone: GestureZone): boolean => {
    if (!api || zone === 'middle') return false;

    const video = api.container.querySelector('video');
    if (!video) return false;

    const delta = zone === 'right' ? seekSeconds : -seekSeconds;
    const live = api.getState('live');
    const seekableRange = api.getState('seekableRange');
    const current = video.currentTime;

    let target: number;

    if (live && seekableRange) {
      target = Math.max(seekableRange.start, Math.min(seekableRange.end, current + delta));

      // Forward at the live edge is not a failure, it is the viewer already
      // being live. Say so rather than showing a ripple that did nothing.
      if (zone === 'right' && target <= current) {
        overlay?.announceLiveEdge();
        return false;
      }
    } else {
      const duration = video.duration;
      const max = Number.isFinite(duration) && duration > 0 ? duration - 0.25 : current;
      target = Math.max(0, Math.min(max, current + delta));
    }

    video.currentTime = target;
    api.emit('playback:seeking', { time: target });

    if (haptics && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }

    return true;
  };

  /** Get the UI plugin, when one is installed, without importing it. */
  const ui = (): { show(): void; hide(): void } | null =>
    api?.getPlugin<{ show(): void; hide(): void }>('ui-controls') ?? null;

  const clearPendingHide = (): void => {
    if (pendingHide) {
      clearTimeout(pendingHide);
      pendingHide = null;
    }
  };

  /**
   * Single tap: toggle the controls, with the asymmetry that keeps the player
   * feeling instant. Showing is non-destructive so it happens immediately;
   * hiding waits out the double-tap window so a seek is never preceded by the
   * controls blinking away.
   */
  const handleTap = (): void => {
    if (!tapToToggleControls || !api) return;

    const controls = ui();
    if (!controls) return;

    // `controlsVisible` is the key the UI package actually writes in
    // showControls(). `interacting` is a different thing (pointer activity) and
    // reading it here made tap-to-hide silently never fire.
    const visible = Boolean(api.getState('controlsVisible'));
    const paused = Boolean(api.getState('paused'));

    if (!visible) {
      controls.show();
      return;
    }

    // While paused the controls stay up, matching the existing desktop guard.
    if (paused) return;

    clearPendingHide();
    pendingHide = setTimeout(() => {
      pendingHide = null;
      controls.hide();
    }, doubleTapWindowMs);
  };

  const handleSeekStep = (zone: GestureZone): void => {
    clearPendingHide();

    if (!canSeek()) return;

    const moved = applySeek(zone);
    if (!moved) return;

    runSeconds += seekSeconds;
    overlay?.showSeek(zone, runSeconds);
    api?.emit('gesture:seek', {
      direction: zone === 'right' ? 'forward' : 'backward',
      seconds: seekSeconds,
      cumulative: runSeconds,
    });
  };

  const onPointer = (record: PointerRecord): void => {
    if (!recognizer) return;

    for (const event of recognizer.handle(record)) {
      switch (event.type) {
        case 'tap':
          api?.emit('gesture:tap', { zone: event.zone });
          handleTap();
          break;

        case 'double-tap':
          runSeconds = 0;
          handleSeekStep(event.zone);
          break;

        case 'accumulate':
          handleSeekStep(event.zone);
          break;

        case 'cancel':
          runSeconds = 0;
          clearPendingHide();
          break;
      }
    }
  };

  return {
    id: 'gestures',
    name: 'Gestures',
    version: PKG_VERSION,
    type: 'feature' as PluginType,

    init(pluginApi: IPluginAPI): void {
      api = pluginApi;

      const enabled = config.enabled ?? 'auto';
      active = enabled === 'auto' ? hasCoarsePointer() : Boolean(enabled);

      if (!active) {
        api.logger.debug('[gestures] no coarse pointer, gesture surface not installed');
        return;
      }

      // Audio has its own compact surface with no picture to tap.
      if (api.getState('mediaType') === 'audio') {
        active = false;
        return;
      }

      recognizer = createRecognizer({
        doubleTapWindowMs,
        accumulationWindowMs: config.accumulationWindowMs,
        leftZone,
        rightZone,
        slopPx: config.slopPx,
      });

      overlay = new GestureOverlay(api.container, { onPointer, feedback });
      overlay.setZoneWidths(leftZone, rightZone);

      api.onDestroy(() => {
        clearPendingHide();
        overlay?.destroy();
        overlay = null;
        recognizer?.reset();
        recognizer = null;
      });
    },

    destroy(): void {
      clearPendingHide();
      overlay?.destroy();
      overlay = null;
      recognizer?.reset();
      recognizer = null;
      active = false;
      runSeconds = 0;
      api = null;
    },

    ownsTapInteraction(): boolean {
      return active && tapToToggleControls;
    },
  };
}

export default createGesturesPlugin;
