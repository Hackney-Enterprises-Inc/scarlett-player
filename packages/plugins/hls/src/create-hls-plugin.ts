/**
 * Shared HLS provider factory.
 *
 * The full (`index.ts`) and light (`light.ts`) entries are thin wrappers
 * around this one factory, differing only in which hls.js loader module
 * they inject and how they label themselves. Every piece of error
 * handling, retry, reconnect, teardown, and playlist-validation machinery
 * lives here EXACTLY ONCE, so the two builds can never drift apart again
 * (the pre-1.2.0 light build shipped without any of the hardening).
 *
 * Features:
 * - Lazy loading of hls.js
 * - Native HLS fallback for Safari
 * - Quality level management
 * - Error recovery, auto-reconnect, load watchdog
 * - Playlist refresh validation
 * - Live stream support
 */

import { ErrorCode } from '@scarlett-player/core';
import type { IPluginAPI, PluginType, PlayerErrorDetail } from '@scarlett-player/core';
import type {
  HLSPluginConfig,
  HLSQualityLevel,
  HLSError,
  HLSLiveInfo,
  IHLSPlugin,
  HlsInstance,
  HlsConstructor,
} from './types';
import { setupHlsEventHandlers, setupVideoEventHandlers } from './event-map';
import { mapLevels, formatLevel, getInitialBandwidthEstimate } from './quality';
import { createValidatingPlaylistLoader, PLAYLIST_INVALID_TEXT } from './playlist-validation';
import { sanitizeUrl } from './sanitize-url';
import { PKG_VERSION } from './version';

/**
 * The loader-module surface a build variant injects: the full build passes
 * the `hls-loader` namespace, the light build `hls-loader-light`.
 */
export interface HlsLoaderModule {
  /** Whether the browser supports native HLS (Safari/iOS) */
  supportsNativeHLS(): boolean;
  /** Whether HLS playback is supported at all (native or hls.js) */
  isHLSSupported(): boolean;
  /** Whether hls.js (MSE) is supported */
  isHlsJsSupported(): boolean;
  /** Lazily load the hls.js constructor */
  loadHlsJs(): Promise<HlsConstructor>;
  /** Create an hls.js instance (loader must be loaded first) */
  createHlsInstance(config?: Record<string, unknown>): HlsInstance;
  /** Cached hls.js constructor, or null before loadHlsJs() resolves */
  getHlsConstructor(): HlsConstructor | null;
}

/** Build-variant labels for plugin metadata and log lines. */
export interface HlsPluginVariant {
  /** Plugin display name (e.g. "HLS Provider (Light)") */
  name: string;
  /** Plugin description */
  description: string;
  /** Suffix appended to lifecycle log lines ('' or ' (light)') */
  logSuffix: string;
  /** Engine label used in load log lines ('hls.js' or 'hls.js/light') */
  engineLabel: string;
}

/** Default HLS config */
const DEFAULT_CONFIG: HLSPluginConfig = {
  debug: false,
  autoStartLoad: true,
  startPosition: -1,
  lowLatencyMode: false,
  maxBufferLength: 30,
  maxMaxBufferLength: 600,
  backBufferLength: 30,
  enableWorker: true,
  capLevelToPlayerSize: true,
  // Error recovery settings
  maxNetworkRetries: 3,
  maxMediaRetries: 2,
  retryDelayMs: 1000,
  retryBackoffFactor: 2,
  // Load watchdog: never leave the viewer on an endless spinner
  loadTimeoutMs: 30000,
  // Self-healing: reconnect automatically after fatal errors mid-playback
  autoReconnect: true,
  reconnectBaseDelayMs: 2000,
  reconnectMaxDelayMs: 30000,
  reconnectWindowMs: 300000,
  // Never index a malformed live playlist refresh blindly
  validatePlaylists: true,
};

/** hls.js error details that occur before a manifest has ever parsed */
const MANIFEST_PHASE_ERRORS = [
  'manifestLoadError',
  'manifestLoadTimeOut',
  'manifestParsingError',
];

/**
 * Create an HLS Provider Plugin instance bound to a loader module and
 * build-variant labels. Not part of the public API: consumers use the
 * `createHLSPlugin` wrappers exported by `index.ts` and `light.ts`.
 *
 * @param loader - hls.js loader module (full or light)
 * @param variant - Build-variant labels for metadata and logging
 * @param config - Plugin configuration
 * @returns HLS Plugin instance
 */
export function createHLSPluginWith(
  loader: HlsLoaderModule,
  variant: HlsPluginVariant,
  config?: Partial<HLSPluginConfig>
): IHLSPlugin {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Plugin state
  let api: IPluginAPI | null = null;
  let hls: HlsInstance | null = null;
  let video: HTMLVideoElement | null = null;
  let isNative = false;
  let currentSrc: string | null = null;
  let cleanupHlsEvents: (() => void) | null = null;
  let cleanupVideoEvents: (() => void) | null = null;
  let isAutoQuality = true; // Track if user has selected auto quality

  // Load-session guard. Bumped by every entry point that starts or stops a
  // pipeline (loadSource, destroy, provider switches, reconnect attempts).
  // Async continuations capture the value when they start and bail once it
  // no longer matches, so a superseded session can never fire a timer,
  // settle a promise, or write state against the current one.
  let loadSession = 0;

  // Settles the pending load promise (if any) when the pipeline is torn down
  let abortPendingLoad: ((reason: Error) => void) | null = null;

  // Retry state
  let networkRetryCount = 0;
  let mediaRetryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  // Non-fatal error tracking - give up if too many errors in a short time
  let errorCount = 0;
  let errorWindowStart = 0;
  const MAX_ERRORS_IN_WINDOW = 10;
  const ERROR_WINDOW_MS = 5000; // 5 seconds

  // Auto-reconnect state - self-healing after a terminal error mid-playback
  let hasPlayedContent = false; // Manifest parsed at least once for this source
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let reconnectWindowStart = 0;
  let reconnectResumePosition = 0; // Viewer position captured at first failure
  let onlineListener: (() => void) | null = null;
  // Error that opened the current reconnect window, reused to classify the
  // terminal error emitted when the window closes
  let reconnectTriggerError: HLSError | null = null;
  // Latched once the window closes so exhaustion is announced exactly once
  // and no further attempt can be scheduled against a closed window
  let reconnectExhausted = false;

  /**
   * Mirror the `poster` state key onto the media element.
   *
   * Called at element creation, at the top of every `loadSource()`, and from
   * the state subscription in `init()`. Until 2026-09-02 this provider set the
   * poster once, when it created the element, and never again: the attribute
   * survives an `src` change, so a playlist moving from a pre-roll to the
   * feature showed the PREVIOUS item's art over the gap, and `setPoster()`
   * plus the Vue `poster` prop did nothing at all.
   *
   * An empty state value clears the attribute, so an item without artwork
   * cannot inherit the last one's image.
   */
  const applyPoster = (): void => {
    if (!video) return;

    video.poster = api?.getState('poster') || '';
  };

  /** Get video element from container */
  const getOrCreateVideo = (): HTMLVideoElement => {
    if (video) return video;

    // Look for existing video element
    const existing = api?.container.querySelector('video');
    if (existing) {
      video = existing as HTMLVideoElement;
      return video;
    }

    // Create new video element
    video = document.createElement('video');
    video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000';
    video.preload = 'metadata';
    video.controls = false;
    video.playsInline = true;

    applyPoster();

    api?.container.appendChild(video);
    return video;
  };

  /**
   * Tear down the active playback pipeline.
   *
   * Every teardown path in this plugin (source switch, destroy, load
   * watchdog, error-storm bail, reconnect attempt) must run through here so
   * no path can leave a timer armed, a handler attached, or a load promise
   * pending against a dead hls.js instance.
   *
   * Keeps source identity, retry budgets, and reconnect bookkeeping intact;
   * callers abandoning the source entirely use cleanup() instead.
   *
   * @param reason - Error used to settle a still-pending load promise
   */
  const teardownPipeline = (reason?: Error) => {
    abortPendingLoad?.(reason ?? new Error('HLS load cancelled'));
    abortPendingLoad = null;

    cleanupHlsEvents?.();
    cleanupHlsEvents = null;

    cleanupVideoEvents?.();
    cleanupVideoEvents = null;

    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }

    if (hls) {
      hls.destroy();
      hls = null;
    }
  };

  /**
   * Full source teardown: the pipeline plus source identity and budgets.
   *
   * @param reason - Error used to settle a still-pending load promise
   */
  const cleanup = (reason?: Error) => {
    teardownPipeline(reason);

    currentSrc = null;
    isNative = false;
    isAutoQuality = true; // Reset to auto when loading new source
    networkRetryCount = 0;
    mediaRetryCount = 0;
    errorCount = 0;
    errorWindowStart = 0;
  };

  /** Build hls.js config */
  const buildHlsConfig = (): Record<string, unknown> => {
    const config: Record<string, unknown> = buildBaseHlsConfig();

    // Validate playlist refreshes so a garbage document becomes a normal
    // network error instead of being indexed blindly (Sentry 2D8 class)
    if (mergedConfig.validatePlaylists !== false) {
      const Hls = loader.getHlsConstructor();
      if (Hls && (Hls as any).DefaultConfig?.loader) {
        config.pLoader = createValidatingPlaylistLoader(Hls);
      }
    }

    return config;
  };

  /** Base hls.js config values (everything except the pLoader wrapper) */
  const buildBaseHlsConfig = (): Record<string, unknown> => ({
    debug: mergedConfig.debug,
    autoStartLoad: mergedConfig.autoStartLoad,
    startPosition: mergedConfig.startPosition,
    startLevel: -1, // Auto quality selection (ABR)
    abrEwmaDefaultEstimate: getInitialBandwidthEstimate(mergedConfig.initialBandwidthEstimate as number | undefined),
    lowLatencyMode: mergedConfig.lowLatencyMode,
    maxBufferLength: mergedConfig.maxBufferLength,
    maxMaxBufferLength: mergedConfig.maxMaxBufferLength,
    backBufferLength: mergedConfig.backBufferLength,
    enableWorker: mergedConfig.enableWorker,
    capLevelToPlayerSize: mergedConfig.capLevelToPlayerSize,
    // Minimize hls.js internal retries - we handle retries ourselves
    fragLoadingMaxRetry: 1,
    manifestLoadingMaxRetry: 1,
    levelLoadingMaxRetry: 1,
    fragLoadingRetryDelay: 500,
    manifestLoadingRetryDelay: 500,
    levelLoadingRetryDelay: 500,
  });

  /** Calculate retry delay with exponential backoff and jitter */
  const getRetryDelay = (retryCount: number): number => {
    const baseDelay = mergedConfig.retryDelayMs ?? 1000;
    const backoffFactor = mergedConfig.retryBackoffFactor ?? 2;
    const delay = baseDelay * Math.pow(backoffFactor, retryCount);
    // Add jitter (70-100% of calculated delay) to prevent thundering herd
    const jitter = delay * (0.7 + Math.random() * 0.3);
    return jitter;
  };

  /** hls.js error details indicating an MSE append failure */
  const APPEND_ERROR_DETAILS = [
    'bufferAppendError',
    'bufferAppendingError',
    'bufferAddCodecError',
  ];

  /**
   * Map an HLS error to a structured player error code.
   *
   * MSE buffer classes (quota exhaustion, append failures such as the
   * detached-ArrayBuffer teardown race) are branched on error.details so
   * the UI can show accurate copy instead of the generic decode message.
   */
  const mapFatalErrorCode = (error: HLSError): ErrorCode => {
    // Synthetic loader error from the validating pLoader: the "network"
    // failure is actually a malformed playlist document
    if (error.response?.text === PLAYLIST_INVALID_TEXT) {
      return ErrorCode.PLAYLIST_INVALID;
    }
    if (error.details === 'bufferFullError') {
      return ErrorCode.MEDIA_BUFFER_FULL;
    }
    if (APPEND_ERROR_DETAILS.includes(error.details)) {
      return ErrorCode.MEDIA_APPEND_ERROR;
    }
    switch (error.type) {
      case 'network':
        return ErrorCode.MEDIA_NETWORK_ERROR;
      case 'media':
      case 'mux':
        return ErrorCode.MEDIA_DECODE_ERROR;
      default:
        return ErrorCode.PLAYBACK_FAILED;
    }
  };

  /**
   * Build the diagnostic `detail` block carried by a fatal error event.
   *
   * `{ code, message }` alone could not answer why a stream died during the
   * 2026-08-29 origin outage: no HTTP status, no URL, no attempt count, so
   * diagnosis meant correlating timestamps across viewers. The URL goes
   * through sanitizeUrl() because signed-URL tokens live in the query.
   */
  const buildErrorDetail = (error: HLSError, retriesExhausted: boolean): PlayerErrorDetail => {
    const attempts =
      error.type === 'network'
        ? networkRetryCount
        : error.type === 'media'
          ? mediaRetryCount
          : 0;

    const detail: PlayerErrorDetail = {
      type: error.type,
      retriesExhausted,
      attempts,
    };

    // Only network failures carry a request; a synthetic playlist-validation
    // error reports code 0, which is not an HTTP status
    if (typeof error.response?.code === 'number' && error.response.code > 0) {
      detail.httpStatus = error.response.code;
    }

    const url = sanitizeUrl(error.url);
    if (url) {
      detail.url = url;
    }

    return detail;
  };

  /**
   * Emit fatal error and stop playback.
   *
   * Emits a structured error code (network vs decode) so the UI can show an
   * accurate message instead of a generic fallback, attaches diagnostics for
   * the consumer's telemetry, then hands off to the auto-reconnect scheduler
   * when the failure class is worth reconnecting for.
   *
   * @param error - Parsed HLS error
   * @param retriesExhausted - Whether the retry budget ran out (adds the
   *        "(max retries exceeded)" message suffix)
   */
  const emitFatalError = (error: HLSError, retriesExhausted: boolean) => {
    const message = retriesExhausted
      ? `HLS error: ${error.details} (max retries exceeded)`
      : `HLS error: ${error.details}`;

    api?.logger.error(message, { type: error.type, details: error.details });
    api?.setState('playbackState', 'error');
    api?.setState('buffering', false);

    api?.emit('error', {
      code: mapFatalErrorCode(error),
      message,
      fatal: true,
      timestamp: Date.now(),
      detail: buildErrorDetail(error, retriesExhausted),
    });

    maybeScheduleReconnect(error);
  };

  /**
   * Handle HLS errors with recovery and retry limits.
   *
   * @param error - Parsed HLS error
   * @returns True when the error is terminal (fatal emitted, no further
   *          recovery will be attempted) so pending load promises can settle
   */
  const handleHlsError = (error: HLSError): boolean => {
    const Hls = loader.getHlsConstructor();
    if (!Hls || !hls) return false;

    // Track all errors (fatal and non-fatal) to detect error storms
    const now = Date.now();
    if (now - errorWindowStart > ERROR_WINDOW_MS) {
      // Reset window
      errorCount = 1;
      errorWindowStart = now;
    } else {
      errorCount++;
    }

    // If too many errors in the time window, treat as fatal
    if (errorCount >= MAX_ERRORS_IN_WINDOW) {
      api?.logger.error(`Too many errors (${errorCount} in ${ERROR_WINDOW_MS}ms), giving up`);
      emitFatalError(error, true);

      // Stop all activity from the dead pipeline (also settles a pending load)
      teardownPipeline(new Error(error.details));
      return true;
    }

    if (error.fatal) {
      api?.logger.error('Fatal HLS error', { type: error.type, details: error.details });

      switch (error.type) {
        case 'network': {
          const maxRetries = mergedConfig.maxNetworkRetries ?? 3;

          if (networkRetryCount >= maxRetries) {
            api?.logger.error(`Network error recovery failed after ${networkRetryCount} attempts`);
            emitFatalError(error, true);
            return true;
          }

          networkRetryCount++;
          const delay = getRetryDelay(networkRetryCount - 1);

          api?.logger.info(`Attempting network error recovery (attempt ${networkRetryCount}/${maxRetries}) in ${delay}ms`);
          api?.emit('error:network', { error: new Error(error.details) });

          // Clear any existing retry timeout
          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }

          // Retry with exponential backoff.
          //
          // startLoad() resumes loading of an already-parsed manifest - it
          // cannot recover when the manifest itself failed to load (404/403,
          // expired token, origin down). In that phase no further ERROR event
          // would ever fire and the retry chain would silently die at attempt
          // one, leaving the viewer on an endless spinner. Re-issue
          // loadSource() instead so the manifest request actually repeats.
          const isManifestPhase = MANIFEST_PHASE_ERRORS.includes(error.details);
          const retry_session = loadSession;
          retryTimeout = setTimeout(() => {
            if (retry_session !== loadSession || !hls) return;
            if (isManifestPhase && currentSrc) {
              hls.loadSource(currentSrc);
            } else {
              hls.startLoad();
            }
          }, delay);
          break;
        }

        case 'media': {
          const maxRetries = mergedConfig.maxMediaRetries ?? 2;

          if (mediaRetryCount >= maxRetries) {
            api?.logger.error(`Media error recovery failed after ${mediaRetryCount} attempts`);
            emitFatalError(error, true);
            return true;
          }

          mediaRetryCount++;
          const delay = getRetryDelay(mediaRetryCount - 1);

          api?.logger.info(`Attempting media error recovery (attempt ${mediaRetryCount}/${maxRetries}) in ${delay}ms`);
          api?.emit('error:media', { error: new Error(error.details) });

          // Clear any existing retry timeout
          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }

          // Retry with exponential backoff
          const retry_session = loadSession;
          retryTimeout = setTimeout(() => {
            if (retry_session !== loadSession || !hls) return;
            hls.recoverMediaError();
          }, delay);
          break;
        }

        default:
          // Unrecoverable error - no retry
          emitFatalError(error, false);
          return true;
      }
    }

    return false;
  };

  /**
   * Handle a fatal media-element error on the native (Safari/iOS) path.
   *
   * The MSE branch gives network errors `maxNetworkRetries` and media errors
   * `maxMediaRetries` before anything is declared fatal. Native had no budget
   * at all: the FIRST media element error went straight to emitFatalError, so
   * during the 2026-08-29 outage a single transient decode hiccup flashed the
   * error overlay on iOS streams the reconnect scheduler then healed 2.15
   * seconds later. Both budgets apply here because the native recovery action
   * is identical for either class: reload the source.
   *
   * @param error - Error synthesized from the media element's MediaError
   * @param resumePosition - Position to restore, captured at the FIRST
   *        failure. A failed reload resets the element to 0, so re-sampling
   *        per attempt would resume a recovered VOD from the start.
   */
  const handleNativeFatalError = (error: HLSError, resumePosition?: number): void => {
    const is_network = error.type === 'network';
    const max_retries = is_network
      ? (mergedConfig.maxNetworkRetries ?? 3)
      : (mergedConfig.maxMediaRetries ?? 2);
    const used = is_network ? networkRetryCount : mediaRetryCount;

    // No source to reload means nothing to recover with
    if (!currentSrc || used >= max_retries) {
      emitFatalError(error, used >= max_retries);
      return;
    }

    const resume_position = resumePosition ?? video?.currentTime ?? 0;

    if (is_network) {
      networkRetryCount++;
    } else {
      mediaRetryCount++;
    }

    const attempt = used + 1;
    const delay = getRetryDelay(attempt - 1);

    api?.logger.info(
      `Attempting native ${error.type} error recovery (attempt ${attempt}/${max_retries}) in ${delay}ms`
    );
    api?.emit(is_network ? 'error:network' : 'error:media', {
      error: new Error(error.details),
    });

    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }

    const retry_session = loadSession;
    retryTimeout = setTimeout(() => {
      if (retry_session !== loadSession) return;
      void recoverNative(error, resume_position);
    }, delay);
  };

  /**
   * Recovery action for the native path: reload the source in place.
   *
   * Native HLS has no hls.js error channel and no `recoverMediaError()`, so
   * the only recovery available is a reload. It goes through loadNative()
   * rather than re-setting `videoEl.src` directly, because loadNative is what
   * re-wires the fatal-error listener and participates in the loadSession
   * supersede bookkeeping.
   *
   * @param error - Error being recovered from, re-entered on failure so the
   *        remaining budget is spent before anything is declared fatal
   * @param resumePosition - Viewer position captured at the first failure
   */
  const recoverNative = async (error: HLSError, resumePosition: number): Promise<void> => {
    if (!currentSrc) return;

    // Tearing down and restarting a pipeline is a new session
    const session = ++loadSession;
    const saved_src = currentSrc;
    const was_live = api?.getState('live') ?? false;

    try {
      // Detaches the dead pipeline's video handlers (including the fatal
      // listener loadNative is about to re-attach) while keeping source
      // identity and the retry budgets this recovery is spending
      teardownPipeline(new Error('HLS load cancelled: native error recovery'));

      api?.setState('playbackState', 'loading');

      await loadNative(saved_src);

      // A user load, a destroy, or a reconnect superseded this recovery
      if (session !== loadSession) return;

      // Live streams rejoin at the live edge, which is where a viewer of a
      // live event wants to be after a blip
      if (!was_live && video && resumePosition > 0) {
        video.currentTime = resumePosition;
      }

      api?.setState('playbackState', 'ready');
      api?.setState('buffering', false);

      try {
        await video?.play();
      } catch {
        // Autoplay policy blocked the resume; the play button still works
      }
    } catch {
      if (session !== loadSession) return;
      api?.logger.warn('Native error recovery attempt failed');
      // The reload itself failed: re-enter so the remaining budget is spent
      // and the error goes fatal exactly when it runs out
      handleNativeFatalError(error, resumePosition);
    }
  };

  /** Load source using native HLS */
  const loadNative = async (src: string): Promise<void> => {
    const session = loadSession;
    const videoEl = getOrCreateVideo();
    isNative = true;

    // Setup video event handlers
    if (api) {
      cleanupVideoEvents = setupVideoEventHandlers(videoEl, api);
    }

    return new Promise((resolve, reject) => {
      let watchdog: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const settle = () => {
        settled = true;
        // Only release the abort hook if it is still ours - a newer load may
        // have installed its own by the time a stale listener fires
        if (abortPendingLoad === abort) {
          abortPendingLoad = null;
        }
        videoEl.removeEventListener('loadedmetadata', onLoaded);
        videoEl.removeEventListener('error', onError);
        if (watchdog !== null) {
          clearTimeout(watchdog);
          watchdog = null;
        }
      };

      /** Settle-with-rejection hook invoked by teardownPipeline() */
      const abort = (reason: Error) => {
        if (settled) return;
        settle();
        reject(reason);
      };
      abortPendingLoad = abort;

      const onLoaded = () => {
        if (settled) return;
        if (session !== loadSession) {
          // Superseded while metadata was loading; do not touch shared state
          settle();
          reject(new Error('HLS load cancelled'));
          return;
        }
        settle();

        hasPlayedContent = true;

        // Native HLS has no hls.js error channel. Route subsequent fatal
        // video element errors through the native retry budget so a
        // transient hiccup is absorbed, and only a genuinely dead stream
        // reaches the error overlay (and auto-reconnect) on Safari.
        const onFatalVideoError = () => {
          const media_error = videoEl.error;
          const hls_error: HLSError = {
            type: media_error?.code === MediaError.MEDIA_ERR_NETWORK ? 'network' : 'media',
            details: media_error?.message || 'Native HLS playback error',
            fatal: true,
          };
          handleNativeFatalError(hls_error);
        };
        videoEl.addEventListener('error', onFatalVideoError);

        // Media is flowing again: restore the full retry budget. This is the
        // native analog of the MSE branch's onFragLoaded reset - without it,
        // blips spread across a long live event permanently consume the
        // budget and an outage hours in becomes instantly terminal.
        const onPlayingResetBudget = () => {
          if (networkRetryCount > 0 || mediaRetryCount > 0) {
            api?.logger.debug('Native playback recovered, resetting retry budgets');
            networkRetryCount = 0;
            mediaRetryCount = 0;
          }
        };
        videoEl.addEventListener('playing', onPlayingResetBudget);

        const removeFatalListener = () => {
          videoEl.removeEventListener('error', onFatalVideoError);
          videoEl.removeEventListener('playing', onPlayingResetBudget);
        };
        const previous_cleanup = cleanupVideoEvents;
        cleanupVideoEvents = () => {
          removeFatalListener();
          previous_cleanup?.();
        };

        api?.setState('source', { src, type: 'application/x-mpegURL' });
        api?.emit('media:loaded', { src, type: 'application/x-mpegURL' });

        resolve();
      };

      const onError = () => {
        if (settled) return;
        settle();

        const error = videoEl.error;
        reject(new Error(error?.message || 'Failed to load HLS source'));
      };

      // Watchdog: a load must terminate. Without this, a request that never
      // errors and never produces metadata pins the viewer on a spinner.
      const timeout_ms = mergedConfig.loadTimeoutMs ?? 30000;
      if (timeout_ms > 0) {
        watchdog = setTimeout(() => {
          if (settled || session !== loadSession) return;
          settle();
          reject(new Error('Video took too long to load (network timeout)'));
        }, timeout_ms);
      }

      videoEl.addEventListener('loadedmetadata', onLoaded);
      videoEl.addEventListener('error', onError);
      videoEl.src = src;
      videoEl.load();
    });
  };

  /** Load source using hls.js */
  const loadWithHlsJs = async (src: string): Promise<void> => {
    const session = loadSession;

    // Lazy load hls.js
    await loader.loadHlsJs();

    // A destroy() or new load during the dynamic import supersedes this call
    if (session !== loadSession) {
      throw new Error('HLS load cancelled');
    }

    const videoEl = getOrCreateVideo();
    isNative = false;

    // Create hls.js instance
    hls = loader.createHlsInstance(buildHlsConfig());

    // Setup video event handlers
    if (api) {
      cleanupVideoEvents = setupVideoEventHandlers(videoEl, api);
    }

    return new Promise((resolve, reject) => {
      if (!hls || !api) {
        reject(new Error('HLS not initialized'));
        return;
      }

      let resolved = false;
      let watchdog: ReturnType<typeof setTimeout> | null = null;

      const clearWatchdog = () => {
        if (watchdog !== null) {
          clearTimeout(watchdog);
          watchdog = null;
        }
      };

      /** Settle-with-rejection hook invoked by teardownPipeline() */
      const abort = (reason: Error) => {
        if (resolved) return;
        resolved = true;
        clearWatchdog();
        reject(reason);
      };
      abortPendingLoad = abort;

      // Only release the abort hook if it is still ours - a newer load may
      // have installed its own by the time this session settles
      const releaseAbort = () => {
        if (abortPendingLoad === abort) {
          abortPendingLoad = null;
        }
      };

      // Setup hls.js event handlers. Every callback bails when the session
      // is stale: a queued event from a torn-down pipeline (the real analog
      // is an in-flight worker message) must not write state, arm timers,
      // or settle promises against the current session.
      cleanupHlsEvents = setupHlsEventHandlers(hls, api, {
        onManifestParsed: () => {
          if (session !== loadSession) return;
          if (!resolved) {
            resolved = true;
            releaseAbort();
            clearWatchdog();
            hasPlayedContent = true;
            api?.setState('source', { src, type: 'application/x-mpegURL' });
            api?.emit('media:loaded', { src, type: 'application/x-mpegURL' });
            resolve();
          }
        },
        onLevelSwitched: () => {
          // Already handled in event-map
        },
        onError: (error) => {
          if (session !== loadSession) return;
          // Reject the pending load once recovery is exhausted (or the error
          // is unrecoverable) so load()/init() never hang forever. Network and
          // media errors that are still being retried keep the promise pending
          // until a retry succeeds (manifest parsed) or gives up.
          const terminal = handleHlsError(error);
          if (terminal && !resolved) {
            resolved = true;
            releaseAbort();
            clearWatchdog();
            reject(new Error(error.details));
          }
        },
        onFragLoaded: () => {
          if (session !== loadSession) return;
          // Media is flowing again: any earlier recovery worked, so restore
          // the full retry budget. Without this, transient blips spread
          // across a long live event permanently consume the budget and an
          // outage hours in becomes instantly terminal.
          if (networkRetryCount > 0 || mediaRetryCount > 0) {
            api?.logger.debug('Playback recovered, resetting retry budgets');
            networkRetryCount = 0;
            mediaRetryCount = 0;
          }
        },
        getIsAutoQuality: () => isAutoQuality,
      });

      // Watchdog: no code path may leave this promise pending forever. If the
      // manifest has not parsed and recovery has not reported terminal within
      // the window, tear down and fail with a real error the UI can show.
      const timeout_ms = mergedConfig.loadTimeoutMs ?? 30000;
      if (timeout_ms > 0) {
        watchdog = setTimeout(() => {
          if (resolved || session !== loadSession) return;
          resolved = true;
          releaseAbort();
          api?.logger.error(`HLS load timed out after ${timeout_ms}ms`, { src });

          // Stop all background activity from the abandoned attempt
          teardownPipeline();

          reject(new Error('Video took too long to load (network timeout)'));
        }, timeout_ms);
      }

      // Attach to video and load
      hls.attachMedia(videoEl);
      hls.loadSource(src);
    });
  };

  /** Cancel any pending auto-reconnect and reset its bookkeeping */
  const cancelReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;
    reconnectWindowStart = 0;
    reconnectResumePosition = 0;
    reconnectTriggerError = null;
    reconnectExhausted = false;
  };

  /**
   * Announce that auto-reconnect has given up.
   *
   * Window exhaustion used to log a warning and return, emitting nothing.
   * A consumer that put up "Reconnecting..." on `error:reconnecting` then had
   * no signal to ever take it down, so an outage longer than the window
   * (the 2026-08-29 one was) left a permanent spinner with no way back.
   *
   * Two events fire, exactly once per window: the dedicated
   * `error:reconnect-exhausted` for lifecycle-driven UIs, then a final fatal
   * `error` for error-driven ones. The fatal error deliberately does NOT go
   * through emitFatalError(), which would re-enter the reconnect scheduler.
   *
   * @param elapsedMs - How long the provider kept trying
   * @param windowMs - The window it was working against
   */
  const emitReconnectExhausted = (elapsedMs: number, windowMs: number) => {
    if (reconnectExhausted) return;
    reconnectExhausted = true;

    const attempts = reconnectAttempts;
    const trigger = reconnectTriggerError;

    api?.emit('error:reconnect-exhausted', { attempts, elapsedMs, windowMs });

    api?.setState('playbackState', 'error');
    api?.setState('buffering', false);
    api?.emit('error', {
      code: trigger ? mapFatalErrorCode(trigger) : ErrorCode.PLAYBACK_FAILED,
      message: `HLS auto-reconnect gave up after ${attempts} attempts over ${Math.round(elapsedMs / 1000)}s`,
      fatal: true,
      timestamp: Date.now(),
      detail: {
        type: trigger?.type ?? 'other',
        retriesExhausted: true,
        attempts,
        reconnectExhausted: true,
      },
    });
  };

  /**
   * Schedule the next auto-reconnect attempt with capped exponential backoff.
   *
   * Emits `error:reconnecting` so the UI can tell the viewer the player is
   * working on it rather than showing a dead-end error. The payload reports
   * `elapsedMs`/`windowMs` rather than a max attempt count because giving up
   * is decided by the TIME WINDOW, not by an attempt cap.
   */
  const scheduleReconnectAttempt = () => {
    if (reconnectExhausted) return; // Window already closed and announced
    if (reconnectTimer) return; // Already scheduled

    const window_ms = mergedConfig.reconnectWindowMs ?? 300000;
    const elapsed_ms = Date.now() - reconnectWindowStart;
    if (elapsed_ms > window_ms) {
      api?.logger.warn(`Auto-reconnect window exhausted after ${reconnectAttempts} attempts`);
      emitReconnectExhausted(elapsed_ms, window_ms);
      return;
    }

    const base_delay = mergedConfig.reconnectBaseDelayMs ?? 2000;
    const max_delay = mergedConfig.reconnectMaxDelayMs ?? 30000;
    const backoff = Math.min(base_delay * Math.pow(2, reconnectAttempts), max_delay);
    // Jitter (70-100%) to avoid a thundering herd when a stream comes back
    const delay = Math.round(backoff * (0.7 + Math.random() * 0.3));

    api?.logger.info(`Scheduling auto-reconnect attempt ${reconnectAttempts + 1} in ${delay}ms`);
    api?.emit('error:reconnecting', {
      attempt: reconnectAttempts + 1,
      delayMs: delay,
      elapsedMs: elapsed_ms,
      windowMs: window_ms,
    });

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void attemptReconnect();
    }, delay);
  };

  /**
   * Start auto-reconnecting after a fatal error, when it makes sense.
   *
   * Only kicks in when the stream had previously worked (manifest parsed) and
   * the failure class is plausibly transient (network/media). Initial-load
   * failures stay manual: the viewer sees an error with a working Try Again,
   * because auto-retrying a wrong URL forever would just mask the problem.
   */
  const maybeScheduleReconnect = (error: HLSError) => {
    if (mergedConfig.autoReconnect === false) return;
    if (!hasPlayedContent || !currentSrc) return;
    if (error.type !== 'network' && error.type !== 'media') return;

    if (reconnectWindowStart === 0) {
      reconnectWindowStart = Date.now();
      // Capture the viewer's position NOW, at the first failure. Failed
      // reconnect attempts reset the video element to 0, so sampling the
      // position per-attempt would resume a recovered VOD from the start.
      reconnectResumePosition = video?.currentTime ?? 0;
      // Remembered so the terminal error emitted when the window closes
      // carries the same classification as the failure that opened it
      reconnectTriggerError = error;
    }
    scheduleReconnectAttempt();
  };

  /**
   * Tear down the dead pipeline and reload the source in place.
   *
   * On success the viewer is put back where they were: live streams rejoin
   * at the live edge, VOD resumes at the previous position, and playback
   * restarts without any interaction.
   */
  const attemptReconnect = async (): Promise<void> => {
    if (!api || !currentSrc) return;

    // New pipeline session: continuations from the dead one must bail, and
    // this attempt itself must bail if a user load or destroy supersedes it
    const session = ++loadSession;

    reconnectAttempts++;
    const saved_src = currentSrc;
    const was_live = api.getState('live');
    const was_native = isNative;
    // Position from the first failure, not the current (possibly reset) element
    const resume_position = reconnectResumePosition;

    api.logger.info(`Auto-reconnect attempt ${reconnectAttempts}`, { src: saved_src });

    try {
      // Tear down the dead instance but keep reconnect bookkeeping intact
      teardownPipeline(new Error('HLS load cancelled: reconnecting'));

      // Fresh retry budgets for the new attempt
      networkRetryCount = 0;
      mediaRetryCount = 0;
      errorCount = 0;
      errorWindowStart = 0;

      currentSrc = saved_src;
      api.setState('playbackState', 'loading');

      if (was_native && loader.supportsNativeHLS()) {
        await loadNative(saved_src);
      } else {
        // loadWithHlsJs creates its own fresh hls.js instance
        await loadWithHlsJs(saved_src);
      }

      // A user-initiated load or destroy superseded this reconnect mid-flight
      if (session !== loadSession) return;

      // Restore position for VOD; live streams rejoin at the live edge,
      // which is where a viewer of a live event wants to be after an outage
      if (!was_live && video && resume_position > 0) {
        video.currentTime = resume_position;
      }

      api.setState('playbackState', 'ready');
      api.setState('buffering', false);
      // Emitted before cancelReconnect(), which resets the bookkeeping the
      // payload reports
      api.emit('error:recovered', {
        attempt: reconnectAttempts,
        elapsedMs: Date.now() - reconnectWindowStart,
      });
      api.logger.info('Auto-reconnect succeeded');
      cancelReconnect();

      try {
        await video?.play();
      } catch {
        // Autoplay policy blocked the resume; the play button now works
        // reliably, so the viewer is one click away
      }
    } catch {
      // A superseded attempt must not respawn the reconnect loop
      if (session !== loadSession) return;
      api?.logger.warn(`Auto-reconnect attempt ${reconnectAttempts} failed`);
      scheduleReconnectAttempt();
    }
  };

  // Plugin implementation
  const plugin: IHLSPlugin = {
    id: 'hls-provider',
    name: variant.name,
    version: PKG_VERSION,
    type: 'provider' as PluginType,
    description: variant.description,

    canPlay(src: string): boolean {
      if (!loader.isHLSSupported()) return false;

      // Check file extension (strip query strings and fragments first)
      const url = src.toLowerCase();
      const urlWithoutQuery = url.split('?')[0].split('#')[0];
      if (urlWithoutQuery.endsWith('.m3u8')) return true;

      // Check MIME type hint in URL
      if (url.includes('application/x-mpegurl')) return true;
      if (url.includes('application/vnd.apple.mpegurl')) return true;

      return false;
    },

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      api.logger.info(`HLS plugin${variant.logSuffix} initialized`);

      // Setup playback control listeners
      const unsubPlay = api.on('playback:play', async () => {
        if (!video) return;
        try {
          await video.play();
        } catch (e) {
          api?.logger.error('Play failed', e);
        }
      });

      const unsubPause = api.on('playback:pause', () => {
        video?.pause();
      });

      const unsubSeek = api.on('playback:seeking', ({ time }: { time: number }) => {
        if (!video) return;
        const clampedTime = Math.max(0, Math.min(time, video.duration || 0));
        video.currentTime = clampedTime;
      });

      const unsubVolume = api.on('volume:change', ({ volume }: { volume: number }) => {
        if (video) video.volume = volume;
      });

      const unsubMute = api.on('volume:mute', ({ muted }: { muted: boolean }) => {
        if (video) video.muted = muted;
      });

      const unsubRate = api.on('playback:ratechange', ({ rate }: { rate: number }) => {
        if (video) video.playbackRate = rate;
      });

      // Handle quality selection from UI
      const unsubQuality = api.on('quality:select', ({ quality, auto }: { quality: string; auto?: boolean }) => {
        if (!hls || isNative) {
          api?.logger.warn('Quality selection not available');
          return;
        }

        if (auto || quality === 'auto') {
          // Enable auto quality selection
          isAutoQuality = true;
          hls.currentLevel = -1;
          api?.logger.debug('Quality: auto selection enabled');

          // Update state immediately to show "Auto"
          api?.setState('currentQuality', {
            id: 'auto',
            label: 'Auto',
            width: 0,
            height: 0,
            bitrate: 0,
            active: true,
          });
        } else {
          // Find level index by id (e.g., 'level-0', 'level-1')
          isAutoQuality = false;
          const levelIndex = parseInt(quality.replace('level-', ''), 10);
          if (!isNaN(levelIndex) && levelIndex >= 0 && levelIndex < hls.levels.length) {
            hls.nextLevel = levelIndex;
            api?.logger.debug(`Quality: queued switch to level ${levelIndex}`);

            // Show pending state - actual switch happens when chunks load
            const targetLevel = hls.levels[levelIndex];
            if (targetLevel) {
              const label = formatLevel(targetLevel);
              api?.setState('currentQuality', {
                id: `level-${levelIndex}`,
                label: `${label}...`, // Ellipsis indicates switching in progress
                width: targetLevel.width,
                height: targetLevel.height,
                bitrate: targetLevel.bitrate,
                active: false, // Not yet active
              });
            }
          }
        }
      });

      // Reconnect immediately when the browser reports the network is back.
      // A viewer whose wifi dropped should not wait out a 30s backoff after
      // their connection has already returned.
      if (typeof window !== 'undefined') {
        onlineListener = () => {
          if (reconnectTimer) {
            api?.logger.info('Browser back online, reconnecting immediately');
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
            void attemptReconnect();
          }
        };
        window.addEventListener('online', onlineListener);
      }

      // Re-apply the poster whenever it changes. Without this the element
      // keeps whatever image it was created with, so setPoster(), a playlist
      // track change and a Vue prop change were all invisible to the viewer.
      const unsubPoster = api.subscribeToState((event) => {
        if (event.key === 'poster') applyPoster();
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubPlay();
        unsubPause();
        unsubSeek();
        unsubVolume();
        unsubMute();
        unsubRate();
        unsubQuality();
        unsubPoster();
      });
    },

    async destroy(): Promise<void> {
      api?.logger.info(`HLS plugin${variant.logSuffix} destroying`);
      // Supersede any in-flight load or reconnect continuation
      loadSession++;
      cancelReconnect();
      if (onlineListener && typeof window !== 'undefined') {
        window.removeEventListener('online', onlineListener);
        onlineListener = null;
      }
      cleanup(new Error('HLS load cancelled: player destroyed'));

      if (video?.parentNode) {
        video.parentNode.removeChild(video);
      }
      video = null;
      api = null;
    },

    async loadSource(src: string): Promise<void> {
      if (!api) throw new Error('Plugin not initialized');

      api.logger.info(`Loading HLS source${variant.logSuffix}`, { src });

      // A user-initiated load supersedes any in-flight load or auto-reconnect
      const session = ++loadSession;
      cancelReconnect();
      hasPlayedContent = false;

      // Cleanup previous source (also settles a pending load promise)
      cleanup(new Error('HLS load cancelled: superseded by a new load'));
      currentSrc = src;

      // Before the load, not after: the poster is what the viewer looks at
      // while the next source is fetched, and on a reused element it is still
      // showing the previous item's art until this runs.
      applyPoster();

      // Update state
      api.setState('playbackState', 'loading');
      api.setState('buffering', true);

      // Force native HLS when AirPlay is active (required for wireless playback)
      if (api.getState('airplayActive') && loader.supportsNativeHLS()) {
        api.logger.info('Using native HLS (AirPlay active)');
        await loadNative(src);
      } else if (loader.isHlsJsSupported()) {
        api.logger.info(`Using ${variant.engineLabel} for HLS playback`);
        await loadWithHlsJs(src);
      } else if (loader.supportsNativeHLS()) {
        api.logger.info('Using native HLS playback (hls.js not supported)');
        await loadNative(src);
      } else {
        throw new Error('HLS playback not supported in this browser');
      }

      // Superseded between the load settling and this continuation running
      if (session !== loadSession) return;

      // Apply initial volume/muted state to video element
      // This must happen before autoplay for muted autoplay to work
      if (video) {
        const muted = api.getState('muted');
        const volume = api.getState('volume');
        if (muted !== undefined) video.muted = muted;
        if (volume !== undefined) video.volume = volume;
      }

      api.setState('playbackState', 'ready');
      api.setState('buffering', false);
    },

    getCurrentLevel(): number {
      if (isNative || !hls) return -1;
      return hls.currentLevel;
    },

    setLevel(index: number): void {
      if (isNative || !hls) {
        api?.logger.warn('Quality selection not available in native HLS mode');
        return;
      }
      hls.currentLevel = index;
    },

    getLevels(): HLSQualityLevel[] {
      if (isNative || !hls) return [];
      return mapLevels(hls.levels, hls.currentLevel);
    },

    getHlsInstance(): HlsInstance | null {
      return hls;
    },

    isNativeHLS(): boolean {
      return isNative;
    },

    getLiveInfo(): HLSLiveInfo | null {
      if (isNative || !hls) return null;

      const live = api?.getState('live') || false;
      if (!live) return null;

      return {
        isLive: true,
        latency: hls.latency || 0,
        targetLatency: hls.targetLatency || 3,
        drift: hls.drift || 0,
      };
    },

    /**
     * Switch from hls.js to native HLS playback.
     * Used for AirPlay compatibility in Safari.
     * Preserves current playback position.
     */
    async switchToNative(): Promise<void> {
      if (isNative) {
        api?.logger.debug('Already using native HLS');
        return;
      }

      if (!loader.supportsNativeHLS()) {
        api?.logger.warn('Native HLS not supported in this browser');
        return;
      }

      if (!currentSrc) {
        api?.logger.warn('No source loaded');
        return;
      }

      api?.logger.info('Switching to native HLS for AirPlay');

      // Save current state
      const wasPlaying = api?.getState('playing') || false;
      const currentTime = video?.currentTime || 0;
      const savedSrc = currentSrc;

      // Cleanup hls.js; the switch is a new session
      const session = ++loadSession;
      cleanup(new Error('HLS load cancelled: switching to native HLS'));

      // Load with native HLS
      await loadNative(savedSrc);

      // Superseded mid-switch by a newer load or destroy
      if (session !== loadSession) return;

      // Restore position
      if (video && currentTime > 0) {
        video.currentTime = currentTime;
      }

      // Resume if was playing
      if (wasPlaying && video) {
        try {
          await video.play();
        } catch (e) {
          api?.logger.debug('Could not auto-resume after switch');
        }
      }

      api?.logger.info('Switched to native HLS');
    },

    /**
     * Switch from native HLS back to hls.js.
     * Restores quality control after AirPlay session ends.
     */
    async switchToHlsJs(): Promise<void> {
      if (!isNative) {
        api?.logger.debug('Already using hls.js');
        return;
      }

      if (!loader.isHlsJsSupported()) {
        api?.logger.warn('hls.js not supported in this browser');
        return;
      }

      if (!currentSrc) {
        api?.logger.warn('No source loaded');
        return;
      }

      api?.logger.info('Switching back to hls.js');

      // Save current state
      const wasPlaying = api?.getState('playing') || false;
      const currentTime = video?.currentTime || 0;
      const savedSrc = currentSrc;

      // Cleanup native; the switch is a new session
      const session = ++loadSession;
      cleanup(new Error('HLS load cancelled: switching to hls.js'));

      // Load with hls.js
      await loadWithHlsJs(savedSrc);

      // Superseded mid-switch by a newer load or destroy
      if (session !== loadSession) return;

      // Restore position
      if (video && currentTime > 0) {
        video.currentTime = currentTime;
      }

      // Resume if was playing
      if (wasPlaying && video) {
        try {
          await video.play();
        } catch (e) {
          api?.logger.debug('Could not auto-resume after switch');
        }
      }

      api?.logger.info('Switched to hls.js');
    },
  };

  return plugin;
}
