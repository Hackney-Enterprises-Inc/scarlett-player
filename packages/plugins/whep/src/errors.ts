/**
 * Failure classification for the WHEP exchange.
 *
 * Every way a join can fail, over HTTP, over the transport, or on the clock,
 * is reduced to one {@link WHEPFailure}: the player error code the core
 * understands, whether the reconnect scheduler should take it, and the
 * server's own `Retry-After` when it gave one. The README's error table is
 * the human copy of {@link classifyResponse}; keep the two in step.
 */

import { ErrorCode, type PlayerErrorDetail, sanitizeUrl } from '@scarlett-player/core';

/**
 * One classified failure.
 */
export interface WHEPFailure {
  /** The player error code the failure maps onto. */
  code: ErrorCode;
  /** Viewer-facing message. */
  message: string;
  /**
   * Whether the reconnect scheduler should retry. A failure the server
   * says will clear (not live yet, at the monitor cap) or one the network
   * caused is; a refused token, an unknown stream, or a codec the server
   * cannot serve is not, because retrying cannot change the answer.
   */
  recoverable: boolean;
  /** The server's `Retry-After`, in milliseconds, when it sent one. */
  retryAfterMs?: number;
  /** The error code the server's JSON envelope carried, when it had one. */
  serverCode?: string;
  /** Diagnostics attached to the emitted error. */
  detail: PlayerErrorDetail;
}

/**
 * The exception the exchange throws, carrying its classification.
 */
export class WHEPError extends Error {
  /** The classified failure. */
  readonly failure: WHEPFailure;

  /**
   * @param failure - The classification to carry
   */
  constructor(failure: WHEPFailure) {
    super(failure.message);
    this.name = 'WHEPError';
    this.failure = failure;
  }
}

/** The only body type a WHEP offer or answer travels as. */
export const SDP_MEDIA_TYPE = 'application/sdp';

/**
 * Parse an `Retry-After` header into milliseconds.
 *
 * Both spellings the header allows are read: a delta in seconds, and an
 * HTTP-date (measured against `now`). A date in the past, or anything
 * unparseable, yields `undefined` so the backoff falls back to its own base.
 *
 * @param value - The raw header value, or `null` when absent
 * @param now - The current time in milliseconds since the epoch
 * @returns The delay in milliseconds, or `undefined`
 */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  const delta = at - now;
  return delta > 0 ? delta : undefined;
}

/**
 * Read the `error.code` and `error.message` out of a JSON error envelope.
 *
 * Tmesis answers every non-201 with `{"error":{"code":...,"message":...}}`;
 * MediaMTX with `{"status":"error","error":"<message>"}`, which yields the
 * message alone. Another server may answer with anything, so a body that
 * is neither shape yields nothing rather than throwing.
 *
 * @param body - The response body text
 * @returns The code and message found, each possibly `undefined`
 */
export function readErrorEnvelope(body: string): { code?: string; message?: string } {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body) as { error?: { code?: unknown; message?: unknown } | string };
    const error = parsed?.error;
    if (typeof error === 'string') return error ? { message: error } : {};
    if (!error || typeof error !== 'object') return {};
    return {
      code: typeof error.code === 'string' ? error.code : undefined,
      message: typeof error.message === 'string' ? error.message : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Classify a non-201 answer to the offer.
 *
 * @param status - The HTTP status
 * @param contentType - The response's `Content-Type`, or `null`
 * @param retryAfter - The response's `Retry-After`, or `null`
 * @param body - The response body text
 * @param url - The endpoint URL, sanitized before it reaches the detail
 * @returns The classification
 */
export function classifyResponse(
  status: number,
  contentType: string | null,
  retryAfter: string | null,
  body: string,
  url: string
): WHEPFailure {
  const envelope = readErrorEnvelope(body);
  const detail: PlayerErrorDetail = { type: 'network', httpStatus: status, url: sanitizeUrl(url) };
  const retryAfterMs = parseRetryAfter(retryAfter);
  const said = envelope.message ? `: ${envelope.message}` : '';

  switch (status) {
    case 401:
    case 403:
      // Core has no auth-flavoured code; the status in the detail is how a
      // host tells a refused token from a missing stream.
      return {
        code: ErrorCode.SOURCE_LOAD_FAILED,
        message: `WHEP endpoint refused the token (${status})${said}`,
        recoverable: false,
        serverCode: envelope.code,
        detail,
      };

    case 404:
      return {
        code: ErrorCode.SOURCE_LOAD_FAILED,
        message: `WHEP endpoint not found (404)${said}`,
        recoverable: false,
        serverCode: envelope.code,
        detail,
      };

    case 406: {
      // WHEP 4.3.2 lets a server answer 406 with an SDP counter-offer the
      // player must answer over PATCH. This plugin does not (v1: it consumes
      // a 201 answer only), so a counter-offer is reported as unplayable
      // with the reason in the message rather than silently ignored.
      const counterOffer = (contentType ?? '').toLowerCase().startsWith(SDP_MEDIA_TYPE);
      return {
        code: ErrorCode.SOURCE_LOAD_FAILED,
        message: counterOffer
          ? 'WHEP server sent a counter-offer (406 with an SDP body); this plugin does not support server offers'
          : `WHEP server cannot serve a codec this browser accepts (406)${said}`,
        recoverable: false,
        serverCode: envelope.code,
        detail: { ...detail, type: 'media' },
      };
    }

    case 409:
      // Tmesis: not_live. The publisher is not there yet, or the tap has not
      // delivered its init. Retry-After says when to ask again.
      return {
        code: ErrorCode.MEDIA_NETWORK_ERROR,
        message: `WHEP stream is not live yet (409)${said}`,
        recoverable: true,
        retryAfterMs,
        serverCode: envelope.code,
        detail,
      };

    case 503:
      // Tmesis: max_monitors or preview_disabled, each with Retry-After.
      return {
        code: ErrorCode.MEDIA_NETWORK_ERROR,
        message: `WHEP endpoint unavailable (503)${said}`,
        recoverable: true,
        retryAfterMs,
        serverCode: envelope.code,
        detail,
      };

    case 400:
    case 405:
    case 413:
    case 415:
      return {
        code: ErrorCode.SOURCE_LOAD_FAILED,
        message: `WHEP endpoint rejected the offer (${status})${said}`,
        recoverable: false,
        serverCode: envelope.code,
        detail,
      };

    default:
      if (status >= 500) {
        return {
          code: ErrorCode.MEDIA_NETWORK_ERROR,
          message: `WHEP endpoint failed (${status})${said}`,
          recoverable: true,
          retryAfterMs,
          serverCode: envelope.code,
          detail,
        };
      }
      return {
        code: ErrorCode.SOURCE_LOAD_FAILED,
        message: `WHEP endpoint answered ${status}${said}`,
        recoverable: false,
        serverCode: envelope.code,
        detail,
      };
  }
}

/**
 * The failures that happen below HTTP: every one is recoverable, because
 * none of them is an answer from the server.
 */
export type TransportFailureKind = 'fetch' | 'ice' | 'timeout' | 'answer';

/**
 * Classify a failure that never produced an HTTP status.
 *
 * @param kind - Which stage failed
 * @param url - The endpoint URL, sanitized before it reaches the detail
 * @param cause - The underlying message, when there is one
 * @returns The classification
 */
export function classifyTransport(kind: TransportFailureKind, url: string, cause?: string): WHEPFailure {
  const detail: PlayerErrorDetail = { type: 'network', url: sanitizeUrl(url) };
  const said = cause ? `: ${cause}` : '';
  switch (kind) {
    case 'fetch':
      return {
        code: ErrorCode.MEDIA_NETWORK_ERROR,
        message: `WHEP request failed${said}`,
        recoverable: true,
        detail,
      };
    case 'ice':
      return {
        code: ErrorCode.MEDIA_NETWORK_ERROR,
        message: `WHEP connection lost${said}`,
        recoverable: true,
        detail,
      };
    case 'timeout':
      return {
        code: ErrorCode.MEDIA_NETWORK_ERROR,
        message: `WHEP join timed out${said}`,
        recoverable: true,
        detail,
      };
    case 'answer':
      // The server's SDP could not be applied. Recoverable on the theory that
      // the next answer is built fresh; it will exhaust the window if not.
      return {
        code: ErrorCode.MEDIA_NETWORK_ERROR,
        message: `WHEP answer could not be applied${said}`,
        recoverable: true,
        detail: { ...detail, type: 'media' },
      };
  }
}
