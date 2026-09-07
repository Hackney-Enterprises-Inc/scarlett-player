/**
 * Clips Plugin Types
 *
 * The public type surface of `@scarlett-player/clips`. The player captures a
 * range; it does not produce a clip: rendering, storage, moderation and
 * playback of the result are the server's problem.
 */

import type { Plugin } from '@scarlett-player/core';

/**
 * A committed clip range - the wire contract, sent verbatim (camelCase) to
 * `onCreate` or the built-in `endpoint` transport.
 *
 * The payload carries no media `src`: playback URLs are frequently signed, the
 * server resolves the source from `mediaId`, and the share plugin already
 * established that a media URL never leaves the player. A host whose API wants
 * another shape uses `endpoint.body`.
 */
export interface ClipRange {
  /** In point, in media seconds. */
  startTime: number;
  /** Out point, in media seconds. */
  endTime: number;
  /** `endTime - startTime`, seconds. */
  duration: number;
  /** Host identifier for the media; never null on a committed range. */
  mediaId: string;
  /**
   * Random id minted on open(); the server's idempotency key so a retried POST
   * cannot make two clips.
   */
  clientRequestId: string;
  /** Viewer-entered name, trimmed; null when the field is disabled or left empty. */
  title: string | null;
  /** Whether the selection was captured on live media. False on all v1 (VOD) ranges. */
  isLive: boolean;
  /** DVR window start at commit, media seconds; null for VOD. */
  seekableStart: number | null;
  /** DVR window end at commit, media seconds; null for VOD. */
  seekableEnd: number | null;
  /**
   * Wall-clock time of the in point, ISO 8601. Live only; null on VOD.
   * On live these are what the server cuts by - `startTime`/`endTime` are
   * session-relative media seconds and mean nothing outside this player.
   */
  startDate: string | null;
  /** Wall-clock time of the out point, ISO 8601. Live only; null on VOD. */
  endDate: string | null;
  /** When the range was captured, ISO 8601. */
  capturedAt: string;
}

/**
 * Built-in transport configuration for clip submission.
 * Mirrors the analytics plugin's `beaconUrl`/`apiKey` shape.
 *
 * Mutually exclusive with `ClipsPluginConfig.onCreate`; a host with its own
 * HTTP client uses `onCreate`, a host running the server-side package with no
 * glue code uses `endpoint`.
 */
export interface ClipEndpointConfig {
  /** POST target, e.g. `'/api/clips'` (the Laravel package's publishable route). */
  url: string;
  /**
   * HTTP method.
   * @defaultValue 'POST'
   */
  method?: 'POST' | 'PUT';
  /**
   * Static headers, or a function resolved per request (CSRF token, Bearer
   * token). Merged over the default `Content-Type: application/json`.
   */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  /**
   * Fetch credentials mode.
   * @defaultValue 'same-origin', which carries the Laravel session / Sanctum cookie.
   */
  credentials?: RequestCredentials;
  /**
   * Reshape the request body.
   * @defaultValue the `ClipRange` verbatim.
   */
  body?: (range: ClipRange) => unknown;
  /**
   * Request timeout in milliseconds, enforced with an `AbortController`.
   * A hung `onCreate` is the host's timeout to own; the endpoint path is not.
   * @defaultValue 15000
   */
  timeoutMs?: number;
  /** Injectable `fetch`, for tests and for hosts with an instrumented client. */
  fetch?: typeof globalThis.fetch;
}

/**
 * Thrown by the built-in transport on a non-2xx response or a transport
 * failure. Rejections surface through `onError` and the `clip:error` event;
 * the selector stays open so the viewer can retry.
 */
export class ClipSubmitError extends Error {
  /** HTTP status, or `0` for a transport failure that never reached the server. */
  readonly status: number;
  /** Parsed JSON body when the server sent one (a Laravel 422 carries `message` + `errors`). */
  readonly body: unknown;

  /**
   * @param message - Human-readable failure description
   * @param status - HTTP status code, or 0 for a network-level failure
   * @param body - Parsed response body when the server sent JSON, else null
   */
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ClipSubmitError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Configuration for `createClipsPlugin`.
 *
 * Every limit is host configuration; the fallback defaults (5 / 60 / 30 / 1s)
 * only matter for a host that sets nothing.
 */
export interface ClipsPluginConfig {
  /**
   * Shortest clip the host will accept, seconds.
   * @defaultValue 5
   */
  minDuration?: number;
  /**
   * Longest clip the host will accept, seconds. The host's value must be at or
   * below the server's own maximum; a disagreement surfaces as a 422.
   * @defaultValue 60
   */
  maxDuration?: number;
  /**
   * Pre-roll behind `currentTime` when the selector opens, seconds.
   * Clamped to `[minDuration, maxDuration]` (with a console warning).
   * @defaultValue 30
   */
  defaultDuration?: number;
  /**
   * Handle snapping granularity, seconds. Labels are formatted at this
   * granularity. A value `<= 0` falls back to 1 with a console warning.
   * @defaultValue 1
   */
  step?: number;
  /**
   * Title field. `false` hides it and the payload always carries
   * `title: null`.
   * @defaultValue `{ maxLength: 80, required: false, placeholder: 'Name this clip' }`
   */
  title?:
    | false
    | {
        /** Maximum trimmed title length. @defaultValue 80 */
        maxLength?: number;
        /** Reject an empty (or whitespace-only) title. @defaultValue false */
        required?: boolean;
        /** Input placeholder text. */
        placeholder?: string;
        /** Visible label for the input. */
        label?: string;
      };
  /**
   * Host identifier for the current media - a video id, slug or playback
   * token; opaque to the plugin. Required for the control to render; a null
   * resolution makes `open()` error rather than open.
   */
  mediaId?: string | (() => string | null);
  /**
   * `'overlay'` renders the selector panel (and the `'clip'` control when the
   * UI package is present); `'none'` is headless - every event, state key and
   * imperative method still works so a host can drive its own UI.
   * @defaultValue 'overlay'
   */
  ui?: 'overlay' | 'none';
  /**
   * Loop playback of the selection while the selector is open.
   * @defaultValue true
   */
  loopPreview?: boolean;
  /** Control-bar button icon (inline SVG), as in share. */
  buttonIcon?: string;
  /**
   * Accessible label for the control-bar button.
   * @defaultValue 'Create clip'
   */
  buttonLabel?: string;

  /**
   * Host-owned submission. Called once with the validated range; the resolved
   * value becomes `result` on `clip:created`. Rejections go to `onError` and
   * `clip:error` and keep the selector open. Mutually exclusive with
   * `endpoint` - a misconfigured host (both or neither set) fails at plugin
   * construction, not on the first click.
   */
  onCreate?: (range: ClipRange) => unknown | Promise<unknown>;
  /**
   * Built-in submission: POST the range as JSON.
   * Mutually exclusive with `onCreate`.
   */
  endpoint?: ClipEndpointConfig;
  /** Called when the viewer cancels (Cancel button, Escape, source change). */
  onCancel?: () => void;
  /** Called on any clip error: invalid `open()`, `mediaId` failures, submission failures. */
  onError?: (error: Error) => void;

  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}

/**
 * Public surface of the clips plugin, for hosts that drive the flow
 * themselves (`ui: 'none'`) or want to open the selector from their own
 * button.
 *
 * Lifecycle: `open()` mints the `clientRequestId`, resolves `mediaId`,
 * pre-rolls the selection from the current position and emits
 * `clip:opened`; `setRange()`/drags update `clipSelection` state and emit
 * `clip:changed`; `commit()` re-validates, submits through exactly one of
 * `onCreate`/`endpoint`, emits `clip:created` and closes; `close()` cancels
 * (fires `onCancel` + `clip:cancelled`, idempotent). The plugin errors rather
 * than opening on live or audio media in v1, and while the duration is
 * unknown.
 */
export interface ClipsPlugin extends Plugin {
  /**
   * Open the selector: resolve `mediaId`, mint a `clientRequestId`, pre-roll
   * the selection from the current position (respecting `defaultDuration`),
   * reset the title to `''`, then show. Errors via `onError` + `clip:error`
   * on live media, non-video media, unknown duration, or a null `mediaId`.
   */
  open(): void;
  /**
   * Close the selector, discarding the selection. Fires `onCancel` and emits
   * `clip:cancelled`; idempotent - a second close (e.g. `media:load-request`
   * followed by `playlist:change`) emits nothing.
   */
  close(): void;
  /**
   * Set the selection programmatically: clamps and snaps both handles, then
   * emits `clip:changed`.
   *
   * @param start - In point in media seconds
   * @param end - Out point in media seconds
   */
  setRange(start: number, end: number): void;
  /**
   * Set the clip title: trimmed and truncated to `maxLength`. Headless hosts
   * use this in place of the overlay's input field.
   *
   * @param title - Viewer-entered title
   */
  setTitle(title: string): void;
  /**
   * The current selection as a committable range.
   *
   * @returns The range, or null when closed or `mediaId` is unresolved
   */
  getRange(): ClipRange | null;
  /**
   * Re-validate and submit the selection through `onCreate` or `endpoint`,
   * then close on success. A second call while one is pending is ignored; a
   * submission that settles after `close()` still emits its event, after
   * `destroy()` it is dropped. Failures go to `onError` + `clip:error` and
   * leave the selector open.
   *
   * @returns Resolves once the submission (if any) has settled
   */
  commit(): Promise<void>;
  /**
   * Whether the selector is currently open.
   *
   * @returns true while open
   */
  isOpen(): boolean;
  /**
   * Change limits at runtime (a server-supplied max, the demo's sliders).
   * Warns and clamps on nonsense (`min > max`), re-clamps an open selection
   * and emits `clip:changed { reason: 'clamp' }` if it moved.
   *
   * @param patch - The subset of limits to change
   */
  configure(patch: Pick<ClipsPluginConfig, 'minDuration' | 'maxDuration' | 'defaultDuration' | 'step'>): void;
}
