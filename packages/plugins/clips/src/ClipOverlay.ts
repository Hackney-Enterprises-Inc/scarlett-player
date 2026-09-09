/**
 * ClipOverlay - the clip-creation editor.
 *
 * Mounted on `api.container` (the watermark and share-sheet precedent). What
 * it draws depends on two things: whether the UI package gave it a place on
 * the playback timeline, and how much room the player actually has.
 *
 * ## Where the handles live
 *
 * When `@scarlett-player/ui` exposes the timeline extension seam, the
 * {@link RangeSelector} is mounted **into the playback rail** and this panel
 * holds only the things that are not the range: the at-playhead buttons,
 * preview, the exact-time fields, the title and the actions. Without that seam
 * - no UI package, an older one, or one torn down mid-session - the same
 * selector instance is re-parented into this panel's own rail and keeps the
 * session going. One selector, two presentations; never two selectors.
 *
 * ## Two stages, and why
 *
 * The old single panel could not fit on a phone. At 320x180 the track, the
 * readout, the title field, its counter, the notice and a 44px action row add
 * up to more than the player is tall, and the container clips overflow, so the
 * Create button was simply not on screen. Range editing and naming are now
 * separate steps on a small player:
 *
 * - **Range** - the handles are on the timeline, and one 44px toolbar carries
 *   "IN here" / "OUT here", Preview, Cancel and Next. The times are read off
 *   the handle labels themselves, so nothing duplicates them.
 * - **Details** - an inset panel with Back, a scrollable body (exact
 *   timestamps, title, counter, notices) and a sticky Cancel / Create footer.
 *   The timeline is frozen while it is open, and Back returns to the range
 *   with the selection and the typed title intact.
 *
 * On a player with room, both are shown at once: the toolbar over the rail and
 * the details panel above it, anchored to the timeline's **measured** top edge
 * rather than a hard-coded 64px. Next and Back are then meaningless and hidden.
 *
 * Below 220px of height the ordinary control bar is hidden for the duration of
 * the edit and Play/Pause moves into the toolbar, which is what keeps roughly
 * 40px of picture visible in a 320x180 frame. Below 160px there is no useful
 * picture left to protect, so the editor becomes a bounded scrollable sheet:
 * being able to reach the controls beats being able to see the video.
 *
 * ## Focus and keys
 *
 * Range editing is a **nonmodal** labelled region: no document-wide Tab trap,
 * because the handles now live in the player's own control area and the host
 * page stays interactive. Tab moves through the handles, the toolbar and the
 * editor normally. The details stage is a labelled dialog and cycles Tab only
 * while focus is already inside it; it carries `aria-modal="false"`, because
 * the page behind it is genuinely still usable.
 *
 * Escape is scoped to focus inside **this** player: with two players on a page
 * the old document-wide handler let a keypress in one close the other's editor.
 *
 * Notices are written with `textContent` only - they render server-supplied
 * messages, which must never be parsed as markup. The polite live region is
 * reserved for things worth announcing (validation, submission failures); a
 * clamp during a drag flashes in the toolbar instead, because announcing it on
 * every pixel of a pinned drag is noise, not feedback.
 */

import { RangeSelector } from './RangeSelector';
import type {
  ClipChangeMeta,
  ClipClampReason,
  ClipDragEndInfo,
  ClipHandle,
  ClipPresentation,
} from './RangeSelector';
import { resolveLimits, validate, validateTitle } from './range';
import type { ClipSelection, RangeBounds } from './range';
import { formatLength, formatTimestamp, parseTimestamp } from './time-format';
import type { ClipsPluginConfig } from './types';

/** How long a clamp flash stays up, matching the handle's `--clamped` flash. */
const CLAMP_FLASH_MS = 1000;

/** Fallback for `title.maxLength` when the field config omits it (mirrors range.ts). */
const DEFAULT_TITLE_MAX_LENGTH = 80;

/** Fallback placeholder and visible label for the title field. */
const DEFAULT_TITLE_PLACEHOLDER = 'Name this clip';
const DEFAULT_TITLE_LABEL = 'Clip title';

/** Fallback confirm-button label when `buttonLabel` is unset. */
const DEFAULT_CONFIRM_LABEL = 'Create clip';

/** Monotonic suffix so label/`for` ids never collide between panels. */
let fieldSeq = 0;

/**
 * Layout breakpoints, measured on the **player**, never on the device.
 *
 * A 320px player embedded in a 1600px article needs the compact editor just as
 * much as a phone does, and a phone in landscape with a full-bleed player does
 * not. `COMPACT_*` is the two-stage threshold; `MINIMAL_HEIGHT` is where the
 * ordinary control bar is given up; `TINY_HEIGHT` is where the picture is.
 */
const COMPACT_WIDTH = 600;
const COMPACT_HEIGHT = 360;
const MINIMAL_HEIGHT = 220;
const TINY_HEIGHT = 160;

/** The lane a handle occupies above the rail, and the gap over it. */
const HANDLE_LANE = 44;
const LANE_GAP = 8;

/** Where the panel sits when there is no timeline to measure against. */
const FALLBACK_ANCHOR = 64;

/** Which stage the compact editor is showing. */
export type ClipStage = 'range' | 'details';

/** How much room the player has, and therefore what the editor draws. */
export type ClipLayout = 'regular' | 'compact' | 'minimal' | 'tiny';

/** Integration surface back into the plugin. */
export interface ClipOverlayCallbacks {
  /** Cancel button or Escape: the plugin closes the session with `reason: 'user'`. */
  onCancel: () => void;
  /** Confirm button or a valid Enter in the title field: the plugin runs `commit()`. */
  onConfirm: () => void;
  /**
   * Every keystroke in the title field, with the raw input value (the plugin
   * trims/truncates into `clipTitle` state; the field keeps what the viewer
   * typed, so mid-word spaces survive).
   */
  onTitleChange: (title: string) => void;
  /**
   * A committed move from the selector (drag, keyboard, exact field or an
   * at-playhead button), already snapped and clamped by the model. The plugin
   * treats it as its `setRange` path and emits `clip:changed`.
   */
  onSelectionChange: (selection: ClipSelection, meta: ClipChangeMeta) => void;
  /** Drag lifecycle passthroughs for the drag-to-scrub integration. */
  onDragStart?: (handle: ClipHandle) => void;
  onDragMove?: (handle: ClipHandle, time: number) => void;
  onDragEnd?: (selection: ClipSelection, info: ClipDragEndInfo) => void;
  /**
   * "IN here" / "OUT here": place that endpoint at the media's real current
   * time. The plugin resolves the time (the overlay has no media access) and
   * calls back into {@link ClipOverlay.setEndpoint}.
   *
   * @param handle - Which endpoint to place
   */
  onSetAtPlayhead?: (handle: ClipHandle) => void;
  /** "Preview clip": seek to the in point, arm the loop and play, in this gesture. */
  onPreview?: () => void;
  /** Play/Pause, only rendered when the control bar has been given up for room. */
  onTogglePlay?: () => void;
}

/** Construction options for {@link ClipOverlay}. */
export interface ClipOverlayOptions {
  /** The player container the panel is appended to on {@link ClipOverlay.open}. */
  container: HTMLElement;
  /** The initial selection (normally the plugin's `clipSelection`). */
  selection: ClipSelection;
  /** The bounds the track spans (`0..duration` in v1). */
  bounds: RangeBounds;
  /** The plugin's live working config; limits and title settings are read from it. */
  config: ClipsPluginConfig;
  /**
   * Initial title-field content (the `clipTitle` state at mount). External
   * updates arrive through {@link ClipOverlay.setTitle}.
   */
  title?: string;
  /** Integration callbacks; see {@link ClipOverlayCallbacks}. */
  callbacks: ClipOverlayCallbacks;
  /**
   * The control-bar button to restore focus to when the panel is destroyed.
   * May return an element that is no longer connected (the UI rebuilt its
   * bar); focus is only moved to a live element.
   */
  getReturnFocus?: () => HTMLElement | null;
}

/** Options for {@link ClipOverlay.showNotice}. */
export interface ClipNoticeOptions {
  /**
   * Notice kind: `'error'` colors the line for submission failures, `'info'`
   * (default) is the clamp-flash amber.
   * @defaultValue 'info'
   */
  type?: 'info' | 'error';
  /**
   * Hide the notice after this many milliseconds. Unset leaves it up until
   * the next notice or a close - how server error messages persist.
   */
  autoHideMs?: number;
}

/**
 * The clip editor: timeline (or standalone) handles, an at-playhead toolbar,
 * a details stage with exact times, title and actions, and the responsive and
 * focus behaviour around them. See the module docblock for the contract.
 */
export class ClipOverlay {
  private readonly root: HTMLElement;
  private readonly selector: RangeSelector;

  // --- range stage ---
  private readonly toolbar: HTMLElement;
  private readonly railHost: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly setInBtn: HTMLButtonElement;
  private readonly setOutBtn: HTMLButtonElement;
  private readonly previewBtn: HTMLButtonElement;
  private readonly tuneBtn: HTMLButtonElement;
  private readonly toolbarCancelBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;

  // --- details stage ---
  private readonly details: HTMLElement;
  private readonly detailsBody: HTMLElement;
  private readonly backBtn: HTMLButtonElement;
  private readonly headingEl: HTMLElement;
  private readonly timeInputs: Record<ClipHandle, HTMLInputElement>;
  private readonly readout: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly noticeText: HTMLElement;
  private readonly cancelBtn: HTMLButtonElement;
  private readonly confirmBtn: HTMLButtonElement;
  private readonly titleInput: HTMLInputElement | null;
  private readonly titleCounter: HTMLElement | null;

  private readonly titleMaxLength: number;
  private readonly confirmLabel: string;
  private readonly container: HTMLElement;
  private readonly callbacks: ClipOverlayCallbacks;
  private readonly getReturnFocus: (() => HTMLElement | null) | undefined;

  private selection: ClipSelection;
  private bounds: RangeBounds;
  private config: ClipsPluginConfig;
  private submitting = false;
  /** True while the platform has taken the picture away (native full screen). */
  private suspended = false;
  private destroyed = false;
  private stage: ClipStage = 'range';
  private layout: ClipLayout = 'regular';
  private paused = true;
  /** A reason submission is impossible right now (audio, live, bad duration). */
  private blockedReason: string | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  // --- timeline attachment ---
  /** The UI extension layer the selector is mounted into, or null. */
  private timelineHost: HTMLElement | null = null;
  /** Measures the rail the handles sit on; null when standalone. */
  private getRailRect: (() => DOMRect) | null = null;

  // --- responsive plumbing ---
  private resizeObserver: ResizeObserver | null = null;
  private onWindowResize: (() => void) | null = null;
  private onOrientationChange: (() => void) | null = null;

  /**
   * Builds the editor DOM (detached - {@link ClipOverlay.open} mounts it) and
   * the {@link RangeSelector} inside it.
   *
   * @param options - Container, initial selection/bounds/config/title and the
   * integration callbacks (see {@link ClipOverlayOptions})
   */
  constructor(options: ClipOverlayOptions) {
    this.container = options.container;
    this.callbacks = options.callbacks;
    this.getReturnFocus = options.getReturnFocus;
    this.selection = { start: options.selection.start, end: options.selection.end };
    this.bounds = { min: options.bounds.min, max: options.bounds.max };
    this.config = options.config;
    this.confirmLabel = this.config.buttonLabel ?? DEFAULT_CONFIRM_LABEL;

    const seq = (fieldSeq += 1);
    const headingId = `sp-clip-heading-${seq}`;

    this.root = document.createElement('div');
    this.root.className = 'sp-clip-editor';
    // A labelled region, not a dialog: the range stage sits in the player's own
    // control area with the page behind it fully usable.
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', this.confirmLabel);
    this.root.dataset.stage = 'range';

    this.selector = new RangeSelector({
      selection: this.selection,
      bounds: this.bounds,
      config: this.config,
      presentation: 'standalone',
      callbacks: {
        onChange: this.handleSelectorChange,
        onDragStart: (handle) => this.callbacks.onDragStart?.(handle),
        onDragMove: (handle, time) => this.callbacks.onDragMove?.(handle, time),
        onDragEnd: (selection, info) => this.callbacks.onDragEnd?.(selection, info),
      },
    });

    // --- range stage ---
    this.flash = document.createElement('div');
    this.flash.className = 'sp-clip-flash';
    // Deliberately NOT a live region: a clamp re-flashes on every pointermove
    // of a drag pinned against a limit, and announcing that would drown out
    // everything worth hearing. Screen-reader users get the same information
    // from the slider's own value, which stops moving.
    this.flash.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.flash);

    this.railHost = document.createElement('div');
    this.railHost.className = 'sp-clip-rail';
    this.railHost.appendChild(this.selector.element);
    this.root.appendChild(this.railHost);

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'sp-clip-toolbar';
    this.toolbar.setAttribute('role', 'group');
    this.toolbar.setAttribute('aria-label', 'Clip range');

    this.playBtn = this.buildTool('sp-clip-tool--play', 'Play', '▶', '▶', () =>
      this.callbacks.onTogglePlay?.()
    );
    this.setInBtn = this.buildTool('sp-clip-tool--set-in', 'Set in point here', 'IN here', 'IN', () =>
      this.callbacks.onSetAtPlayhead?.('start')
    );
    this.setOutBtn = this.buildTool('sp-clip-tool--set-out', 'Set out point here', 'OUT here', 'OUT', () =>
      this.callbacks.onSetAtPlayhead?.('end')
    );
    this.previewBtn = this.buildTool('sp-clip-tool--preview', 'Preview clip', 'Preview', '↻', () =>
      this.callbacks.onPreview?.()
    );
    this.tuneBtn = this.buildTool('sp-clip-tool--tune', 'Fine tune exact times', 'Fine tune', '⋯', () =>
      this.goToDetails('start')
    );
    this.toolbarCancelBtn = this.buildTool('sp-clip-tool--cancel', 'Cancel clip', 'Cancel', '✕', () => {
      if (!this.submitting) this.callbacks.onCancel();
    });
    this.nextBtn = this.buildTool('sp-clip-tool--next', 'Next: name and create', 'Next', 'Next', () =>
      this.goToDetails()
    );
    this.nextBtn.classList.add('sp-clip-tool--primary');

    for (const el of [
      this.playBtn,
      this.setInBtn,
      this.setOutBtn,
      this.previewBtn,
      this.tuneBtn,
      this.toolbarCancelBtn,
      this.nextBtn,
    ]) {
      this.toolbar.appendChild(el);
    }
    this.root.appendChild(this.toolbar);

    // --- details stage ---
    this.details = document.createElement('div');
    this.details.className = 'sp-clip-details';
    this.details.setAttribute('role', 'dialog');
    // The host page is genuinely still interactive - the picture is playing
    // behind this and the page around the player is untouched - so claiming
    // modality would be a lie to assistive technology.
    this.details.setAttribute('aria-modal', 'false');
    this.details.setAttribute('aria-labelledby', headingId);

    const head = document.createElement('div');
    head.className = 'sp-clip-details__head';
    this.backBtn = document.createElement('button');
    this.backBtn.type = 'button';
    this.backBtn.className = 'sp-clip-back';
    this.backBtn.setAttribute('aria-label', 'Back to range');
    this.backBtn.textContent = 'Back';
    this.backBtn.addEventListener('click', () => this.goToRange());
    head.appendChild(this.backBtn);

    this.headingEl = document.createElement('h2');
    this.headingEl.className = 'sp-clip-details__title';
    this.headingEl.id = headingId;
    this.headingEl.tabIndex = -1;
    this.headingEl.textContent = this.confirmLabel;
    head.appendChild(this.headingEl);
    this.details.appendChild(head);

    this.detailsBody = document.createElement('div');
    this.detailsBody.className = 'sp-clip-details__body';

    const fields = document.createElement('div');
    fields.className = 'sp-clip-fields';
    this.timeInputs = {
      start: this.buildTimeField('start', 'In point', `sp-clip-in-${seq}`, fields),
      end: this.buildTimeField('end', 'Out point', `sp-clip-out-${seq}`, fields),
    };
    this.detailsBody.appendChild(fields);

    this.readout = document.createElement('div');
    this.readout.className = 'sp-clip-readout';
    this.detailsBody.appendChild(this.readout);

    // --- title field: omitted entirely when `title: false` ---
    const titleCfg = options.config.title === false ? null : options.config.title ?? {};
    this.titleMaxLength = titleCfg?.maxLength ?? DEFAULT_TITLE_MAX_LENGTH;
    if (titleCfg) {
      const fieldId = `sp-clip-title-${seq}`;

      const label = document.createElement('label');
      label.className = 'sp-clip-title-label';
      label.htmlFor = fieldId;
      label.textContent = titleCfg.label ?? DEFAULT_TITLE_LABEL;
      this.detailsBody.appendChild(label);

      this.titleInput = document.createElement('input');
      this.titleInput.className = 'sp-clip-title';
      this.titleInput.type = 'text';
      this.titleInput.id = fieldId;
      this.titleInput.maxLength = Math.max(0, this.titleMaxLength);
      this.titleInput.placeholder = titleCfg.placeholder ?? DEFAULT_TITLE_PLACEHOLDER;
      this.titleInput.value = options.title ?? '';
      if (titleCfg.required) this.titleInput.setAttribute('aria-required', 'true');
      this.titleInput.addEventListener('input', this.handleTitleInput);
      this.titleInput.addEventListener('keydown', this.handleTitleKeydown);
      this.titleInput.addEventListener('focus', this.handleFieldFocus);
      this.detailsBody.appendChild(this.titleInput);

      this.titleCounter = document.createElement('span');
      this.titleCounter.className = 'sp-clip-title-counter';
      // The input announces its own value; a live counter would talk over it.
      this.titleCounter.setAttribute('aria-hidden', 'true');
      this.detailsBody.appendChild(this.titleCounter);
    } else {
      this.titleInput = null;
      this.titleCounter = null;
    }

    // --- notice slot: textContent only, server text must never parse as markup ---
    this.notice = document.createElement('div');
    this.notice.className = 'sp-clip-notice';
    this.notice.setAttribute('aria-live', 'polite');
    this.noticeText = document.createElement('span');
    this.notice.appendChild(this.noticeText);
    this.detailsBody.appendChild(this.notice);

    this.details.appendChild(this.detailsBody);

    const actions = document.createElement('div');
    actions.className = 'sp-clip-actions';

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.type = 'button';
    this.cancelBtn.className = 'sp-clip-btn sp-clip-btn--cancel';
    this.cancelBtn.textContent = 'Cancel';
    this.cancelBtn.addEventListener('click', this.handleCancelClick);
    actions.appendChild(this.cancelBtn);

    this.confirmBtn = document.createElement('button');
    this.confirmBtn.type = 'button';
    this.confirmBtn.className = 'sp-clip-btn sp-clip-btn--confirm';
    this.confirmBtn.addEventListener('click', this.handleConfirmClick);
    actions.appendChild(this.confirmBtn);

    this.details.appendChild(actions);
    this.root.appendChild(this.details);

    document.addEventListener('keydown', this.onDocumentKeyDown);
    this.renderAll();
  }

  /** The editor element; mounted on the container by {@link ClipOverlay.open}. */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Mount the editor on the container, start observing its size and take
   * focus. The `--open` class and the initial focus are deferred one frame
   * (the SettingsMenu pattern) so the enter transition runs and the DOM has
   * settled.
   */
  open(): void {
    if (this.destroyed) return;
    if (!this.root.isConnected) this.container.appendChild(this.root);
    this.startObservingSize();
    this.measureLayout();
    requestAnimationFrame(() => {
      if (this.destroyed) return;
      this.root.classList.add('sp-clip-editor--open');
      this.measureLayout();
      this.focusStageEntry();
    });
  }

  /**
   * Re-render from state after an external change (`setRange`, a `configure()`
   * re-clamp, new limits or bounds). Render-only: the title field keeps
   * whatever the viewer is typing; host-driven title writes go through
   * {@link ClipOverlay.setTitle}.
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
    this.selector.update(selection, bounds, config);
    this.renderTimeFields();
    this.renderReadout();
    this.renderValidity();
  }

  // --------------------------------------------------------------------------
  // Timeline attachment
  // --------------------------------------------------------------------------

  /**
   * Move the handles onto the playback timeline, or back off it.
   *
   * The **same** selector instance is re-parented, so an open session survives
   * the UI package appearing, disappearing or rebuilding its control bar
   * without losing the selection, the title or the request id.
   *
   * @param host - The UI extension layer to mount into, or null for standalone
   * @param getRailRect - Measures the rail the handles sit on; required with a host
   */
  attachTimeline(host: HTMLElement | null, getRailRect?: () => DOMRect): void {
    if (this.destroyed) return;
    const presentation: ClipPresentation = host ? 'timeline' : 'standalone';
    this.timelineHost = host;
    this.getRailRect = host && getRailRect ? getRailRect : null;

    (host ?? this.railHost).appendChild(this.selector.element);
    this.selector.setPresentation(presentation);
    this.root.classList.toggle('sp-clip-editor--timeline', presentation === 'timeline');
    // The panel's own rail is redundant the moment the real one is available,
    // and leaving it would put two tracks for one selection on screen.
    this.railHost.hidden = presentation === 'timeline';
    this.measureLayout();
  }

  /**
   * Whether the handles are currently on the playback timeline.
   *
   * @returns True while mounted into the UI extension layer
   */
  isOnTimeline(): boolean {
    return this.timelineHost !== null;
  }

  /**
   * Recompute geometry against the timeline.
   *
   * Called from the timeline extension's `update()`, which the UI package runs
   * with its own progress-bar update, so the panel follows the rail without
   * observing it separately.
   */
  syncTimelineGeometry(): void {
    if (this.destroyed) return;
    this.applyAnchor();
  }

  // --------------------------------------------------------------------------
  // External state
  // --------------------------------------------------------------------------

  /**
   * Write the title field from outside (a host calling `setTitle()` while the
   * panel is open). The overlay's own keystrokes do not echo back here - the
   * field keeps the raw text while typing.
   *
   * @param title - The title to show
   */
  setTitle(title: string): void {
    if (this.destroyed || !this.titleInput) return;
    this.titleInput.value = title;
    this.renderCounter();
    this.renderValidity();
  }

  /**
   * Enter or leave the submitting state.
   *
   * Everything freezes, the handles included: the range being submitted must
   * not move under the request that carries it.
   *
   * @param submitting - True while the submission is pending
   */
  setSubmitting(submitting: boolean): void {
    if (this.destroyed || this.submitting === submitting) return;
    this.submitting = submitting;
    this.root.classList.toggle('sp-clip-editor--submitting', submitting);
    this.applySelectorInteractivity();
    this.renderConfirmContent();
    this.renderValidity();
  }

  /**
   * Suspend or resume editing because the platform took the picture away.
   *
   * On iPhone, native video full screen replaces the page with the OS player,
   * where no custom DOM control exists at all. The draft is kept exactly as it
   * is and every control is frozen, so a stray touch on the way in or out
   * cannot move an endpoint; leaving full screen thaws it unchanged.
   *
   * @param suspended - True while the media is in the platform's own player
   */
  setSuspended(suspended: boolean): void {
    if (this.destroyed || this.suspended === suspended) return;
    this.suspended = suspended;
    this.root.classList.toggle('sp-clip-editor--suspended', suspended);
    this.applySelectorInteractivity();
    this.renderValidity();
  }

  /**
   * Reflect play state on the toolbar's Play/Pause, which only exists when the
   * ordinary control bar has been hidden for room.
   *
   * @param paused - Whether playback is paused
   */
  setPaused(paused: boolean): void {
    if (this.destroyed || this.paused === paused) return;
    this.paused = paused;
    this.renderPlayButton();
  }

  /**
   * Block (or unblock) submission with a precise reason.
   *
   * The plugin calls this when the media stops being something this selection
   * can be committed against - it turned out to be audio, it went live, its
   * duration stopped being usable. The selection is kept and shown; only the
   * commit is refused, and the viewer is told why rather than being left with
   * a Create button that silently does nothing.
   *
   * @param reason - Human-readable reason, or null to unblock
   */
  setBlocked(reason: string | null): void {
    if (this.destroyed || this.blockedReason === reason) return;
    this.blockedReason = reason;
    if (reason) this.showNotice(reason, { type: 'error' });
    else this.hideNotice();
    this.renderValidity();
  }

  /**
   * Place one endpoint at an exact time, through the selector's own commit
   * path (so it snaps, clamps, re-renders and reports identically to a drag).
   *
   * @param handle - Which endpoint
   * @param time - The requested time in media seconds
   * @returns The landed time after snapping and clamping
   */
  setEndpoint(handle: ClipHandle, time: number): number {
    if (this.destroyed) return this.selection[handle];
    return this.selector.applyEndpoint(handle, time, 'playhead');
  }

  /**
   * Show a notice in the `aria-live` slot: validation hints, block reasons,
   * server error text. Written with `textContent` only - a server-supplied
   * `body.message` containing markup renders as literal text, never HTML.
   *
   * @param message - The text to show
   * @param options - Kind (`'error'` coloring) and optional auto-hide delay
   */
  showNotice(message: string, options: ClipNoticeOptions = {}): void {
    if (this.destroyed) return;
    this.clearNoticeTimer();
    this.noticeText.textContent = message;
    this.notice.classList.add('sp-clip-notice--visible');
    this.notice.classList.toggle('sp-clip-notice--error', options.type === 'error');
    if (options.autoHideMs !== undefined) {
      this.noticeTimer = setTimeout(() => {
        this.noticeTimer = null;
        this.notice.classList.remove('sp-clip-notice--visible');
      }, options.autoHideMs);
    }
  }

  /**
   * Flash why a move was refused by a limit, for {@link CLAMP_FLASH_MS}.
   *
   * Goes to the toolbar's silent flash, not to the live region - see the
   * module docblock.
   *
   * @param reason - Which limit bit stopped the move
   */
  showClampNotice(reason: ClipClampReason): void {
    if (this.destroyed) return;
    const limits = resolveLimits(this.config);
    let text: string;
    if (reason === 'max-duration') text = `Max ${limits.maxDuration}s`;
    else if (reason === 'min-duration') text = `Min ${limits.minDuration}s`;
    else text = 'Media edge';

    this.flash.textContent = text;
    this.flash.classList.add('sp-clip-flash--visible');
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      this.flash.classList.remove('sp-clip-flash--visible');
    }, CLAMP_FLASH_MS);
  }

  /** Clear the notice and any pending auto-hide. Idempotent. */
  hideNotice(): void {
    if (this.destroyed) return;
    this.clearNoticeTimer();
    this.notice.classList.remove('sp-clip-notice--visible', 'sp-clip-notice--error');
    this.noticeText.textContent = '';
  }

  /**
   * The stage the compact editor is showing.
   *
   * @returns `'range'` or `'details'`
   */
  getStage(): ClipStage {
    return this.stage;
  }

  /**
   * How much room the editor decided it has.
   *
   * @returns The layout mode currently applied
   */
  getLayout(): ClipLayout {
    return this.layout;
  }

  /**
   * Detach listeners, destroy the selector, unmount and return focus to the
   * opener when focus had been inside the editor. Idempotent; the instance
   * must not be reused afterwards.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const hadFocus = this.ownsFocus();

    document.removeEventListener('keydown', this.onDocumentKeyDown);
    this.stopObservingSize();
    this.clearNoticeTimer();
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer);
      this.flashTimer = null;
    }
    this.container.classList.remove('sp-clip-editing', 'sp-clip-editing--minimal');
    this.selector.destroy();
    this.root.remove();

    if (hadFocus) {
      const target = this.getReturnFocus?.() ?? null;
      if (target && target.isConnected) {
        target.focus();
      } else if (this.container.isConnected) {
        // The opener went with a control-bar rebuild. Parking focus on the
        // player is a good deal better than dropping it onto <body>, which
        // sends a keyboard user back to the top of the page.
        this.container.focus?.({ preventScroll: true });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Stages
  // --------------------------------------------------------------------------

  /**
   * Show the details stage.
   *
   * @param focusEndpoint - Focus this endpoint's exact-time field on arrival
   */
  goToDetails(focusEndpoint?: ClipHandle): void {
    if (this.destroyed || this.stage === 'details') {
      if (focusEndpoint) this.timeInputs[focusEndpoint].focus();
      return;
    }
    this.stage = 'details';
    this.root.dataset.stage = 'details';
    this.applySelectorInteractivity();
    this.measureLayout();
    if (focusEndpoint) this.timeInputs[focusEndpoint].focus();
    else this.focusStageEntry();
  }

  /** Show the range stage, keeping the selection and the typed title. */
  goToRange(): void {
    if (this.destroyed || this.stage === 'range') return;
    this.stage = 'range';
    this.root.dataset.stage = 'range';
    this.applySelectorInteractivity();
    this.measureLayout();
    this.focusStageEntry();
  }

  /** @internal Focus the first thing that makes sense for the current stage. */
  private focusStageEntry(): void {
    if (this.layout === 'regular' || this.stage === 'range') {
      // The range stage's first real control. Not a handle: landing on a slider
      // means the first arrow key moves the clip before the viewer has looked
      // at it.
      const first = this.visibleToolbarButtons()[0];
      first?.focus();
      return;
    }
    this.headingEl.focus();
  }

  // --------------------------------------------------------------------------
  // Responsive layout
  // --------------------------------------------------------------------------

  /**
   * @internal Watch the **player**, not the window.
   *
   * Device sniffing would get a 320px player in a wide article wrong in both
   * directions. A window-resize fallback covers jsdom and the handful of
   * browsers without `ResizeObserver`; `visualViewport` covers the on-screen
   * keyboard, which changes the usable height without resizing anything else.
   */
  private startObservingSize(): void {
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => this.measureLayout());
      this.resizeObserver.observe(this.container);
    }
    if (typeof window !== 'undefined') {
      this.onWindowResize = (): void => this.measureLayout();
      window.addEventListener('resize', this.onWindowResize);
      window.visualViewport?.addEventListener('resize', this.onWindowResize);

      // Rotation gets its own handler because it must do one thing more: the
      // rail a held drag is measuring against is about to be somewhere else,
      // so the drag is abandoned where it stands rather than jumping the
      // endpoint by the difference. The selection and the title are untouched.
      this.onOrientationChange = (): void => {
        this.selector.cancelDrag();
        this.measureLayout();
      };
      window.addEventListener('orientationchange', this.onOrientationChange);
    }
  }

  /** @internal Stop watching the player's size. */
  private stopObservingSize(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (typeof window !== 'undefined') {
      if (this.onWindowResize) {
        window.removeEventListener('resize', this.onWindowResize);
        window.visualViewport?.removeEventListener('resize', this.onWindowResize);
      }
      if (this.onOrientationChange) {
        window.removeEventListener('orientationchange', this.onOrientationChange);
      }
    }
    this.onWindowResize = null;
    this.onOrientationChange = null;
  }

  /** @internal Re-decide the layout mode and re-apply everything that depends on it. */
  private measureLayout(): void {
    if (this.destroyed) return;
    const rect = this.container.getBoundingClientRect();
    // clientWidth/Height are the fallback for jsdom, which lays everything out
    // at zero; a test that sets them still exercises the real branching.
    const width = rect.width || this.container.clientWidth;
    const height = rect.height || this.container.clientHeight;

    const next: ClipLayout =
      height > 0 && height < TINY_HEIGHT
        ? 'tiny'
        : height > 0 && height < MINIMAL_HEIGHT
          ? 'minimal'
          : (width > 0 && width < COMPACT_WIDTH) || (height > 0 && height < COMPACT_HEIGHT)
            ? 'compact'
            : 'regular';

    if (next !== this.layout) {
      this.layout = next;
      // Leaving compact with the details stage open would strand the viewer on
      // a stage that no longer exists as a separate thing; regular shows both.
      if (next === 'regular') this.stage = 'range';
      this.root.dataset.stage = this.stage;
    }
    this.root.dataset.layout = this.layout;

    // The control bar is only given up when the picture genuinely cannot hold
    // both, and the class is scoped to this container so a second player on the
    // page keeps its own controls.
    this.container.classList.add('sp-clip-editing');
    this.container.classList.toggle(
      'sp-clip-editing--minimal',
      this.layout === 'minimal' || this.layout === 'tiny'
    );

    this.applyToolbarVisibility();
    this.applyAnchor();
    this.applySelectorInteractivity();
  }

  /** @internal Which toolbar buttons make sense in the current layout and stage. */
  private applyToolbarVisibility(): void {
    const regular = this.layout === 'regular';
    const givesUpControls = this.layout === 'minimal' || this.layout === 'tiny';

    // Regular shows the details panel alongside the toolbar, so the stage
    // buttons have nothing to switch between and the panel's own footer
    // carries Cancel.
    this.nextBtn.hidden = regular;
    this.toolbarCancelBtn.hidden = regular;
    this.backBtn.hidden = regular;
    this.playBtn.hidden = !givesUpControls;
    // Fine tune is a shortcut to the details stage focused on one endpoint.
    // On a player short enough to have given up its control bar there is no
    // room for a shortcut to a place Next already goes, and keeping it is what
    // pushed the primary action off the right-hand edge at 320px.
    this.tuneBtn.hidden = regular || givesUpControls;
    this.renderPlayButton();

    // Short visible labels below `regular`; the accessible names are untouched.
    const short = this.layout !== 'regular';
    this.root.classList.toggle('sp-clip-editor--icons', short);
    for (const button of [
      this.setInBtn,
      this.setOutBtn,
      this.previewBtn,
      this.tuneBtn,
      this.toolbarCancelBtn,
      this.nextBtn,
    ]) {
      const label = short ? button.dataset.shortLabel : button.dataset.longLabel;
      if (label !== undefined && button.textContent !== label) button.textContent = label;
    }
  }

  /**
   * @internal Anchor the editor above the timeline's measured top edge.
   *
   * The old fixed `bottom: 64px` assumed a control bar of a particular height
   * and no handle lanes at all. With the handles on the rail there are two
   * lanes to clear, and the only honest source for where they are is the rail's
   * own box.
   */
  private applyAnchor(): void {
    const box = this.container.getBoundingClientRect();
    const height = box.height || this.container.clientHeight;

    let anchor = FALLBACK_ANCHOR;
    const rail = this.getRailRect?.();
    if (rail && height > 0) {
      // Distance from the container's bottom edge up to the top of the IN lane.
      anchor = Math.max(0, box.bottom - rail.top) + HANDLE_LANE + LANE_GAP;
    }
    this.root.style.bottom = `${Math.round(anchor)}px`;

    // Bounded, never clipped: an error notice must not push Create out of the
    // player, so the body scrolls instead of the panel growing.
    if (height > 0) {
      const available = Math.max(0, height - anchor - LANE_GAP);
      this.details.style.maxHeight = this.layout === 'tiny' ? `${height}px` : `${available}px`;
    } else {
      this.details.style.maxHeight = '';
    }
  }

  /**
   * @internal Freeze the handles whenever they are out of reach or must not
   * move: while a submission is in flight, and while the details stage covers
   * the player on a compact layout.
   */
  private applySelectorInteractivity(): void {
    const detailsCovers = this.layout !== 'regular' && this.stage === 'details';
    this.selector.setInteractive(!this.submitting && !this.suspended && !detailsCovers);
  }

  // --------------------------------------------------------------------------
  // Event handlers
  // --------------------------------------------------------------------------

  /** @internal Selector committed a move: re-render and route it to the plugin. */
  private handleSelectorChange = (selection: ClipSelection, meta: ClipChangeMeta): void => {
    this.selection = { start: selection.start, end: selection.end };
    this.renderTimeFields();
    this.renderReadout();
    this.renderValidity();
    if (meta.clamped && meta.clampReason) this.showClampNotice(meta.clampReason);
    this.callbacks.onSelectionChange({ ...this.selection }, meta);
  };

  /** @internal Keystroke in the title field: live counter + validity, raw text to the plugin. */
  private handleTitleInput = (): void => {
    const value = this.titleInput?.value ?? '';
    this.renderCounter();
    this.renderValidity();
    this.callbacks.onTitleChange(value);
  };

  /**
   * @internal Enter in the title field confirms when valid and does nothing
   * when not - `preventDefault()` either way, so the key never reaches the
   * UI shortcuts or submits anything natively.
   */
  private handleTitleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!this.submitting && this.isCommittable()) this.callbacks.onConfirm();
  };

  /**
   * @internal An on-screen keyboard has just taken half the viewport. Bring the
   * field back into view rather than leaving the viewer typing off screen.
   */
  private handleFieldFocus = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    // The details body is what scrolls; asking the element to scroll itself
    // into view inside it is enough, and never scrolls the host page.
    requestAnimationFrame(() => {
      if (this.destroyed) return;
      target.scrollIntoView?.({ block: 'nearest' });
    });
  };

  /** @internal Cancel button: route to the plugin (close with reason 'user'). */
  private handleCancelClick = (): void => {
    if (this.submitting) return;
    this.callbacks.onCancel();
  };

  /** @internal Confirm button: guarded the same way Enter is. */
  private handleConfirmClick = (): void => {
    if (this.submitting || !this.isCommittable()) return;
    this.callbacks.onConfirm();
  };

  /**
   * @internal
   * Escape closes, scoped to focus inside **this** player - a document-wide
   * handler let a keypress in one player close another's editor. Tab is
   * trapped only inside the details dialog, and only in a compact layout where
   * that dialog genuinely covers the player; the range stage is nonmodal and
   * lets Tab through to the rest of the page.
   */
  private onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this.destroyed) return;
    if (!this.ownsFocus()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      // Escape out of the details stage is "back", not "throw the clip away":
      // the viewer has typed a title by then, and losing it to a stray key is
      // the kind of thing people only forgive once.
      if (this.layout !== 'regular' && this.stage === 'details') this.goToRange();
      else if (!this.submitting) this.callbacks.onCancel();
      return;
    }

    if (event.key !== 'Tab') return;
    if (this.layout === 'regular' || this.stage !== 'details') return;
    if (!this.details.contains(document.activeElement)) return;

    const items = this.dialogFocusables();
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    const next = event.shiftKey
      ? current <= 0
        ? last
        : current - 1
      : current === -1 || current === last
        ? 0
        : current + 1;
    items[next].focus();
  };

  /**
   * @internal Whether focus is inside this player's editor or controls.
   *
   * The selector may be mounted into the UI package's timeline layer, which is
   * outside this editor's DOM but inside the same player, so the container is
   * the right boundary - and it is exactly the boundary that keeps two players
   * on one page from stealing each other's keys.
   */
  private ownsFocus(): boolean {
    const active = document.activeElement;
    if (!(active instanceof Node)) return false;
    return this.root.contains(active) || this.container.contains(active);
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  /**
   * @internal Build one toolbar button with a full accessible name.
   *
   * Two visible labels, one accessible name. At 320px the toolbar's own row is
   * 296px wide and seven word-labelled buttons need well over 400, so the
   * primary action scrolled off the right-hand edge - which is the exact
   * failure this whole piece of work exists to stop. The short label is what
   * the viewer sees there; `aria-label` never shortens, so a screen-reader user
   * always hears "Set in point here", not "IN".
   *
   * @param modifier - The button's class modifier
   * @param ariaLabel - The unabridged accessible name
   * @param text - Visible label on a player with room
   * @param shortText - Visible label on a narrow player
   * @param onClick - What the press does
   * @returns The button
   */
  private buildTool(
    modifier: string,
    ariaLabel: string,
    text: string,
    shortText: string,
    onClick: () => void
  ): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `sp-clip-tool ${modifier}`;
    el.setAttribute('aria-label', ariaLabel);
    el.dataset.longLabel = text;
    el.dataset.shortLabel = shortText;
    el.textContent = text;
    el.addEventListener('click', () => {
      if (this.submitting) return;
      onClick();
    });
    return el;
  }

  /** @internal Build one labelled exact-time field and append it to a row. */
  private buildTimeField(
    which: ClipHandle,
    labelText: string,
    id: string,
    parent: HTMLElement
  ): HTMLInputElement {
    const wrap = document.createElement('div');
    wrap.className = 'sp-clip-field';

    const label = document.createElement('label');
    label.className = 'sp-clip-field__label';
    label.htmlFor = id;
    label.textContent = labelText;
    wrap.appendChild(label);

    const input = document.createElement('input');
    input.className = 'sp-clip-time';
    input.type = 'text';
    input.id = id;
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.clipEndpoint = which;
    input.setAttribute('aria-describedby', `${id}-hint`);
    input.addEventListener('keydown', (event) => this.handleTimeKeydown(which, event));
    input.addEventListener('blur', () => this.commitTimeField(which));
    input.addEventListener('focus', this.handleFieldFocus);
    wrap.appendChild(input);

    const hint = document.createElement('span');
    hint.className = 'sp-clip-field__hint';
    hint.id = `${id}-hint`;
    hint.textContent = 'Seconds or m:ss';
    wrap.appendChild(hint);

    parent.appendChild(wrap);
    return input;
  }

  /**
   * @internal Enter commits an exact time; Escape reverts the field to the
   * selection it is showing. Both stop the key reaching the player shortcuts.
   */
  private handleTimeKeydown(which: ClipHandle, event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitTimeField(which);
      return;
    }
    if (event.key === 'Escape') {
      // Not stopPropagation: the document handler above turns Escape into
      // "back" or "cancel", and reverting the field first means the viewer
      // never leaves with a half-typed value applied.
      this.renderTimeFields(which);
    }
  }

  /**
   * @internal Commit one exact-time field through the selector's model path.
   *
   * A malformed, negative or non-finite value changes nothing and says so; the
   * field is then re-rendered from the selection, so the viewer is never left
   * looking at text the player did not accept.
   */
  private commitTimeField(which: ClipHandle): void {
    if (this.destroyed || this.submitting) return;
    const input = this.timeInputs[which];
    const parsed = parseTimestamp(input.value);
    if (parsed === null) {
      this.showNotice('Enter a time as seconds or m:ss', { type: 'error', autoHideMs: 4000 });
      this.renderTimeFields(which);
      return;
    }
    this.selector.applyEndpoint(which, parsed, 'field');
    this.renderTimeFields(which);
  }

  /** @internal Re-render everything stateful. */
  private renderAll(): void {
    this.renderTimeFields();
    this.renderReadout();
    this.renderCounter();
    this.renderConfirmContent();
    this.renderPlayButton();
    this.renderValidity();
  }

  /**
   * @internal The exact-time fields, unless the viewer is editing one.
   *
   * @param force - One field to rewrite even while it holds focus. Enter and
   *   Escape are both handled with the input still focused, so without this the
   *   field the viewer just acted on was the one field the re-render skipped:
   *   Escape left the half-typed text in place, a refused value stayed on
   *   screen next to the notice rejecting it, and a committed value never
   *   showed the snapped, clamped time the selector actually landed on.
   */
  private renderTimeFields(force?: ClipHandle): void {
    const step = (this.config.step as number | undefined) ?? 1;
    for (const which of ['start', 'end'] as const) {
      const input = this.timeInputs[which];
      // Never overwrite what someone is typing; blur and Enter are the commits.
      if (which !== force && document.activeElement === input) continue;
      input.value = formatTimestamp(this.selection[which], step);
    }
  }

  /** @internal `0:12 - 0:47 · 35s`, at the configured granularity. */
  private renderReadout(): void {
    const step = (this.config.step as number | undefined) ?? 1;
    const { start, end } = this.selection;
    this.readout.textContent = `${formatTimestamp(start, step)} – ${formatTimestamp(end, step)} · ${formatLength(end - start, step)}s`;
  }

  /** @internal Live `12/80` counter under the title field. */
  private renderCounter(): void {
    if (!this.titleCounter) return;
    this.titleCounter.textContent = `${(this.titleInput?.value ?? '').length}/${this.titleMaxLength}`;
  }

  /** @internal Swap the Confirm label for the spinner while submitting. */
  private renderConfirmContent(): void {
    this.confirmBtn.textContent = '';
    if (this.submitting) {
      this.confirmBtn.classList.add('sp-clip-btn--submitting');
      const spinner = document.createElement('span');
      spinner.className = 'sp-clip-spinner';
      this.confirmBtn.appendChild(spinner);
    } else {
      this.confirmBtn.classList.remove('sp-clip-btn--submitting');
      this.confirmBtn.textContent = this.confirmLabel;
    }
  }

  /** @internal The toolbar transport glyph and its accessible name. */
  private renderPlayButton(): void {
    this.playBtn.textContent = this.paused ? '▶' : '⏸';
    this.playBtn.setAttribute('aria-label', this.paused ? 'Play' : 'Pause');
  }

  /** @internal Whether the selection and title pass the pure-model validation. */
  private isCommittable(): boolean {
    return (
      this.blockedReason === null &&
      !this.suspended &&
      validate(this.selection, this.config, this.bounds) === null &&
      validateTitle(this.titleInput?.value ?? '', this.config) === null
    );
  }

  /**
   * @internal Disabled states. Submitting wins over everything: while a request
   * is in flight nothing that could change the range or the title is live.
   */
  private renderValidity(): void {
    const frozen = this.submitting || this.suspended;
    this.cancelBtn.disabled = frozen;
    this.toolbarCancelBtn.disabled = frozen;
    this.confirmBtn.disabled = frozen || !this.isCommittable();
    this.nextBtn.disabled = frozen;
    this.tuneBtn.disabled = frozen;
    this.setInBtn.disabled = frozen;
    this.setOutBtn.disabled = frozen;
    this.previewBtn.disabled = frozen;
    this.backBtn.disabled = frozen;
    this.playBtn.disabled = frozen;
    for (const which of ['start', 'end'] as const) {
      this.timeInputs[which].disabled = frozen;
    }
    if (this.titleInput) this.titleInput.disabled = frozen;
  }

  /** @internal The toolbar buttons currently on screen and usable. */
  private visibleToolbarButtons(): HTMLButtonElement[] {
    return [
      this.playBtn,
      this.setInBtn,
      this.setOutBtn,
      this.previewBtn,
      this.tuneBtn,
      this.toolbarCancelBtn,
      this.nextBtn,
    ].filter((el) => !el.hidden && !el.disabled);
  }

  /**
   * @internal The details dialog's focusables, in DOM order. Selected through
   * the pinned class vocabulary rather than a generic selector, so a disabled
   * Confirm drops out of the cycle.
   */
  private dialogFocusables(): HTMLElement[] {
    return Array.from(
      this.details.querySelectorAll<HTMLElement>(
        '.sp-clip-back:not([disabled]), .sp-clip-time:not([disabled]), .sp-clip-title:not([disabled]), .sp-clip-btn:not([disabled])'
      )
    );
  }

  /** @internal */
  private clearNoticeTimer(): void {
    if (this.noticeTimer !== null) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
  }
}
