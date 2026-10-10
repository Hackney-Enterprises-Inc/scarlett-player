/**
 * Keyboard Help Button Control
 *
 * The optional `keyboard-help` bar slot: a visible entry point into the
 * keyboard shortcut dialog for hosts that want one. Not part of the default
 * layout - `?` is the always-available entry point, and the default bar keeps
 * its exact widths.
 */

import type { Control } from './Control';
import { icons } from '../icons';
import { createButton } from '../utils';

/**
 * Bar button that opens the keyboard shortcut dialog when clicked.
 *
 * The plugin creates it only when the global shortcuts are enabled
 * (`keyboard` is not `false`), since the dialog would otherwise list keys
 * that do nothing.
 */
export class KeyboardHelpButton implements Control {
  private el: HTMLButtonElement;

  /**
   * @param onOpen - Opens the keyboard help dialog; the button does not own it
   */
  constructor(onOpen: () => void) {
    this.el = createButton('sp-kbd-help-btn', 'Keyboard shortcuts', icons.keyboardHelp);
    this.el.addEventListener('click', () => onOpen());
  }

  /** @returns The bar button element. */
  render(): HTMLElement {
    return this.el;
  }

  /**
   * No state to read: the dialog is opened on demand and answers for itself
   * what is currently implemented.
   */
  update(): void {
    // No-op.
  }

  /** Remove the button; the dialog is destroyed by the plugin itself. */
  destroy(): void {
    this.el.remove();
  }
}
