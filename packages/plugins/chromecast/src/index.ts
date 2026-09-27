/**
 * Chromecast Plugin for Scarlett Player
 *
 * Enables casting video to Chromecast devices using Google Cast SDK.
 * SDK is loaded dynamically when plugin initializes.
 *
 * @packageDocumentation
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { loadCastSDK, isCastSupported } from './cast-loader';
import type {
  IChromecastPlugin,
  CastFramework,
  ChromecastConnectedEvent,
  ChromecastErrorEvent,
} from './types';

export type {
  IChromecastPlugin,
  ChromecastConnectedEvent,
  ChromecastErrorEvent,
} from './types';
import { PKG_VERSION } from './version';
export { loadCastSDK, isCastSDKLoaded, isCastSupported } from './cast-loader';

/**
 * Create a Chromecast plugin instance.
 *
 * @example
 * ```ts
 * import { createPlayer } from '@scarlett-player/core';
 * import { chromecastPlugin } from '@scarlett-player/chromecast';
 *
 * const player = await createPlayer({
 *   container: '#player',
 *   plugins: [chromecastPlugin()],
 * });
 *
 * // Request cast session
 * const chromecast = player.getPlugin<IChromecastPlugin>('chromecast');
 * if (chromecast?.isAvailable()) {
 *   await chromecast.requestSession();
 * }
 * ```
 */
export function chromecastPlugin(): IChromecastPlugin {
  let api: IPluginAPI;

  /**
   * True once the player is being destroyed.
   *
   * Core destroys the StateManager right after the plugins, and any read or
   * write after that throws `Manager is destroyed` on purpose. The SDK can
   * still deliver a queued callback after destroy() removed its listener, and
   * a host can poll the getters late, so every path that can run after
   * teardown checks this before touching state (same guard as the AirPlay
   * plugin, Sentry TSP-WEB-2HT).
   *
   * Set by destroy(), and also by `player:destroy`: a player destroyed while
   * init() still awaits the SDK never calls destroy() on this plugin (core's
   * PluginManager skips a plugin that is not `ready` yet).
   */
  let destroyed = false;
  let castContext: CastFramework.CastContext | null = null;
  let currentSession: CastFramework.CastSession | null = null;
  let remotePlayer: CastFramework.RemotePlayer | null = null;
  let remotePlayerController: CastFramework.RemotePlayerController | null = null;

  // Track local state for resume on disconnect
  let localTimeBeforeCast = 0;
  let localSrcBeforeCast = '';

  // Event handler references for cleanup
  let castStateHandler: ((event: CastFramework.CastStateEventData) => void) | null = null;
  let sessionStateHandler: ((event: CastFramework.SessionStateEventData) => void) | null = null;
  let remotePlayerHandler: ((event: CastFramework.RemotePlayerChangedEvent) => void) | null = null;

  /**
   * Initialize the Cast API after SDK is loaded.
   */
  const initCastApi = (): void => {
    if (!window.cast?.framework) {
      api.logger.error('Cast framework not available');
      return;
    }

    castContext = window.cast.framework.CastContext.getInstance();

    // Configure cast options
    castContext.setOptions({
      receiverApplicationId: window.chrome!.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: window.chrome!.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });

    // Create remote player for controlling cast playback
    remotePlayer = new window.cast.framework.RemotePlayer();
    remotePlayerController = new window.cast.framework.RemotePlayerController(remotePlayer);

    // Set up event handlers
    castStateHandler = handleCastStateChange;
    sessionStateHandler = handleSessionStateChange;
    remotePlayerHandler = handleRemotePlayerChange;

    // Listen for cast state (device availability)
    castContext.addEventListener(
      window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
      castStateHandler as any
    );

    // Listen for session state changes
    castContext.addEventListener(
      window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      sessionStateHandler as any
    );

    // Sync remote player state
    remotePlayerController.addEventListener(
      window.cast.framework.RemotePlayerEventType.ANY_CHANGE,
      remotePlayerHandler as any
    );

    // Also listen specifically for IS_MEDIA_LOADED_CHANGED for reliable media-ended detection
    remotePlayerController.addEventListener(
      window.cast.framework.RemotePlayerEventType.IS_MEDIA_LOADED_CHANGED,
      remotePlayerHandler as any
    );

    // Check initial cast state
    const initialState = castContext.getCastState();
    const available = initialState !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE;
    api.setState('chromecastAvailable', available);

    api.logger.debug('Cast API initialized', { available });
  };

  /**
   * Handle cast device availability changes.
   */
  const handleCastStateChange = (event: CastFramework.CastStateEventData): void => {
    if (destroyed) return;
    const available = event.castState !== window.cast!.framework.CastState.NO_DEVICES_AVAILABLE;
    api.setState('chromecastAvailable', available);
    api.emit(available ? 'chromecast:available' : 'chromecast:unavailable', undefined);
    api.logger.debug('Cast state changed', { castState: event.castState, available });
  };

  /**
   * Handle session state changes (connect/disconnect).
   */
  const handleSessionStateChange = (event: CastFramework.SessionStateEventData): void => {
    if (destroyed) return;
    const SessionState = window.cast!.framework.SessionState;

    switch (event.sessionState) {
      case SessionState.SESSION_STARTED:
        currentSession = castContext!.getCurrentSession();
        onSessionConnected();
        break;

      case SessionState.SESSION_RESUMED:
        currentSession = castContext!.getCurrentSession();
        onSessionResumed();
        break;

      case SessionState.SESSION_ENDED:
        onSessionDisconnected();
        currentSession = null;
        break;

      case SessionState.SESSION_START_FAILED:
        api.emit('chromecast:error', {
          error: new Error('Failed to start cast session'),
        } as ChromecastErrorEvent);
        break;
    }
  };

  /**
   * Handle session connected.
   */
  const onSessionConnected = (): void => {
    if (!currentSession) return;

    const deviceName = currentSession.getCastDevice()?.friendlyName || 'Chromecast';

    api.setState('chromecastActive', true);
    api.emit('chromecast:connected', { deviceName } as ChromecastConnectedEvent);

    api.logger.info('Chromecast connected', { deviceName });

    // Store local state for resume
    localTimeBeforeCast = api.getState('currentTime') || 0;
    const source = api.getState('source');
    localSrcBeforeCast = source?.src || '';

    // Pause local video
    const video = api.container.querySelector('video');
    if (video) {
      video.pause();
    }

    // Load media on cast device
    if (localSrcBeforeCast) {
      loadMediaOnCast(localSrcBeforeCast, localTimeBeforeCast);
    }
  };

  /**
   * Handle session resumed (reconnecting to existing session).
   * Unlike onSessionConnected, this does NOT reload media since
   * the cast device is already playing.
   */
  const onSessionResumed = (): void => {
    if (!currentSession) return;

    const deviceName = currentSession.getCastDevice()?.friendlyName || 'Chromecast';

    api.setState('chromecastActive', true);
    api.emit('chromecast:connected', { deviceName } as ChromecastConnectedEvent);

    api.logger.info('Chromecast session resumed', { deviceName });

    // Pause local video (cast device is already playing)
    const video = api.container.querySelector('video');
    if (video) {
      video.pause();
    }
  };

  /**
   * Handle session disconnected.
   */
  const onSessionDisconnected = (): void => {
    // Get cast position before disconnect
    const castTime = remotePlayer?.currentTime || localTimeBeforeCast;

    api.setState('chromecastActive', false);
    api.emit('chromecast:disconnected', undefined);

    api.logger.info('Chromecast disconnected', { resumeTime: castTime });

    // Skip local seek for live streams — the cast position may be outside
    // the DVR window, and seeking there would confuse hls.js.
    const isLive = api.getState('live');

    // Resume local playback at cast position (VOD only)
    const video = api.container.querySelector('video');
    if (video && castTime > 0 && !isLive) {
      video.currentTime = castTime;
      video.play().catch(() => {
        // Autoplay may be blocked
        api.logger.debug('Autoplay blocked on cast disconnect');
      });
    }
  };

  /**
   * Load media on cast device.
   */
  const loadMediaOnCast = async (src: string, startTime: number): Promise<void> => {
    if (!currentSession || !window.chrome?.cast) return;

    // Determine content type
    const contentType = src.includes('.m3u8')
      ? 'application/x-mpegurl'
      : src.includes('.mpd')
        ? 'application/dash+xml'
        : 'video/mp4';

    const mediaInfo = new window.chrome.cast.media.MediaInfo(src, contentType);

    // Add metadata from player state (title, poster, subtitle)
    const title = api.getState('title');
    const poster = api.getState('poster');
    if (title || poster) {
      const metadata = new window.chrome.cast.media.GenericMediaMetadata();
      if (title) metadata.title = title;
      if (poster) metadata.images = [new window.chrome.cast.Image(poster)];
      mediaInfo.metadata = metadata;
    }

    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
    request.currentTime = startTime;
    request.autoplay = true;

    try {
      await currentSession.loadMedia(request);
      if (destroyed) return;
      api.logger.debug('Media loaded on Chromecast', { src, startTime });
    } catch (error) {
      // No chromecast:error for a player that is gone.
      if (destroyed) return;
      api.logger.error('Failed to load media on Chromecast', { error });
      api.emit('chromecast:error', { error: error as Error } as ChromecastErrorEvent);
    }
  };

  /**
   * Handle remote player state changes.
   * Detects media ended via playerState == 'IDLE' with idleReason == 'FINISHED'.
   */
  const handleRemotePlayerChange = (): void => {
    if (destroyed || !remotePlayer) return;

    // Only sync state when connected
    if (!api.getState('chromecastActive')) return;

    // Detect media ended on Cast device via playerState and idleReason
    // on the media session.
    const mediaSession = currentSession?.getMediaSession();
    if (mediaSession?.playerState === 'IDLE' && mediaSession?.idleReason === 'FINISHED') {
      api.logger.debug('Cast media ended (IDLE + FINISHED)');
      api.emit('playback:ended', undefined);
    }

    // Sync cast state to player state
    api.setState('currentTime', remotePlayer.currentTime);
    api.setState('duration', remotePlayer.duration);
    api.setState('playing', !remotePlayer.isPaused);
    api.setState('paused', remotePlayer.isPaused);
    api.setState('volume', remotePlayer.volumeLevel);
    api.setState('muted', remotePlayer.isMuted);
  };

  return {
    id: 'chromecast',
    name: 'Chromecast',
    type: 'feature',
    version: PKG_VERSION,

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      destroyed = false;

      // Initialize state
      api.setState('chromecastAvailable', false);
      api.setState('chromecastActive', false);

      // Listen for media:load-request - when Chromecast is active, load on Cast device
      const unsubLoadRequest = api.on('media:load-request', async ({ src }) => {
        if (destroyed || !api.getState('chromecastActive')) return;
        await loadMediaOnCast(src, 0);
      });

      // Command interception: when Chromecast is active, route play/pause/seek
      // to the remote player instead of the local element.
      const unsubPlay = api.on('playback:play', () => {
        if (destroyed || !api.getState('chromecastActive')) return;
        if (remotePlayer?.isPaused && remotePlayerController) {
          remotePlayerController.playOrPause();
        }
      });

      const unsubPause = api.on('playback:pause', () => {
        if (destroyed || !api.getState('chromecastActive')) return;
        if (remotePlayer && !remotePlayer.isPaused && remotePlayerController) {
          remotePlayerController.playOrPause();
        }
      });

      const unsubSeek = api.on('playback:seeking', ({ time }: { time: number }) => {
        if (destroyed || !api.getState('chromecastActive')) return;
        if (remotePlayer && remotePlayerController) {
          remotePlayer.currentTime = time;
          remotePlayerController.seek();
        }
      });

      // Subscribed before the await below: a player destroyed while the SDK
      // is still loading never calls this plugin's destroy(), and this is
      // the only signal that reaches it. Core emits it before tearing
      // anything down.
      const unsubPlayerDestroy = api.on('player:destroy', () => {
        destroyed = true;
      });

      // Register cleanup for listeners (when the player is destroyed during
      // init this never runs, and the event bus teardown drops them instead)
      api.onDestroy(() => {
        unsubPlayerDestroy();
        unsubLoadRequest();
        unsubPlay();
        unsubPause();
        unsubSeek();
      });

      // Check if Cast is supported in this browser
      if (!isCastSupported()) {
        api.logger.debug('Chromecast not supported in this browser');
        return;
      }

      try {
        await loadCastSDK();
        // The player went away while the SDK loaded: install nothing, and
        // touch no state.
        if (destroyed) return;
        initCastApi();
        api.logger.debug('Chromecast plugin initialized');
      } catch (error) {
        // A load that fails after the player is gone concerns nobody.
        if (destroyed) return;
        // Cast SDK failed to load - not a fatal error
        api.logger.warn('Failed to load Cast SDK', { error });
        api.emit('chromecast:error', { error: error as Error } as ChromecastErrorEvent);
      }
    },

    async destroy(): Promise<void> {
      // First, so an SDK callback fired by the teardown below is already gated.
      destroyed = true;

      // End session gracefully — let the TV continue playback rather than
      // forcibly stopping it. The viewer may want to keep watching on the big
      // screen after navigating away from the player page.
      if (currentSession) {
        try {
          currentSession.endSession(false);
        } catch {
          // Ignore errors during cleanup
        }
      }

      // Remove event listeners (use optional chaining in case SDK was unloaded)
      if (castContext && castStateHandler && window.cast?.framework) {
        castContext.removeEventListener(
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          castStateHandler as any
        );
      }
      if (castContext && sessionStateHandler && window.cast?.framework) {
        castContext.removeEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          sessionStateHandler as any
        );
      }
      if (remotePlayerController && remotePlayerHandler && window.cast?.framework) {
        remotePlayerController.removeEventListener(
          window.cast.framework.RemotePlayerEventType.ANY_CHANGE,
          remotePlayerHandler as any
        );
        remotePlayerController.removeEventListener(
          window.cast.framework.RemotePlayerEventType.IS_MEDIA_LOADED_CHANGED,
          remotePlayerHandler as any
        );
      }

      // Clear references
      castContext = null;
      currentSession = null;
      remotePlayer = null;
      remotePlayerController = null;
      castStateHandler = null;
      sessionStateHandler = null;
      remotePlayerHandler = null;

      api.logger.debug('Chromecast plugin destroyed');
    },

    // Public methods
    async requestSession(): Promise<void> {
      if (!castContext) {
        api?.logger.warn('Cast not available');
        return;
      }
      await castContext.requestSession();
    },

    endSession(): void {
      if (!currentSession) return;

      // The SDK throws synchronously when the session it holds is already gone:
      // a viewer who presses Stop casting after the transport dropped (receiver
      // rebooted, network blip) gets an uncaught error from a button they were
      // right to press (TSP-WEB-2E7, 2026-09-20). The SESSION_ENDED handler
      // catches up with the real state either way, so the throw carries nothing
      // worth surfacing; log it and let the handler finish the job. Mirrors the
      // guard destroy() already has.
      try {
        currentSession.endSession(true);
      } catch (error) {
        api?.logger.debug('Cast session was already gone when ending it', { error });
      }
    },

    isAvailable(): boolean {
      // A torn-down plugin answers "no" rather than throwing from the
      // destroyed StateManager.
      if (destroyed) return false;
      return api?.getState('chromecastAvailable') === true;
    },

    isConnected(): boolean {
      if (destroyed) return false;
      return api?.getState('chromecastActive') === true;
    },

    getDeviceName(): string | null {
      if (!currentSession) return null;
      return currentSession.getCastDevice()?.friendlyName || null;
    },

    play(): void {
      if (remotePlayer?.isPaused && remotePlayerController) {
        remotePlayerController.playOrPause();
      }
    },

    pause(): void {
      if (remotePlayer && !remotePlayer.isPaused && remotePlayerController) {
        remotePlayerController.playOrPause();
      }
    },

    seek(time: number): void {
      if (remotePlayer && remotePlayerController) {
        remotePlayer.currentTime = time;
        remotePlayerController.seek();
      }
    },

    setVolume(level: number): void {
      if (remotePlayer && remotePlayerController) {
        remotePlayer.volumeLevel = Math.max(0, Math.min(1, level));
        remotePlayerController.setVolumeLevel();
      }
    },

    setMuted(muted: boolean): void {
      if (remotePlayer && remotePlayerController) {
        if (remotePlayer.isMuted !== muted) {
          remotePlayerController.muteOrUnmute();
        }
      }
    },
  };
}

export default chromecastPlugin;
