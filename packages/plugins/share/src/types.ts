/**
 * Share Plugin Types
 */

/**
 * What a target needs to build its link, resolved fresh each time the sheet
 * opens so the timestamp reflects the current position.
 */
export interface ShareContext {
  /** Canonical page URL, timestamp already applied where applicable. */
  url: string;
  /** Page or media title. */
  title: string;
  /** Playback position in seconds when the sheet was opened. */
  currentTime: number;
  /** Whether the current media is live. */
  isLive: boolean;
}

/**
 * A destination in the share sheet.
 *
 * `native` and `copy` are handled internally. Every other target is a link:
 * supply `href` and it opens in a new tab.
 */
export interface ShareTarget {
  /** Stable id, used for onShare reporting and as the CSS hook. */
  id: string;
  /** Visible label. */
  label: string;
  /** Inline SVG markup. Falls back to the built-in icon for known ids. */
  icon?: string;
  /** Builds the URL to open. Omit only for the built-in `native` and `copy`. */
  href?: (context: ShareContext) => string;
}

export interface SharePluginConfig {
  /**
   * The canonical page URL to share.
   *
   * Defaults to `window.location.href`, which is correct on an ordinary watch
   * page. Override it when the player is not the page - most importantly inside
   * an iframe embed, where `window.location.href` is the embed itself and
   * cross-origin rules prevent reading the parent.
   *
   * This never falls back to the media `src`. Playback URLs are frequently
   * signed, so sharing one leaks a credential and produces a link that expires.
   */
  url?: string | (() => string);

  /** Title passed to the native sheet. Defaults to `document.title`. */
  title?: string | (() => string);

  /** Append the current position to the URL. Default true; ignored on live. */
  withTimestamp?: boolean;
  /** Query parameter used for the timestamp. Default 't'. */
  timestampParam?: string;
  /** Round the timestamp to whole seconds. Default true. */
  roundTimestamp?: boolean;

  /**
   * Targets to offer, in order. Ids resolve to built-ins; objects define your
   * own. Default: `['native', 'copy', 'embed']`.
   */
  targets?: Array<string | ShareTarget>;

  /** Base URL of the iframe embed page, enabling the `embed` target. */
  embedBaseUrl?: string;
  /** Override the generated embed snippet. */
  embedSnippet?: (context: ShareContext) => string;

  /** Called after a successful share, for analytics. */
  onShare?: (targetId: string, url: string) => void;
  /** Called when a share fails. Never fires for a user-cancelled native sheet. */
  onError?: (error: Error) => void;

  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}
