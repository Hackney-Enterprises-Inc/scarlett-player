/**
 * RangeSelector - the two-handle in/out clip track.
 *
 * A self-contained DOM component: no player, no video element, no
 * `@scarlett-player/ui` imports. It renders one selection state (the plugin's
 * `clipSelection` key is the single source of truth), turns pointer and
 * keyboard input into model calls (`snap` -> `moveStart`/`moveEnd`, which
 * clamp and never push the other handle), and reports every result through
 * callbacks. The only value it owns internally is a drag in progress.
 *
 * Pointer Events, not the mouse+touch pair the ProgressBar uses. jsdom 24 has
 * no `PointerEvent` constructor and no `setPointerCapture`, so this component
 * calls `setPointerCapture?.()` / `releasePointerCapture?.()` (optional
 * chaining, never assumes they exist) and reads only `clientX` off the event -
 * which lets tests dispatch `new MouseEvent('pointerdown', ...)`.
 *
 * Every key this component handles calls `preventDefault()`: the UI plugin's
 * document-level shortcut handler bails on `defaultPrevented` and skips slider
 * targets, so arrows on a handle must never also seek the video or toggle
 * playback.
 *
 * ## Callback contract (pinned - tasks 3.3 and 3.5 build on this verbatim)
 *
 * ```ts
 * new RangeSelector({
 *   selection, bounds, config,
 *   callbacks: {
 *     onChange: (selection, meta) => {},   // after any committed move
 *     onDragStart: (handle) => {},          // pointerdown chose a handle
 *     onDragMove: (handle, time) => {},     // every pointermove, always fires
 *     onDragEnd: (selection) => {},         // pointerup / pointercancel
 *   },
 * });
 * ```
 *
 * - `pointerdown` only *selects* the nearer handle (ties at the exact
 *   midpoint go to start); the first position commit is the first
 *   `pointermove`, so pressing near a handle never jumps it.
 * - `onChange` fires when a move changed the selection **or** was clamped
 *   (a press pinned against a limit keeps reporting `clamped: true` so the
 *   overlay's notice can re-flash; the selection value may be unchanged).
 * - `onDragMove` fires on every `pointermove` during a drag even when the
 *   selection did not change - that is the channel task 3.5 throttles
 *   drag-to-scrub seeks (100ms) on. `time` is the handle's landed
 *   (snapped + clamped) position, never the raw pointer time.
 */

import { formatTime } from '@scarlett-player/core';
import { moveStart, moveEnd, resolveLimits, snap } from './range';
import type { ClipSelection, RangeBounds } from './range';
import type { ClipsPluginConfig } from './types';

/** Which handle an interaction targets. */
export type ClipHandle = 'start' | 'end';

/** How a move was initiated; surfaced on {@link ClipChangeMeta}. */
export type ClipMoveSource = 'pointer' | 'keyboard';

/**
 * Which limit refused a clamped move:
 * - `'min-duration'` - the handles cannot get any closer
 * - `'max-duration'` - the clip cannot get any longer
 * - `'bounds'` - the media (or DVR) window edge
 */
export type ClipClampReason = 'min-duration' | 'max-duration' | 'bounds';

/** Context for a committed move, passed to {@link RangeSelectorCallbacks.onChange}. */
export interface ClipChangeMeta {
  /** The handle that moved (the other never does - clamp, don't push). */
  handle: ClipHandle;
  /** Pointer drag vs. keyboard step. */
  source: ClipMoveSource;
  /** True when the model clamped the requested time. */
  clamped: boolean;
  /** Which limit bit, when clamped; null otherwise. */
  clampReason: ClipClampReason | null;
}

/**
 * Callback surface for the integration lanes. All optional; the selector
 * works stand-alone without them.
 */
export interface RangeSelectorCallbacks {
  /**
   * After any committed move: fires with the new selection and whether the
   * move was clamped (plus the reason). Task 3.3's overlay renders the
   * readout from this and flashes the notice off `meta.clampReason`.
   *
   * @param selection - The selection after clamp + snap
   * @param meta - Handle, input source and clamp info
   */
  onChange?: (selection: ClipSelection, meta: ClipChangeMeta) => void;
  /**
   * Pointerdown chose a handle (before any position change). Task 3.5 pauses
   * playback and suspends the preview loop here.
   *
   * @param handle - The handle now under the pointer
   */
  onDragStart?: (handle: ClipHandle) => void;
  /**
   * Every pointermove during a drag, continuous (fires even when the
   * selection is unchanged, e.g. pinned against a limit). Task 3.5 throttles
   * drag-to-scrub seeks (100ms) off this.
   *
   * @param handle - The dragged handle
   * @param time - The handle's landed (snapped + clamped) time, media seconds
   */
  onDragMove?: (handle: ClipHandle, time: number) => void;
  /**
   * Pointerup / pointercancel released the drag. Task 3.5 seeks to
   * `selection.start`, resumes the loop and restores play state here.
   *
   * @param selection - The final selection at release
   */
  onDragEnd?: (selection: ClipSelection) => void;
}

/** Construction options for {@link RangeSelector}. */
export interface RangeSelectorOptions {
  /** The initial selection to render (normally from `clipSelection` state). */
  selection: ClipSelection;
  /** The bounds the track spans (`0..duration` in v1). */
  bounds: RangeBounds;
  /** Host config: `minDuration`, `maxDuration` and `step` apply here. */
  config: ClipsPluginConfig;
  /** Integration callbacks; see {@link RangeSelectorCallbacks}. */
  callbacks?: RangeSelectorCallbacks;
}

/** How long `.sp-clip-handle--clamped` stays on, matching the notice flash. */
const CLAMP_FLASH_MS = 1000;

/** Arrow-key multiplier with Shift held. */
const KEYBOARD_COARSE_FACTOR = 5;

/**
 * Two-handle clip range track: a `.sp-clip-track` band containing the shaded
 * `.sp-clip-track__range` and two `role="slider"` handles. See the module
 * docblock for the DOM structure, input rules and the callback contract.
 */
export class RangeSelector {
  private readonly track: HTMLElement;
  private readonly rangeEl: HTMLElement;
  private readonly startHandle: HTMLElement;
  private readonly endHandle: HTMLElement;

  private selection: ClipSelection;
  private bounds: RangeBounds;
  private config: ClipsPluginConfig;
  private readonly callbacks: RangeSelectorCallbacks;

  /** The drag in progress - the only state this component owns. */
  private drag: { handle: ClipHandle; pointerId: number } | null = null;
  private clampTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  /**
   * Builds the selector DOM (detached - the caller mounts `element`).
   *
   * @param options - Initial selection, bounds, host config and callbacks
   */
  constructor(options: RangeSelectorOptions) {
    this.selection = { start: options.selection.start, end: options.selection.end };
    this.bounds = { min: options.bounds.min, max: options.bounds.max };
    this.config = options.config;
    this.callbacks = options.callbacks ?? {};

    this.track = document.createElement('div');
    this.track.className = 'sp-clip-track';

    this.rangeEl = document.createElement('div');
    this.rangeEl.className = 'sp-clip-track__range';
    this.track.appendChild(this.rangeEl);

    this.startHandle = this.buildHandle('start', 'Clip start');
    this.endHandle = this.buildHandle('end', 'Clip end');
    this.track.appendChild(this.startHandle);
    this.track.appendChild(this.endHandle);

    this.track.addEventListener('pointerdown', this.onPointerDown);
    this.track.addEventListener('pointermove', this.onPointerMove);
    this.track.addEventListener('pointerup', this.onPointerUp);
    this.track.addEventListener('pointercancel', this.onPointerUp);

    this.render();
  }

  /** The track element; the overlay mounts this and owns placement. */
  get element(): HTMLElement {
    return this.track;
  }

  /**
   * Re-render from state - the single path for external updates. The plugin
   * calls this whenever `clipSelection` changes (setRange, keyboard, drags,
   * `configure()` re-clamps). No callbacks fire: nothing here "moved", the
   * world did.
   *
   * During an active drag the drag continues from the new selection (the next
   * pointermove applies the model to what is passed in here).
   *
   * @param selection - The selection to render
   * @param bounds - The bounds the track spans
   * @param config - Optional replacement config (limits changed at runtime)
   */
  update(selection: ClipSelection, bounds: RangeBounds, config?: ClipsPluginConfig): void {
    this.selection = { start: selection.start, end: selection.end };
    this.bounds = { min: bounds.min, max: bounds.max };
    if (config) this.config = config;
    this.render();
  }

  /**
   * Detach all listeners, clear timers and remove the DOM. Idempotent; the
   * component must not be reused afterwards.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.track.removeEventListener('pointerdown', this.onPointerDown);
    this.track.removeEventListener('pointermove', this.onPointerMove);
    this.track.removeEventListener('pointerup', this.onPointerUp);
    this.track.removeEventListener('pointercancel', this.onPointerUp);
    if (this.clampTimer !== null) {
      clearTimeout(this.clampTimer);
      this.clampTimer = null;
    }
    this.drag = null;
    this.track.remove();
  }

  // --------------------------------------------------------------------------
  // DOM construction / rendering
  // --------------------------------------------------------------------------

  /** @internal Build one slider handle with its ARIA wiring and key handler. */
  private buildHandle(which: ClipHandle, label: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `sp-clip-handle sp-clip-handle--${which}`;
    el.setAttribute('role', 'slider');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', label);
    el.dataset.clipHandle = which;
    el.addEventListener('keydown', (event: KeyboardEvent) => this.onKeyDown(which, event));
    return el;
  }

  /** @internal Position both handles and the range fill from current state. */
  private render(): void {
    const { min, max } = this.bounds;
    const span = max - min;
    const pct = (t: number): number =>
      Number.isFinite(span) && span > 0 ? Math.min(Math.max((t - min) / span, 0), 1) * 100 : 0;

    const startPct = pct(this.selection.start);
    const endPct = pct(this.selection.end);

    this.rangeEl.style.left = `${startPct}%`;
    this.rangeEl.style.width = `${Math.max(endPct - startPct, 0)}%`;
    this.startHandle.style.left = `${startPct}%`;
    this.endHandle.style.left = `${endPct}%`;

    for (const [el, time] of [
      [this.startHandle, this.selection.start],
      [this.endHandle, this.selection.end],
    ] as const) {
      el.setAttribute('aria-valuemin', String(min));
      el.setAttribute('aria-valuemax', String(max));
      el.setAttribute('aria-valuenow', String(time));
      el.setAttribute('aria-valuetext', formatTime(time));
    }
  }

  // --------------------------------------------------------------------------
  // Pointer interaction
  // --------------------------------------------------------------------------

  /**
   * @internal
   * pointerdown picks the nearer handle - ties (pointer exactly at the
   * selection midpoint) resolve to the start handle - captures the pointer on
   * the track and announces the drag. It does NOT move anything yet: pressing
   * beside a handle must not jump it.
   */
  private onPointerDown = (event: PointerEvent): void => {
    if (this.destroyed || this.drag) return;
    if (event.button !== 0) return; // primary button / touch only
    const raw = this.timeFromClientX(event.clientX);
    if (raw === null) return;
    // Compare on the snap grid: clientX -> time carries float noise that would
    // otherwise decide an exact-midpoint tie by an epsilon.
    const which = this.pickHandle(snap(raw, this.stepValue()));
    this.drag = { handle: which, pointerId: event.pointerId };
    // Optional: jsdom has no setPointerCapture; real browsers capture moves
    // and the release event onto the track even outside its bounds.
    this.track.setPointerCapture?.(event.pointerId);
    this.track.classList.add('sp-clip-track--dragging');
    this.handleEl(which).classList.add('sp-clip-handle--dragging');
    this.handleEl(which).focus?.({ preventScroll: true });
    this.callbacks.onDragStart?.(which);
  };

  /** @internal Convert clientX to a time on the track, or null if unusable. */
  private onPointerMove = (event: PointerEvent): void => {
    if (!this.drag) return;
    const raw = this.timeFromClientX(event.clientX);
    if (raw === null) return;
    const landed = this.applyMove(this.drag.handle, raw, 'pointer');
    // Continuous channel for drag-to-scrub (task 3.5): fires even when the
    // selection is pinned against a limit and did not change.
    this.callbacks.onDragMove?.(this.drag.handle, landed);
  };

  /** @internal Release the drag; pointerup and pointercancel share the path. */
  private onPointerUp = (): void => {
    if (!this.drag) return;
    const { handle, pointerId } = this.drag;
    this.drag = null;
    this.track.releasePointerCapture?.(pointerId);
    this.track.classList.remove('sp-clip-track--dragging');
    this.handleEl(handle).classList.remove('sp-clip-handle--dragging');
    this.callbacks.onDragEnd?.({ ...this.selection });
  };

  /**
   * @internal Which handle a pointer position targets: the nearer one; an
   * exact-midpoint tie goes to start (the pointer sits on the start side of
   * the selection as it crosses the middle).
   */
  private pickHandle(time: number): ClipHandle {
    const { start, end } = this.selection;
    return time - start <= end - time ? 'start' : 'end';
  }

  /** @internal Map a clientX to media seconds; null if the track has no box. */
  private timeFromClientX(clientX: number): number | null {
    const rect = this.track.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const { min, max } = this.bounds;
    const ratio = (clientX - rect.left) / rect.width;
    return min + Math.min(Math.max(ratio, 0), 1) * (max - min);
  }

  // --------------------------------------------------------------------------
  // Keyboard interaction
  // --------------------------------------------------------------------------

  /**
   * @internal
   * ArrowLeft/Right step by one `step`, Shift+Arrow by five, Home/End jump to
   * the track bounds. Every key handled here calls `preventDefault()` so the
   * UI plugin's document-level shortcuts skip the event.
   */
  private onKeyDown(which: ClipHandle, event: KeyboardEvent): void {
    if (this.destroyed) return;
    const step = this.stepValue();
    const delta = event.shiftKey ? step * KEYBOARD_COARSE_FACTOR : step;
    const current = this.selection[which];

    let target: number | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        target = current - delta;
        break;
      case 'ArrowRight':
        target = current + delta;
        break;
      case 'Home':
        target = this.bounds.min;
        break;
      case 'End':
        target = this.bounds.max;
        break;
      default:
        return; // unhandled keys (Tab etc.) pass through untouched
    }

    event.preventDefault();
    this.applyMove(which, target, 'keyboard');
  }

  // --------------------------------------------------------------------------
  // Model application
  // --------------------------------------------------------------------------

  /**
   * @internal The single commit path: snap the requested time, run the
   * clamping model (`moveStart`/`moveEnd` - the other handle never moves),
   * re-render, flash + report if clamped, and fire `onChange` when anything
   * meaningful happened.
   *
   * @returns The handle's landed time
   */
  private applyMove(which: ClipHandle, requested: number, source: ClipMoveSource): number {
    const target = snap(requested, this.stepValue());
    const prev = this.selection;
    const next =
      which === 'start'
        ? moveStart(prev, target, this.config, this.bounds)
        : moveEnd(prev, target, this.config, this.bounds);
    const landed = next[which];
    const clamped = landed !== target;
    const changed = next.start !== prev.start || next.end !== prev.end;

    this.selection = next;
    this.render();

    if (clamped) this.flashClamp(which);
    if (changed || clamped) {
      this.callbacks.onChange?.({ ...next }, {
        handle: which,
        source,
        clamped,
        clampReason: clamped ? this.classifyClamp(which, target, landed) : null,
      });
    }
    return landed;
  }

  /**
   * @internal Name the limit a clamped move hit. Recall the clamp geometry:
   * `landed > requested` means the value was lifted to the lower limit;
   * `landed < requested` means it was held down to the upper limit.
   */
  private classifyClamp(which: ClipHandle, requested: number, landed: number): ClipClampReason {
    const { maxDuration } = resolveLimits(this.config);
    const { start, end } = this.selection;
    const { min, max } = this.bounds;

    if (which === 'start') {
      // Lower limit is max(bounds.min, end - maxDuration).
      if (landed > requested) return min >= end - maxDuration ? 'bounds' : 'max-duration';
      // Upper limit is end - minDuration.
      return 'min-duration';
    }
    // Upper limit is min(bounds.max, start + maxDuration).
    if (landed < requested) return max <= start + maxDuration ? 'bounds' : 'max-duration';
    // Lower limit is start + minDuration.
    return 'min-duration';
  }

  /** @internal Add `--clamped` to a handle, re-arming the ~1s removal timer. */
  private flashClamp(which: ClipHandle): void {
    const el = this.handleEl(which);
    el.classList.add('sp-clip-handle--clamped');
    if (this.clampTimer !== null) clearTimeout(this.clampTimer);
    this.clampTimer = setTimeout(() => {
      this.clampTimer = null;
      this.startHandle.classList.remove('sp-clip-handle--clamped');
      this.endHandle.classList.remove('sp-clip-handle--clamped');
    }, CLAMP_FLASH_MS);
  }

  /** @internal The handle element for a handle id. */
  private handleEl(which: ClipHandle): HTMLElement {
    return which === 'start' ? this.startHandle : this.endHandle;
  }

  /** @internal Snap granularity with the same guard `snap()` applies. */
  private stepValue(): number {
    const step = this.config.step ?? 1;
    return Number.isFinite(step) && step > 0 ? step : 1;
  }
}
