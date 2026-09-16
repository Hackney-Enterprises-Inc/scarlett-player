/**
 * Public types of @scarlett-player/whep.
 */

import type { IPluginAPI, PluginType } from '@scarlett-player/core';

/**
 * Supplies the bearer token for the next WHEP request.
 *
 * Called before every offer, on the first join and on every reconnect
 * attempt, so a host holding a short-lived token can hand over a fresh one
 * instead of the one that expired during an outage. Returning `null` or
 * `undefined` sends no `Authorization` header at all.
 */
export type WHEPTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

/**
 * Configuration for {@link createWHEPPlugin}.
 *
 * The reconnect knobs carry the same names and defaults as the HLS plugin's,
 * so a host that already tunes one provider tunes both the same way.
 */
export interface WHEPPluginConfig {
  /**
   * Bearer token sent as `Authorization: Bearer <token>` on every request.
   *
   * A Tmesis v1 preview endpoint needs none: it is open, and a token it is
   * sent is ignored rather than refused. Other WHEP servers, and the later
   * Tmesis token shape, read it. Ignored when `tokenProvider` is set.
   */
  token?: string;

  /**
   * Asked for a token before every request instead of `token`; see
   * {@link WHEPTokenProvider}.
   */
  tokenProvider?: WHEPTokenProvider;

  /**
   * ICE servers handed to the `RTCPeerConnection` (default: none).
   *
   * A preview box on a reachable address needs no STUN or TURN: the browser
   * dials the box's host candidates directly. Set this when the viewer sits
   * behind a NAT the box cannot reach through.
   */
  iceServers?: RTCIceServer[];

  /**
   * Whether to reconnect automatically after a recoverable failure
   * (default: `true`). See the README's error table for which failures are
   * recoverable.
   */
  autoReconnect?: boolean;

  /**
   * First reconnect delay in milliseconds (default: 2000). A server's
   * `Retry-After` replaces it for the failure that carried one.
   */
  reconnectBaseDelayMs?: number;

  /**
   * Longest reconnect delay in milliseconds (default: 30000). The backoff
   * doubles from the base until it reaches this and then holds.
   */
  reconnectMaxDelayMs?: number;

  /**
   * How long to keep reconnecting, in milliseconds, before giving up
   * (default: 300000, five minutes). `Infinity` keeps trying for as long as
   * the player lives, which suits a monitor opened before the producer
   * starts.
   */
  reconnectWindowMs?: number;

  /**
   * Watchdog for one join attempt (offer, POST, and the connection coming
   * up) in milliseconds (default: 10000, `0` disables). A join that stalls
   * without erroring is reported as a network failure so the reconnect
   * scheduler, and the viewer, hear about it.
   */
  loadTimeoutMs?: number;
}

/**
 * The plugin descriptor {@link createWHEPPlugin} returns.
 */
export interface IWHEPPlugin {
  /** Plugin id: `whep-provider`. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Package version, from the build. */
  version: string;
  /** Always `provider`. */
  type: PluginType;
  /** One-line description. */
  description: string;
  /** True for a URL whose path contains `/whep/v1/`. */
  canPlay(src: string): boolean;
  /** Wires the playback control listeners; called by the core once selected. */
  init(api: IPluginAPI): Promise<void>;
  /** Leaves the session, closes the connection, removes the element. */
  destroy(): Promise<void>;
  /**
   * Joins the WHEP endpoint at `src`.
   *
   * Resolves once the connection is up (after any reconnect attempts the
   * join needed), rejects when the failure is terminal or a newer load or
   * `destroy()` superseded it.
   */
  loadSource(src: string): Promise<void>;
  /**
   * The session resource the server handed back in `Location`, resolved to
   * an absolute URL, or `null` while not joined.
   */
  getSessionUrl(): string | null;
}
