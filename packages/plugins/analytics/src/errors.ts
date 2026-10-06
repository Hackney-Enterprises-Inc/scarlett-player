import type { ErrorCategory } from './types';

/** Map structured player error code/detail to a stable category (no message inspection).
 * A player code or `detail.type` wins; failing those, an element `detail.mediaErrorCode`
 * classifies (2 network, 3 media, 4 source).
 * @param error - Error or player error with code/detail.
 * @returns First matching category, or unknown.
 */
export function classifyError(error: { code?: unknown; detail?: unknown; message?: unknown }): ErrorCategory {
  const detail = error.detail && typeof error.detail === 'object' ? error.detail as Record<string, unknown> : {};
  if ([401, 403, 451].includes(detail.httpStatus as number)) return 'access';
  if (['MEDIA_NETWORK_ERROR', 'SOURCE_LOAD_FAILED'].includes(error.code as string) || detail.type === 'network') return 'network';
  if (['MEDIA_DECODE_ERROR', 'MEDIA_APPEND_ERROR', 'MEDIA_BUFFER_FULL'].includes(error.code as string) || detail.type === 'media') return 'media';
  if (['SOURCE_NOT_SUPPORTED', 'PLAYLIST_INVALID', 'PROVIDER_NOT_FOUND'].includes(error.code as string)) return 'source';
  if (error.code === 'PLAYBACK_FAILED') return 'playback';
  if (['PROVIDER_SETUP_FAILED', 'PLUGIN_SETUP_FAILED', 'PLUGIN_NOT_FOUND'].includes(error.code as string)) return 'player';
  if (detail.mediaErrorCode === 2) return 'network';
  if (detail.mediaErrorCode === 3) return 'media';
  if (detail.mediaErrorCode === 4) return 'source';
  return 'unknown';
}

/** Copy only permitted structured diagnostics; never include a URL or arbitrary detail.
 * @param detail - PlayerError.detail, if any.
 * @returns Flat, validated diagnostic keys.
 */
export function errorDetail(detail: unknown): Record<string, number | boolean> {
  if (!detail || typeof detail !== 'object') return {};
  const input = detail as Record<string, unknown>;
  const result: Record<string, number | boolean> = {};
  for (const key of ['httpStatus', 'mediaErrorCode', 'networkState', 'readyState', 'attempts']) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) result[key] = input[key] as number;
  }
  for (const key of ['retriesExhausted', 'reconnectExhausted', 'reconnecting', 'timedOut']) {
    if (typeof input[key] === 'boolean') result[key] = input[key] as boolean;
  }
  return result;
}

/** Host name of the playing source, for the error beacon: no scheme, port, path, query or fragment.
 * A relative source resolves against the page.
 * @param src - The `source` state's URL.
 * @returns The host name, or undefined when the source has none (blob:, data:, empty, unparseable).
 */
export function sourceHost(src: unknown): string | undefined {
  if (typeof src !== 'string' || src === '') return undefined;
  try {
    const base = typeof document !== 'undefined' ? document.baseURI : undefined;
    return new URL(src, base).hostname || undefined;
  } catch {
    return undefined;
  }
}

/** Strip URL query/fragment credentials from messages without using text to classify errors.
 * @param message - Original diagnostic message.
 * @returns Message with URL query strings and fragments redacted.
 */
export function safeErrorMessage(message: string): string {
  return message.replace(/https?:\/\/[^\s)]+/g, (url) => {
    try { const parsed = new URL(url); return parsed.origin + parsed.pathname; } catch { return '[url]'; }
  });
}
