/**
 * Overflow Tray Control
 *
 * Holds the controls the bar could not fit, and gives them back when it can.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, createElement } from '../utils';

/**
 * A horizontal strip of the controls that did not fit in the bar.
 *
 * It is a wrapping strip rather than the vertical menu the shape of a "more"
 * button suggests, and that is a size argument. A vertical list of up to eight
 * 44px rows is over 350px tall, and a portrait phone player is 211px at 375px
 * wide (measured 2026-09-05), so the menu would be cut off by the same host
 * `overflow: hidden` that hides the controls in the first place. Two wrapped
 * rows of icon buttons are about 104px. The strip also keeps `overflow:
 * visible`, so the popovers registered controls own (the chapter list opens
 * `bottom: calc(100% + 8px)` inside its own wrapper) open upward out of the
 * tray instead of being clipped by a scroll container.
 *
 * Adopted elements are moved, never re-rendered or wrapped: a `CaptionsButton`
 * in the tray is the same element with the same listeners, so it still emits
 * `track:text`, and its own `update()` keeps running from the plugin's control
 * list.
 */
export class OverflowTray implements Control {
  /** Bar item: the button plus the absolutely positioned strip. */
  private el: HTMLDivElement;

  private btn: HTMLButtonElement;

  private panel: HTMLDivElement;

  private isOpen = false;

  private closeHandler: (e: MouseEvent) => void;

  private keyHandler: (e: KeyboardEvent) => void;

  /**
   * @param api - Plugin API, kept for parity with the other controls and for
   *   logging; the tray itself reads no state
   */
  constructor(private api: IPluginAPI) {
    this.el = createElement('div', { className: 'sp-overflow' });

    this.btn = createButton('sp-overflow__btn', 'More controls', icons.more);
    this.btn.setAttribute('aria-haspopup', 'true');
    this.btn.setAttribute('aria-expanded', 'false');
    this.btn.addEventListener('click', this.toggleHandler);

    this.panel = createElement('div', {
      className: 'sp-overflow-tray',
      role: 'group',
      'aria-label': 'More controls',
    });

    this.el.appendChild(this.btn);
    this.el.appendChild(this.panel);

    // Hidden until something is actually in it: an empty "more" button is a
    // dead affordance, and on a desktop bar that fits, nothing must change.
    this.el.style.display = 'none';

    // Outside click and Escape, the same document listeners SettingsMenu uses.
    // Neither the button nor the panel stops propagation: the container's own
    // interaction handler has to keep seeing these clicks, or the bar would
    // auto-hide under the finger of a viewer working through the tray.
    this.closeHandler = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node)) {
        this.close();
      }
    };
    document.addEventListener('click', this.closeHandler);

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.isOpen || e.key !== 'Escape') return;

      e.preventDefault();
      e.stopPropagation();
      this.close();
      this.btn.focus();
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  private toggleHandler = (): void => {
    this.isOpen ? this.close() : this.open();
  };

  /**
   * The bar item to place in the control bar.
   *
   * @returns The wrapper holding the button and the strip
   */
  render(): HTMLElement {
    return this.el;
  }

  /**
   * No state of its own: the fit loop owns what is inside it.
   */
  update(): void {
    // No-op - contents are driven by fitControls(), not by player state.
  }

  /**
   * Move a control's element into the tray.
   *
   * The element is moved as-is, so its class, icon, aria-label, event handlers
   * and `update()` all keep working.
   *
   * @param el - The control element leaving the bar
   */
  adopt(el: HTMLElement): void {
    this.panel.appendChild(el);
    this.syncVisibility();
  }

  /**
   * Take a control's element back out of the tray.
   *
   * The caller decides where in the bar it goes; this only detaches it and
   * updates the button's visibility.
   *
   * @param el - The control element returning to the bar
   * @returns The same element, detached
   */
  release(el: HTMLElement): HTMLElement {
    if (el.parentNode === this.panel) {
      this.panel.removeChild(el);
    }
    this.syncVisibility();

    return el;
  }

  /**
   * Whether an element is currently held by the tray.
   *
   * @param el - Element to test
   * @returns True when the tray is its parent
   */
  holds(el: HTMLElement): boolean {
    return el.parentNode === this.panel;
  }

  /**
   * Open the strip.
   */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.panel.classList.add('sp-overflow-tray--open');
    this.btn.setAttribute('aria-expanded', 'true');
  }

  /**
   * Close the strip.
   *
   * Deliberately not called after a control inside it is used: skip, PiP and
   * cast are things a viewer taps more than once in a row.
   */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.classList.remove('sp-overflow-tray--open');
    this.btn.setAttribute('aria-expanded', 'false');
  }

  /**
   * Show the button only while the tray holds something the viewer can see.
   *
   * A control that hid itself (no cast device on the network, no text tracks)
   * can be sitting in the tray with `display: none`, and a button that opens an
   * empty strip is worse than no button at all.
   */
  private syncVisibility(): void {
    const usable = Array.from(this.panel.children).some(
      (child) => (child as HTMLElement).style.display !== 'none'
    );

    this.el.style.display = usable ? '' : 'none';

    if (!usable && this.isOpen) {
      this.close();
    }
  }

  /**
   * Re-check the button's visibility after the controls have updated
   * themselves.
   */
  refresh(): void {
    this.syncVisibility();
  }

  /**
   * Remove the document listeners and the tray itself.
   *
   * Adopted elements are left where they are: they belong to their own
   * controls, which are destroyed by the plugin alongside this one.
   */
  destroy(): void {
    document.removeEventListener('click', this.closeHandler);
    document.removeEventListener('keydown', this.keyHandler);
    this.btn.removeEventListener('click', this.toggleHandler);
    this.el.remove();
    this.api.logger.debug('Overflow tray destroyed');
  }
}
