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
  let castContext: CastFramework.CastContext | null = null;
  let currentSession: CastFramework.CastSession | null = null;
  let remotePlayer: CastFramework.RemotePlayer | null = null;
  let remotePlayerController: CastFramework.RemotePlayerController | null = null;

  // Track local state for resume on disconnect
  let localTimeBeforeCast = 0;
  let localSrcBeforeCast = '';

  // Track previous isMediaLoaded state for media-ended detection
  let previousIsMediaLoaded = false;

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
    const available = event.castState !== window.cast!.framework.CastState.NO_DEVICES_AVAILABLE;
    api.setState('chromecastAvailable', available);
    api.emit(available ? 'chromecast:available' : 'chromecast:unavailable', undefined);
    api.logger.debug('Cast state changed', { castState: event.castState, available });
  };

  /**
   * Handle session state changes (connect/disconnect).
   */
  const handleSessionStateChange = (event: CastFramework.SessionStateEventData): void => {
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
      api.logger.debug('Media loaded on Chromecast', { src, startTime });
    } catch (error) {
      api.logger.error('Failed to load media on Chromecast', { error });
      api.emit('chromecast:error', { error: error as Error } as ChromecastErrorEvent);
    }
  };

  /**
   * Handle remote player state changes.
   * Detects media ended via playerState == 'IDLE' with idleReason == 'FINISHED'.
   */
  const handleRemotePlayerChange = (): void => {
    if (!remotePlayer) return;

    // Only sync state when connected
    if (!api.getState('chromecastActive')) return;

    // Detect media ended on Cast device via playerState.
    // The previous approach used isMediaLoaded transitions (true -> false),
    // which fired prematurely when a remote paused the stream.
    const mediaInfo = (remotePlayer as any).mediaInfo;
    if (mediaInfo?.playerState === 'IDLE' && mediaInfo?.idleReason === 'FINISHED') {
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

      // Initialize state
      api.setState('chromecastAvailable', false);
      api.setState('chromecastActive', false);

      // Listen for media:load-request - when Chromecast is active, load on Cast device
      const unsubLoadRequest = api.on('media:load-request', async ({ src }) => {
        if (!api.getState('chromecastActive')) return;
        await loadMediaOnCast(src, 0);
      });

      // Command interception: when Chromecast is active, route play/pause/seek
      // to the remote player instead of the local element.
      const unsubPlay = api.on('playback:play', () => {
        if (!api.getState('chromecastActive')) return;
        if (remotePlayer?.isPaused && remotePlayerController) {
          remotePlayerController.playOrPause();
        }
      });

      const unsubPause = api.on('playback:pause', () => {
        if (!api.getState('chromecastActive')) return;
        if (remotePlayer && !remotePlayer.isPaused && remotePlayerController) {
          remotePlayerController.playOrPause();
        }
      });

      const unsubSeek = api.on('playback:seeking', ({ time }: { time: number }) => {
        if (!api.getState('chromecastActive')) return;
        if (remotePlayer && remotePlayerController) {
          remotePlayer.currentTime = time;
          remotePlayerController.seek();
        }
      });

      // Register cleanup for listeners
      api.onDestroy(() => {
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
        initCastApi();
        api.logger.debug('Chromecast plugin initialized');
      } catch (error) {
        // Cast SDK failed to load - not a fatal error
        api.logger.warn('Failed to load Cast SDK', { error });
        api.emit('chromecast:error', { error: error as Error } as ChromecastErrorEvent);
      }
    },

    async destroy(): Promise<void> {
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
      if (currentSession) {
        currentSession.endSession(true);
      }
    },

    isAvailable(): boolean {
      return api?.getState('chromecastAvailable') === true;
    },

    isConnected(): boolean {
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
