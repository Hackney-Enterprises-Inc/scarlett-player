/**
 * Keyboard Help Dialog
 *
 * A container-scoped modal that lists the shortcuts the player actually
 * implements (see ../shortcuts.ts, the single source of the rows).
 *
 * Rendered into the player's own container, never portalled to `document.body`:
 * container-scoped themes and the player's keyboard focus detection both
 * depend on the dialog living inside the container's subtree.
 *
 * While it is open it owns Escape and Tab, keeps focus inside itself, and the
 * plugin's player-wide shortcuts stand down (the open-dialog guard in
 * `handleKeyDown`). One instance belongs to one player; two players each get
 * their own dialog and never share state, and this one only acts on keys
 * while its own player holds focus.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { icons } from '../icons';
import { createElement } from '../utils';
import { SHORTCUTS } from '../shortcuts';

/**
 * The modal listing the player's keyboard shortcuts.
 *
 * Opened by `?` or the `keyboard-help` button; Escape or the close button
 * dismisses it and returns focus to the element that opened it. One instance
 * per player, rendered inside that player's container.
 */
export class KeyboardHelpDialog {
  /** The dialog element: scrim plus panel, appended to the container on open. */
  private el: HTMLDivElement;
  /** The panel inside the scrim, bounded to the player's box. */
  private panel: HTMLDivElement;
  /** The only interactive control in the dialog. */
  private closeBtn: HTMLButtonElement;
  /** Rows and footnotes, built once from SHORTCUTS. */
  private body: HTMLDivElement;
  private api: IPluginAPI;
  /** True while the dialog is in the container and owns its keys. */
  private opened = false;
  /** Element focused when the dialog opened, handed focus back on close. */
  private invoker: HTMLElement | null = null;
  /** Document keydown listener, attached on open and removed on close. */
  private keyHandler: (e: KeyboardEvent) => void;
  /** Close-button listener, removed on destroy. */
  private closeHandler: () => void;

  /**
   * @param api - Per-player plugin API; the dialog renders into `api.container`
   */
  constructor(api: IPluginAPI) {
    this.api = api;

    this.el = createElement('div', {
      className: 'sp-kbd-help',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Keyboard shortcuts',
    });

    this.panel = createElement('div', { className: 'sp-kbd-help__panel' });

    const header = createElement('div', { className: 'sp-kbd-help__header' });
    const title = createElement('span', { className: 'sp-kbd-help__title' });
    title.textContent = 'Keyboard shortcuts';
    this.closeBtn = createElement('button', {
      className: 'sp-kbd-help__close',
      type: 'button',
      'aria-label': 'Close keyboard shortcuts',
    });
    this.closeBtn.innerHTML = icons.close;

    this.closeHandler = (): void => this.close();
    this.closeBtn.addEventListener('click', this.closeHandler);

    header.appendChild(title);
    header.appendChild(this.closeBtn);

    this.body = createElement('div', { className: 'sp-kbd-help__body' });
    this.renderEntries();

    this.panel.appendChild(header);
    this.panel.appendChild(this.body);
    this.el.appendChild(this.panel);

    this.keyHandler = (e: KeyboardEvent): void => {
      if (!this.opened) return;

      // Another player's dialog, or a host overlay that took focus, must not
      // be fought over: this dialog only answers while its own player has
      // focus.
      if (!this.api.container.contains(document.activeElement)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }

      // Tab belongs to the dialog while focus is inside it, so keyboard
      // viewers cannot tab out of a modal into the page behind it.
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.trapTab(e.shiftKey);
      }
    };
  }

  /**
   * Build the shortcut rows and their footnotes from the shared list.
   *
   * Called once, in the constructor: the list is a build-time constant, and
   * rebuilding it per open would only churn the DOM.
   */
  private renderEntries(): void {
    const list = createElement('div', { className: 'sp-kbd-help__list' });

    for (const entry of SHORTCUTS) {
      const row = createElement('div', { className: 'sp-kbd-help__row' });
      const keys = createElement('span', { className: 'sp-kbd-help__keys' });
      keys.textContent = entry.keys;
      const action = createElement('span', { className: 'sp-kbd-help__action' });
      action.textContent = entry.action;
      row.appendChild(keys);
      row.appendChild(action);
      list.appendChild(row);
    }

    this.body.appendChild(list);

    const notes = SHORTCUTS.filter((entry) => entry.note);
    if (notes.length === 0) return;

    const noteList = createElement('div', { className: 'sp-kbd-help__notes' });
    for (const entry of notes) {
      const note = createElement('p', { className: 'sp-kbd-help__note' });
      note.textContent = `${entry.keys}: ${entry.note}`;
      noteList.appendChild(note);
    }
    this.body.appendChild(noteList);
  }

  /**
   * Open the dialog.
   *
   * A no-op while already open: a held or repeated `?` must not toggle the
   * dialog closed again, and opening never moves focus out of another modal
   * (a clip title editor, a host dialog) that currently owns it. A modal that
   * contains the player itself does not count as foreign.
   *
   * @param invoker - Element to hand focus back to on close; defaults to
   *   whatever holds focus now. Falls back to the player container.
   * @returns True when the dialog is open after the call
   */
  open(invoker?: HTMLElement | null): boolean {
    if (this.opened) return true;

    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      const foreignModal = active.closest('[role="dialog"], [aria-modal="true"]');
      if (foreignModal && !this.el.contains(foreignModal) && !foreignModal.contains(this.api.container)) {
        // Focus belongs to another modal; opening here would steal it.
        // A host modal that wraps the entire player is not foreign.
        return false;
      }
    }

    this.opened = true;
    this.invoker =
      invoker instanceof HTMLElement && this.api.container.contains(invoker)
        ? invoker
        : this.api.container;

    this.api.container.appendChild(this.el);
    document.addEventListener('keydown', this.keyHandler);
    this.closeBtn.focus();

    return true;
  }

  /**
   * Close the dialog and hand focus back.
   *
   * The invoking element gets focus again when it is still in the document
   * and accepts it; when it is gone (a rebuild took the control, the source
   * changed) or hidden (it sat in a popover that closed, so the browser
   * refuses focus) focus lands on the player container, which is the player's
   * own tab stop. Without that, focus would drop to `<body>` and every
   * player shortcut would stop working.
   *
   * @param restoreFocus - False skips focus handoff entirely (used by
   *   `destroy`, where the host is tearing the player down)
   */
  close(restoreFocus = true): void {
    if (!this.opened) return;
    this.opened = false;

    document.removeEventListener('keydown', this.keyHandler);
    this.el.remove();

    const invoker = this.invoker;
    this.invoker = null;
    if (!restoreFocus) return;

    const target = invoker?.isConnected ? invoker : this.api.container;
    if (target.isConnected) {
      target.focus();
      if (document.activeElement !== target && this.api.container.isConnected) {
        this.api.container.focus();
      }
    }
  }

  /**
   * @returns True while the dialog is open and owns its keys
   */
  isOpen(): boolean {
    return this.opened;
  }

  /**
   * Keep Tab inside the dialog, wrapping from either end.
   *
   * @param shiftKey - True for Shift+Tab, which wraps to the last focusable
   */
  private trapTab(shiftKey: boolean): void {
    const focusables = Array.from(
      this.el.querySelectorAll<HTMLElement>('button, [href], [tabindex]')
    ).filter((el) => !(el instanceof HTMLButtonElement && el.disabled));

    if (focusables.length === 0) return;

    const current = focusables.indexOf(document.activeElement as HTMLElement);
    const next = shiftKey
      ? focusables[(current <= 0 ? focusables.length : current) - 1]
      : focusables[(current + 1) % focusables.length];

    next.focus();
  }

  /**
   * Remove the dialog and its listeners.
   *
   * Closes first when open but leaves focus alone: the host is tearing the
   * player down, so handing focus to its container would only strand it.
   */
  destroy(): void {
    this.close(false);
    this.closeBtn.removeEventListener('click', this.closeHandler);
  }
}
