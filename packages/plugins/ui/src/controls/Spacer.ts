/**
 * Spacer Control
 *
 * Flex spacer element to push controls apart.
 */

import type { Control } from './Control';
import { createElement } from '../utils';

export class Spacer implements Control {
  private el: HTMLDivElement;

  constructor() {
    this.el = createElement('div', { className: 'sp-spacer' });
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    // No-op - spacer has no state
  }

  destroy(): void {
    this.el.remove();
  }
}
