/**
 * AirPlay Plugin for Scarlett Player
 *
 * Wraps Safari's native AirPlay APIs for wireless playback.
 * Gracefully degrades to no-op on non-Safari browsers.
 *
 * @packageDocumentation
 */

import type { Plugin, IPluginAPI } from '@scarlett-player/core';
import type {
  IAirPlayPlugin,
  WebkitVideoElement,
  WebkitPlaybackTargetAvailabilityEvent,
} from './types';

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
 * import { airplayPlugin } from '@scarlett-player/airplay';
 *
 * const player = new ScarlettPlayer({
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

  const handleAvailabilityChange = (e: Event): void => {
    const event = e as WebkitPlaybackTargetAvailabilityEvent;
    const available = event.availability === 'available';
    api.setState('airplayAvailable', available);
    api.emit(available ? 'airplay:available' : 'airplay:unavailable', undefined);
    api.logger.debug('AirPlay availability changed', { available });
  };

  const handleTargetChange = (): void => {
    const active = video?.webkitCurrentPlaybackTargetIsWireless === true;
    api.setState('airplayActive', active);
    api.emit(active ? 'airplay:connected' : 'airplay:disconnected', undefined);
  };

  const attachToVideo = (): void => {
    // Already attached?
    if (video) return;

    // Get the video element from container
    video = api.container.querySelector('video') as WebkitVideoElement | null;

    if (!video) {
      api.logger.debug('AirPlay: No video element yet');
      return;
    }

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
    if ('remote' in video && (video as any).remote) {
      api.logger.debug('AirPlay: RemotePlayback API available');
      (video as any).remote.watchAvailability((available: boolean) => {
        api.logger.debug('AirPlay: RemotePlayback availability', { available });
        if (available) {
          api.setState('airplayAvailable', true);
          api.emit('airplay:available', undefined);
        }
      }).catch((err: Error) => {
        api.logger.debug('AirPlay: RemotePlayback watchAvailability not supported', { error: err.message });
      });
    }
  };

  return {
    id: 'airplay',
    name: 'AirPlay',
    type: 'feature',
    version: '1.0.0',

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

      // Also listen for media:loaded in case video is created later
      unsubMediaLoaded = api.on('media:loaded', () => {
        attachToVideo();
      });

      api.logger.debug('AirPlay plugin initialized');
    },

    async destroy(): Promise<void> {
      // Unsubscribe from media:loaded event
      unsubMediaLoaded?.();
      unsubMediaLoaded = null;

      if (video && isAirPlaySupported()) {
        video.removeEventListener(
          'webkitplaybacktargetavailabilitychanged',
          handleAvailabilityChange
        );
        video.removeEventListener(
          'webkitcurrentplaybacktargetiswirelesschanged',
          handleTargetChange
        );
      }
      video = null;
      api.logger.debug('AirPlay plugin destroyed');
    },

    async showPicker(): Promise<void> {
      if (!isAirPlaySupported()) {
        api?.logger.warn('AirPlay not supported in this browser');
        return;
      }

      // Try to attach if not yet attached
      if (!video) {
        attachToVideo();
      }

      if (!video) {
        api?.logger.warn('Cannot show AirPlay picker: no video element');
        return;
      }

      // Switch to native HLS before showing picker (required for AirPlay)
      const hlsPlugin = api?.getPlugin<{
        isNativeHLS(): boolean;
        switchToNative(): Promise<void>;
      }>('hls-provider');

      if (hlsPlugin && !hlsPlugin.isNativeHLS()) {
        api?.logger.info('Switching to native HLS for AirPlay compatibility');
        await hlsPlugin.switchToNative();

        // Re-attach to video after switch (video element may be recreated)
        video = null;
        attachToVideo();
      }

      video?.webkitShowPlaybackTargetPicker?.();
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
