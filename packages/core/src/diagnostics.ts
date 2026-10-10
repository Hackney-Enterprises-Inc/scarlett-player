/**
 * Diagnostics snapshot collection and projection for Scarlett Player core.
 *
 * Implements synchronous, side-effect free, typed and bounded snapshots
 * adhering to schemaVersion: 1.
 */

import { ErrorCode, type PlayerError, type PlayerErrorDetail } from './error-handler';
import type { Plugin } from './types/plugin';
import type {
  PlayerDiagnosticsSnapshot,
  DiagnosticsPlaybackState,
  DiagnosticError,
  DiagnosticTimeRange,
} from './types/diagnostics';
import type { StateManager } from './state/state-manager';
import type { ErrorHandler } from './error-handler';
import type { PluginManager } from './plugin-manager';

/**
 * Maximum items for bounds enforcement.
 */
export const DIAGNOSTIC_LIMITS = {
  MAX_ERRORS: 20,
  MAX_TIME_RANGES: 32,
  MAX_OBJECT_KEYS: 64,
  MAX_ARRAY_ITEMS: 50,
  MAX_NESTING_DEPTH: 4,
  MAX_NODES: 500,
} as const;

/**
 * Forbidden prototype-mutating keys.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sensitive field patterns to omit from untrusted provider data.
 */
const SENSITIVE_KEY_RE = /(token|secret|password|credential|auth|authorization|cookie|session|signature)/i;

/**
 * Object keys an untrusted contribution may carry: short identifiers only, so
 * URLs, query strings and free text cannot ride in as keys.
 */
const SAFE_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/**
 * Identity and location-like keys omitted from untrusted provider data
 * (compared lower-cased).
 */
const IDENTITY_KEYS: ReadonlySet<string> = new Set([
  'id',
  'userid',
  'viewerid',
  'uid',
  'email',
  'ip',
  'url',
  'uri',
  'src',
  'href',
  'key',
]);

/**
 * The only string values an untrusted contribution may carry: the categorical
 * values the built-in providers report (HLS engine, WebRTC connection, ICE and
 * signaling states). Every other string is omitted, because secrets and
 * identifiers can sit anywhere in free text and no redaction pattern makes an
 * arbitrary string safe.
 */
export const SAFE_DIAGNOSTIC_STRINGS: ReadonlySet<string> = new Set([
  'hls.js',
  'native',
  'new',
  'connecting',
  'connected',
  'disconnected',
  'failed',
  'closed',
  'checking',
  'completed',
  'stable',
  'have-local-offer',
  'have-remote-offer',
  'have-local-pranswer',
  'have-remote-pranswer',
]);

/**
 * Running count of values a sanitization pass dropped or cut short.
 */
export interface SanitizeReport {
  /** Number of values, keys or array entries omitted */
  omitted: number;
  /** Values visited so far, checked against DIAGNOSTIC_LIMITS.MAX_NODES; managed by the sanitizer */
  nodes?: number;
}

/** True while provider contributions are being collected (re-entrancy guard). */
let collecting = false;

/**
 * Known error categories.
 */
const KNOWN_ERROR_CATEGORIES = new Set([
  'playback',
  'network',
  'media',
  'source',
  'player',
  'access',
  'unknown',
]);

/**
 * Whitelisted error detail fields.
 */
const WHITELISTED_DETAIL_NUMERICS = [
  'httpStatus',
  'mediaErrorCode',
  'networkState',
  'readyState',
  'attempts',
] as const;

const WHITELISTED_DETAIL_BOOLEANS = [
  'retriesExhausted',
  'reconnectExhausted',
  'reconnecting',
  'timedOut',
] as const;

/**
 * Extract hostname without scheme, port, credentials, path, query or fragment.
 */
export function extractHostname(src: unknown): string | null {
  if (typeof src !== 'string' || src.trim() === '') return null;
  try {
    const base = typeof document !== 'undefined' ? document.baseURI : undefined;
    const url = new URL(src, base);
    if (url.protocol === 'blob:' || url.protocol === 'data:') return null;
    return url.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Sanitize an untrusted value returned from a provider getDiagnostics hook.
 *
 * Keeps finite numbers, booleans, null and allowlisted categorical strings
 * (SAFE_DIAGNOSTIC_STRINGS) inside plain objects and arrays. Plain means an
 * object whose prototype is Object.prototype or null; typed arrays, Map, Set,
 * Date, class instances, DOM nodes and Error are omitted. Object keys must match
 * `[A-Za-z][A-Za-z0-9_]{0,39}`, and identity or location-like keys (id, userId,
 * viewerId, uid, email, ip, url, uri, src, href, key), sensitive-looking keys and
 * prototype-mutating keys are omitted. Cycles, promises, throwing getters and
 * anything past the depth (applied to every value, primitives included), key,
 * array or node-budget caps are omitted too. Omissions are counted in `report`.
 *
 * @param value - Untrusted value to sanitize
 * @param depth - Current nesting depth (1 for the contribution root)
 * @param seen - Objects already visited, for cycle detection
 * @param report - Receives the count of omitted values and tracks the nodes
 *   visited against MAX_NODES; pass one fresh report per contribution
 * @returns The sanitized value, or undefined when the value is omitted entirely
 */
export function sanitizeUntrustedContribution(
  value: unknown,
  depth = 1,
  seen: WeakSet<object> = new WeakSet(),
  report: SanitizeReport = { omitted: 0 }
): unknown {
  if (value === undefined) return undefined;

  if (depth > DIAGNOSTIC_LIMITS.MAX_NESTING_DEPTH) {
    report.omitted++;
    return undefined;
  }

  report.nodes = (report.nodes ?? 0) + 1;
  if (report.nodes > DIAGNOSTIC_LIMITS.MAX_NODES) {
    report.omitted++;
    return undefined;
  }

  if (value === null) return null;
  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    // Only allowlisted categorical values survive; see SAFE_DIAGNOSTIC_STRINGS.
    if (SAFE_DIAGNOSTIC_STRINGS.has(value)) return value;
    report.omitted++;
    return undefined;
  }

  // Reject functions, symbols, bigints and promises
  if (
    typeof value !== 'object' ||
    typeof (value as any).then === 'function' ||
    value instanceof Promise
  ) {
    report.omitted++;
    return undefined;
  }

  if (seen.has(value)) {
    report.omitted++;
    return undefined;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    const limit = Math.min(value.length, DIAGNOSTIC_LIMITS.MAX_ARRAY_ITEMS);
    report.omitted += value.length - limit;
    for (let i = 0; i < limit; i++) {
      if (report.nodes >= DIAGNOSTIC_LIMITS.MAX_NODES) {
        report.omitted += limit - i;
        break;
      }
      try {
        // Read the element (index getter or own property may throw) and
        // recurse; dropping one bad element instead of aborting the array.
        const sanitized = sanitizeUntrustedContribution(value[i], depth + 1, seen, report);
        if (sanitized !== undefined) {
          result.push(sanitized);
        }
      } catch {
        report.omitted++;
      }
    }
    return result;
  }

  if (!isPlainObject(value)) {
    report.omitted++;
    return undefined;
  }

  const result: Record<string, unknown> = Object.create(null);
  const keys = Object.keys(value);

  for (let i = 0; i < keys.length; i++) {
    if (i >= DIAGNOSTIC_LIMITS.MAX_OBJECT_KEYS || report.nodes >= DIAGNOSTIC_LIMITS.MAX_NODES) {
      report.omitted += keys.length - i;
      break;
    }

    const key = keys[i]!;
    if (!isAllowedKey(key)) {
      report.omitted++;
      continue;
    }

    try {
      const val = (value as Record<string, unknown>)[key];
      const sanitized = sanitizeUntrustedContribution(val, depth + 1, seen, report);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    } catch {
      // Throwing getter or access error - omit this key
      report.omitted++;
    }
  }

  return result;
}

/**
 * Whether a value is a plain object (prototype Object.prototype or null).
 *
 * @param value - Object to test
 * @returns True for plain objects; false for class instances, typed arrays,
 *   Map, Set, Date, DOM nodes, Error and objects whose prototype cannot be read
 */
function isPlainObject(value: object): boolean {
  try {
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
  } catch {
    return false;
  }
}

/**
 * Whether an untrusted object key may appear in a sanitized contribution.
 *
 * @param key - Own enumerable key of an untrusted object
 * @returns True when the key is a short identifier that is not prototype-mutating,
 *   sensitive, or identity or location-like
 */
function isAllowedKey(key: string): boolean {
  return (
    SAFE_KEY_RE.test(key) &&
    !FORBIDDEN_KEYS.has(key) &&
    !IDENTITY_KEYS.has(key.toLowerCase()) &&
    !SENSITIVE_KEY_RE.test(key)
  );
}

/**
 * Collect sanitized contributions from ready provider plugins.
 *
 * A provider without the hook maps to null; a throwing hook, a promise or an
 * unusable value maps to `{ unavailable: true }` without exception text. A call
 * made from inside a provider's own hook returns an empty map rather than
 * recursing.
 *
 * @param providers - Ready provider plugins to ask
 * @param truncated - Optional list that receives, sorted, the ids of providers
 *   whose contribution had anything omitted or cut short
 * @returns Contributions keyed by plugin id, in a null-prototype map
 */
export function collectProviderDiagnostics(
  providers: Plugin[],
  truncated?: string[]
): Record<string, unknown> {
  const contributions: Record<string, unknown> = Object.create(null);

  // A hook that calls back into collection gets an empty map instead of recursion.
  if (collecting) return contributions;
  collecting = true;
  try {
    collectInto(contributions, providers, truncated);
  } finally {
    collecting = false;
  }
  return contributions;
}

function collectInto(
  contributions: Record<string, unknown>,
  providers: Plugin[],
  truncated?: string[]
): void {
  for (const provider of providers) {
    if (!provider || typeof provider.id !== 'string') continue;
    if (FORBIDDEN_KEYS.has(provider.id)) continue;

    if (typeof provider.getDiagnostics !== 'function') {
      contributions[provider.id] = null;
      continue;
    }

    try {
      const raw = provider.getDiagnostics();
      if (raw === null || raw === undefined) {
        contributions[provider.id] = null;
      } else if (typeof (raw as any).then === 'function' || raw instanceof Promise) {
        // Promises are forbidden at synchronous collection boundary
        contributions[provider.id] = { unavailable: true };
      } else {
        const report: SanitizeReport = { omitted: 0 };
        const sanitized = sanitizeUntrustedContribution(raw, 1, new WeakSet(), report);
        contributions[provider.id] = sanitized !== undefined ? sanitized : { unavailable: true };
        if (report.omitted > 0) truncated?.push(provider.id);
      }
    } catch {
      contributions[provider.id] = { unavailable: true };
    }
  }

  truncated?.sort();
}

/**
 * Classify a player error into a known categorical string.
 *
 * Prefers a known `context.category`, then HTTP access statuses, error codes,
 * detail type and finally the media error code.
 *
 * @param error - Player error to classify
 * @returns One of playback, network, media, source, player, access or unknown
 */
export function classifyDiagnosticErrorCategory(error: PlayerError): string {
  if (error.context?.category && KNOWN_ERROR_CATEGORIES.has(error.context.category)) {
    return error.context.category;
  }

  const detail = (error.detail || {}) as PlayerErrorDetail;
  if ([401, 403, 451].includes(detail.httpStatus as number)) return 'access';

  if (
    error.code === ErrorCode.MEDIA_NETWORK_ERROR ||
    error.code === ErrorCode.SOURCE_LOAD_FAILED ||
    detail.type === 'network'
  ) {
    return 'network';
  }

  if (
    error.code === ErrorCode.MEDIA_DECODE_ERROR ||
    error.code === ErrorCode.MEDIA_APPEND_ERROR ||
    error.code === ErrorCode.MEDIA_BUFFER_FULL ||
    detail.type === 'media'
  ) {
    return 'media';
  }

  if (
    error.code === ErrorCode.SOURCE_NOT_SUPPORTED ||
    error.code === ErrorCode.PLAYLIST_INVALID ||
    error.code === ErrorCode.PROVIDER_NOT_FOUND
  ) {
    return 'source';
  }

  if (error.code === ErrorCode.PLAYBACK_FAILED) {
    return 'playback';
  }

  if (
    error.code === ErrorCode.PROVIDER_SETUP_FAILED ||
    error.code === ErrorCode.PLUGIN_SETUP_FAILED ||
    error.code === ErrorCode.PLUGIN_NOT_FOUND
  ) {
    return 'player';
  }

  if (detail.mediaErrorCode === 2) return 'network';
  if (detail.mediaErrorCode === 3) return 'media';
  if (detail.mediaErrorCode === 4) return 'source';

  return 'unknown';
}

/**
 * Project bounded structured errors for diagnostics export.
 *
 * Error history is oldest-first, so when it exceeds `limit` the newest `limit`
 * entries are kept. Only the code, category, fatal flag, timestamp and
 * whitelisted numeric and boolean detail fields are copied; messages and
 * context never leave.
 *
 * @param errors - Error history, oldest first
 * @param limit - Maximum entries to return (default DIAGNOSTIC_LIMITS.MAX_ERRORS)
 * @returns Projected errors, oldest first
 */
export function projectDiagnosticErrors(
  errors: readonly PlayerError[],
  limit = DIAGNOSTIC_LIMITS.MAX_ERRORS
): DiagnosticError[] {
  const result: DiagnosticError[] = [];
  const knownCodes = new Set(Object.values(ErrorCode) as string[]);

  const slice = limit > 0 ? errors.slice(-limit) : [];
  for (const err of slice) {
    const code = knownCodes.has(err.code) ? err.code : 'UNKNOWN_ERROR';
    const category = classifyDiagnosticErrorCategory(err);
    const fatal = Boolean(err.fatal);
    const timestamp = Number.isFinite(err.timestamp) ? err.timestamp : Date.now();

    const entry: DiagnosticError = {
      code,
      category,
      fatal,
      timestamp,
    };

    if (err.detail && typeof err.detail === 'object') {
      const detailObj: Record<string, number | boolean> = {};
      let hasDetail = false;

      for (const numKey of WHITELISTED_DETAIL_NUMERICS) {
        const val = (err.detail as any)[numKey];
        if (typeof val === 'number' && Number.isFinite(val)) {
          detailObj[numKey] = val;
          hasDetail = true;
        }
      }

      for (const boolKey of WHITELISTED_DETAIL_BOOLEANS) {
        const val = (err.detail as any)[boolKey];
        if (typeof val === 'boolean') {
          detailObj[boolKey] = val;
          hasDetail = true;
        }
      }

      if (hasDetail) {
        entry.detail = detailObj;
      }
    }

    result.push(entry);
  }

  return result;
}

/**
 * Project safe playback state from StateManager and container.
 *
 * @param stateManager - State to read, or null when unavailable
 * @param container - Player container, used to read the video element's decoded size
 * @param isDestroyed - True after the player is destroyed
 * @returns A sanitized playback state; a fixed "destroyed" projection when the
 *   player is destroyed or has no state manager. The source is reduced to its
 *   host name and type.
 */
export function projectPlaybackState(
  stateManager: StateManager | null,
  container: HTMLElement | null,
  isDestroyed: boolean
): DiagnosticsPlaybackState {
  if (isDestroyed || !stateManager) {
    return {
      playbackState: 'destroyed',
      playing: false,
      paused: false,
      ended: false,
      buffering: false,
      seeking: false,
      currentTime: null,
      duration: null,
      volume: null,
      muted: null,
      playbackRate: null,
      mediaType: null,
      live: null,
      seekableRange: null,
      liveEdge: null,
      liveLatency: null,
      dimensions: null,
      source: null,
    };
  }

  const rawState = stateManager.snapshot();

  const currentTime = Number.isFinite(rawState.currentTime) ? rawState.currentTime : null;
  const duration = Number.isFinite(rawState.duration) ? rawState.duration : null;
  const volume = Number.isFinite(rawState.volume) ? rawState.volume : null;
  const playbackRate = Number.isFinite(rawState.playbackRate) ? rawState.playbackRate : null;

  let mediaType: string | null = null;
  if (rawState.mediaType === 'video' || rawState.mediaType === 'audio') {
    mediaType = rawState.mediaType;
  }

  let seekableRange: DiagnosticTimeRange | null = null;
  if (
    rawState.seekableRange &&
    typeof rawState.seekableRange.start === 'number' &&
    typeof rawState.seekableRange.end === 'number' &&
    Number.isFinite(rawState.seekableRange.start) &&
    Number.isFinite(rawState.seekableRange.end)
  ) {
    seekableRange = {
      start: rawState.seekableRange.start,
      end: rawState.seekableRange.end,
    };
  }

  let liveEdge: boolean | null = null;
  let liveLatency: number | null = null;
  if (rawState.live) {
    liveEdge = typeof rawState.liveEdge === 'boolean' ? rawState.liveEdge : null;
    liveLatency = Number.isFinite(rawState.liveLatency) ? rawState.liveLatency : null;
  }

  let dimensions: { width: number; height: number } | null = null;
  if (container) {
    const video = container.querySelector('video') as HTMLVideoElement | null;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      dimensions = { width: video.videoWidth, height: video.videoHeight };
    }
  }

  let source: { hostname: string | null; type?: string | null } | null = null;
  if (rawState.source && rawState.source.src) {
    source = {
      hostname: extractHostname(rawState.source.src),
      ...(rawState.source.type ? { type: rawState.source.type } : {}),
    };
  }

  return {
    playbackState: rawState.playbackState || 'idle',
    playing: Boolean(rawState.playing),
    paused: Boolean(rawState.paused),
    ended: Boolean(rawState.ended),
    buffering: Boolean(rawState.buffering),
    seeking: Boolean(rawState.seeking),
    currentTime,
    duration,
    volume,
    muted: typeof rawState.muted === 'boolean' ? rawState.muted : false,
    playbackRate,
    mediaType,
    live: Boolean(rawState.live),
    seekableRange,
    liveEdge,
    liveLatency,
    dimensions,
    source,
  };
}

/**
 * Options for generating a diagnostics snapshot.
 */
export interface GenerateDiagnosticsOptions {
  /** State to project the playback state from; `null` yields the destroyed-player snapshot. */
  stateManager: StateManager | null;
  /** Source of the recent error history; `null` yields no errors. */
  errorHandler: ErrorHandler | null;
  /** Source of the ready provider plugins; `null` yields no provider contributions. */
  pluginManager: PluginManager | null;
  /** Player container, read for the media element's video dimensions; `null` leaves them unknown. */
  container: HTMLElement | null;
  /** Whether the player was destroyed; a destroyed player yields the empty snapshot. */
  isDestroyed: boolean;
  /** Player version reported in the snapshot's `playerVersion`. */
  playerVersion: string;
}

/**
 * Generate a complete, side-effect free PlayerDiagnosticsSnapshot.
 *
 * @param options - State, error handler, plugin manager and container to read,
 *   plus the destroyed flag and player version
 * @returns The schemaVersion 1 snapshot; an empty one with a destroyed playback
 *   state when the player is destroyed or has no state manager
 */
export function generateDiagnosticsSnapshot(
  options: GenerateDiagnosticsOptions
): PlayerDiagnosticsSnapshot {
  const timestamp = Date.now();
  const playerVersion = options.playerVersion;

  if (options.isDestroyed || !options.stateManager) {
    return {
      schemaVersion: 1,
      timestamp,
      playerVersion,
      playbackState: projectPlaybackState(null, null, true),
      errors: [],
      providers: Object.create(null),
      truncatedProviders: [],
    };
  }

  const playbackState = projectPlaybackState(
    options.stateManager,
    options.container,
    false
  );

  const errors = options.errorHandler
    ? projectDiagnosticErrors(options.errorHandler.getHistory())
    : [];

  const readyProviders = options.pluginManager
    ? options.pluginManager
        .getReadyPlugins()
        .filter((p) => p.type === 'provider')
    : [];

  const truncatedProviders: string[] = [];
  const providers = collectProviderDiagnostics(readyProviders, truncatedProviders);

  return {
    schemaVersion: 1,
    timestamp,
    playerVersion,
    playbackState,
    errors,
    providers,
    truncatedProviders,
  };
}
