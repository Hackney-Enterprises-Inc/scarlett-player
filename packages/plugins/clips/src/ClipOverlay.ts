/**
 * ClipOverlay - the clip-creation panel.
 *
 * Mounted on `api.container` (the watermark and share-sheet precedent) as a
 * bottom panel above the control strip; the pinned CSS vocabulary in
 * ./styles.ts puts it on the menus' layer (z-index 20) with no backdrop, so
 * the looping picture stays visible while the viewer picks in/out points.
 *
 * Contents (plan "Design > Overlay"): the two-handle {@link RangeSelector},
 * a duration readout (`0:12 – 0:47 · 35s`), the optional title input (omitted
 * entirely with `title: false`), an `aria-live="polite"` notice slot and
 * Cancel / Create clip buttons. Confirm is disabled while `validate()` or
 * `validateTitle()` reports a problem; while a submission is in flight both
 * buttons are disabled and Confirm swaps its label for a spinner.
 *
 * Keyboard: a document-level trap keeps Tab/Shift+Tab inside the panel while
 * it is mounted, and Escape calls `preventDefault()` (so the UI plugin's
 * shortcuts and full-screen handling skip the event) before routing to
 * cancel. Focus lands on the first focusable on open (deferred one frame,
 * per SettingsMenu) and returns to the control-bar button on close when it
 * had been inside the panel - {@link ClipOverlayOptions.getReturnFocus}
 * resolves it, and a detached button is skipped. There is deliberately no
 * outside-click close: the panel coexists with looping playback, and
 * Escape/Cancel are the exits.
 *
 * Typing a title is safe from player shortcuts: the UI plugin's document
 * handler ignores `HTMLInputElement` targets (`ui/src/index.ts:953-962`), so
 * Space or `f` in the field toggles nothing. Enter in the field confirms when
 * the selection is valid and does nothing when it is not - `preventDefault()`
 * either way.
 *
 * The overlay owns no model logic and no truth: it renders from the plugin's
 * `clipSelection` state (the single source of truth), routes every committed
 * move through {@link ClipOverlayCallbacks.onSelectionChange} back to the
 * plugin, and receives external changes (setRange, `configure()` re-clamps)
 * through {@link ClipOverlay.update}. The notice is written with
 * `textContent` only - it renders server-supplied messages, which must never
 * be parsed as markup.
 */

import { formatTime } from '@scarlett-player/core';
import { RangeSelector } from './RangeSelector';
import type { ClipChangeMeta, ClipClampReason, ClipHandle } from './RangeSelector';
import { resolveLimits, validate, validateTitle } from './range';
import type { ClipSelection, RangeBounds } from './range';
import type { ClipsPluginConfig } from './types';

/** How long a clamp flash stays on the notice, matching the handle flash. */
const CLAMP_FLASH_MS = 1000;

/** Fallback for `title.maxLength` when the field config omits it (mirrors range.ts). */
const DEFAULT_TITLE_MAX_LENGTH = 80;

/** Fallback placeholder and visible label for the title field. */
const DEFAULT_TITLE_PLACEHOLDER = 'Name this clip';
const DEFAULT_TITLE_LABEL = 'Clip title';

/** Fallback confirm-button label when `buttonLabel` is unset. */
const DEFAULT_CONFIRM_LABEL = 'Create clip';

/** Monotonic suffix so label/`for` ids never collide between panels. */
let titleFieldSeq = 0;

/** Integration surface back into the plugin (wired in index.ts, task 3.3/3.5). */
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
   * A committed move from the selector (drag or keyboard), already snapped
   * and clamped by the model. The plugin treats it as its `setRange` path
   * and emits `clip:changed { reason: 'user' }`.
   */
  onSelectionChange: (selection: ClipSelection, meta: ClipChangeMeta) => void;
  /**
   * Drag lifecycle passthroughs for the drag-to-scrub integration (task 3.5):
   * pause + suspend on start, throttled seeks off move, seek-to-start +
   * resume + play-restore on end. Wired straight to the selector's callbacks.
   */
  onDragStart?: (handle: ClipHandle) => void;
  onDragMove?: (handle: ClipHandle, time: number) => void;
  onDragEnd?: (selection: ClipSelection) => void;
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
 * The clip panel: selector + readout + title + notice + actions, with the
 * focus trap and the submitting/disabled button states. See the module
 * docblock for the interaction contract.
 */
export class ClipOverlay {
  private readonly panel: HTMLElement;
  private readonly selector: RangeSelector;
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
  private destroyed = false;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Builds the panel DOM (detached - {@link ClipOverlay.open} mounts it) and
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

    this.panel = document.createElement('div');
    this.panel.className = 'sp-clip-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', this.confirmLabel);

    this.selector = new RangeSelector({
      selection: this.selection,
      bounds: this.bounds,
      config: this.config,
      callbacks: {
        onChange: this.handleSelectorChange,
        onDragStart: (handle) => this.callbacks.onDragStart?.(handle),
        onDragMove: (handle, time) => this.callbacks.onDragMove?.(handle, time),
        onDragEnd: (selection) => this.callbacks.onDragEnd?.(selection),
      },
    });
    this.panel.appendChild(this.selector.element);

    this.readout = document.createElement('div');
    this.readout.className = 'sp-clip-readout';
    this.panel.appendChild(this.readout);

    // --- title field: omitted entirely when `title: false` ---
    const titleCfg = options.config.title === false ? null : options.config.title ?? {};
    this.titleMaxLength = titleCfg?.maxLength ?? DEFAULT_TITLE_MAX_LENGTH;
    if (titleCfg) {
      const fieldId = `sp-clip-title-${(titleFieldSeq += 1)}`;

      const label = document.createElement('label');
      label.className = 'sp-clip-title-label';
      label.htmlFor = fieldId;
      label.textContent = titleCfg.label ?? DEFAULT_TITLE_LABEL;
      this.panel.appendChild(label);

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
      this.panel.appendChild(this.titleInput);

      this.titleCounter = document.createElement('span');
      this.titleCounter.className = 'sp-clip-title-counter';
      // The input announces its own value; a live counter would talk over it.
      this.titleCounter.setAttribute('aria-hidden', 'true');
      this.panel.appendChild(this.titleCounter);
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
    this.panel.appendChild(this.notice);

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

    this.panel.appendChild(actions);

    document.addEventListener('keydown', this.onDocumentKeyDown);
    this.renderAll();
  }

  /** The panel element; mounted on the container by {@link ClipOverlay.open}. */
  get element(): HTMLElement {
    return this.panel;
  }

  /**
   * Mount the panel on the container and take focus: the `--open` class and
   * the initial focus are deferred one frame (the SettingsMenu pattern) so
   * the enter transition runs and the DOM is settled.
   */
  open(): void {
    if (this.destroyed) return;
    if (!this.panel.isConnected) this.container.appendChild(this.panel);
    requestAnimationFrame(() => {
      if (this.destroyed) return;
      this.panel.classList.add('sp-clip-panel--open');
      this.focusables()[0]?.focus();
    });
  }

  /**
   * Re-render from state after an external change (`setRange`, a
   * `configure()` re-clamp, new limits or bounds). Render-only: the title
   * field keeps whatever the viewer is typing; host-driven title writes go
   * through {@link ClipOverlay.setTitle}.
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
    this.renderReadout();
    this.renderValidity();
  }

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
   * Enter or leave the submitting state: both buttons disabled, the `--submitting`
   * modifier and a spinner replacing the Confirm label while a commit is in
   * flight (plan "Submission").
   *
   * @param submitting - True while the submission is pending
   */
  setSubmitting(submitting: boolean): void {
    if (this.destroyed || this.submitting === submitting) return;
    this.submitting = submitting;
    this.renderConfirmContent();
    this.renderValidity();
  }

  /**
   * Show a notice in the `aria-live` slot: clamp reasons, validation hints,
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
   * Flash why a move was refused by a limit, for {@link CLAMP_FLASH_MS} -
   * the same beat as the handle's `--clamped` flash.
   *
   * @param reason - Which limit bit stopped the move
   */
  showClampNotice(reason: ClipClampReason): void {
    const limits = resolveLimits(this.config);
    let text: string;
    if (reason === 'max-duration') text = `Max ${limits.maxDuration}s`;
    else if (reason === 'min-duration') text = `Min ${limits.minDuration}s`;
    else text = 'Media edge';
    this.showNotice(text, { autoHideMs: CLAMP_FLASH_MS });
  }

  /** Clear the notice and any pending auto-hide. Idempotent. */
  hideNotice(): void {
    if (this.destroyed) return;
    this.clearNoticeTimer();
    this.notice.classList.remove('sp-clip-notice--visible', 'sp-clip-notice--error');
    this.noticeText.textContent = '';
  }

  /**
   * Detach listeners, destroy the selector, unmount the panel and return
   * focus to the control-bar button when focus had been inside the panel.
   * Idempotent; the instance must not be reused afterwards.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const hadFocus = this.panel.contains(document.activeElement);

    document.removeEventListener('keydown', this.onDocumentKeyDown);
    this.clearNoticeTimer();
    this.selector.destroy();
    this.panel.remove();

    if (hadFocus) {
      const target = this.getReturnFocus?.() ?? null;
      if (target && target.isConnected) target.focus();
    }
  }

  // --------------------------------------------------------------------------
  // Event handlers
  // --------------------------------------------------------------------------

  /** @internal Selector committed a move: re-render and route it to the plugin. */
  private handleSelectorChange = (selection: ClipSelection, meta: ClipChangeMeta): void => {
    this.selection = { start: selection.start, end: selection.end };
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
   * Document-level trap, active while the panel is mounted (the SettingsMenu
   * pattern): Escape cancels with `preventDefault()`, Tab/Shift+Tab cycle the
   * panel's own focusables.
   */
  private onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this.destroyed) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.onCancel();
      return;
    }

    if (event.key !== 'Tab') return;
    const items = this.focusables();
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    let next: number;
    if (event.shiftKey) {
      next = current <= 0 ? last : current - 1;
    } else {
      next = current === -1 || current === last ? 0 : current + 1;
    }
    items[next].focus();
  };

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  /** @internal Re-render everything stateful. */
  private renderAll(): void {
    this.renderReadout();
    this.renderCounter();
    this.renderConfirmContent();
    this.renderValidity();
  }

  /** @internal `0:12 – 0:47 · 35s`, at the deliberately coarse whole-second granularity. */
  private renderReadout(): void {
    const { start, end } = this.selection;
    const secs = Math.max(0, end - start);
    const shown = Number.isInteger(secs) ? String(secs) : secs.toFixed(1);
    this.readout.textContent = `${formatTime(start)} – ${formatTime(end)} · ${shown}s`;
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

  /** @internal Whether the selection and title pass the pure-model validation. */
  private isCommittable(): boolean {
    return (
      validate(this.selection, this.config, this.bounds) === null &&
      validateTitle(this.titleInput?.value ?? '', this.config) === null
    );
  }

  /** @internal Disabled states: submitting wins over validity; Cancel is free otherwise. */
  private renderValidity(): void {
    this.cancelBtn.disabled = this.submitting;
    this.confirmBtn.disabled = this.submitting || !this.isCommittable();
  }

  /**
   * @internal The panel's focusables, in DOM order: the two slider handles,
   * the title field, then the enabled action buttons. Selected through the
   * pinned class vocabulary rather than a generic selector so the disabled
   * Confirm drops out of the cycle.
   */
  private focusables(): HTMLElement[] {
    return Array.from(
      this.panel.querySelectorAll<HTMLElement>(
        '.sp-clip-handle, .sp-clip-title, .sp-clip-btn:not([disabled])',
      ),
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
