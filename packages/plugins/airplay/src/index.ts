/**
 * AirPlay Plugin for Scarlett Player
 *
 * Wraps Safari's native AirPlay APIs for wireless playback.
 * Gracefully degrades to no-op on non-Safari browsers.
 *
 * @packageDocumentation
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type {
  IAirPlayPlugin,
  RemotePlaybackLike,
  WebkitVideoElement,
  WebkitPlaybackTargetAvailabilityEvent,
} from './types';
import { PKG_VERSION } from './version';

export type { IAirPlayPlugin, AirPlayAvailabilityEvent, AirPlayConnectionEvent } from './types';

/**
 * Check if AirPlay is supported (Safari only).
 */
export function isAirPlaySupported(): boolean {
  return (
    typeof HTMLVideoElement !== 'undefined' &&
    typeof (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker ===
      'function'
  );
}

/**
 * Create an AirPlay plugin instance.
 *
 * @example
 * ```ts
 * import { createPlayer } from '@scarlett-player/core';
 * import { airplayPlugin } from '@scarlett-player/airplay';
 *
 * const player = await createPlayer({
 *   container: '#player',
 *   plugins: [airplayPlugin()],
 * });
 *
 * // Show AirPlay picker
 * const airplay = player.getPlugin<IAirPlayPlugin>('airplay');
 * if (airplay?.isAvailable()) {
 *   airplay.showPicker();
 * }
 * ```
 */
export function airplayPlugin(): IAirPlayPlugin {
  let api: IPluginAPI;
  let video: WebkitVideoElement | null = null;
  let unsubMediaLoaded: (() => void) | null = null;

  /** The remote-playback watch currently held, so destroy() can cancel it. */
  let availabilityWatch: { remote: RemotePlaybackLike; id: number } | null = null;

  /**
   * Bumped on every attach/detach.
   *
   * `watchAvailability()` resolves asynchronously, and by then the element it
   * was started on may already have been replaced. The generation says whether
   * the id coming back is still wanted or should be cancelled on arrival.
   */
  let watchGeneration = 0;

  const handleAvailabilityChange = (e: Event): void => {
    const event = e as WebkitPlaybackTargetAvailabilityEvent;
    const available = event.availability === 'available';
    api.setState('airplayAvailable', available);
    api.emit(available ? 'airplay:available' : 'airplay:unavailable', undefined);
    api.logger.debug('AirPlay availability changed', { available });
  };

  /**
   * Move to native HLS now that AirPlay is actually connected.
   *
   * Deliberately NOT done before opening the picker. Switching up front left a
   * viewer who cancelled the picker stuck on native HLS - no quality menu, no
   * hls.js recovery - for the rest of the session, with nothing to switch them
   * back, because no connection event ever arrived.
   */
  const switchToNativeForAirPlay = (): void => {
    const hlsPlugin = api?.getPlugin<{
      isNativeHLS(): boolean;
      switchToNative(): Promise<void>;
    }>('hls-provider');

    if (!hlsPlugin || hlsPlugin.isNativeHLS()) return;

    api.logger.info('AirPlay connected, switching to native HLS');
    hlsPlugin
      .switchToNative()
      .then(() => {
        // The provider may have replaced the element.
        attachToVideo();
      })
      .catch((err: unknown) => {
        api.logger.warn('Failed to switch to native HLS for AirPlay', { error: err });
      });
  };

  const handleTargetChange = (): void => {
    const active = video?.webkitCurrentPlaybackTargetIsWireless === true;
    const wasActive = api.getState('airplayActive');
    api.setState('airplayActive', active);
    api.emit(active ? 'airplay:connected' : 'airplay:disconnected', undefined);

    // A real connection is the signal to hand playback to the native path.
    if (!wasActive && active) {
      switchToNativeForAirPlay();
      return;
    }

    // When AirPlay disconnects, switch back to hls.js for quality control
    if (wasActive && !active) {
      api.logger.info('AirPlay disconnected, restoring hls.js');
      const hlsPlugin = api.getPlugin<{
        isNativeHLS(): boolean;
        switchToHlsJs(): Promise<void>;
      }>('hls-provider');

      if (hlsPlugin?.isNativeHLS()) {
        hlsPlugin.switchToHlsJs().then(() => {
          // Re-attach to the (potentially new) video element
          attachToVideo();
        }).catch((err: unknown) => {
          api.logger.warn('Failed to switch back to hls.js', { error: err });
        });
      }
    }
  };

  /**
   * Stop watching remote-playback availability, if a watch is held.
   *
   * Without this, every provider swap left another live callback on a detached
   * element, each still writing `airplayAvailable`.
   */
  const cancelAvailabilityWatch = (): void => {
    watchGeneration += 1;

    const watch = availabilityWatch;
    availabilityWatch = null;
    if (!watch) return;

    watch.remote.cancelWatchAvailability(watch.id).catch(() => {
      // Cancelling a watch on an element the browser has already torn down
      // rejects, and there is nothing to recover from.
    });
  };

  /**
   * Drop every listener held on the current element.
   */
  const detachFromVideo = (): void => {
    if (!video) return;

    video.removeEventListener('webkitplaybacktargetavailabilitychanged', handleAvailabilityChange);
    video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleTargetChange);
    cancelAvailabilityWatch();
    video = null;
  };

  /**
   * Bind to the container's current video element.
   *
   * Re-queries every time rather than short-circuiting on a cached reference:
   * a provider swap (hls.js to native, or a new source) replaces the element,
   * and the old code held the first one forever, so AirPlay silently stopped
   * reporting anything after the first `load()`.
   */
  const attachToVideo = (): void => {
    const el = api.container.querySelector('video') as WebkitVideoElement | null;

    if (!el) {
      detachFromVideo();
      api.logger.debug('AirPlay: No video element yet');
      return;
    }

    if (el === video) return;

    detachFromVideo();
    video = el;

    api.logger.debug('AirPlay: Attaching to video element');

    // Listen for AirPlay availability changes
    video.addEventListener(
      'webkitplaybacktargetavailabilitychanged',
      handleAvailabilityChange
    );

    // Listen for AirPlay connection state changes
    video.addEventListener(
      'webkitcurrentplaybacktargetiswirelesschanged',
      handleTargetChange
    );

    // Check if remote playback API is available (alternative detection)
    const remote = (video as unknown as { remote?: RemotePlaybackLike }).remote;
    if (remote) {
      api.logger.debug('AirPlay: RemotePlayback API available');

      const generation = watchGeneration;
      remote
        .watchAvailability((available: boolean) => {
          api.logger.debug('AirPlay: RemotePlayback availability', { available });
          if (available) {
            api.setState('airplayAvailable', true);
            api.emit('airplay:available', undefined);
          }
        })
        .then((id: number) => {
          if (generation !== watchGeneration) {
            // Detached while the watch was starting up.
            remote.cancelWatchAvailability(id).catch(() => {});
            return;
          }

          availabilityWatch = { remote, id };
        })
        .catch((err: Error) => {
          api.logger.debug('AirPlay: RemotePlayback watchAvailability not supported', { error: err.message });
        });
    }
  };

  return {
    id: 'airplay',
    name: 'AirPlay',
    type: 'feature',
    version: PKG_VERSION,

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;

      // Initialize state
      api.setState('airplayAvailable', false);
      api.setState('airplayActive', false);

      if (!isAirPlaySupported()) {
        api.logger.debug('AirPlay not supported in this browser');
        return;
      }

      // Try to attach now (video might already exist)
      attachToVideo();

      // Re-attach on every load: the provider may have replaced the element.
      unsubMediaLoaded = api.on('media:loaded', () => {
        attachToVideo();
      });

      api.logger.debug('AirPlay plugin initialized');
    },

    async destroy(): Promise<void> {
      // Unsubscribe from media:loaded event
      unsubMediaLoaded?.();
      unsubMediaLoaded = null;

      if (isAirPlaySupported()) {
        detachFromVideo();
      }
      video = null;
      api.logger.debug('AirPlay plugin destroyed');
    },

    async showPicker(): Promise<void> {
      if (!isAirPlaySupported()) {
        api?.logger.warn('AirPlay not supported in this browser');
        return;
      }

      // Cheap, and picks up an element the provider replaced since the last load.
      attachToVideo();

      if (!video) {
        api?.logger.warn('Cannot show AirPlay picker: no video element');
        return;
      }

      // Opened with nothing awaited in front of it: Safari only honours the
      // picker from inside the user's click gesture, and an awaited provider
      // switch would have spent that gesture. The switch to native HLS now
      // happens when a device actually connects, so cancelling the picker
      // costs the viewer nothing.
      video.webkitShowPlaybackTargetPicker?.();
    },

    isAvailable(): boolean {
      return api?.getState('airplayAvailable') === true;
    },

    isActive(): boolean {
      return api?.getState('airplayActive') === true;
    },

    stop(): void {
      // AirPlay doesn't have a programmatic stop - user must use system controls
      // or disconnect from the AirPlay device picker
      api?.logger.debug('AirPlay stop requested (use system controls to disconnect)');
    },
  };
}

export default airplayPlugin;
