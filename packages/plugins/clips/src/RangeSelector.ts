/**
 * RangeSelector - the two-handle in/out clip range.
 *
 * A self-contained DOM component: no player, no video element, no
 * `@scarlett-player/ui` imports. It renders one selection state (the plugin's
 * `clipSelection` key is the single source of truth), turns pointer and
 * keyboard input into model calls (`snap` -> `moveStart`/`moveEnd`, which clamp
 * and never push the other handle), and reports every result through
 * callbacks. The only values it owns internally are a drag in progress and the
 * presentation it is currently mounted in.
 *
 * ## Two presentations, one instance
 *
 * The same selector renders either way, and {@link RangeSelector.setPresentation}
 * switches between them without losing the selection or the session:
 *
 * - **`'timeline'`** - mounted into the UI package's timeline extension layer,
 *   so the handles sit on the *playback* rail the viewer was already scrubbing.
 *   Two 44px lanes, IN above the rail and OUT below, each handle a labelled
 *   block with a stem pointing at its exact timestamp. Distinct vertical
 *   targets are what keeps both handles operable when the selection is a
 *   pixel wide - a thirty second clip on a two hour source at 300px.
 *   The track itself takes no pointer input: presses that miss a handle fall
 *   through to the rail and seek, which is the whole point of being there.
 * - **`'standalone'`** - the original self-contained rail, used when the UI
 *   package is absent, is too old to expose the extension seam, or has been
 *   torn down under a live session. Presses on the background pick the nearer
 *   handle, because there is no playhead underneath to seek instead.
 *
 * ## Pointer rules
 *
 * Pointer Events, not the mouse+touch pair the ProgressBar uses. jsdom 24 has
 * no `PointerEvent` constructor and no `setPointerCapture`, so this component
 * calls capture optionally and reads only `clientX`/`pointerId`/`button` off
 * the event, which lets tests dispatch `new MouseEvent('pointerdown', ...)`.
 *
 * - A press on a handle moves **that** handle. Nearest-handle logic is the
 *   standalone background's behaviour only; with overlapping targets an
 *   explicit hit must win, or the endpoints of a short selection become
 *   impossible to tell apart.
 * - The grab offset is preserved: movement applies the delta from where the
 *   handle was grabbed, so a finger that lands 8px off-centre does not teleport
 *   the endpoint by 8px worth of seconds.
 * - One pointer owns a drag. A second finger is ignored, a secondary or right
 *   button never starts one.
 * - Capture is attempted and its failure is survivable: without it the drag
 *   falls back to guarded document listeners, so a handle dragged off the rail
 *   still tracks.
 * - `pointerup` applies its final position exactly once. `pointercancel` and
 *   `lostpointercapture` keep the last committed range instead, and every exit
 *   clears ownership exactly once.
 *
 * Every key this component handles calls `preventDefault()`: the UI plugin's
 * document-level shortcut handler bails on `defaultPrevented` and skips slider
 * targets, so arrows on a handle must never also seek the video or toggle
 * playback.
 *
 * ## Callback contract
 *
 * ```ts
 * new RangeSelector({
 *   selection, bounds, config,
 *   callbacks: {
 *     onChange: (selection, meta) => {},   // after any committed move
 *     onDragStart: (handle) => {},          // pointerdown chose a handle
 *     onDragMove: (handle, time) => {},     // every pointermove, always fires
 *     onDragEnd: (selection, info) => {},   // release, cancel or lost capture
 *   },
 * });
 * ```
 */

import { moveStart, moveEnd, resolveLimits, snap } from './range';
import type { ClipSelection, RangeBounds } from './range';
import { formatTimestamp } from './time-format';
import type { ClipsPluginConfig } from './types';

/** Which handle an interaction targets. */
export type ClipHandle = 'start' | 'end';

/** How a move was initiated; surfaced on {@link ClipChangeMeta}. */
export type ClipMoveSource = 'pointer' | 'keyboard' | 'field' | 'playhead';

/**
 * Which limit refused a clamped move:
 * - `'min-duration'` - the handles cannot get any closer
 * - `'max-duration'` - the clip cannot get any longer
 * - `'bounds'` - the media (or DVR) window edge
 */
export type ClipClampReason = 'min-duration' | 'max-duration' | 'bounds';

/** Where the selector's handles are mounted. */
export type ClipPresentation = 'standalone' | 'timeline';

/** Context for a committed move, passed to {@link RangeSelectorCallbacks.onChange}. */
export interface ClipChangeMeta {
  /** The handle that moved (the other never does - clamp, don't push). */
  handle: ClipHandle;
  /** How the move was made. */
  source: ClipMoveSource;
  /** True when the model clamped the requested time. */
  clamped: boolean;
  /** Which limit bit, when clamped; null otherwise. */
  clampReason: ClipClampReason | null;
}

/** How a drag ended, passed to {@link RangeSelectorCallbacks.onDragEnd}. */
export interface ClipDragEndInfo {
  /**
   * True when the drag was interrupted rather than released: `pointercancel`,
   * a lost capture, or a teardown mid-drag.
   *
   * An interrupted drag keeps the last committed range and must **not**
   * restore playback - the viewer had a finger on a handle and the gesture was
   * taken away from them; starting playback under that is a surprise.
   */
  cancelled: boolean;
}

/**
 * Callback surface for the integration lanes. All optional; the selector
 * works stand-alone without them.
 */
export interface RangeSelectorCallbacks {
  /**
   * After any committed move: fires with the new selection and whether the
   * move was clamped (plus the reason).
   *
   * @param selection - The selection after clamp + snap
   * @param meta - Handle, input source and clamp info
   */
  onChange?: (selection: ClipSelection, meta: ClipChangeMeta) => void;
  /**
   * Pointerdown chose a handle (before any position change). The plugin pauses
   * playback and suspends the preview loop here.
   *
   * @param handle - The handle now under the pointer
   */
  onDragStart?: (handle: ClipHandle) => void;
  /**
   * Every pointermove during a drag, continuous (fires even when the selection
   * is unchanged, e.g. pinned against a limit). The plugin throttles
   * drag-to-scrub seeks off this.
   *
   * @param handle - The dragged handle
   * @param time - The handle's landed (snapped + clamped) time, media seconds
   */
  onDragMove?: (handle: ClipHandle, time: number) => void;
  /**
   * The drag ended. The plugin seeks to `selection.start`, restores the
   * preview loop and (on a clean release only) the play state.
   *
   * @param selection - The final selection
   * @param info - Whether the drag was interrupted rather than released
   */
  onDragEnd?: (selection: ClipSelection, info: ClipDragEndInfo) => void;
}

/** Construction options for {@link RangeSelector}. */
export interface RangeSelectorOptions {
  /** The initial selection to render (normally from `clipSelection` state). */
  selection: ClipSelection;
  /** The bounds the track spans (`0..duration` in v1). */
  bounds: RangeBounds;
  /** Host config: `minDuration`, `maxDuration` and `step` apply here. */
  config: ClipsPluginConfig;
  /**
   * Where the handles are mounted.
   * @defaultValue 'standalone'
   */
  presentation?: ClipPresentation;
  /** Integration callbacks; see {@link RangeSelectorCallbacks}. */
  callbacks?: RangeSelectorCallbacks;
}

/** How long `.sp-clip-handle--clamped` stays on, matching the notice flash. */
const CLAMP_FLASH_MS = 1000;

/** Arrow-key multiplier with Shift held. */
const KEYBOARD_COARSE_FACTOR = 5;

/** Accessible names; also the visible short labels on the timeline lanes. */
const HANDLE_LABEL: Record<ClipHandle, string> = { start: 'IN', end: 'OUT' };
const HANDLE_ARIA: Record<ClipHandle, string> = {
  start: 'Clip in point',
  end: 'Clip out point',
};

/** A drag in progress: the only mutable interaction state this component owns. */
interface DragState {
  handle: ClipHandle;
  pointerId: number;
  /** `pointerTime - handleTime` at press, so the handle moves by the delta. */
  grabOffset: number;
  /** Whether `setPointerCapture` succeeded; false means document fallback. */
  captured: boolean;
  /** Set once the drag has been ended, so every exit path releases exactly once. */
  released: boolean;
}

/**
 * Two-handle clip range: a `.sp-clip-track` band containing the shaded
 * `.sp-clip-track__range` and two `role="slider"` handles. See the module
 * docblock for the presentations, input rules and the callback contract.
 */
export class RangeSelector {
  private readonly track: HTMLElement;
  private readonly rangeEl: HTMLElement;
  private readonly startHandle: HTMLElement;
  private readonly endHandle: HTMLElement;
  private readonly labels: Record<ClipHandle, HTMLElement>;

  private selection: ClipSelection;
  private bounds: RangeBounds;
  private config: ClipsPluginConfig;
  private presentation: ClipPresentation;
  private readonly callbacks: RangeSelectorCallbacks;

  private drag: DragState | null = null;
  private clampTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  /** False while frozen by {@link RangeSelector.setInteractive}. */
  private interactive = true;

  /**
   * Builds the selector DOM (detached - the caller mounts `element`).
   *
   * @param options - Initial selection, bounds, host config, presentation and
   * callbacks
   */
  constructor(options: RangeSelectorOptions) {
    this.selection = { start: options.selection.start, end: options.selection.end };
    this.bounds = { min: options.bounds.min, max: options.bounds.max };
    this.config = options.config;
    this.presentation = options.presentation ?? 'standalone';
    this.callbacks = options.callbacks ?? {};

    this.track = document.createElement('div');

    this.rangeEl = document.createElement('div');
    this.rangeEl.className = 'sp-clip-track__range';
    this.track.appendChild(this.rangeEl);

    const start = this.buildHandle('start');
    const end = this.buildHandle('end');
    this.startHandle = start.el;
    this.endHandle = end.el;
    this.labels = { start: start.label, end: end.label };
    this.track.appendChild(this.startHandle);
    this.track.appendChild(this.endHandle);

    // Bound on the track, not per handle: a drag continues to receive moves
    // through the captured element, and the target check inside decides
    // whether a press is a handle grab or background.
    this.track.addEventListener('pointerdown', this.onPointerDown);
    this.track.addEventListener('pointermove', this.onPointerMove);
    this.track.addEventListener('pointerup', this.onPointerUp);
    this.track.addEventListener('pointercancel', this.onPointerCancel);
    this.track.addEventListener('lostpointercapture', this.onLostCapture);

    this.applyPresentationClass();
    this.render();
  }

  /** The track element; the caller mounts this and owns placement. */
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
    if (this.destroyed) return;
    this.selection = { start: selection.start, end: selection.end };
    this.bounds = { min: bounds.min, max: bounds.max };
    if (config) this.config = config;
    this.render();
  }

  /**
   * Move the handles between the timeline lanes and the standalone rail.
   *
   * The caller re-parents `element`; this only changes how it draws. An active
   * drag is cancelled first - the geometry it was measuring against is about to
   * stop existing, and continuing would apply a delta from a rail that moved.
   *
   * @param presentation - Where the handles are now mounted
   */
  setPresentation(presentation: ClipPresentation): void {
    if (this.destroyed || this.presentation === presentation) return;
    this.endDrag(true);
    this.presentation = presentation;
    this.applyPresentationClass();
    this.render();
  }

  /**
   * The presentation currently in force.
   *
   * @returns `'timeline'` or `'standalone'`
   */
  getPresentation(): ClipPresentation {
    return this.presentation;
  }

  /**
   * Move focus to one handle.
   *
   * @param which - The handle to focus
   */
  focusHandle(which: ClipHandle): void {
    if (this.destroyed) return;
    this.handleEl(which).focus?.({ preventScroll: true });
  }

  /**
   * Whether a pointer drag is in progress.
   *
   * @returns True while a handle is held
   */
  isDragging(): boolean {
    return this.drag !== null;
  }

  /**
   * Abandon any drag in progress, keeping the range it had reached.
   *
   * Reported as a cancellation, so the plugin keeps the last committed
   * endpoints and leaves playback alone. The device rotating is the case this
   * exists for: the rail the drag was measuring against has moved, and
   * continuing to apply a delta against the old geometry would throw the
   * endpoint somewhere the viewer never dragged it.
   */
  cancelDrag(): void {
    if (this.destroyed) return;
    this.endDrag(true);
  }

  /**
   * Freeze or thaw the handles.
   *
   * Frozen handles take no pointer input, leave the tab order and announce
   * themselves as disabled. Used while a submission is in flight (the range
   * being submitted must not move under the request) and while the details
   * stage covers the player, where the timeline behind it is out of reach.
   *
   * The freeze is enforced in the handlers, not only in CSS and the tab order:
   * `tabindex="-1"` removes a handle from tabbing but leaves a handle that was
   * already focused when the freeze landed focused and taking arrow keys, so
   * the range could still be moved out from under a submission with the
   * keyboard.
   *
   * Any drag in progress is cancelled, so the endpoint stays where it was
   * rather than following a finger the editor is no longer listening to.
   *
   * @param interactive - False to freeze
   */
  setInteractive(interactive: boolean): void {
    if (this.destroyed) return;
    this.interactive = interactive;
    if (!interactive) this.endDrag(true);
    this.track.classList.toggle('sp-clip-track--frozen', !interactive);
    for (const which of ['start', 'end'] as const) {
      const el = this.handleEl(which);
      el.setAttribute('aria-disabled', String(!interactive));
      el.setAttribute('tabindex', interactive ? '0' : '-1');
    }
  }

  /**
   * Detach all listeners, clear timers and remove the DOM. Idempotent; the
   * component must not be reused afterwards.
   */
  destroy(): void {
    if (this.destroyed) return;
    // Before the flag: a drag in flight is an interruption, and the plugin has
    // to hear about it so it does not restore playback under a closing editor.
    this.endDrag(true);
    this.destroyed = true;
    this.track.removeEventListener('pointerdown', this.onPointerDown);
    this.track.removeEventListener('pointermove', this.onPointerMove);
    this.track.removeEventListener('pointerup', this.onPointerUp);
    this.track.removeEventListener('pointercancel', this.onPointerCancel);
    this.track.removeEventListener('lostpointercapture', this.onLostCapture);
    this.detachDocumentFallback();
    if (this.clampTimer !== null) {
      clearTimeout(this.clampTimer);
      this.clampTimer = null;
    }
    this.track.remove();
  }

  // --------------------------------------------------------------------------
  // DOM construction / rendering
  // --------------------------------------------------------------------------

  /** @internal Build one slider handle with its stem, label, ARIA and keys. */
  private buildHandle(which: ClipHandle): { el: HTMLElement; label: HTMLElement } {
    const el = document.createElement('div');
    el.className = `sp-clip-handle sp-clip-handle--${which}`;
    el.setAttribute('role', 'slider');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', HANDLE_ARIA[which]);
    el.dataset.clipHandle = which;

    const stem = document.createElement('span');
    stem.className = 'sp-clip-handle__stem';
    stem.setAttribute('aria-hidden', 'true');
    el.appendChild(stem);

    // The visible label doubles as the compact readout: with the lanes on the
    // playback rail there is no room for a separate "0:12 - 0:47" line, and
    // putting each time beside its own handle is more use than both together
    // somewhere else. aria-hidden because the slider announces its own value.
    const label = document.createElement('span');
    label.className = 'sp-clip-handle__label';
    label.setAttribute('aria-hidden', 'true');
    el.appendChild(label);

    el.addEventListener('keydown', (event: KeyboardEvent) => this.onKeyDown(which, event));
    return { el, label };
  }

  /** @internal Apply the presentation modifier to the track's class list. */
  private applyPresentationClass(): void {
    this.track.className = `sp-clip-track sp-clip-track--${this.presentation}`;
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

    const step = this.stepValue();
    for (const which of ['start', 'end'] as const) {
      const el = this.handleEl(which);
      const time = this.selection[which];
      const limits = this.endpointLimits(which);
      // The limits a slider announces are the ones it can actually reach: the
      // other endpoint and the duration limits, not the whole media. A viewer
      // told "0 to 7200" and then stopped at 118 has been lied to.
      el.setAttribute('aria-valuemin', String(round(limits.lo)));
      el.setAttribute('aria-valuemax', String(round(limits.hi)));
      el.setAttribute('aria-valuenow', String(round(time)));
      el.setAttribute('aria-valuetext', `${HANDLE_LABEL[which]} ${formatTimestamp(time, step)}`);
      this.labels[which].textContent = `${HANDLE_LABEL[which]} ${formatTimestamp(time, step)}`;
    }
  }

  // --------------------------------------------------------------------------
  // Pointer interaction
  // --------------------------------------------------------------------------

  /**
   * @internal
   * pointerdown starts a drag on a handle. It does NOT move anything: the grab
   * offset is recorded so the first move applies a delta rather than jumping
   * the handle to the finger.
   */
  private onPointerDown = (event: PointerEvent): void => {
    if (this.destroyed || !this.interactive || this.drag) return;
    // Primary button (or touch/pen, which report 0) only. A right-click or a
    // stylus barrel press must never grab a handle.
    if (event.button !== undefined && event.button !== 0) return;

    const which = this.resolveTarget(event);
    if (which === null) return;

    const raw = this.timeFromClientX(event.clientX);
    if (raw === null) return;

    const handleEl = this.handleEl(which);
    let captured = false;
    try {
      handleEl.setPointerCapture?.(event.pointerId);
      captured = typeof handleEl.setPointerCapture === 'function';
    } catch {
      // Safari throws for a pointer that has already been released, and jsdom
      // has no capture at all. Neither is fatal: the document fallback below
      // keeps the drag tracking.
      captured = false;
    }

    this.drag = {
      handle: which,
      pointerId: event.pointerId,
      grabOffset: raw - this.selection[which],
      captured,
      released: false,
    };

    if (!captured) this.attachDocumentFallback();

    this.track.classList.add('sp-clip-track--dragging');
    handleEl.classList.add('sp-clip-handle--dragging');
    handleEl.focus?.({ preventScroll: true });
    this.callbacks.onDragStart?.(which);
  };

  /** @internal Move the dragged handle by the delta from where it was grabbed. */
  private onPointerMove = (event: PointerEvent): void => {
    if (!this.drag || this.drag.released) return;
    // Only the pointer that started the drag drives it: a second finger on the
    // track must not yank the handle. jsdom's stand-in MouseEvents carry no
    // pointerId at all, so undefined matches the undefined recorded on drag.
    if (event.pointerId !== this.drag.pointerId) return;
    const raw = this.timeFromClientX(event.clientX);
    if (raw === null) return;
    const landed = this.applyMove(this.drag.handle, raw - this.drag.grabOffset, 'pointer');
    // Continuous channel for drag-to-scrub: fires even when the selection is
    // pinned against a limit and did not change.
    this.callbacks.onDragMove?.(this.drag.handle, landed);
  };

  /**
   * @internal A clean release: apply the release coordinates once, then end.
   *
   * The final position matters - a fast drag can outrun `pointermove` by
   * several pixels, and the endpoint the viewer let go on is the one they
   * meant. Applying it here rather than trusting the last move is what makes
   * the release land where the finger did.
   */
  private onPointerUp = (event: PointerEvent): void => {
    if (!this.drag || this.drag.released) return;
    if (event.pointerId !== this.drag.pointerId) return;
    const raw = this.timeFromClientX(event.clientX);
    if (raw !== null) this.applyMove(this.drag.handle, raw - this.drag.grabOffset, 'pointer');
    this.endDrag(false);
  };

  /** @internal The gesture was taken away: keep the range, restore nothing. */
  private onPointerCancel = (event: PointerEvent): void => {
    if (!this.drag || this.drag.released) return;
    if (event.pointerId !== this.drag.pointerId) return;
    this.endDrag(true);
  };

  /**
   * @internal Capture was lost (a scroll took over, the element was removed).
   *
   * Same treatment as a cancel. Fires after a normal `pointerup` too, which the
   * `released` guard on the drag state absorbs.
   */
  private onLostCapture = (event: PointerEvent): void => {
    if (!this.drag || this.drag.released) return;
    if (event.pointerId !== this.drag.pointerId) return;
    this.endDrag(true);
  };

  /**
   * @internal End the current drag exactly once, whatever route got here.
   *
   * @param cancelled - True when the drag was interrupted rather than released
   */
  private endDrag(cancelled: boolean): void {
    const drag = this.drag;
    if (!drag || drag.released) return;
    drag.released = true;
    this.drag = null;

    if (drag.captured) {
      try {
        this.handleEl(drag.handle).releasePointerCapture?.(drag.pointerId);
      } catch {
        // Already released by the browser; nothing to undo.
      }
    }
    this.detachDocumentFallback();

    this.track.classList.remove('sp-clip-track--dragging');
    this.handleEl(drag.handle).classList.remove('sp-clip-handle--dragging');
    this.callbacks.onDragEnd?.({ ...this.selection }, { cancelled });
  }

  /**
   * @internal Which handle a press targets.
   *
   * An explicit hit on a handle always wins - with the lanes overlapping on a
   * short selection, nearest-by-time would pick the wrong one constantly.
   * Falling back to the nearer handle is the standalone rail's behaviour only;
   * on the timeline a press that missed both handles belongs to the playhead
   * underneath, and this returns null so it falls through and seeks.
   *
   * @param event - The press
   * @returns The handle to drag, or null to ignore the press
   */
  private resolveTarget(event: PointerEvent): ClipHandle | null {
    const target = event.target;
    if (target instanceof Element) {
      const hit = target.closest<HTMLElement>('[data-clip-handle]');
      const which = hit?.dataset.clipHandle;
      if (which === 'start' || which === 'end') return which;
    }

    if (this.presentation !== 'standalone') return null;

    const raw = this.timeFromClientX(event.clientX);
    if (raw === null) return null;
    // Compare on the snap grid: clientX -> time carries float noise that would
    // otherwise decide an exact-midpoint tie by an epsilon.
    return this.pickHandle(snap(raw, this.stepValue()));
  }

  /**
   * @internal Which handle a background position is nearer to; an exact-midpoint
   * tie goes to start (the pointer sits on the start side as it crosses).
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

  // --- document fallback, for when pointer capture is unavailable -----------

  /**
   * @internal Whether a document-level event has already been handled on the way up.
   *
   * The fallback listens on the document, and an event that started inside the
   * track reaches the track's own handler first and then bubbles here. Without
   * this the whole drag is processed twice per move - two model applications,
   * two `onChange`, two scrub seeks.
   *
   * @param event - The event as the document sees it
   * @returns True when the track's own listener already handled it
   */
  private alreadyHandled(event: Event): boolean {
    const target = event.target;
    return target instanceof Node && this.track.contains(target);
  }

  private onDocPointerMove = (event: PointerEvent): void => {
    if (this.alreadyHandled(event)) return;
    this.onPointerMove(event);
  };

  private onDocPointerUp = (event: PointerEvent): void => {
    if (this.alreadyHandled(event)) return;
    this.onPointerUp(event);
  };

  private onDocPointerCancel = (event: PointerEvent): void => {
    if (this.alreadyHandled(event)) return;
    this.onPointerCancel(event);
  };

  /**
   * @internal Track a drag through the document when capture failed.
   *
   * Without capture, moving off the handle stops delivering events to it, and
   * the drag would freeze mid-gesture with the handle still latched. These are
   * guarded by the same pointer id, skip anything the track already handled,
   * and are removed on every exit.
   */
  private attachDocumentFallback(): void {
    document.addEventListener('pointermove', this.onDocPointerMove);
    document.addEventListener('pointerup', this.onDocPointerUp);
    document.addEventListener('pointercancel', this.onDocPointerCancel);
  }

  /** @internal Remove the document fallback. Safe to call when never attached. */
  private detachDocumentFallback(): void {
    document.removeEventListener('pointermove', this.onDocPointerMove);
    document.removeEventListener('pointerup', this.onDocPointerUp);
    document.removeEventListener('pointercancel', this.onDocPointerCancel);
  }

  // --------------------------------------------------------------------------
  // Keyboard interaction
  // --------------------------------------------------------------------------

  /**
   * @internal
   * ArrowLeft/Right step by one `step`, Shift+Arrow by five, Home/End jump to
   * the endpoint's own effective limits (not the media's - the other handle and
   * the duration limits are what this handle can actually reach). Every key
   * handled here calls `preventDefault()` so the UI plugin's shortcuts skip it.
   */
  private onKeyDown(which: ClipHandle, event: KeyboardEvent): void {
    if (this.destroyed || !this.interactive) return;
    const step = this.stepValue();
    const delta = event.shiftKey ? step * KEYBOARD_COARSE_FACTOR : step;
    const current = this.selection[which];
    const limits = this.endpointLimits(which);

    let target: number | null = null;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        target = current - delta;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        target = current + delta;
        break;
      case 'Home':
        target = limits.lo;
        break;
      case 'End':
        target = limits.hi;
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
   * Commit a time for one endpoint through the same clamping path a drag uses.
   *
   * The exact-timestamp fields and the "set at playhead" buttons come through
   * here, so every route to a new endpoint snaps, clamps and reports
   * identically - there is one mutation path, not four.
   *
   * @param which - The endpoint to move
   * @param time - Requested time in media seconds
   * @param source - How the move was made, for the change metadata
   * @returns The landed time after snapping and clamping
   */
  applyEndpoint(which: ClipHandle, time: number, source: ClipMoveSource): number {
    if (this.destroyed) return this.selection[which];
    return this.applyMove(which, time, source);
  }

  /**
   * The limits one endpoint can actually reach right now.
   *
   * The other endpoint, the min/max duration and the media bounds together;
   * this is what ARIA announces and what Home/End jump to.
   *
   * @param which - The endpoint
   * @returns Its inclusive `[lo, hi]` in media seconds
   */
  endpointLimits(which: ClipHandle): { lo: number; hi: number } {
    const { minDuration, maxDuration } = resolveLimits(this.config);
    const { start, end } = this.selection;
    const { min, max } = this.bounds;

    if (which === 'start') {
      return { lo: Math.max(min, end - maxDuration), hi: end - minDuration };
    }
    return { lo: start + minDuration, hi: Math.min(max, start + maxDuration) };
  }

  /**
   * @internal The single commit path: snap the requested time, run the clamping
   * model (`moveStart`/`moveEnd` - the other handle never moves), re-render,
   * flash + report if clamped, and fire `onChange` when anything meaningful
   * happened.
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

/**
 * @internal Round an ARIA value to something a screen reader can read out.
 *
 * @param value - The raw time
 * @returns The value at millisecond resolution, without float noise
 */
function round(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}
