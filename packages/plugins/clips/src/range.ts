/**
 * Pure clip-range model.
 *
 * All clip arithmetic lives here - pre-roll, clamping, snapping, validation -
 * so it is unit-testable without DOM and shared by the overlay, the selector
 * and the headless API. No state, no events, no player access: callers pass
 * the selection, the config and the bounds in, and pure values come back.
 *
 * Clamp, don't push: a handle moved past its limit stops; the other handle
 * never moves. Predictable, and the readout can say why ("Max 60s").
 */

import type { ClipsPluginConfig } from './types';

/** Fallback limits, only relevant for a host that sets nothing. */
const DEFAULT_MIN_DURATION = 5;
const DEFAULT_MAX_DURATION = 60;
const DEFAULT_DEFAULT_DURATION = 30;
const DEFAULT_STEP = 1;
const DEFAULT_TITLE_MAX_LENGTH = 80;

/** Float tolerance for duration comparisons, so a snapped 5s clip is not 'too-short'. */
const EPSILON = 1e-9;

/**
 * The clip-permission window for a selection: the in/out bounds handles may
 * occupy. `[0, duration]` for VOD; the DVR window in Phase 2.
 */
export interface RangeBounds {
  /** Earliest clip time, media seconds. */
  min: number;
  /** Latest clip time, media seconds. */
  max: number;
}

/**
 * The slice of player state `bounds()` reads. Deliberately a plain parameter
 * (not an api call) so Phase 2 can return the DVR window on live - by adding
 * logic over `live`/`seekableRange` - without changing any caller.
 */
export interface BoundsSource {
  /** Total media duration in seconds; Infinity on live, which v1 never clips. */
  duration: number;
  /** Whether the current media is live. Unused in v1; present for the Phase 2 signature. */
  live?: boolean;
  /** DVR window on live, else null. Unused in v1; present for the Phase 2 signature. */
  seekableRange?: { start: number; end: number } | null;
}

/**
 * A live selection in progress: the shape of the `clipSelection` state key and
 * the value `RangeSelector` drags around. Not yet a `ClipRange` - no media id,
 * no capture metadata.
 */
export interface ClipSelection {
  /** In point, media seconds. */
  start: number;
  /** Out point, media seconds. */
  end: number;
}

/**
 * Range limits after defaults and sanity clamping are applied.
 * Produced by {@link resolveLimits}.
 */
export interface ResolvedRangeLimits {
  /** Shortest accepted clip, seconds. */
  minDuration: number;
  /** Longest accepted clip, seconds. */
  maxDuration: number;
  /** Pre-roll behind the playhead on open, seconds; guaranteed within [minDuration, maxDuration]. */
  defaultDuration: number;
  /** Snap granularity, seconds. `snap()` guards against a non-positive value. */
  step: number;
}

/** Error code for a selection that cannot be committed. */
export type RangeErrorCode = 'too-short' | 'too-long' | 'out-of-bounds' | 'inverted';

/** Error code for a title that cannot be committed. */
export type TitleErrorCode = 'title-required' | 'title-too-long';

/**
 * @internal
 * Clamp a value into an inclusive interval. With a nonsense interval
 * (lo > hi) the result lands on hi; configure()'s min > max guard is the
 * caller's job.
 */
function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

/**
 * @internal
 * Fill in the fallback defaults (5 / 60 / 30 / 1s) without validating.
 */
function rawLimits(cfg: ClipsPluginConfig): ResolvedRangeLimits {
  return {
    minDuration: cfg.minDuration ?? DEFAULT_MIN_DURATION,
    maxDuration: cfg.maxDuration ?? DEFAULT_MAX_DURATION,
    defaultDuration: cfg.defaultDuration ?? DEFAULT_DEFAULT_DURATION,
    step: cfg.step ?? DEFAULT_STEP,
  };
}

/**
 * Resolve the range limits from host config, applying the documented fallback
 * defaults and clamping `defaultDuration` into `[minDuration, maxDuration]`
 * with a console warning.
 *
 * Called at construction by the plugin factory and by {@link preroll}, so a
 * nonsense `defaultDuration` can never produce a selection that immediately
 * fails validation. `step <= 0` is guarded where it is consumed
 * ({@link snap}) rather than here.
 *
 * @param cfg - Host configuration (any subset; absent fields take fallbacks)
 * @returns The limits to apply, with a usable `defaultDuration`
 */
export function resolveLimits(cfg: ClipsPluginConfig): ResolvedRangeLimits {
  const limits = rawLimits(cfg);
  if (limits.defaultDuration < limits.minDuration || limits.defaultDuration > limits.maxDuration) {
    const clamped = clamp(limits.defaultDuration, limits.minDuration, limits.maxDuration);
    console.warn(
      `[clips] defaultDuration ${limits.defaultDuration} is outside [minDuration, maxDuration] ` +
        `= [${limits.minDuration}, ${limits.maxDuration}]; using ${clamped}.`
    );
    limits.defaultDuration = clamped;
  }
  return limits;
}

/**
 * The time window a clip may occupy. VOD (all of v1) is the whole media:
 * `[0, duration]`. Phase 2 returns the DVR window on live from the same
 * object, which is why callers pass state in rather than reading it here.
 *
 * @param state - The duration (and, in Phase 2, live/DVR fields) to bound against
 * @returns The inclusive bounds for handles
 */
export function bounds(state: BoundsSource): RangeBounds {
  return { min: 0, max: state.duration };
}

/**
 * Round a time to the nearest multiple of `step`.
 *
 * A `step` that is not a positive finite number falls back to 1 with a console
 * warning - a snapping granularity of 0 would park handles off any readable
 * grid, and a negative one would invert the rounding.
 *
 * @param t - Time in media seconds
 * @param step - Snap granularity in seconds; 1 means whole seconds
 * @returns The snapped time
 */
export function snap(t: number, step: number): number {
  let s = step;
  if (!Number.isFinite(s) || s <= 0) {
    console.warn(`[clips] step must be a positive number of seconds; got ${step}, falling back to 1.`);
    s = DEFAULT_STEP;
  }
  // toFixed(6) erases binary float noise (377 * 0.1 === 37.70000000000001)
  // without meaning anything at sub-millisecond granularity.
  return Number((Math.round(t / s) * s).toFixed(6));
}

/**
 * Build the initial selection for `open()`: pre-roll behind the playhead.
 *
 * `end` is the (clamped) current time, `start = end - defaultDuration`, then
 * `start` is clamped to `bounds.min`; if that leaves less than `minDuration`,
 * `end` is extended forward within bounds (never past `bounds.max`, which
 * `validate()` will report for media shorter than the minimum).
 *
 * @param currentTime - Playhead position in media seconds
 * @param cfg - Host configuration; `defaultDuration` is clamped with a warning
 * @param b - The window from {@link bounds}
 * @returns The snapped, bounded opening selection
 */
export function preroll(currentTime: number, cfg: ClipsPluginConfig, b: RangeBounds): ClipSelection {
  const limits = resolveLimits(cfg);
  let end = Math.min(snap(clamp(currentTime, b.min, b.max), limits.step), b.max);
  let start = snap(end - limits.defaultDuration, limits.step);
  if (start < b.min) start = b.min;
  if (end - start < limits.minDuration - EPSILON) {
    end = Math.min(snap(start + limits.minDuration, limits.step), b.max);
  }
  return { start, end };
}

/**
 * Move the in handle, clamped - the out handle never moves.
 *
 * `start` is limited to `[max(bounds.min, end - maxDuration), end - minDuration]`:
 * it cannot reach before the window, cannot make the selection longer than
 * `maxDuration`, and cannot pass `end - minDuration`.
 *
 * Does not snap: callers snap the pointer/keyboard time first (the selector
 * snaps before calling), so a single clamp is the one place limits apply.
 *
 * @param selection - The current selection
 * @param t - Requested new in point, media seconds
 * @param cfg - Host configuration (min/max duration apply)
 * @param b - The window from {@link bounds}
 * @returns A new selection with the clamped start and the same end
 */
export function moveStart(
  selection: ClipSelection,
  t: number,
  cfg: ClipsPluginConfig,
  b: RangeBounds
): ClipSelection {
  const limits = rawLimits(cfg);
  const lo = Math.max(b.min, selection.end - limits.maxDuration);
  const hi = selection.end - limits.minDuration;
  return { start: clamp(t, lo, hi), end: selection.end };
}

/**
 * Move the out handle, clamped - the in handle never moves.
 *
 * `end` is limited to `[start + minDuration, min(bounds.max, start + maxDuration)]`.
 * Symmetric with {@link moveStart}; see its note on snapping.
 *
 * @param selection - The current selection
 * @param t - Requested new out point, media seconds
 * @param cfg - Host configuration (min/max duration apply)
 * @param b - The window from {@link bounds}
 * @returns A new selection with the clamped end and the same start
 */
export function moveEnd(
  selection: ClipSelection,
  t: number,
  cfg: ClipsPluginConfig,
  b: RangeBounds
): ClipSelection {
  const limits = rawLimits(cfg);
  const lo = selection.start + limits.minDuration;
  const hi = Math.min(b.max, selection.start + limits.maxDuration);
  return { start: selection.start, end: clamp(t, lo, hi) };
}

/**
 * Check a selection against the host limits and the bounds.
 *
 * Order matters for the notice text: bounds and order are checked before
 * duration, so a negative-time selection says "out of bounds" rather than
 * "too short".
 *
 * @param selection - The selection to check
 * @param cfg - Host configuration (min/max duration apply)
 * @param b - The window from {@link bounds}
 * @returns null when committable, else the error code:
 * `'out-of-bounds'`, `'inverted'`, `'too-long'` or `'too-short'`
 */
export function validate(
  selection: ClipSelection,
  cfg: ClipsPluginConfig,
  b: RangeBounds
): RangeErrorCode | null {
  const limits = rawLimits(cfg);
  const { start, end } = selection;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'out-of-bounds';
  if (start < b.min - EPSILON || end > b.max + EPSILON) return 'out-of-bounds';
  if (end < start) return 'inverted';
  const duration = end - start;
  if (duration > limits.maxDuration + EPSILON) return 'too-long';
  if (duration < limits.minDuration - EPSILON) return 'too-short';
  return null;
}

/**
 * Check a viewer-entered title against the title config.
 *
 * Trims first: an all-whitespace title is an empty title. When `title` is
 * `false` the field is disabled and nothing is ever invalid.
 *
 * @param title - Raw title text
 * @param cfg - Host configuration (the `title` field applies)
 * @returns null when committable, else `'title-required'` or `'title-too-long'`
 */
export function validateTitle(title: string, cfg: ClipsPluginConfig): TitleErrorCode | null {
  if (cfg.title === false) return null;
  // Optional chaining short-circuits only on null/undefined, and a boolean's
  // property access yields undefined, so `false?.maxLength` reading as the
  // default is safe - but the branch above means only object configs get here.
  const maxLength = cfg.title?.maxLength ?? DEFAULT_TITLE_MAX_LENGTH;
  const required = cfg.title?.required ?? false;
  const trimmed = title.trim();
  if (trimmed.length === 0) return required ? 'title-required' : null;
  if (trimmed.length > maxLength) return 'title-too-long';
  return null;
}
