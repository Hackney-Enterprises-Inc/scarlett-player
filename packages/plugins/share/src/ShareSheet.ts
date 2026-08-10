/**
 * The share sheet: a bottom sheet on phones, a popover on wider screens.
 *
 * Rendered into the player container rather than the document body so it stays
 * inside fullscreen, where a body-level element would be invisible.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { ShareTarget } from './types';

/** How long the copy confirmation stays up. */
const TOAST_MS = 1800;

export interface ShareSheetCallbacks {
  onSelect: (target: ShareTarget) => void;
  onClose: () => void;
}

export class ShareSheet {
  private backdrop: HTMLDivElement | null = null;
  private sheet: HTMLDivElement | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private open = false;

  private readonly keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.close();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  };

  constructor(
    private api: IPluginAPI,
    private callbacks: ShareSheetCallbacks,
  ) {}

  /** Whether the sheet is currently showing. */
  isOpen(): boolean {
    return this.open;
  }

  /**
   * Show the sheet for a set of targets.
   */
  show(targets: ShareTarget[]): void {
    if (this.open) {
      return;
    }

    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.open = true;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'sp-share-backdrop';
    this.backdrop.addEventListener('click', () => this.close());

    this.sheet = document.createElement('div');
    this.sheet.className = 'sp-share-sheet';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');
    this.sheet.setAttribute('aria-label', 'Share');

    const grip = document.createElement('div');
    grip.className = 'sp-share-grip';
    this.sheet.appendChild(grip);

    const heading = document.createElement('p');
    heading.className = 'sp-share-title';
    heading.textContent = 'Share';
    this.sheet.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'sp-share-targets';

    for (const target of targets) {
      list.appendChild(this.renderTarget(target));
    }

    this.sheet.appendChild(list);

    this.api.container.appendChild(this.backdrop);
    this.api.container.appendChild(this.sheet);

    // Next frame, so the opening transition has a start state to animate from.
    requestAnimationFrame(() => {
      this.backdrop?.classList.add('sp-share-backdrop--open');
      this.sheet?.classList.add('sp-share-sheet--open');
    });

    document.addEventListener('keydown', this.keydownHandler, true);

    // Focus the first target so keyboard and screen-reader users land inside
    // the dialog rather than behind it.
    const first = this.sheet.querySelector<HTMLButtonElement>('.sp-share-target');
    first?.focus();
  }

  /** Hide the sheet and restore focus. */
  close(): void {
    if (!this.open) {
      return;
    }

    this.open = false;
    document.removeEventListener('keydown', this.keydownHandler, true);

    this.backdrop?.classList.remove('sp-share-backdrop--open');
    this.sheet?.classList.remove('sp-share-sheet--open');

    const backdrop = this.backdrop;
    const sheet = this.sheet;
    this.backdrop = null;
    this.sheet = null;

    // Let the close transition finish before removing. Guarded so a destroy
    // during the animation cannot leave orphans behind.
    setTimeout(() => {
      backdrop?.remove();
      sheet?.remove();
    }, 220);

    this.previouslyFocused?.focus();
    this.previouslyFocused = null;

    this.callbacks.onClose();
  }

  /**
   * Show a transient confirmation, e.g. after copying.
   */
  showToast(message: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    if (!this.toast) {
      this.toast = document.createElement('div');
      this.toast.className = 'sp-share-toast';
      // Polite: a copy confirmation should not interrupt what is being read.
      this.toast.setAttribute('role', 'status');
      this.toast.setAttribute('aria-live', 'polite');
      this.api.container.appendChild(this.toast);
    }

    this.toast.textContent = message;
    requestAnimationFrame(() => this.toast?.classList.add('sp-share-toast--visible'));

    this.toastTimer = setTimeout(() => {
      this.toast?.classList.remove('sp-share-toast--visible');
      this.toastTimer = null;
    }, TOAST_MS);
  }

  /**
   * Last-resort clipboard fallback: show the text for manual copying.
   */
  showManualCopy(text: string): void {
    if (!this.sheet) {
      return;
    }

    const row = document.createElement('div');
    row.className = 'sp-share-fallback';

    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = text;
    input.setAttribute('aria-label', 'Link to copy');

    row.appendChild(input);
    this.sheet.appendChild(row);

    input.focus();
    input.select();
  }

  /** Remove everything and detach listeners. */
  destroy(): void {
    document.removeEventListener('keydown', this.keydownHandler, true);

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    this.backdrop?.remove();
    this.sheet?.remove();
    this.toast?.remove();

    this.backdrop = null;
    this.sheet = null;
    this.toast = null;
    this.open = false;
    this.previouslyFocused = null;
  }

  /** Build one target button. */
  private renderTarget(target: ShareTarget): HTMLLIElement {
    const item = document.createElement('li');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sp-share-target sp-share-target--${target.id}`;
    button.setAttribute('aria-label', target.label);

    const icon = document.createElement('span');
    icon.className = 'sp-share-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (target.icon) {
      icon.innerHTML = target.icon;
    }

    const label = document.createElement('span');
    label.className = 'sp-share-label';
    label.textContent = target.label;

    button.appendChild(icon);
    button.appendChild(label);
    button.addEventListener('click', () => this.callbacks.onSelect(target));

    item.appendChild(button);
    return item;
  }

  /** Keep Tab inside the dialog while it is open. */
  private trapFocus(event: KeyboardEvent): void {
    if (!this.sheet) {
      return;
    }

    const focusable = this.sheet.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
