/**
 * URL sanitizer for error telemetry.
 *
 * Segment and playlist URLs are the single most useful field when diagnosing a
 * dead stream, and the single most dangerous one to hand to a consumer's
 * telemetry: signed-URL tokens, HMAC signatures, and session ids all live in
 * the query string. Stripping the whole query (and fragment) is the
 * privacy-safe default for EVERY consumer; anyone who genuinely needs the
 * parameters can subscribe to hls.js directly.
 *
 * The implementation lives in `@scarlett-player/core`, whose own docblock says
 * it exists so every package shares one sanitizer rather than duplicating the
 * logic. This module stays because `sanitizeUrl` is public API on both HLS
 * entries (`index.ts`, `light.ts`).
 */

export { sanitizeUrl } from '@scarlett-player/core';
