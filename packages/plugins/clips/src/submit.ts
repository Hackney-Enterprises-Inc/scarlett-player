/**
 * Built-in endpoint transport for clip submission.
 *
 * `commit()` picks exactly one of two paths: a host-owned `onCreate`
 * callback, or this module for hosts running the server-side package with
 * no glue code. The wire contract is the `ClipRange` object verbatim
 * (camelCase); a host whose API wants another shape uses `endpoint.body`.
 *
 * Failure contract (documented choice, tested in tests/submit.test.ts):
 * **every** rejection from this module is a `ClipSubmitError`. Transport
 * failures - a thrown `fetch`, or an abort from the timeout - are wrapped
 * with `status: 0` (the server was never confirmed to have answered) rather
 * than rethrown raw, so the caller has one error shape to handle and
 * `status === 0` cleanly means "retryable, no server verdict".
 */

import { ClipSubmitError } from './types';
import type { ClipEndpointConfig, ClipRange } from './types';

/** Fallback request budget when `timeoutMs` is unset. */
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @internal
 * Read the response body as parsed JSON. An empty body, a body that is not
 * JSON, or a body-read failure all yield null - never a throw.
 */
async function parseBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (text === '') return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Submit a clip range to the configured endpoint.
 *
 * Resolves with the parsed JSON body (`null` for an empty or non-JSON body -
 * a 2xx that cannot be parsed is still a **success**; presenting it as a
 * failure would invite a retry and a duplicate clip). Rejects with a
 * {@link ClipSubmitError} carrying the HTTP status and parsed body on a
 * non-2xx response, or `status: 0` on a transport failure or timeout.
 *
 * @param range - The validated clip range - the request body unless `body()` reshapes it
 * @param cfg - Endpoint configuration (url, method, headers, credentials, timeout)
 * @returns The server's parsed response body, or null
 * @throws {ClipSubmitError} Non-2xx response, transport failure, or timeout
 */
export async function submitViaEndpoint(range: ClipRange, cfg: ClipEndpointConfig): Promise<unknown> {
  const fetchImpl: typeof globalThis.fetch | undefined = cfg.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new ClipSubmitError('clips: no fetch implementation available; provide endpoint.fetch', 0, null);
  }

  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    // Headers are resolved per request so a function form re-reads the CSRF/
    // Bearer token on every retry, not just the first.
    const extra = typeof cfg.headers === 'function' ? await cfg.headers() : cfg.headers;
    response = await fetchImpl(cfg.url, {
      method: cfg.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...extra },
      credentials: cfg.credentials ?? 'same-origin',
      body: JSON.stringify(cfg.body ? cfg.body(range) : range),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new ClipSubmitError(`clips: clip request to ${cfg.url} timed out after ${timeoutMs}ms`, 0, null);
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new ClipSubmitError(`clips: clip request to ${cfg.url} failed: ${reason}`, 0, null);
  }
  clearTimeout(timer);

  if (response.ok) {
    return parseBody(response);
  }

  const body = await parseBody(response);
  throw new ClipSubmitError(
    `clips: clip request to ${cfg.url} failed with status ${response.status}`,
    response.status,
    body,
  );
}
