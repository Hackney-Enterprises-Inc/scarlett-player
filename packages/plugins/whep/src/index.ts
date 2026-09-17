/**
 * WHEP Provider Plugin for Scarlett Player
 *
 * Plays a WebRTC stream served over WHEP (WebRTC-HTTP Egress Protocol,
 * draft-ietf-wish-whep-04) into an ordinary `<video>` element. Built for the
 * Tmesis low-delay preview (`/whep/v1/streams/<id>` on a Tmesis box), and it
 * plays any WHEP server that answers offers with a `201`.
 *
 * What it does, in order, on `loadSource(src)`:
 *
 * 1. creates the video element the way the native provider does;
 * 2. builds an `RTCPeerConnection` with a receive-only video transceiver and
 *    a receive-only audio transceiver, makes an offer, and waits (bounded)
 *    for ICE gathering so the offer carries the browser's host candidates;
 * 3. `POST`s the offer as `application/sdp`, with `Authorization: Bearer`
 *    when a token is configured, applies the `201` answer, and remembers
 *    the session resource from `Location`;
 * 4. attaches the remote tracks to the element and starts playback;
 * 5. polls `getStats()` once a second for a receiver-side latency estimate.
 *
 * Every recoverable failure (the stream is not live yet, the monitor cap,
 * the network, the ICE connection) enters the same reconnect scheduler the
 * HLS provider uses, with the same events and defaults, and the server's
 * `Retry-After` sets the first delay when it sent one. `destroy()` DELETEs
 * the session, closes the connection and removes the element.
 */

import { ErrorCode, type IPluginAPI, type PluginType, sanitizeUrl } from '@scarlett-player/core';
import { PKG_VERSION } from './version';
import { WHEPError, classifyTransport, type WHEPFailure } from './errors';
import { deleteSession, postOffer } from './session';
import { estimateLatency, type LatencySample } from './latency';
import type { IWHEPPlugin, WHEPPluginConfig } from './types';

export type { IWHEPPlugin, WHEPPluginConfig, WHEPTokenProvider } from './types';
export {
  WHEPError,
  classifyResponse,
  classifyTransport,
  parseRetryAfter,
  readErrorEnvelope,
  type WHEPFailure,
  type TransportFailureKind,
} from './errors';
export { estimateLatency, type LatencyEstimate, type LatencySample } from './latency';
export { PKG_VERSION } from './version';

/**
 * A source this plugin claims: any URL with a path segment named `whep`,
 * or whose last segment is Nimble Streamer's `whep.stream`.
 *
 * That is where every WHEP server this plugin has met puts its endpoint:
 * a Tmesis box at `/whep/v1/streams/<id>`, MediaMTX at `/<path>/whep`, the
 * WISH drafts' own examples at `/whep/<id>`, and Nimble Streamer at
 * `/<app>/<stream>/whep.stream`. The segment has to stand on its own
 * (`/whep/`, a trailing `/whep` or a trailing `/whep.stream`), so a path
 * that merely contains the letters, or a query string that names one, is
 * left to the other providers.
 */
const WHEP_PATH = /(?:^|\/)whep(?:\/|$)|\/whep\.stream$/i;

/**
 * How long to wait for ICE gathering before sending the offer anyway.
 *
 * Host candidates gather in milliseconds; only a STUN or TURN server makes
 * gathering take longer, and the offer is still valid without those
 * candidates (the server's answer carries its own, and the browser connects
 * to them). A second is generous; an unbounded wait would hang the join on
 * a browser that never reports `complete`.
 */
const GATHER_TIMEOUT_MS = 1000;

/** How often the latency estimate is refreshed. */
const LATENCY_POLL_MS = 1000;

/** Change in the estimate, in seconds, below which no state write happens. */
const LATENCY_EPSILON = 0.005;

/**
 * How long a `disconnected` connection state may last before it is treated
 * as a failure. Browsers report `disconnected` on a few lost keepalives
 * and often recover; the server frees a monitor slot after its own ICE
 * timeouts (a Tmesis box: 5 s disconnected, 10 s failed), so waiting longer
 * than this only delays a reconnect that is coming anyway.
 */
const DISCONNECT_GRACE_MS = 5000;

/** Past this much reconnecting, `error:reconnecting` carries `longOutage`. */
const LONG_OUTAGE_MS = 600000;

/** The `type` written to the `source` state key: the protocol's media type. */
const SOURCE_TYPE = 'application/sdp';

/**
 * The configuration defaults, exported so a host can read them.
 */
export const DEFAULT_WHEP_CONFIG = {
  autoReconnect: true,
  reconnectBaseDelayMs: 2000,
  reconnectMaxDelayMs: 30000,
  reconnectWindowMs: 300000,
  loadTimeoutMs: 10000,
} as const;

/**
 * Thrown inside a join when a newer load or `destroy()` replaced it. Never
 * reported: the session that superseded it owns the state now.
 */
class SupersededError extends Error {
  /**
   * @param reason - Why the join was abandoned
   */
  constructor(reason: string) {
    super(reason);
    this.name = 'SupersededError';
  }
}

/**
 * Create a WHEP Provider Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns WHEP Plugin instance
 *
 * @example
 * ```ts
 * import { createPlayer } from '@scarlett-player/core';
 * import { createWHEPPlugin } from '@scarlett-player/whep';
 *
 * const player = await createPlayer({
 *   container: document.getElementById('monitor'),
 *   plugins: [createWHEPPlugin()],
 * });
 *
 * await player.load('https://origin.example.com:8889/whep/v1/streams/show-1');
 * ```
 */
export function createWHEPPlugin(config?: WHEPPluginConfig): IWHEPPlugin {
  // Resolved knobs: an explicit `undefined` in the config falls through to
  // the default rather than replacing it.
  const autoReconnect = config?.autoReconnect ?? DEFAULT_WHEP_CONFIG.autoReconnect;
  const reconnectBaseDelayMs = config?.reconnectBaseDelayMs ?? DEFAULT_WHEP_CONFIG.reconnectBaseDelayMs;
  const reconnectMaxDelayMs = config?.reconnectMaxDelayMs ?? DEFAULT_WHEP_CONFIG.reconnectMaxDelayMs;
  const reconnectWindowMs = config?.reconnectWindowMs ?? DEFAULT_WHEP_CONFIG.reconnectWindowMs;
  const loadTimeoutMs = config?.loadTimeoutMs ?? DEFAULT_WHEP_CONFIG.loadTimeoutMs;
  const iceServers = config?.iceServers ?? [];

  // Plugin state
  let api: IPluginAPI | null = null;
  let video: HTMLVideoElement | null = null;
  let cleanupEvents: (() => void) | null = null;
  /** The peer connection of the current join, null between joins. */
  let peer: RTCPeerConnection | null = null;
  /** The session resource the server handed back, null while not joined. */
  let sessionUrl: string | null = null;
  /** The endpoint of the current source. */
  let currentSrc = '';
  /**
   * Whether the current source has connected at least once. A `404` before
   * that is a wrong URL and terminal; after it, the endpoint is known to
   * exist and the `404` means the publisher went away (MediaMTX answers a
   * path with no publisher that way, where Tmesis answers `409`), which is
   * worth waiting out like any other outage.
   */
  let hasJoined = false;

  /**
   * Load-session guard, mirroring the native and HLS providers'.
   *
   * Bumped by every entry point that starts or stops a join (loadSource, a
   * reconnect attempt, destroy). Async continuations capture the value when
   * they start and bail once it no longer matches, so a superseded join can
   * never fire its watchdog, settle its promise, or write state over the
   * live source.
   */
  let loadSession = 0;
  /** Settles the in-flight load promise; null when none is pending. */
  let pendingLoad: { resolve: () => void; reject: (reason: Error) => void } | null = null;

  // Latency polling and the disconnect grace timer
  let latencyTimer: ReturnType<typeof setInterval> | null = null;
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Auto-reconnect state: the HLS provider's bookkeeping, same names
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let reconnectWindowStart = 0;
  /** The failure that opened the current reconnect window. */
  let reconnectTrigger: WHEPFailure | null = null;
  /** Set once the window has closed and been announced, so it happens once. */
  let reconnectExhausted = false;
  /** True from the first reconnect attempt until recovery or exhaustion. */
  let isReconnecting = false;

  /** Guard tracking whether play was initiated via ScarlettPlayer.play() */
  let isCorePlayRequested = false;
  /** Guard tracking whether the pause was initiated via ScarlettPlayer.pause() */
  let isCorePauseRequested = false;

  /**
   * Resolve the bearer token for the next request.
   *
   * `tokenProvider` wins over `token` so a host can start with a literal and
   * move to a refreshing provider without unsetting anything. A provider
   * that throws is reported as no token, with a warning, rather than as a
   * failed join: the server's answer decides whether one was needed.
   *
   * @returns The token, or `null` for none
   */
  const resolveToken = async (): Promise<string | null> => {
    if (config?.tokenProvider) {
      try {
        const token = await config.tokenProvider();
        return token || null;
      } catch (error) {
        api?.logger.warn('WHEP token provider failed; sending no token', error);
        return null;
      }
    }
    return config?.token || null;
  };

  /**
   * Mirror the `poster` state key onto the element, as the native provider
   * does, so `setPoster()` and the Vue prop take effect on an element that
   * already exists. An empty value clears the attribute.
   */
  const applyPoster = (): void => {
    if (!video) return;
    video.poster = api?.getState('poster') || '';
  };

  /**
   * Get or create the video element.
   *
   * Created exactly as the native provider creates its own: absolute inside
   * the container, `playsInline` (an iPhone monitor must not go fullscreen
   * on play), no native controls, poster mirrored.
   *
   * @returns The element
   */
  const getOrCreateVideo = (): HTMLVideoElement => {
    if (video) return video;

    const existing = api?.container.querySelector('video');
    if (existing) {
      video = existing as HTMLVideoElement;
      return video;
    }

    video = document.createElement('video');
    video.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000';
    video.controls = false;
    video.playsInline = true;
    video.autoplay = false;

    applyPoster();

    api?.container.appendChild(video);
    return video;
  };

  /**
   * Start playback on the element after the remote stream attaches.
   *
   * A rejection is the autoplay policy (no gesture yet, sound on): the
   * element stays paused and the viewer's own play works. It is logged, not
   * reported, because nothing is broken.
   */
  const playElement = async (): Promise<void> => {
    if (!video) return;
    try {
      await video.play();
    } catch (error) {
      isCorePlayRequested = false;
      api?.logger.info('WHEP: autoplay refused; waiting for the viewer', {
        reason: (error as Error)?.name,
      });
    }
  };

  /**
   * Setup element event listeners for the state keys the core reads.
   *
   * @param videoEl - The element
   * @returns Removes every listener this call added
   */
  const setupEventListeners = (videoEl: HTMLVideoElement): (() => void) => {
    // The listeners belong to the source, not to one join: a reconnect
    // attempt bumps the load session and keeps them, and `cleanup()` removes
    // them before a new source or `destroy()` can fire anything at them.
    const handlers: Array<[string, EventListener]> = [];

    const on = (event: string, handler: EventListener) => {
      videoEl.addEventListener(event, handler);
      handlers.push([event, handler]);
    };

    on('play', () => {
      api?.setState('paused', false);
    });

    on('playing', () => {
      api?.setState('playing', true);
      api?.setState('paused', false);
      api?.setState('buffering', false);
      api?.setState('playbackState', 'playing');
      isCorePauseRequested = false;

      if (isCorePlayRequested) {
        isCorePlayRequested = false;
      } else {
        api?.emit('playback:play', undefined);
      }
    });

    on('pause', () => {
      isCorePlayRequested = false;
      api?.setState('playing', false);
      api?.setState('paused', true);
      api?.setState('playbackState', 'paused');

      if (isCorePauseRequested) {
        isCorePauseRequested = false;
      } else {
        api?.emit('playback:pause', undefined);
      }
    });

    on('loadedmetadata', () => {
      // A MediaStream has no duration; the key is 0 for live, as the HLS
      // provider writes it.
      api?.setState('duration', 0);
      api?.emit('media:loadedmetadata', { duration: 0 });
    });

    on('canplay', () => {
      api?.setState('buffering', false);
      api?.emit('media:canplay', undefined);
    });

    on('waiting', () => {
      api?.setState('buffering', true);
      api?.emit('media:waiting', undefined);
    });

    on('volumechange', () => {
      api?.setState('volume', videoEl.volume);
      api?.setState('muted', videoEl.muted);
      api?.emit('volume:change', { volume: videoEl.volume, muted: videoEl.muted });
    });

    on('error', () => {
      // An element error on a MediaStream source is the decoder giving up on
      // the stream it was handed. A fresh join hands it a fresh one.
      const error = videoEl.error;
      api?.logger.error('WHEP: video element error', { mediaErrorCode: error?.code });
      handleFailure({
        code: ErrorCode.MEDIA_DECODE_ERROR,
        message: error?.message || 'Decode error on the WHEP stream',
        recoverable: true,
        detail: { type: 'media', url: sanitizeUrl(currentSrc) },
      });
    });

    return () => {
      for (const [event, handler] of handlers) {
        videoEl.removeEventListener(event, handler);
      }
    };
  };

  /** Stop the latency poll. */
  const stopLatencyPoll = (): void => {
    if (latencyTimer !== null) {
      clearInterval(latencyTimer);
      latencyTimer = null;
    }
  };

  /**
   * Start polling `getStats()` for the latency estimate.
   *
   * The number is the receiver's share of the delay (the jitter buffer over
   * the last second's frames plus half the round trip) and is labelled an
   * estimate wherever it appears; it cannot see the encoder or the server's
   * tap.
   *
   * @param pc - The connection to poll
   */
  const startLatencyPoll = (pc: RTCPeerConnection): void => {
    stopLatencyPoll();
    const session = loadSession;
    // The counters the previous tick saw, so each estimate covers the frames
    // emitted since then rather than the mean since the join.
    let lastSample: LatencySample | null = null;
    latencyTimer = setInterval(() => {
      if (session !== loadSession || peer !== pc || !api) {
        stopLatencyPoll();
        return;
      }
      void pc
        .getStats()
        .then((report) => {
          if (session !== loadSession || !api) return;
          const estimate = estimateLatency(report as unknown as Iterable<unknown>, lastSample);
          if (!estimate) return;
          lastSample = estimate.sample;
          const previous = api.getState('liveLatency');
          if (Math.abs(previous - estimate.latency) > LATENCY_EPSILON) {
            api.setState('liveLatency', estimate.latency);
            api.emit('live:latency', { latency: estimate.latency });
          }
        })
        .catch(() => {
          // A closed connection has no stats; the next tick sees peer changed.
        });
    }, LATENCY_POLL_MS);
  };

  /** Clear the disconnect grace timer. */
  const clearDisconnectTimer = (): void => {
    if (disconnectTimer !== null) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
  };

  /**
   * Close the peer connection and free the session on the server.
   *
   * @param keepalive - Whether the DELETE may outlive the page
   */
  const closeConnection = (keepalive: boolean): void => {
    stopLatencyPoll();
    clearDisconnectTimer();

    const pc = peer;
    peer = null;
    if (pc) {
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        // Already closed.
      }
    }

    const url = sessionUrl;
    sessionUrl = null;
    if (url) {
      void resolveToken().then((token) => deleteSession(url, token, keepalive));
    }

    if (video) {
      video.srcObject = null;
    }
  };

  /**
   * Reset the live keys this provider owns, as the HLS provider does in its
   * own cleanup, so a source change cannot leave the previous stream's
   * latency readout over the new one.
   */
  const resetLiveKeys = (): void => {
    if (!api) return;
    api.setState('liveLatency', 0);
    api.setState('liveEdge', false);
    api.setState('seekableRange', null);
    if (api.getState('lowLatencyMode')) {
      api.setState('lowLatencyMode', false);
      api.emit('live:lowlatency', { enabled: false });
    }
    api.setState('live', false);
  };

  /** Cancel any pending auto-reconnect and reset its bookkeeping. */
  const cancelReconnect = (): void => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;
    reconnectWindowStart = 0;
    reconnectTrigger = null;
    reconnectExhausted = false;
    isReconnecting = false;
  };

  /**
   * Settle the pending load promise, if any.
   *
   * @param error - Rejects with this; resolves when absent
   */
  const settleLoad = (error?: Error): void => {
    const pending = pendingLoad;
    pendingLoad = null;
    if (!pending) return;
    if (error) pending.reject(error);
    else pending.resolve();
  };

  /**
   * Tear down the current source: connection, session, listeners, live keys.
   *
   * @param reason - Why, for the pending load's rejection
   * @param keepalive - Whether the DELETE may outlive the page
   */
  const cleanup = (reason: Error, keepalive: boolean): void => {
    cancelReconnect();
    settleLoad(reason);
    closeConnection(keepalive);

    if (cleanupEvents) {
      cleanupEvents();
      cleanupEvents = null;
    }
    isCorePlayRequested = false;
    isCorePauseRequested = false;
    resetLiveKeys();
  };

  /**
   * Announce that auto-reconnect has given up.
   *
   * Two events fire, exactly once per window: `error:reconnect-exhausted`
   * for lifecycle-driven UIs, then a final fatal `error` carrying
   * `detail.reconnectExhausted` for error-driven ones, the contract the HLS
   * provider set. The pending load, if the source never connected, rejects.
   *
   * @param elapsedMs - How long the provider kept trying
   * @param windowMs - The window it was working against
   */
  const emitReconnectExhausted = (elapsedMs: number, windowMs: number): void => {
    if (reconnectExhausted) return;
    reconnectExhausted = true;
    isReconnecting = false;

    const attempts = reconnectAttempts;
    const trigger = reconnectTrigger;

    api?.emit('error:reconnect-exhausted', { attempts, elapsedMs, windowMs });

    api?.setState('playbackState', 'error');
    api?.setState('buffering', false);
    const message = `WHEP auto-reconnect gave up after ${attempts} attempts over ${Math.round(elapsedMs / 1000)}s`;
    api?.emit('error', {
      code: trigger?.code ?? ErrorCode.PLAYBACK_FAILED,
      message,
      fatal: true,
      timestamp: Date.now(),
      detail: {
        ...(trigger?.detail ?? { type: 'other' }),
        retriesExhausted: true,
        attempts,
        reconnectExhausted: true,
      },
    });
    settleLoad(new Error(message));
  };

  /**
   * Schedule the next reconnect attempt.
   *
   * The delay doubles from the base (the server's `Retry-After` when the
   * failure carried one, the configured base otherwise) until it reaches
   * the cap, jittered down by up to 30% but never below what the server
   * asked for. Giving up is decided by the time window, not an attempt
   * count, so `error:reconnecting` reports `elapsedMs` and `windowMs`.
   *
   * @param failure - The failure this attempt answers
   */
  const scheduleReconnect = (failure: WHEPFailure): void => {
    if (reconnectExhausted) return;
    if (reconnectTimer) return;

    const windowMs = reconnectWindowMs;
    const elapsedMs = Date.now() - reconnectWindowStart;
    if (elapsedMs > windowMs) {
      api?.logger.warn(`WHEP auto-reconnect window exhausted after ${reconnectAttempts} attempts`);
      emitReconnectExhausted(elapsedMs, windowMs);
      return;
    }

    const base = failure.retryAfterMs ?? reconnectBaseDelayMs;
    const cap = Math.max(reconnectMaxDelayMs, base);
    const backoff = Math.min(base * Math.pow(2, reconnectAttempts), cap);
    const jittered = Math.round(backoff * (0.7 + Math.random() * 0.3));
    const delayMs = failure.retryAfterMs ? Math.max(failure.retryAfterMs, jittered) : jittered;

    api?.logger.info(`WHEP: scheduling reconnect attempt ${reconnectAttempts + 1} in ${delayMs}ms`, {
      reason: failure.serverCode ?? failure.message,
    });
    api?.emit('error:reconnecting', {
      attempt: reconnectAttempts + 1,
      delayMs,
      elapsedMs,
      windowMs,
      ...(elapsedMs > LONG_OUTAGE_MS ? { longOutage: true } : {}),
    });

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void attemptReconnect();
    }, delayMs);
  };

  /**
   * Report a failed join or a lost connection, and reconnect when it is
   * worth it.
   *
   * The first failure of a window emits the fatal `error` (the overlay
   * shows it, then `error:reconnecting` turns it into "reconnecting"); the
   * recoverable failures that follow inside the window emit only
   * `error:reconnecting` again, so a stream that is not live for a while
   * does not flash an error every poll. A terminal failure always emits the
   * fatal `error`, ends the window, and rejects the pending load.
   *
   * @param failure - The classification
   */
  const handleFailure = (failure: WHEPFailure): void => {
    if (!api) return;
    const recoverable = failure.recoverable || (hasJoined && failure.detail.httpStatus === 404);
    const willReconnect = recoverable && autoReconnect && currentSrc !== '';
    // Quiet only while the window stays open: a terminal failure inside it
    // (the stream deleted mid-outage, say) must still reach the overlay, or
    // "reconnecting" would stand forever with nothing coming to take it down.
    const reconnecting = isReconnecting && !reconnectExhausted && willReconnect;

    api.setState('buffering', false);
    if (!reconnecting) {
      api.setState('playbackState', 'error');
      api.logger.error(`WHEP: ${failure.message}`, {
        code: failure.code,
        serverCode: failure.serverCode,
        httpStatus: failure.detail.httpStatus,
      });
      api.emit('error', {
        code: failure.code,
        message: failure.message,
        fatal: true,
        timestamp: Date.now(),
        detail: { ...failure.detail, attempts: reconnectAttempts },
      });
    } else {
      api.logger.warn(`WHEP: reconnect attempt ${reconnectAttempts} failed: ${failure.message}`);
    }

    if (!willReconnect) {
      cancelReconnect();
      settleLoad(new Error(failure.message));
      return;
    }

    if (!isReconnecting) {
      isReconnecting = true;
      reconnectWindowStart = Date.now();
      reconnectTrigger = failure;
    }
    scheduleReconnect(failure);
  };

  /**
   * Wait for ICE gathering to complete, bounded.
   *
   * @param pc - The connection
   * @param timeoutMs - The bound
   * @returns Resolves on `complete` or at the bound, whichever is first
   */
  const waitForGathering = (pc: RTCPeerConnection, timeoutMs: number): Promise<void> =>
    new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      let timer: ReturnType<typeof setTimeout> | null = null;
      const done = () => {
        pc.removeEventListener('icegatheringstatechange', check);
        if (timer !== null) clearTimeout(timer);
        resolve();
      };
      const check = () => {
        if (pc.iceGatheringState === 'complete') done();
      };
      pc.addEventListener('icegatheringstatechange', check);
      timer = setTimeout(done, timeoutMs);
    });

  /**
   * One join attempt: offer, POST, answer, connection.
   *
   * Resolves once the connection state reaches `connected`; rejects with a
   * `WHEPError` for anything the scheduler should classify, or a
   * `SupersededError` when a newer session took over mid-flight.
   *
   * @param session - The load session this attempt belongs to
   * @param src - The endpoint
   */
  const connect = async (session: number, src: string): Promise<void> => {
    const superseded = () => session !== loadSession;
    const check = () => {
      if (superseded()) throw new SupersededError('WHEP join superseded');
    };

    const pc = new RTCPeerConnection({ iceServers });
    peer = pc;
    const stream = new MediaStream();

    const abort = new AbortController();
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const connection = new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (watchdog !== null) {
          clearTimeout(watchdog);
          watchdog = null;
        }
        if (error) reject(error);
        else resolve();
      };

      pc.ontrack = (event: RTCTrackEvent) => {
        if (superseded() || peer !== pc || !video) return;
        // Our own stream rather than `event.streams[0]`, so a video-only
        // answer (a tap with no audio) attaches through the same path.
        if (!stream.getTracks().includes(event.track)) {
          stream.addTrack(event.track);
        }
        if (video.srcObject !== stream) {
          video.srcObject = stream;
          void playElement();
        }
      };

      pc.onconnectionstatechange = () => {
        if (superseded() || peer !== pc) return;
        switch (pc.connectionState) {
          case 'connected':
            if (disconnectTimer !== null) {
              // Back inside the grace period: the `buffering` the
              // disconnect raised comes down here, because a MediaStream
              // element fires no `canplay` for a hiccup it never noticed.
              clearDisconnectTimer();
              api?.setState('buffering', false);
            }
            finish();
            break;
          case 'disconnected':
            if (disconnectTimer === null) {
              api?.setState('buffering', true);
              disconnectTimer = setTimeout(() => {
                disconnectTimer = null;
                if (superseded() || peer !== pc) return;
                const failure = classifyTransport('ice', src, 'disconnected');
                if (!settled) finish(new WHEPError(failure));
                else lostConnection(failure);
              }, DISCONNECT_GRACE_MS);
            }
            break;
          case 'failed': {
            clearDisconnectTimer();
            const failure = classifyTransport('ice', src, 'failed');
            if (!settled) finish(new WHEPError(failure));
            else lostConnection(failure);
            break;
          }
          default:
            break;
        }
      };

      if (loadTimeoutMs > 0) {
        watchdog = setTimeout(() => {
          watchdog = null;
          abort.abort();
          finish(new WHEPError(classifyTransport('timeout', src, `${loadTimeoutMs}ms`)));
        }, loadTimeoutMs);
      }

      const exchange = async () => {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const offer = await pc.createOffer();
        check();
        await pc.setLocalDescription(offer);
        check();
        await waitForGathering(pc, GATHER_TIMEOUT_MS);
        check();
        const sdp = pc.localDescription?.sdp ?? offer.sdp ?? '';

        const token = await resolveToken();
        check();
        const result = await postOffer(src, sdp, token, abort.signal);
        if (superseded() || peer !== pc) {
          // The server made a session for a join nobody wants any more:
          // free it now rather than leaving it to the ICE timeout.
          const orphan = result.sessionUrl;
          if (orphan) void resolveToken().then((t) => deleteSession(orphan, t, true));
          throw new SupersededError('WHEP join superseded');
        }
        sessionUrl = result.sessionUrl;

        try {
          await pc.setRemoteDescription({ type: 'answer', sdp: result.answer });
        } catch (error) {
          throw new WHEPError(classifyTransport('answer', src, (error as Error)?.message));
        }
        check();
      };

      exchange().catch((error: unknown) => {
        if (abort.signal.aborted && !(error instanceof WHEPError) && !(error instanceof SupersededError)) {
          // The watchdog aborted the fetch and has already finished.
          return;
        }
        finish(error as Error);
      });
    });

    try {
      await connection;
    } catch (error) {
      if (peer === pc) {
        closeConnection(true);
      }
      throw error;
    }
  };

  /**
   * A connection that was up went down: report and reconnect.
   *
   * @param failure - The classification
   */
  const lostConnection = (failure: WHEPFailure): void => {
    api?.setState('playing', false);
    api?.setState('buffering', true);
    closeConnection(true);
    handleFailure(failure);
  };

  /**
   * Drive one join to its outcome: state on success, the scheduler on
   * failure. Superseded joins report nothing.
   *
   * @param session - The load session
   * @param src - The endpoint
   */
  const join = async (session: number, src: string): Promise<void> => {
    try {
      await connect(session, src);
    } catch (error) {
      if (session !== loadSession || error instanceof SupersededError) return;
      if (error instanceof WHEPError) {
        handleFailure(error.failure);
      } else {
        handleFailure(classifyTransport('fetch', src, (error as Error)?.message));
      }
      return;
    }
    if (session !== loadSession || !api || !peer) return;

    // Apply initial volume/muted state before playback so a muted autoplay
    // is honoured.
    if (video) {
      const muted = api.getState('muted');
      const volume = api.getState('volume');
      if (muted !== undefined) video.muted = muted;
      if (volume !== undefined) video.volume = volume;
    }

    const recovered = isReconnecting;
    const attempt = reconnectAttempts;
    const elapsedMs = Date.now() - reconnectWindowStart;
    cancelReconnect();
    hasJoined = true;

    api.setState('source', { src, type: SOURCE_TYPE });
    // The element can report `playing` before the connection state settles
    // (the tracks arrive with the answer); `ready` must not regress it.
    if (api.getState('playbackState') !== 'playing') {
      api.setState('playbackState', 'ready');
    }
    api.setState('live', true);
    api.setState('liveEdge', true);
    api.setState('seekableRange', null);
    if (!api.getState('lowLatencyMode')) {
      api.setState('lowLatencyMode', true);
      api.emit('live:lowlatency', { enabled: true });
    }
    api.emit('media:loaded', { src, type: SOURCE_TYPE });
    api.logger.info('WHEP: joined', { src: sanitizeUrl(src), session: sessionUrl ? 'yes' : 'none' });

    if (recovered) {
      api.emit('error:recovered', { attempt, elapsedMs });
    }

    startLatencyPoll(peer);
    settleLoad();
  };

  /**
   * One reconnect attempt: leave the dead session, join again.
   */
  const attemptReconnect = async (): Promise<void> => {
    if (!api || currentSrc === '') return;
    const session = ++loadSession;
    reconnectAttempts++;
    const src = currentSrc;

    api.logger.info(`WHEP: reconnect attempt ${reconnectAttempts}`, { src: sanitizeUrl(src) });
    closeConnection(true);
    api.setState('playbackState', 'loading');
    api.setState('buffering', true);

    await join(session, src);
  };

  /**
   * Free the session when the page is going away.
   *
   * `pagehide` is the last event a closing or navigating tab reliably
   * fires; the DELETE rides `keepalive` so it outlives the page and the
   * monitor slot is free at once instead of after the server's ICE timeout.
   */
  const onPageHide = (): void => {
    const url = sessionUrl;
    if (!url) return;
    sessionUrl = null;
    void resolveToken().then((token) => deleteSession(url, token, true));
  };

  // Plugin implementation
  const plugin: IWHEPPlugin = {
    id: 'whep-provider',
    name: 'WHEP Provider',
    version: PKG_VERSION,
    type: 'provider' as PluginType,
    description: 'WebRTC playback over WHEP (WebRTC-HTTP Egress Protocol) for sub-second live monitoring',

    canPlay(src: string): boolean {
      try {
        const url = new URL(src, typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
        return WHEP_PATH.test(url.pathname);
      } catch {
        return WHEP_PATH.test(src);
      }
    },

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      api.logger.info('WHEP plugin initialized');

      const unsubPlay = api.on('playback:play', async () => {
        if (!video) return;
        if (!video.paused) return;
        try {
          isCorePlayRequested = true;
          await video.play();
        } catch (error) {
          isCorePlayRequested = false;
          api?.logger.error('Play failed', error);
        }
      });

      const unsubPause = api.on('playback:pause', () => {
        if (!video) return;
        if (video.paused) {
          if (isCorePlayRequested) {
            isCorePlayRequested = false;
            video.pause();
          }
          return;
        }
        isCorePauseRequested = true;
        isCorePlayRequested = false;
        video.pause();
      });

      const unsubVolume = api.on('volume:change', ({ volume, muted }: { volume: number; muted: boolean }) => {
        if (video) {
          video.volume = volume;
          video.muted = muted;
        }
      });

      const unsubMute = api.on('volume:mute', ({ muted }: { muted: boolean }) => {
        if (video) video.muted = muted;
      });

      // Seeking and rate changes have no meaning on a live WebRTC stream
      // (no DVR window, no buffer to speed through), so neither is wired.

      const unsubPoster = api.subscribeToState((event) => {
        if (event.key === 'poster') applyPoster();
      });

      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', onPageHide);
      }

      api.onDestroy(() => {
        unsubPlay();
        unsubPause();
        unsubVolume();
        unsubMute();
        unsubPoster();
        if (typeof window !== 'undefined') {
          window.removeEventListener('pagehide', onPageHide);
        }
      });
    },

    async destroy(): Promise<void> {
      api?.logger.info('WHEP plugin destroying');

      loadSession++;
      cleanup(new Error('Player destroyed during load'), true);
      currentSrc = '';
      hasJoined = false;

      if (video?.parentNode) {
        video.parentNode.removeChild(video);
      }
      video = null;
      api = null;
    },

    async loadSource(src: string): Promise<void> {
      if (!api) throw new Error('Plugin not initialized');

      api.logger.info('Loading WHEP source', { src: sanitizeUrl(src) });

      // A new load supersedes anything in flight. Bump first so the old
      // session's continuations bail, then settle its promise.
      const session = ++loadSession;
      cleanup(new Error('Load superseded by a newer source'), true);
      currentSrc = src;
      hasJoined = false;

      api.setState('playbackState', 'loading');
      api.setState('buffering', true);
      api.setState('mediaType', 'video');
      api.setState('qualities', []);
      api.setState('currentQuality', null);
      api.setState('duration', 0);
      api.setState('live', true);
      api.setState('liveEdge', true);
      api.setState('seekableRange', null);

      const videoEl = getOrCreateVideo();
      videoEl.style.display = 'block';
      applyPoster();
      cleanupEvents = setupEventListeners(videoEl);

      const load = new Promise<void>((resolve, reject) => {
        pendingLoad = { resolve, reject };
      });
      void join(session, src);
      return load;
    },

    getSessionUrl(): string | null {
      return sessionUrl;
    },
  };

  return plugin;
}

// Default export
export default createWHEPPlugin;
