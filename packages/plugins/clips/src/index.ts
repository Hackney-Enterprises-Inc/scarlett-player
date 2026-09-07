/**
 * Clips Plugin for Scarlett Player
 *
 * Viewer-created clips, player side: the plugin captures a range; it does
 * not produce a clip. Rendering, storage, moderation and playback of the
 * result are the server's problem. v1 is VOD only - `open()` errors on live
 * and audio media rather than opening.
 *
 * Lifecycle: `open()` resolves `mediaId`, mints the `clientRequestId`
 * idempotency key, pre-rolls the selection from the current position and
 * emits `clip:opened`; `setRange()` updates `clipSelection` state (clamped
 * and snapped by the pure range model) and emits `clip:changed`; `commit()`
 * re-validates, submits through exactly one of `onCreate` / `endpoint`,
 * emits `clip:created` and closes; `close()` cancels (idempotent).
 *
 * @example
 * ```ts
 * import { createPlayer } from '@scarlett-player/core';
 * import { createClipsPlugin } from '@scarlett-player/clips';
 *
 * const player = await createPlayer({
 *   container: '#player',
 *   plugins: [
 *     uiPlugin({ controls: ['play', 'time', 'spacer', 'clip', 'fullscreen'] }),
 *     createClipsPlugin({ mediaId: 'video-42', endpoint: { url: '/api/clips' } }),
 *   ],
 * });
 * ```
 */

import { injectSharedStyles } from '@scarlett-player/core';
import type { IPluginAPI, ReleaseStyles } from '@scarlett-player/core';
import type {
  ClipEndpointConfig,
  ClipRange,
  ClipsPlugin,
  ClipsPluginConfig,
} from './types';
import { ClipSubmitError } from './types';
import {
  bounds,
  moveEnd,
  moveStart,
  preroll,
  resolveLimits,
  snap,
  validate,
  validateTitle,
} from './range';
import type { ClipSelection, RangeBounds, RangeErrorCode, TitleErrorCode } from './range';
import { createPreviewLoop } from './preview';
import type { PreviewLoop } from './preview';
import { submitViaEndpoint } from './submit';
import { getVideo, seekClamped } from './media';
import { ClipOverlay } from './ClipOverlay';
import { ClipButton } from './ClipButton';
import type { ClipHandle, ClipClampReason } from './RangeSelector';
import { styles } from './styles';
import { PKG_VERSION } from './version';

export type { ClipRange, ClipsPlugin, ClipsPluginConfig, ClipEndpointConfig } from './types';
export { ClipSubmitError } from './types';
export { ClipOverlay } from './ClipOverlay';
export type { ClipOverlayOptions, ClipOverlayCallbacks, ClipNoticeOptions } from './ClipOverlay';
export { ClipButton, CLIP_ICON } from './ClipButton';
export type { ClipButtonOptions, ClipControl } from './ClipButton';

declare module '@scarlett-player/core' {
  interface StateStore {
    clipSelection: { start: number; end: number } | null;
    clipOpen: boolean;
    clipTitle: string; // '' when empty; lives in state so headless hosts and the overlay agree
  }
  interface PlayerEventMap {
    'clip:opened': { start: number; end: number };
    'clip:changed': { start: number; end: number; reason: 'user' | 'clamp' }; // Phase 2 adds 'live'
    'clip:created': { range: ClipRange; result: unknown }; // result = onCreate's value or the endpoint's parsed JSON
    'clip:cancelled': { reason: 'user' | 'source-change' | 'destroy' }; // Phase 2 adds 'live-expired'
    'clip:error': { error: Error };
  }
}

/** Fallback for `title.maxLength` when the field config omits it (mirrors range.ts). */
const DEFAULT_TITLE_MAX_LENGTH = 80;

/** Id of the ref-counted shared stylesheet (core's `injectSharedStyles`). */
const STYLE_ID = 'sp-clips-styles';

/** Slot id this plugin registers under in `@scarlett-player/ui`'s control registry. */
const CONTROL_ID = 'clip';

/** Success toast text and how long it stays up (plan "Submission"). */
const TOAST_MESSAGE = 'Clip requested';
const TOAST_VISIBLE_MS = 2000;

/** Fallback notice when a submission fails and the server sent no message. */
const GENERIC_FAILURE_MESSAGE = "Couldn't create the clip. Please try again.";

/** Drag-scrub seek throttle, matching the ProgressBar drag cadence (max 10 seeks/sec). */
const SEEK_THROTTLE_MS = 100;

/**
 * Codes carried on the `code` property of errors reported through `onError`
 * / `clip:error` outside submission. Submission failures are
 * {@link ClipSubmitError} instead. The gate codes (`live-unsupported`,
 * `media-type-unsupported`, `duration-unknown`, `media-id-unresolved`) are
 * camel-snake mirrors of the plan's reasons; range and title codes come
 * straight from the range model.
 */
type ClipErrorCode =
  | 'live-unsupported'
  | 'media-type-unsupported'
  | 'duration-unknown'
  | 'media-id-unresolved'
  | RangeErrorCode
  | TitleErrorCode;

/** An `Error` carrying a machine-readable {@link ClipErrorCode}. */
export interface ClipOperationError extends Error {
  code: ClipErrorCode;
}

/** @internal Build a coded error for the reportError path. */
function clipError(code: ClipErrorCode, message: string): ClipOperationError {
  const error = new Error(message) as ClipOperationError;
  error.code = code;
  return error;
}

/** @internal Idempotency key: crypto.randomUUID with an RFC-4122-shaped fallback. */
function newClientRequestId(): string {
  const withUuid = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof withUuid?.randomUUID === 'function') return withUuid.randomUUID();
  const rand = (): string => Math.random().toString(36).slice(2, 10);
  return `clip-${Date.now().toString(36)}-${rand()}${rand()}`;
}

/** True when both or neither submission path is configured - a startup failure. */
function isMisconfigured(config: ClipsPluginConfig): boolean {
  const hasOnCreate = typeof config.onCreate === 'function';
  const hasEndpoint = config.endpoint !== undefined && config.endpoint !== null;
  return hasOnCreate === hasEndpoint;
}

/**
 * Create a Clips Plugin instance.
 *
 * @param config - Plugin configuration; exactly one of `onCreate` / `endpoint`
 * is required (see below)
 * @returns The clips plugin, also usable headless (`ui: 'none'`)
 * @throws {TypeError} When both or neither of `onCreate` / `endpoint` are
 * set - a misconfigured host fails at construction, not on the first click
 */
export function createClipsPlugin(config: ClipsPluginConfig = {}): ClipsPlugin {
  if (isMisconfigured(config)) {
    throw new TypeError(
      'createClipsPlugin: configure exactly one of `onCreate` (host-owned submission) ' +
        'or `endpoint` (built-in transport) - not both, and not neither.',
    );
  }

  /**
   * Working config. A copy: `configure()` merges runtime limit changes into
   * it, and the range helpers (`validate`, `moveStart`, `preroll`, ...) read
   * the limits straight off it.
   */
  const cfg: ClipsPluginConfig = { ...config };

  /**
   * Resolve the limits on the working config and persist them back onto it:
   * `resolveLimits()` applies the fallback defaults and warns + clamps a
   * `defaultDuration` outside `[minDuration, maxDuration]`; the min > max
   * nonsense guard then lowers `minDuration` to `maxDuration` (the maximum is
   * the authority a server would enforce anyway).
   */
  function applyLimits(): void {
    const limits = resolveLimits(cfg);
    let minDuration = limits.minDuration;
    const maxDuration = limits.maxDuration;
    if (minDuration > maxDuration) {
      console.warn(
        `[clips] minDuration ${minDuration} exceeds maxDuration ${maxDuration}; ` +
          `clamping minDuration to ${maxDuration}.`,
      );
      minDuration = maxDuration;
    }
    cfg.minDuration = minDuration;
    cfg.maxDuration = maxDuration;
    cfg.defaultDuration = Math.min(Math.max(limits.defaultDuration, minDuration), maxDuration);
    cfg.step = limits.step;
  }

  // Construction-time clamp warning for a nonsense defaultDuration (plan
  // "Range model"); configure() re-runs this after every merge.
  applyLimits();

  let api: IPluginAPI | null = null;
  let preview: PreviewLoop | null = null;
  /** Unsubscribe fns for init()-level event subscriptions (not the loop's). */
  const disposers: Array<() => void> = [];

  // --- session state (mirrored into player state; we own the source of truth) ---
  let sessionOpen = false;
  let selection: ClipSelection | null = null;
  let sessionMediaId: string | null = null;
  let sessionDuration = 0;
  let clientRequestId: string | null = null;
  let titleText = '';

  // --- submission guards ---
  let inFlight = false;
  let inFlightGeneration = -1;
  /**
   * Bumped by init() and teardown(). A submission captures the generation it
   * started under; when it settles after destroy() (or after a re-init) the
   * generation no longer matches and the result is dropped. Group 3 reuses
   * this counter for the dynamic `import('@scarlett-player/ui')` guard.
   */
  let lifecycle = 0;

  // --- UI (Group 3) ---
  /**
   * The mounted panel, or null in headless mode and while closed. Created by
   * `open()` when `cfg.ui === 'overlay'`, destroyed by `endSession()`.
   */
  let overlay: ClipOverlay | null = null;
  /** Give-back for `injectSharedStyles` (ref-counted; null when headless). */
  let releaseStyles: ReleaseStyles | null = null;
  /** Unregister for the `clip` control; set only once the dynamic ui import resolved. */
  let releaseControls: (() => void) | null = null;
  /**
   * The control-bar button the UI factory last built, kept for the overlay's
   * focus return. May be detached by a control-bar rebuild; focus is only
   * restored when it is still connected.
   */
  let clipControl: ClipButton | null = null;

  // --- drag-to-scrub (task 3.5): the drag owns the media while it runs ---
  let dragging = false;
  let wasPlayingBeforeDrag = false;
  let lastScrubSeek = 0;

  // --- success toast (transient element on the container) ---
  let toastEl: HTMLElement | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const currentBounds = (): RangeBounds => bounds({ duration: sessionDuration });

  /**
   * Resolve `mediaId` for the current call. A function may throw - callers
   * wrap in try/catch and report through `onError` / `clip:error`. An empty
   * string counts as unresolved: there is nothing for the server to key on.
   */
  function resolveMediaId(): string | null {
    const { mediaId } = cfg;
    if (typeof mediaId === 'function') {
      const value = mediaId();
      return typeof value === 'string' && value !== '' ? value : null;
    }
    return typeof mediaId === 'string' && mediaId !== '' ? mediaId : null;
  }

  /** Log, call `config.onError`, emit `clip:error`. Never throws. */
  function reportError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    api?.logger.error('Clips error', { error: err });
    config.onError?.(err);
    api?.emit('clip:error', { error: err });
  }

  /** Snapshot the session into the wire contract. VOD fields are fixed in v1. */
  function buildRange(mediaId: string): ClipRange | null {
    if (!selection || clientRequestId === null) return null;
    const trimmed = cfg.title === false ? '' : titleText.trim();
    return {
      startTime: selection.start,
      endTime: selection.end,
      duration: selection.end - selection.start,
      mediaId,
      clientRequestId,
      title: trimmed === '' ? null : trimmed,
      isLive: false,
      seekableStart: null,
      seekableEnd: null,
      startDate: null,
      endDate: null,
      capturedAt: new Date().toISOString(),
    };
  }

  /** Shared teardown of a session; emits nothing and never fires onCancel. */
  function endSession(): void {
    sessionOpen = false;
    selection = null;
    sessionMediaId = null;
    clientRequestId = null;
    preview?.stop();
    api?.setState('clipSelection', null);
    api?.setState('clipOpen', false);
    // == GROUP 3 UI SEAM (c): overlay teardown ==
    // The panel ends with the session on every path - cancel, commit success,
    // source change, destroy. It lives here rather than in closeSession()
    // because commit() settles via endSession() directly (a success is not a
    // cancel), and that path must unmount the panel too.
    overlay?.destroy();
    overlay = null;
    // A drag in flight dies with the session: the play state captured at
    // drag start is deliberately NOT restored. On the source-change and
    // destroy paths resuming is moot (the media is gone or going); on a
    // cancel mid-drag, staying paused is the safe read - the viewer had
    // their finger on the handle, and auto-playing under a closing panel
    // would surprise them.
    dragging = false;
    wasPlayingBeforeDrag = false;
  }

  /**
   * Cancel-and-close. Idempotent: only the first close of an open session
   * fires `onCancel` and `clip:cancelled`, so `media:load-request` followed
   * by `playlist:change` on a playlist advance emits once. The overlay is
   * unmounted by `endSession()` (see the seam note there).
   */
  function closeSession(reason: 'user' | 'source-change' | 'destroy'): void {
    if (!sessionOpen) return;
    endSession();
    config.onCancel?.();
    api?.emit('clip:cancelled', { reason });
  }

  /** Full teardown. Idempotent (core may run onDestroy cleanups after destroy()). */
  function teardown(): void {
    if (!api) return;
    lifecycle += 1;
    // A submission in flight when the player dies must not hold the next
    // lifecycle hostage: the plan deliberately waits on a hung onCreate
    // forever, so leaving `inFlight` set would block commit() after a
    // re-init until the dead attempt settles. Reset both fields - the old
    // attempt's settle sees a generation nobody owns anymore and touches
    // nothing (its clip:error is dropped by the guard in doCommit()).
    inFlight = false;
    inFlightGeneration = -1;
    // == GROUP 3 UI SEAM (a) + (b) release ==
    // closeSession() runs FIRST, before the control release nulls
    // `clipControl`: the overlay's focus return on destroy resolves it
    // through getReturnFocus(), and releasing it earlier would silently
    // strand keyboard focus on <body>.
    closeSession('destroy');
    clearToast();
    // Bumping `lifecycle` above is what makes an in-flight
    // `import('@scarlett-player/ui')` skip its registration: the `.then()`
    // compares the generation it captured against this counter.
    releaseControls?.();
    releaseControls = null;
    releaseStyles?.();
    releaseStyles = null;
    clipControl = null;
    preview?.stop();
    preview = null;
    while (disposers.length > 0) disposers.pop()?.();
    api = null;
  }

  /**
   * Clamp a selection into the current limits without moving a handle that
   * is already valid: `moveEnd` first (a `maxDuration` shrink takes the out
   * point), then `moveStart` with the fresh end in view. Used by
   * `setRange()` and `configure()` re-clamping; no snap pass here because
   * the clamped values are already on the grid, and snapping could round a
   * clamp back past its limit.
   */
  function clampSelection(sel: ClipSelection): ClipSelection {
    const b = currentBounds();
    let next = moveEnd(sel, sel.end, cfg, b);
    next = moveStart(next, next.start, cfg, b);
    return next;
  }

  /**
   * Write a new selection to state, retarget the loop, keep the mounted
   * panel in sync and emit `clip:changed`.
   *
   * `retargetLoop` is false while a handle drag owns the media:
   * `preview.start()` also clears the suspension the drag installed, so the
   * retarget waits for `onDragEnd`.
   */
  function commitSelection(
    sel: ClipSelection,
    reason: 'user' | 'clamp',
    retargetLoop = true,
  ): void {
    selection = sel;
    api?.setState('clipSelection', { start: sel.start, end: sel.end });
    if (retargetLoop) preview?.start(sel);
    api?.emit('clip:changed', { start: sel.start, end: sel.end, reason });
    // clipSelection is the single source of truth: echo it to the panel. The
    // selector's update() is render-only (fires no callbacks), so a change
    // that originated in the selector simply re-asserts what it drew.
    overlay?.update(sel, currentBounds(), cfg);
  }

  /**
   * Route a committed move from the selector (drag step or keyboard) through
   * the same clamping path as `setRange()`, emitting `clip:changed` with
   * `reason: 'user'`.
   */
  function applySelectionFromSelector(sel: ClipSelection): void {
    if (!api || !sessionOpen) return;
    const step = (cfg.step as number | undefined) ?? 1;
    const snapped: ClipSelection = { start: snap(sel.start, step), end: snap(sel.end, step) };
    commitSelection(clampSelection(snapped), 'user', !dragging);
  }

  /** Write the title model-side (trimmed + truncated, mirrored to state). */
  function applyTitle(raw: string): void {
    if (!api) return;
    const configured = typeof cfg.title === 'object' && cfg.title !== null ? cfg.title.maxLength : undefined;
    const maxLength = configured ?? DEFAULT_TITLE_MAX_LENGTH;
    titleText = raw.trim().slice(0, Math.max(0, maxLength));
    api.setState('clipTitle', titleText);
  }

  /**
   * Whether the current media is clippable at all - the {@link ClipButton}
   * visibility gate, mirroring `open()`'s guards. A `mediaId` function that
   * throws reads as "not clippable": the button hides quietly, and `open()`
   * is the place that reports the error properly.
   */
  function mediaClippable(): boolean {
    if (!api) return false;
    if (api.getState('live')) return false;
    if (api.getState('mediaType') !== 'video') return false;
    const duration = api.getState('duration');
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return false;
    try {
      return resolveMediaId() !== null;
    } catch {
      return false;
    }
  }

  // --- drag-to-scrub (task 3.5) -------------------------------------------------
  // The drag owns the media: pause and suspend on start, throttled seeks to the
  // dragged handle's time during, seek to the in point + resume + play-restore
  // on release. ProgressBar's resume pattern applies: playback waits for the
  // final `seeked` so the loop restarts without stutter.

  /** @internal pointerdown chose a handle (before any position change). */
  function handleDragStart(): void {
    dragging = true;
    lastScrubSeek = 0; // the first move always seeks, like ProgressBar's drag start
    const video = api ? getVideo(api.container) : null;
    wasPlayingBeforeDrag = video ? !video.paused : false;
    video?.pause();
    preview?.suspend();
  }

  /** @internal pointermove: seek to the landed handle time, throttled to one seek per 100ms. */
  function handleDragMove(_handle: ClipHandle, time: number): void {
    const now = Date.now();
    if (now - lastScrubSeek < SEEK_THROTTLE_MS) return;
    lastScrubSeek = now;
    seekClamped(api, time);
  }

  /** @internal pointerup / pointercancel: land on the in point and give the loop back. */
  function handleDragEnd(finalSelection: ClipSelection): void {
    dragging = false;
    seekClamped(api, finalSelection.start);
    preview?.start(finalSelection); // retargets and clears the suspension
    restorePlayStateAfterDrag();
  }

  /** @internal Resume playback if it was running before the drag, after the final seek lands. */
  function restorePlayStateAfterDrag(): void {
    if (!wasPlayingBeforeDrag || !api) return;
    wasPlayingBeforeDrag = false;
    const video = getVideo(api.container);
    if (video && video.paused) {
      const resumePlayback = (): void => {
        video.removeEventListener('seeked', resumePlayback);
        if (!sessionOpen) return; // the drag-release raced a close: stay paused
        video.play().catch(() => {});
      };
      // If a close lands before `seeked`, this listener dangles on the video
      // element until the next seek; it is bounded (removes itself on first
      // fire) and self-heals, so no timer or cleanup path is warranted here.
      video.addEventListener('seeked', resumePlayback);
    }
  }

  // --- commit-settle chrome -------------------------------------------------

  /** @internal A transient "Clip requested" pill on the container; survives the panel's close. */
  function showToast(): void {
    if (!api) return;
    clearToast();
    const el = document.createElement('div');
    el.className = 'sp-clip-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = TOAST_MESSAGE;
    api.container.appendChild(el);
    toastEl = el;
    requestAnimationFrame(() => el.classList.add('sp-clip-toast--visible'));
    toastTimer = setTimeout(clearToast, TOAST_VISIBLE_MS);
  }

  /** @internal Remove the toast and its timer. Idempotent. */
  function clearToast(): void {
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toastEl?.remove();
    toastEl = null;
  }

  /**
   * @internal Notice text for a submission failure: the server's own wording
   * when the response carried a `message` (a Laravel 422 does), else a
   * generic line. Rendered with textContent by the overlay - never markup.
   */
  function failureNoticeMessage(error: unknown): string {
    if (error instanceof ClipSubmitError && error.body && typeof error.body === 'object') {
      const message = (error.body as { message?: unknown }).message;
      if (typeof message === 'string' && message !== '') return message;
    }
    return GENERIC_FAILURE_MESSAGE;
  }

  // --- overlay mount (seam c) ------------------------------------------------

  /**
   * @internal Build and open the panel for the current session. Mounted on
   * `api.container` (watermark / share-sheet precedent); every route back to
   * the player goes through the callbacks below.
   */
  function mountOverlay(): void {
    if (!api || !selection) return;
    overlay = new ClipOverlay({
      container: api.container,
      selection,
      bounds: currentBounds(),
      config: cfg,
      title: titleText,
      getReturnFocus: () => clipControl?.render() ?? null,
      callbacks: {
        onCancel: () => closeSession('user'),
        onConfirm: () => {
          void doCommit();
        },
        // Keystrokes stay raw in the field (mid-word spaces survive typing);
        // the model side trims. No echo back - see applyTitle's note.
        onTitleChange: (raw) => applyTitle(raw),
        onSelectionChange: (sel) => applySelectionFromSelector(sel),
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragEnd: handleDragEnd,
      },
    });
    overlay.open();
  }

  /** Shared body of the public `open()`; also called by the control's toggle. */
  function doOpen(): void {
    if (!api || sessionOpen) return;

    // --- gates: error, do not open (v1 is VOD video only) ---
    if (api.getState('live')) {
      reportError(clipError('live-unsupported', 'clips: live media cannot be clipped in v1'));
      return;
    }
    const mediaType = api.getState('mediaType');
    if (mediaType !== 'video') {
      reportError(
        clipError('media-type-unsupported', `clips: only video is clippable; media type is ${String(mediaType)}`),
      );
      return;
    }
    const duration = api.getState('duration');
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      reportError(clipError('duration-unknown', 'clips: media duration is unknown; cannot open'));
      return;
    }
    let mediaId: string | null = null;
    try {
      mediaId = resolveMediaId();
    } catch (error) {
      reportError(error);
      return;
    }
    if (mediaId === null) {
      reportError(clipError('media-id-unresolved', 'clips: mediaId is unset or resolved to null; cannot open'));
      return;
    }

    const currentTime = (api.getState('currentTime') as number | undefined) ?? 0;
    sessionDuration = duration;
    sessionMediaId = mediaId;
    clientRequestId = newClientRequestId();
    const sel = preroll(currentTime, cfg, bounds({ duration }));
    selection = sel;
    titleText = '';
    sessionOpen = true;

    api.setState('clipSelection', { start: sel.start, end: sel.end });
    api.setState('clipOpen', true);
    api.setState('clipTitle', '');
    api.emit('clip:opened', { start: sel.start, end: sel.end });
    preview?.start(sel);

    // == GROUP 3 UI SEAM (c): mount the ClipOverlay on api.container ==
    // Cancel/Escape route to closeSession('user') and Confirm to doCommit(),
    // both wired inside mountOverlay(). Headless (`ui: 'none'`) never mounts
    // a panel: the plugin API above is the entire product surface.
    if (cfg.ui !== 'none') mountOverlay();
  }

  /**
   * Shared body of the public `commit()`; the overlay's Confirm button and a
   * host's imperative call both run it.
   */
  async function doCommit(): Promise<void> {
    if (!api || !sessionOpen || !selection) return;
    if (inFlight) {
      api.logger.debug('clips: submission already in flight; ignoring commit()');
      return;
    }

    // Re-resolve mediaId: a token rotated between open() and Confirm must
    // not be shipped stale. Failure keeps the selector open.
    let mediaId: string | null = null;
    try {
      mediaId = resolveMediaId();
    } catch (error) {
      reportError(error);
      return;
    }
    if (mediaId === null) {
      reportError(clipError('media-id-unresolved', 'clips: mediaId could not be resolved at commit time'));
      return;
    }

    const rangeCode = validate(selection, cfg, currentBounds());
    if (rangeCode !== null) {
      reportError(clipError(rangeCode, `clips: selection is not committable (${rangeCode})`));
      return;
    }
    const titleCode = validateTitle(titleText, cfg);
    if (titleCode !== null) {
      reportError(clipError(titleCode, `clips: title is not acceptable (${titleCode})`));
      return;
    }

    const range = buildRange(mediaId);
    if (!range) return; // defensive: selection vanished mid-validation

    const generation = lifecycle;
    // Identity of the session this attempt belongs to: the clientRequestId
    // was minted by this open() and endSession() nulls it, so equality after
    // the await means "still the SAME session". sessionOpen alone is not
    // that test - a close -> open while the request is in flight leaves
    // sessionOpen true for a DIFFERENT session, and a late settle must not
    // close it, toast into it, or write its notice.
    const sessionKey = clientRequestId;
    inFlight = true;
    inFlightGeneration = generation;
    overlay?.setSubmitting(true);
    let failed = false;
    let failure: unknown = null;
    let result: unknown = null;
    try {
      // Exactly one path; the constructor-time XOR guarantees the cast.
      result = config.onCreate
        ? await config.onCreate(range)
        : await submitViaEndpoint(range, config.endpoint as ClipEndpointConfig);
    } catch (error) {
      failed = true;
      failure = error;
    }
    // Release the guard only for our own attempt: a submission that began
    // under a newer lifecycle owns the flag by now (teardown() resets both
    // fields, so an attempt from a dead lifecycle never clears a live one's).
    if (inFlightGeneration === generation) inFlight = false;

    // Settled after destroy() (or after a re-init): dropped - the bus and
    // container it would speak through belong to a lifecycle that is gone.
    if (!api || generation !== lifecycle) return;

    if (failed) {
      // onError + clip:error ALWAYS fire, however the panel state looks: the
      // request was made and answered, the host must hear about it.
      reportError(failure);
      // == GROUP 3 UI SEAM (c): failure chrome ==
      // Only for the attempt's OWN still-open session: a failure settling
      // after close() - or after a close -> re-open - is events-only, no DOM.
      // Re-enable Confirm on this session's panel for the retry.
      if (overlay && clientRequestId === sessionKey) {
        overlay.setSubmitting(false);
        overlay.showNotice(failureNoticeMessage(failure), { type: 'error' });
      }
      return;
    }

    api.emit('clip:created', { range, result });
    // The success-path close is NOT a cancel: no onCancel, no
    // clip:cancelled. The event ALWAYS emits - the server may well have
    // created the clip - but DOM is touched only when the attempt's own
    // session is still the open one (see sessionKey above).
    // == GROUP 3 UI SEAM (c): success chrome ==
    // Toast first, then endSession() (which unmounts the panel); the toast
    // is its own element on the container and survives the panel's teardown.
    if (sessionOpen && clientRequestId === sessionKey) {
      if (cfg.ui !== 'none') showToast();
      endSession();
    }
  }

  return {
    id: 'clips',
    name: 'Clips',
    version: PKG_VERSION,
    type: 'feature',
    description: 'Viewer-created clips with two-handle range selection, preview loop and host submission',

    init(pluginApi: IPluginAPI): void {
      api = pluginApi;
      lifecycle += 1;
      api.logger.debug('Clips plugin initialized');

      // Idempotent by contract: a re-init after a source change keeps live
      // state rather than resetting it.
      api.defineState('clipSelection', null);
      api.defineState('clipOpen', false);
      api.defineState('clipTitle', '');

      preview = createPreviewLoop(api, { enabled: config.loopPreview !== false });

      // Both events fire on a playlist advance; closeSession's idempotence
      // guard makes that exactly one 'source-change' cancellation.
      const closeOnSourceChange = (): void => closeSession('source-change');
      disposers.push(
        api.on('media:load-request', closeOnSourceChange),
        api.on('playlist:change', closeOnSourceChange),
      );

      // == GROUP 3 UI SEAM (a): shared stylesheet ==
      // Reference-counted by core: two players share one <style>; the last
      // release removes it. Headless hosts get no DOM at all, so no sheet.
      if (cfg.ui !== 'none') {
        releaseStyles = injectSharedStyles(STYLE_ID, styles);
      }

      // == GROUP 3 UI SEAM (b): 'clip' control registration ==
      // The share pattern: a runtime import so a headless host never needs
      // @scarlett-player/ui to resolve, guarded by the lifecycle generation
      // this init runs under. `registerControl`/`unregisterControl` come from
      // THIS import only - they are the package's entire ui dependency.
      if (cfg.ui !== 'none') {
        const generation = lifecycle;
        const owner = api.container;
        void import('@scarlett-player/ui')
          .then(({ registerControl, unregisterControl }) => {
            // Destroyed (or re-initialised) while the import was in flight:
            // this registration belongs to a lifecycle that is over.
            if (generation !== lifecycle) return;

            // Scoped to this player's container: the factory's button closes
            // over THIS plugin instance's state, so a global registration
            // would let one player's button drive another's panel.
            registerControl(
              CONTROL_ID,
              (controlApi: IPluginAPI) => {
                clipControl = new ClipButton(controlApi, {
                  icon: cfg.buttonIcon,
                  label: cfg.buttonLabel,
                  // Click toggles: opens when closed, closes when open. The
                  // close routes through closeSession('user'), so the overlay
                  // unmounts and returns focus to this button.
                  onActivate: () => {
                    if (sessionOpen) closeSession('user');
                    else doOpen();
                  },
                  isOpen: () => sessionOpen,
                  isAvailable: mediaClippable,
                });
                return clipControl;
              },
              { owner },
            );
            // Only ever the id this plugin registered, mirroring share:
            // unregisterControlsFor(owner) would drop a neighbour's control
            // (chapters, playlist) sharing the container.
            releaseControls = () => {
              unregisterControl(CONTROL_ID, { owner });
              clipControl = null;
            };
          })
          .catch(() => {
            api?.logger.debug('@scarlett-player/ui not present, clip control not registered');
          });
      }

      api.onDestroy(teardown);
    },

    destroy(): void {
      teardown();
    },

    open(): void {
      doOpen();
    },

    close(): void {
      closeSession('user');
    },

    setRange(start: number, end: number): void {
      if (!api || !sessionOpen) return;
      const step = (cfg.step as number | undefined) ?? 1;
      const snapped: ClipSelection = { start: snap(start, step), end: snap(end, step) };
      // `!dragging`: a host setRange() landing mid-drag updates the selection
      // but must not re-arm (and un-suspend) the loop - the drag still owns
      // the media, same rule as the overlay path in applySelectionFromSelector.
      commitSelection(clampSelection(snapped), 'user', !dragging);
    },

    setTitle(title: string): void {
      if (!api) return;
      applyTitle(title);
      // Host-driven title writes mirror into the open panel. Keystrokes from
      // the panel itself arrive via onTitleChange and deliberately do not
      // echo back - the field keeps the raw text while typing.
      overlay?.setTitle(titleText);
    },

    getRange(): ClipRange | null {
      if (!sessionOpen || sessionMediaId === null) return null;
      return buildRange(sessionMediaId);
    },

    commit(): Promise<void> {
      return doCommit();
    },

    isOpen(): boolean {
      return sessionOpen;
    },

    configure(patch: Partial<Pick<ClipsPluginConfig, 'minDuration' | 'maxDuration' | 'defaultDuration' | 'step'>>): void {
      for (const key of ['minDuration', 'maxDuration', 'defaultDuration', 'step'] as const) {
        if (patch[key] !== undefined) cfg[key] = patch[key];
      }
      applyLimits();

      if (!sessionOpen || !selection) return;
      const previous = selection;
      const clamped = clampSelection(selection);
      if (clamped.start === previous.start && clamped.end === previous.end) return;
      commitSelection(clamped, 'clamp');
      // == GROUP 3 UI SEAM (c): the re-clamp flashes its reason in the
      // notice. clampSelection pulls to whichever limit bites, so the new
      // length names it; commitSelection() has already re-rendered the
      // panel itself from the single-source-of-truth selection. ==
      if (overlay) {
        const limits = resolveLimits(cfg);
        const length = clamped.end - clamped.start;
        const reason: ClipClampReason =
          Math.abs(length - limits.maxDuration) < 1e-6
            ? 'max-duration'
            : Math.abs(length - limits.minDuration) < 1e-6
              ? 'min-duration'
              : 'bounds';
        overlay.showClampNotice(reason);
      }
    },
  };
}

export default createClipsPlugin;
