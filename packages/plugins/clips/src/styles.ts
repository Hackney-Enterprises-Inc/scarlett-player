/**
 * Clips plugin styles.
 *
 * Injected once via `injectSharedStyles('sp-clips-styles')`; ref-counted by
 * core, so multiple players share one stylesheet.
 *
 * Mobile first and sized in px, exactly like the share sheet: the player is
 * frequently embedded in someone else's CSS, so nothing here may depend on the
 * host page's font size or reset. Colors follow the house convention -
 * `#1c1c1e`-family dark surfaces with `rgba(255, 255, 255, a)` neutrals and the
 * `var(--sp-accent, #e50914)` accent the UI package's controls already use.
 *
 * **This is the pinned class vocabulary.** `ClipOverlay.ts`, `RangeSelector.ts`
 * and `ClipButton.ts` build against these exact names. JS applies the state
 * modifiers; CSS never has to know about player state beyond what is listed.
 *
 * ## Two presentations for one selector
 *
 * `.sp-clip-track--timeline` renders into the UI package's
 * `.sp-progress__extension` layer, which is a **zero-height line lying exactly
 * on the playback rail's centre**. Everything in that presentation is
 * positioned from that line: the shading sits over the rail, the IN handle
 * occupies a 44px lane above it and the OUT handle a 44px lane below, and each
 * one's stem points back down (or up) at its own timestamp. Two lanes, not one,
 * because a thirty second selection on a two hour source is a pixel and a
 * quarter wide - overlapping targets on one line cannot both be hit.
 *
 * The track itself is `pointer-events: none` there; only the handles take
 * input, so a press that misses them falls through to the rail and seeks.
 *
 * `.sp-clip-track--standalone` is the original self-contained 44px band, used
 * when there is no UI package to mount into.
 *
 * ## Layering and anchoring
 *
 * - `.sp-clip-editor` is `z-index: 20` - the menus' layer: below the error
 *   overlay (25), above the big-play button (12) and the gestures surface (6).
 * - Its `bottom` is set **inline by JS** from the measured rail box, not by a
 *   fixed offset. The old `bottom: 64px` assumed a control bar of a particular
 *   height and no handle lanes at all.
 * - There is deliberately NO backdrop: the picture stays undimmed so the
 *   viewer sees the loop preview while picking in/out points.
 *
 * ## Class reference (selector - `RangeSelector.ts`)
 * - `.sp-clip-track`                base track
 * - `.sp-clip-track--standalone`    self-contained 44px rail
 * - `.sp-clip-track--timeline`      mounted on the playback rail
 * - `.sp-clip-track--dragging`      while any handle is dragged
 * - `.sp-clip-track--frozen`        submission in flight, or covered by details
 * - `.sp-clip-track__range`         shaded selection between the handles
 * - `.sp-clip-handle`               one handle; `role="slider"`, 44px lane
 * - `.sp-clip-handle--start/--end`  the IN / OUT handle
 * - `.sp-clip-handle--dragging`     the handle under the pointer
 * - `.sp-clip-handle--clamped`      flash while a move is refused by a limit
 * - `.sp-clip-handle__stem`         line pointing at the exact timestamp
 * - `.sp-clip-handle__label`        `IN 0:12` / `OUT 0:47` pill
 *
 * ## Class reference (editor - `ClipOverlay.ts`)
 * - `.sp-clip-editor`               the panel; `data-stage`, `data-layout`
 * - `.sp-clip-editor--open`         shown state (drives the enter transition)
 * - `.sp-clip-editor--timeline`     handles are on the playback rail
 * - `.sp-clip-editor--icons`        short visible labels (compact widths)
 * - `.sp-clip-editor--submitting`   a request is in flight
 * - `.sp-clip-flash`                silent clamp flash (not a live region)
 * - `.sp-clip-rail`                 host for the standalone track
 * - `.sp-clip-toolbar`              the 44px range-stage toolbar
 * - `.sp-clip-tool`                 one toolbar button; `--primary` for Next
 * - `.sp-clip-details`              the review/confirm dialog
 * - `.sp-clip-details__head/body/title`
 * - `.sp-clip-back`                 back to the range stage
 * - `.sp-clip-fields` / `.sp-clip-field` / `__label` / `__hint`
 * - `.sp-clip-time`                 exact-timestamp input
 * - `.sp-clip-readout`              `0:12 – 0:47 · 35s` line
 * - `.sp-clip-notice`               polite live region; `--visible`, `--error`
 * - `.sp-clip-title-label` / `.sp-clip-title` / `.sp-clip-title-counter`
 * - `.sp-clip-actions` / `.sp-clip-btn` / `--cancel` / `--confirm`
 * - `.sp-clip-btn--submitting` / `.sp-clip-spinner`
 *
 * ## Class reference (container - applied by `ClipOverlay.ts`)
 * - `.sp-clip-editing`              an editor is open on this player
 * - `.sp-clip-editing--minimal`     the player is too short to keep the
 *                                   ordinary control bar as well
 *
 * ## Class reference (toast - `index.ts`)
 * - `.sp-clip-toast` / `--visible`  transient "Clip requested" pill
 */

export const styles = `
/* ==========================================================================
   Range selector - shared
   ========================================================================== */

.sp-clip-track {
  position: relative;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* The shaded selection; never intercepts pointer input in either presentation. */
.sp-clip-track__range {
  position: absolute;
  background: var(--sp-accent, #e50914);
  border-radius: 3px;
  pointer-events: none;
}

.sp-clip-handle {
  position: absolute;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: grab;
  touch-action: none;
  z-index: 2;
}

/* Frozen: a submission is in flight, or the details stage covers the player.
   Handles must not move under a request that is already carrying the range. */
.sp-clip-track--frozen { pointer-events: none; }
.sp-clip-track--frozen .sp-clip-handle { opacity: 0.5; cursor: default; }

/* ==========================================================================
   Range selector - timeline presentation

   Mounted inside .sp-progress__extension, a zero-height line on the playback
   rail's centre. Everything below is positioned from that line.
   ========================================================================== */

.sp-clip-track--timeline {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 0;
  /* Presses that miss a handle belong to the playhead underneath. */
  pointer-events: none;
}

.sp-clip-track--timeline .sp-clip-track__range {
  top: -3px;
  height: 6px;
}

.sp-clip-track--timeline .sp-clip-handle {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 44px;
  transform: translateX(-50%);
  pointer-events: auto;
}

/* IN sits in the lane above the rail, OUT in the lane below: distinct vertical
   targets are what keeps both reachable when the selection is a pixel wide. */
.sp-clip-track--timeline .sp-clip-handle--start {
  bottom: 2px;
  justify-content: flex-start;
}
.sp-clip-track--timeline .sp-clip-handle--end {
  top: 2px;
  flex-direction: column-reverse;
  justify-content: flex-start;
}

.sp-clip-track--timeline .sp-clip-handle__label {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  white-space: nowrap;
  color: #fff;
  background: rgba(28, 28, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  padding: 4px 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
}

/* The stem is the precision: the label is a readable block, the 2px line under
   it is what actually points at the timestamp. */
.sp-clip-track--timeline .sp-clip-handle__stem {
  display: block;
  width: 2px;
  flex: 1 1 auto;
  min-height: 8px;
  background: #fff;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.6);
}

.sp-clip-track--timeline .sp-clip-handle--dragging .sp-clip-handle__label,
.sp-clip-track--timeline .sp-clip-handle:focus-visible .sp-clip-handle__label {
  background: var(--sp-accent, #e50914);
  border-color: #fff;
}
.sp-clip-track--timeline .sp-clip-handle:focus-visible {
  outline: none;
}
.sp-clip-track--timeline .sp-clip-handle:focus-visible .sp-clip-handle__label {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
.sp-clip-track--timeline .sp-clip-handle--clamped .sp-clip-handle__label {
  background: #ffd23f;
  color: #1c1c1e;
}

/* ==========================================================================
   Range selector - standalone presentation

   The self-contained 44px band used when there is no timeline to mount into:
   no UI package, one too old to expose the extension seam, or one torn down
   under a live session.
   ========================================================================== */

.sp-clip-track--standalone {
  height: 44px;
  margin: 0 10px; /* keeps edge handles over the picture, not off it */
  cursor: pointer;
}
.sp-clip-track--standalone::before {
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
.sp-clip-track--standalone .sp-clip-track__range {
  top: 50%;
  height: 6px;
  transform: translateY(-50%);
}
.sp-clip-track--standalone .sp-clip-handle {
  top: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  border-radius: 8px;
}
/* The knob: a 6x20px bar drawn inside the 44px hit area. */
.sp-clip-track--standalone .sp-clip-handle__stem {
  position: absolute;
  inset: 12px 19px;
  background: #fff;
  border-radius: 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  transition: inset 120ms ease, background-color 120ms ease;
}
/* The label has no room on the standalone rail; the panel's readout carries it. */
.sp-clip-track--standalone .sp-clip-handle__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (hover: hover) {
  .sp-clip-track--standalone .sp-clip-handle:hover .sp-clip-handle__stem { inset: 10px 16px; }
}
.sp-clip-track--standalone .sp-clip-handle:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -6px;
}
.sp-clip-track--standalone .sp-clip-handle:focus-visible .sp-clip-handle__stem { inset: 10px 16px; }
.sp-clip-track--standalone .sp-clip-handle--dragging { cursor: grabbing; }
.sp-clip-track--standalone .sp-clip-handle--dragging .sp-clip-handle__stem { inset: 10px 16px; }
.sp-clip-track--standalone.sp-clip-track--dragging .sp-clip-handle__stem { inset: 10px 16px; }
.sp-clip-track--standalone .sp-clip-handle--clamped .sp-clip-handle__stem { background: #ffd23f; }

/* ==========================================================================
   Editor
   ========================================================================== */

/*
 * Anchored above the timeline's measured top edge (JS writes \`bottom\`), on the
 * menus' layer. No backdrop anywhere in this file - the picture stays undimmed
 * so the loop preview is visible while the viewer picks in/out points.
 */
.sp-clip-editor {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 64px;
  z-index: 20;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
  margin: 0 auto;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 140ms ease, transform 140ms ease;
}
.sp-clip-editor--open {
  opacity: 1;
  transform: translateY(0);
}
.sp-clip-editor * { box-sizing: border-box; min-width: 0; }

/* The standalone rail's host; hidden the moment the real timeline is available,
   so one selection never shows two tracks. */
.sp-clip-rail {
  background: rgba(28, 28, 30, 0.95);
  border-radius: 12px;
  padding: 0 2px;
}
.sp-clip-rail[hidden] { display: none; }

/* Silent clamp flash. Deliberately not a live region: a drag pinned against a
   limit re-flashes on every pointermove, and announcing that is noise. */
.sp-clip-flash {
  align-self: center;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #1c1c1e;
  background: #ffd23f;
  border-radius: 10px;
  padding: 3px 10px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease;
}
.sp-clip-flash--visible { opacity: 1; }

/* ==========================================================================
   Range stage toolbar
   ========================================================================== */

.sp-clip-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 6px;
  background: rgba(28, 28, 30, 0.95);
  border-radius: 12px;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.45);
  overflow-x: auto;
  scrollbar-width: none;
}
.sp-clip-toolbar::-webkit-scrollbar { display: none; }

.sp-clip-tool {
  appearance: none;
  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  min-height: 36px;
  padding: 0 10px;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 120ms ease, opacity 120ms ease;
}
.sp-clip-tool[hidden] { display: none; }
.sp-clip-tool:disabled { opacity: 0.4; cursor: not-allowed; }
.sp-clip-tool:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (hover: hover) {
  .sp-clip-tool:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); }
}
.sp-clip-tool--primary {
  background: var(--sp-accent, #e50914);
  color: #fff;
  margin-left: auto;
}
.sp-clip-tool--play { font-size: 14px; min-width: 40px; }

/* ==========================================================================
   Details stage
   ========================================================================== */

.sp-clip-details {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgba(28, 28, 30, 0.97);
  border-radius: 12px;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.5);
}

.sp-clip-details__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 4px;
}
.sp-clip-details__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.sp-clip-details__title:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

.sp-clip-back {
  appearance: none;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  min-height: 36px;
  padding: 0 10px;
  cursor: pointer;
}
.sp-clip-back[hidden] { display: none; }
.sp-clip-back:disabled { opacity: 0.4; cursor: not-allowed; }
.sp-clip-back:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

/* The body scrolls; the footer does not. An error notice must never push the
   Create button out of the player. */
.sp-clip-details__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 4px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-clip-fields {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sp-clip-field {
  flex: 1 1 120px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sp-clip-field__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}
.sp-clip-field__hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
}
.sp-clip-time {
  width: 100%;
  /* 16px keeps iOS Safari from zooming the viewport on focus. */
  font-size: 16px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px 10px;
}
.sp-clip-time:focus-visible {
  outline: 2px solid var(--sp-accent, #e50914);
  outline-offset: -1px;
}
.sp-clip-time:disabled { opacity: 0.5; }

/* "0:12 – 0:47 · 35s" - tabular numerals so the line does not jitter. */
.sp-clip-readout {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.9);
}

/* Title field (absent entirely when config.title === false). */
.sp-clip-title-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}
.sp-clip-title {
  display: block;
  width: 100%;
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
.sp-clip-title-counter {
  display: block;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.55);
}

/*
 * Notice slot: validation hints, block reasons, then server messages. The
 * element carries aria-live="polite" (set in JS); text is written with
 * textContent only - server-supplied markup must render as text. Wraps rather
 * than pushing the footer anywhere.
 */
.sp-clip-notice {
  min-height: 18px;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  color: #ffd23f;
  opacity: 0;
  transition: opacity 160ms ease;
}
.sp-clip-notice--visible { opacity: 1; }
.sp-clip-notice--error { color: #ff6b6b; }

/* Sticky footer: safe-area padding counted here, inside the bounded panel. */
.sp-clip-actions {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 6px 10px calc(8px + env(safe-area-inset-bottom, 0px));
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
.sp-clip-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.sp-clip-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

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
   Stages and layouts

   \`data-layout\` is measured from the PLAYER, never the device: a 320px player
   embedded in a 1600px article needs the compact editor just as much as a
   phone does. \`data-stage\` only means anything below \`regular\`.
   ========================================================================== */

/* Regular: toolbar and details on screen together, so the stage buttons are
   meaningless and the panel's own footer carries Cancel. */
.sp-clip-editor[data-layout='regular'] .sp-clip-details { display: flex; }

/* Compact and below: exactly one stage at a time. */
.sp-clip-editor:not([data-layout='regular'])[data-stage='range'] .sp-clip-details {
  display: none;
}
.sp-clip-editor:not([data-layout='regular'])[data-stage='details'] .sp-clip-toolbar,
.sp-clip-editor:not([data-layout='regular'])[data-stage='details'] .sp-clip-rail,
.sp-clip-editor:not([data-layout='regular'])[data-stage='details'] .sp-clip-flash {
  display: none;
}

/* Icons/short labels at narrow widths; the accessible name is unchanged. */
.sp-clip-editor--icons .sp-clip-tool { font-size: 11px; padding: 0 8px; }

/* Tiny: there is no picture worth protecting left, so reachability wins and
   the editor becomes a bounded scrollable sheet over the whole player. */
.sp-clip-editor[data-layout='tiny'] {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0 !important;
  margin: 0;
  max-width: none;
  padding: 6px;
  background: rgba(0, 0, 0, 0.82);
  overflow-y: auto;
}

/* The details stage covers the picture on a compact player, so it gets the
   room; on a regular one it is bounded above the timeline by JS. */
.sp-clip-editor:not([data-layout='regular'])[data-stage='details'] {
  bottom: 8px !important;
  top: 8px;
}

/* ==========================================================================
   Container-level effects

   The clips package styling the UI package's control bar is deliberate and
   narrow: it is the only way to reclaim that band for the duration of an edit
   without adding a "hide your controls" call to the UI plugin's public API for
   one caller. Scoped to the container the editor is open on, so a second
   player on the page is untouched, and removed on close.
   ========================================================================== */

.sp-clip-editing--minimal .sp-controls {
  display: none !important;
}
/* With the bar gone the timeline can come back down; the OUT lane then needs
   only its own 44px of clearance. */
.sp-clip-editing--minimal .sp-progress-wrapper--editing {
  bottom: calc(44px + var(--sp-inset-bottom, 0px));
}

/* ==========================================================================
   Success toast (index.ts)
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
  z-index: 22; /* above the editor (20), below the error overlay (25) */
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
  .sp-clip-editor,
  .sp-clip-notice,
  .sp-clip-flash,
  .sp-clip-btn,
  .sp-clip-tool,
  .sp-clip-track--standalone .sp-clip-handle__stem {
    transition: none;
  }
  .sp-clip-spinner {
    animation-duration: 1600ms; /* keep the "working" signal, drop the speed */
  }
}
`;
