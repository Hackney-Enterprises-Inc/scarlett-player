import type { AnalyticsConfig, BeaconPayload } from './types';
import { isHttpsUrl, safeStringify } from './helpers';

/** Batch envelope understood by compatible custom ingests (not Laravel v0.3.0). */
export interface BatchEnvelope {
  batch: 1;
  sentAt: number;
  events: BeaconPayload[];
}

/** Dispatch individual 1.19.3 beacons or opt-in, bounded batches.
 * @param config - Analytics configuration.
 * @param logger - Debug logger for header-resolution failures.
 * @param isOptedOut - Live privacy check at dispatch time.
 * @returns Transport methods for ordinary/unload dispatch and flush.
 */
export function createTransport(config: AnalyticsConfig, logger: { debug(message: string, data?: unknown): void }, isOptedOut: () => boolean): {
  send(payload: BeaconPayload): void;
  sendUnload(payload: BeaconPayload): void;
  flush(): void;
  flushUnload(): void;
} {
  const batch = config.batch;
  const enabled = Boolean(batch);
  const options = typeof batch === 'object' ? batch : {};
  const intervalMs = typeof options.intervalMs === 'number' && Number.isFinite(options.intervalMs) && options.intervalMs > 0 ? options.intervalMs : 10000;
  const maxEvents = typeof options.maxEvents === 'number' && Number.isFinite(options.maxEvents) && options.maxEvents > 0 ? Math.floor(options.maxEvents) : 20;
  const queue: BeaconPayload[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const bytes = (body: string) => new TextEncoder().encode(body).length;
  const envelope = (events: BeaconPayload[]): BatchEnvelope => ({ batch: 1, sentAt: Date.now(), events });
  const bodyFor = (events: BeaconPayload[]) => safeStringify(envelope(events));

  /** Drop pending work whenever an active privacy signal is observed. */
  function blocked(): boolean {
    if (!isOptedOut()) return false;
    clearTimer();
    queue.length = 0;
    return true;
  }

  /** Merge header names case-insensitively, preserving the existing HTTPS-only key rule. */
  function beaconHeaders(extra: Record<string, string>): Headers {
    const headers = new Headers({ 'Content-Type': 'application/json', ...(config.apiKey && isHttpsUrl(config.beaconUrl) ? { 'X-API-Key': config.apiKey } : {}) });
    for (const [name, value] of Object.entries(extra)) headers.set(name, value);
    return headers;
  }

  /** Post a fully serialized body without blocking playback. */
  function post(body: string): void {
    const dispatch = (extra: Record<string, string>) => {
      if (blocked()) return;
      try {
        fetch(config.beaconUrl, { method: 'POST', headers: beaconHeaders(extra), body, keepalive: true }).catch(() => {});
      } catch { /* Transport must never interrupt playback. */ }
    };
    const configured = config.headers;
    if (typeof configured !== 'function') { dispatch(configured ?? {}); return; }
    Promise.resolve().then(() => configured()).then(dispatch).catch((error) => {
      logger.debug('Analytics headers() failed; sending without them', { error });
      dispatch({});
    });
  }

  /**
   * Headers for the unload fetch fallback, resolved without waiting: pagehide
   * cannot await, so a headers() function is called once and only a plain
   * object result is used. A promise result is dropped, with a rejection
   * handler so a failing token fetch never becomes an unhandled rejection.
   */
  function unloadHeaders(): Record<string, string> {
    const configured = config.headers;
    if (typeof configured !== 'function') return configured ?? {};
    try {
      const result = configured();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        Promise.resolve(result).catch((error) => {
          logger.debug('Analytics headers() rejected on unload; sent without them', { error });
        });
        return {};
      }
      if (result && typeof result === 'object') {
        const prototype = Object.getPrototypeOf(result);
        if (prototype === Object.prototype || prototype === null) return result as Record<string, string>;
      }
      return {};
    } catch (error) {
      logger.debug('Analytics headers() failed on unload; sending without them', { error });
      return {};
    }
  }

  /** Send one body on the unload transport, with the legacy fetch fallback. */
  function unload(body: string): void {
    if (blocked()) return;
    if (navigator.sendBeacon) {
      let url = config.beaconUrl;
      if (config.apiKey && isHttpsUrl(config.beaconUrl)) {
        try {
          const base = typeof window !== 'undefined' && window.location?.href ? window.location.href : undefined;
          const parsed = base ? new URL(url, base) : new URL(url);
          parsed.searchParams.set('api_key', config.apiKey);
          url = parsed.toString();
        } catch {
          url = `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(config.apiKey)}`;
        }
      }
      try { if (!blocked() && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return; } catch { /* Fetch fallback. */ }
    }
    if (blocked()) return;
    const extra = unloadHeaders();
    try {
      fetch(config.beaconUrl, { method: 'POST', headers: beaconHeaders(extra), body, keepalive: true }).catch(() => {});
    } catch { /* Transport must never interrupt playback. */ }
  }

  /** Stop the pending flush timer. */
  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  /** Drain the queue into one bounded envelope using the requested transport. */
  function flushWith(dispatch: (body: string) => void): void {
    if (blocked()) return;
    clearTimer();
    if (queue.length) dispatch(bodyFor(queue.splice(0)));
  }

  /** Enqueue one payload, splitting before 60,000 bytes or on the event limit. */
  function send(payload: BeaconPayload): void {
    if (blocked()) return;
    if (config.customBeacon) { config.customBeacon(config.beaconUrl, payload); return; }
    if (!enabled) { post(safeStringify(payload)); return; }
    if (bytes(bodyFor([payload])) > 60000) {
      flushWith(post);
      post(safeStringify(payload));
      return;
    }
    if (queue.length && bytes(bodyFor([...queue, payload])) > 60000) flushWith(post);
    queue.push(payload);
    if (queue.length >= maxEvents || payload.event === 'viewEnd' || (payload.event === 'error' && payload.fatal === true)) {
      flushWith(post);
    } else if (timer === null) timer = setTimeout(() => flushWith(post), intervalMs);
  }

  /** Unload the pending queue and final payload as one batch if it fits. */
  function sendUnload(payload: BeaconPayload): void {
    if (blocked()) return;
    if (config.customBeacon) { config.customBeacon(config.beaconUrl, payload); return; }
    if (!enabled) { unload(safeStringify(payload)); return; }
    if (queue.length && bytes(bodyFor([...queue, payload])) > 60000) flushWith(unload);
    if (bytes(bodyFor([payload])) > 60000) { unload(safeStringify(payload)); return; }
    queue.push(payload);
    flushWith(unload);
  }

  return { send, sendUnload, flush: () => flushWith(post), flushUnload: () => flushWith(unload) };
}
