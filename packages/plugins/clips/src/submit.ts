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
 * JSON, or a body-read failure all yield a null `value` - never a throw.
 * `failed` separates a read that broke off (the timeout aborting mid-body)
 * from one that simply had nothing to parse, which is the only way the caller
 * can tell a stalled body from an empty one.
 */
async function parseBody(response: Response): Promise<{ value: unknown; failed: boolean }> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { value: null, failed: true };
  }
  if (text === '') return { value: null, failed: false };
  try {
    return { value: JSON.parse(text), failed: false };
  } catch {
    return { value: null, failed: false };
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
  const timedOut = (): ClipSubmitError =>
    new ClipSubmitError(`clips: clip request to ${cfg.url} timed out after ${timeoutMs}ms`, 0, null);

  // The timer stays armed until the body has been consumed: a server that
  // answers its headers and then stalls the body would otherwise hang forever
  // on a budget everyone assumes covers the whole request.
  try {
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
      if (controller.signal.aborted) throw timedOut();
      const reason = error instanceof Error ? error.message : String(error);
      throw new ClipSubmitError(`clips: clip request to ${cfg.url} failed: ${reason}`, 0, null);
    }

    const { value: body, failed } = await parseBody(response);
    // parseBody never throws, so the abort signal plus a failed read is what
    // tells a body the timeout cut off from an empty or non-JSON one. A 2xx is
    // no exception: nothing was received, so it is a status-0 timeout, not the
    // "unparseable 2xx is still a success" case.
    if (failed && controller.signal.aborted) throw timedOut();

    if (response.ok) return body;

    throw new ClipSubmitError(
      `clips: clip request to ${cfg.url} failed with status ${response.status}`,
      response.status,
      body,
    );
  } finally {
    clearTimeout(timer);
  }
}
