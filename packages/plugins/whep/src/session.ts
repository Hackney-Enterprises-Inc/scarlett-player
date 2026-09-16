/**
 * The WHEP HTTP exchange: one POST that carries the offer and returns the
 * answer plus the session resource, and one DELETE that frees the session.
 *
 * Nothing here knows about the player; it is the protocol as
 * draft-ietf-wish-whep-04 spells it, restricted to what this plugin
 * supports (a 201 answer; no trickle ICE, no server offers).
 */

import { SDP_MEDIA_TYPE, WHEPError, classifyResponse, classifyTransport } from './errors';

/**
 * What a successful offer produced.
 */
export interface JoinResult {
  /** The SDP answer to apply. */
  answer: string;
  /**
   * The session resource from `Location`, resolved against the endpoint to
   * an absolute URL, or `null` when the server sent none (the DELETE is
   * then skipped, and the server frees the session by ICE timeout).
   */
  sessionUrl: string | null;
}

/**
 * Build the request headers.
 *
 * @param token - The bearer token, or `null` for none
 * @param contentType - The body type, when there is a body
 * @returns The headers
 */
function headersFor(token: string | null, contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * POST the offer and read the answer.
 *
 * @param endpoint - The WHEP endpoint URL
 * @param offer - The local SDP offer
 * @param token - The bearer token, or `null` for none
 * @param signal - Aborts the request (the load watchdog, a supersede)
 * @returns The answer and the session resource
 * @throws {WHEPError} On any answer other than 201, and on a failed request
 */
export async function postOffer(
  endpoint: string,
  offer: string,
  token: string | null,
  signal?: AbortSignal
): Promise<JoinResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: headersFor(token, SDP_MEDIA_TYPE),
      body: offer,
      signal,
    });
  } catch (error) {
    // An abort is the caller's doing (watchdog or supersede) and is
    // reported by the caller; anything else is the network.
    if (signal?.aborted) throw error;
    throw new WHEPError(classifyTransport('fetch', endpoint, (error as Error)?.message));
  }

  const body = await response.text();
  if (response.status !== 201) {
    throw new WHEPError(
      classifyResponse(
        response.status,
        response.headers.get('Content-Type'),
        response.headers.get('Retry-After'),
        body,
        endpoint
      )
    );
  }

  const location = response.headers.get('Location');
  let sessionUrl: string | null = null;
  if (location) {
    try {
      sessionUrl = new URL(location, endpoint).toString();
    } catch {
      sessionUrl = null;
    }
  }

  return { answer: body, sessionUrl };
}

/**
 * DELETE the session resource.
 *
 * Never throws: the session is being abandoned either way, and the server
 * frees a session it never hears a DELETE for by ICE timeout. `keepalive`
 * lets the request outlive a closing tab, so a producer who shuts the
 * window frees the monitor slot at once instead of after the timeout.
 *
 * @param sessionUrl - The session resource
 * @param token - The bearer token, or `null` for none
 * @param keepalive - Whether the request may outlive the page
 * @returns Resolves when the request settles, whatever the outcome
 */
export async function deleteSession(sessionUrl: string, token: string | null, keepalive: boolean): Promise<void> {
  try {
    await fetch(sessionUrl, { method: 'DELETE', headers: headersFor(token), keepalive });
  } catch {
    // Abandoned either way.
  }
}
