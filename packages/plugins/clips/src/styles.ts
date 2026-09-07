/**
 * Clips plugin styles.
 *
 * Injected once via `injectSharedStyles('sp-clips-styles')` (task 3.1 wiring in
 * `index.ts`); ref-counted by core, so multiple players share one stylesheet.
 *
 * Mobile first and sized in px, exactly like the share sheet: the player is
 * frequently embedded in someone else's CSS, so nothing here may depend on the
 * host page's font size or reset. Colors follow the house convention -
 * `#1c1c1e`-family dark surfaces with `rgba(255, 255, 255, a)` neutrals and the
 * `var(--sp-accent, #e50914)` accent the UI package's controls already use.
 *
 * **This is the pinned class vocabulary.** `ClipOverlay.ts` (task 3.3) and
 * `ClipButton.ts` / the drag integration (tasks 3.4/3.5) build against these
 * exact names - every class is documented below with who applies it and when.
 * JS applies the state modifiers; CSS never has to know about player state
 * beyond what is listed here.
 *
 * Layering (plan "Design > Overlay"), and why:
 * - `.sp-clip-panel` is `z-index: 20` - the menus' layer: below the error
 *   overlay (25), above the big-play button (12) and the gestures surface (6).
 * - `bottom: 64px` anchors it above the control strip, the band the gestures
 *   overlay reserves (`gestures/src/overlay.ts:36`), so it never covers
 *   playback controls.
 * - There is deliberately NO backdrop: the picture stays undimmed so the
 *   viewer sees the loop preview while picking in/out points.
 *
 * ## Class reference (selector - applied by `RangeSelector.ts`)
 * - `.sp-clip-track`              the 44px touch band; the rail is `::before`
 * - `.sp-clip-track__range`       shaded selection between the handles
 * - `.sp-clip-track--dragging`    on the track while any handle is dragged
 * - `.sp-clip-handle`             one handle; `role="slider"`, 44x44 hit area,
 *                                 knob drawn by `::before`, grips by `::after`
 * - `.sp-clip-handle--start`      the in handle (modifier hook; same visuals)
 * - `.sp-clip-handle--end`        the out handle (modifier hook; same visuals)
 * - `.sp-clip-handle--dragging`   on the handle grabbed by the pointer
 * - `.sp-clip-handle--clamped`    flash while a move is refused by a limit
 *
 * ## Class reference (overlay - applied by `ClipOverlay.ts`, task 3.3)
 * - `.sp-clip-panel`              bottom panel container
 * - `.sp-clip-panel--open`        shown state (drives the enter transition)
 * - `.sp-clip-readout`            `0:12 – 0:47 · 35s` line, tabular numerals
 * - `.sp-clip-notice`             message slot; the `aria-live="polite"` target
 * - `.sp-clip-notice--visible`    reveals the notice (text set via textContent)
 * - `.sp-clip-notice--error`      submission-failure coloring (vs. clamp info)
 * - `.sp-clip-title-label`        visible `<label>` for the title input
 * - `.sp-clip-title`              the `<input type="text">` itself
 * - `.sp-clip-title-counter`      live `12/80` character counter
 * - `.sp-clip-actions`            button row
 * - `.sp-clip-btn`                shared button base (Cancel + Confirm)
 * - `.sp-clip-btn--cancel`        Cancel button
 * - `.sp-clip-btn--confirm`       "Create clip" button
 * - `.sp-clip-btn--submitting`    on Confirm while a submission is in flight
 * - `.sp-clip-spinner`            spinner glyph inside the submitting Confirm
 *
 * ## Class reference (toast - applied by `index.ts`, task 3.3 wiring)
 * - `.sp-clip-toast`              transient "Clip requested" pill appended to
 *                                 `api.container` when a commit succeeds
 * - `.sp-clip-toast--visible`     shown state; the toast is removed ~2s later
 */

export const styles = `
/* ==========================================================================
   Range selector (RangeSelector.ts)
   ========================================================================== */

/*
 * The track is a 44px-tall touch band (WCAG 2.5.5 floor); the visible rail is
 * a 6px line centered by ::before so the hit area extends far past the art.
 * touch-action: none keeps a scroll gesture from stealing handle drags.
 * left/width/top offsets are set inline by JS from the selection state.
 */
.sp-clip-track {
  position: relative;
  height: 44px;
  margin: 0 10px; /* keeps edge handles over the picture, not off it */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}
.sp-clip-track::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 6px;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.25);
  border-radius: 3px;
}

/* The shaded selection between the handles; never intercepts pointer input. */
.sp-clip-track__range {
  position: absolute;
  top: 50%;
  height: 6px;
  transform: translateY(-50%);
  background: var(--sp-accent, #e50914);
  border-radius: 3px;
  pointer-events: none;
}

/*
 * Handles: transparent 44x44 hit areas (the "visually smaller via padding"
 * rule - the 6x20px knob is drawn by ::before, inset to center it).
 * translate(-50%, -50%) lets JS position the center with left: <pct>%.
 */
.sp-clip-handle {
  position: absolute;
  top: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 8px;
  cursor: grab;
  touch-action: none;
  z-index: 2; /* above the range fill so edge handles stay grabbable */
}
.sp-clip-handle::before {
  content: '';
  position: absolute;
  inset: 12px 19px; /* 6px wide x 20px tall knob inside the 44px band */
  background: #fff;
  border-radius: 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  transition: inset 120ms ease, background-color 120ms ease;
}
/* Two grip lines, the "I drag" affordance. */
.sp-clip-handle::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 10px;
  transform: translate(-50%, -50%);
  background:
    linear-gradient(#555, #555) -2px 0 / 1px 100% no-repeat,
    linear-gradient(#555, #555) 2px 0 / 1px 100% no-repeat;
  pointer-events: none;
  opacity: 0.9;
}
.sp-clip-handle--start,
.sp-clip-handle--end {
  /* Semantic hooks only: both handles render identically by design. JS and
     tests select on these; visuals differ (yet) only through the state
     modifiers below. */
}

@media (hover: hover) {
  .sp-clip-handle:hover::before { inset: 10px 16px; }
}

/* Visible keyboard focus, per the house focus convention. */
.sp-clip-handle:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -6px;
}
.sp-clip-handle:focus-visible::before { inset: 10px 16px; }

/* The handle currently under the pointer during a drag. */
.sp-clip-handle--dragging {
  cursor: grabbing;
}
.sp-clip-handle--dragging::before { inset: 10px 16px; }
/* Grow the sibling knob too, matching .sp-progress--dragging behavior. */
.sp-clip-track--dragging .sp-clip-handle::before { inset: 10px 16px; }

/*
 * Clamp flash: a move was refused by min/max duration or the bounds. JS adds
 * this for ~1s (same beat as the overlay's notice flash) and colors the knob
 * so the stop reads as deliberate, not as a dead track.
 */
.sp-clip-handle--clamped::before {
  background: #ffd23f;
}

/* ==========================================================================
   Overlay panel (ClipOverlay.ts, task 3.3)
   ========================================================================== */

/*
 * Bottom panel anchored above the 64px control strip on the menus' layer
 * (z-index 20: below the error overlay's 25, above big-play's 12 and the
 * gestures surface's 6). No backdrop anywhere in this file - the picture
 * stays undimmed so the loop preview is visible.
 */
.sp-clip-panel {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 64px;
  z-index: 20;
  background: rgba(28, 28, 30, 0.95); /* share sheet's #1c1c1e, lifted off the backdrop */
  color: #fff;
  border-radius: 12px;
  padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.45);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 560px;
  margin: 0 auto;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 140ms ease, transform 140ms ease;
}
.sp-clip-panel--open {
  opacity: 1;
  transform: translateY(0);
}

/* "0:12 – 0:47 · 35s" - tabular numerals so the line does not jitter. */
.sp-clip-readout {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.9);
  padding: 0 10px; /* aligns with the track's edge inset */
}

/*
 * Notice slot: clamp reasons, then validation hints, then server messages.
 * The element carries aria-live="polite" (set in JS); text is written with
 * textContent only - server-supplied markup must render as text. Hidden
 * (height-collapsed but live-region stable) until JS adds --visible.
 */
.sp-clip-notice {
  min-height: 18px;
  font-size: 12px;
  line-height: 18px;
  color: #ffd23f; /* matches the handle clamp flash */
  padding: 0 10px;
  opacity: 0;
  transition: opacity 160ms ease;
}
.sp-clip-notice--visible { opacity: 1; }
.sp-clip-notice--error { color: #ff6b6b; }

/* Title field (hidden entirely when config.title === false). */
.sp-clip-title-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  padding: 0 10px 2px;
}
.sp-clip-title {
  display: block;
  box-sizing: border-box;
  width: calc(100% - 20px);
  margin: 0 10px;
  /* 16px keeps iOS Safari from zooming the viewport on focus. */
  font-size: 16px;
  font-family: inherit;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px 10px;
}
.sp-clip-title:focus-visible {
  outline: 2px solid var(--sp-accent, #e50914);
  outline-offset: -1px;
}
/* Live "12/80" counter; tabular so the digits do not shift as they roll. */
.sp-clip-title-counter {
  display: block;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.55);
  padding: 2px 12px 0 0;
}

/* Button row. */
.sp-clip-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 2px 10px 0;
}
.sp-clip-btn {
  appearance: none;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 16px;
  min-height: 44px; /* thumb target; matches .sp-control's floor */
  cursor: pointer;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 120ms ease, transform 120ms ease, opacity 120ms ease;
}
.sp-clip-btn:active { transform: scale(0.96); }
.sp-clip-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.sp-clip-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.sp-clip-btn--cancel {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
}
@media (hover: hover) {
  .sp-clip-btn--cancel:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); }
}

.sp-clip-btn--confirm {
  background: var(--sp-accent, #e50914);
  color: #fff;
  min-width: 120px; /* steady width while the spinner replaces the label */
}
@media (hover: hover) {
  .sp-clip-btn--confirm:hover:not(:disabled) { filter: brightness(1.12); }
}

/* Submitting state: JS sets disabled, adds --submitting, and appends the
   spinner; the label text is swapped out by the overlay. */
.sp-clip-btn--submitting { cursor: progress; }

.sp-clip-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: sp-clip-spin 800ms linear infinite;
}
@keyframes sp-clip-spin {
  to { transform: rotate(360deg); }
}

/* ==========================================================================
   Success toast (index.ts wiring, task 3.3)
   ========================================================================== */

/*
 * A transient confirmation pill shown over the picture when a clip request
 * lands. Centered at the bottom edge - the share toast's band, which is free
 * here because a successful commit tears down the panel before the toast
 * shows. JS removes it after ~2s; it never intercepts pointer input.
 */
.sp-clip-toast {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translate(-50%, 8px);
  z-index: 22; /* above the panel (20), below the error overlay (25) */
  background: rgba(28, 28, 30, 0.95);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 20px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
}
.sp-clip-toast--visible {
  opacity: 1;
  transform: translate(-50%, 0);
}


@media (prefers-reduced-motion: reduce) {
  .sp-clip-panel,
  .sp-clip-notice,
  .sp-clip-btn,
  .sp-clip-handle::before {
    transition: none;
  }
  .sp-clip-spinner {
    animation-duration: 1600ms; /* keep the "working" signal, drop the speed */
  }
}
`;
