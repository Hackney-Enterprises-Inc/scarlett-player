/**
 * Control-bar share button.
 *
 * Registered under the `share` slot; a host opts in by listing it in
 * `uiPlugin({ controls: [...] })`.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { icons } from './targets';

/** Matches the Control interface in @scarlett-player/ui without importing it. */
export interface ShareControl {
  render(): HTMLElement;
  update(): void;
  destroy(): void;
}

export class ShareButton implements ShareControl {
  private el: HTMLButtonElement;

  private readonly clickHandler = (): void => {
    this.onActivate();
  };

  constructor(
    _api: IPluginAPI,
    private onActivate: () => void,
  ) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'sp-share sp-control';
    this.el.setAttribute('aria-label', 'Share');
    this.el.setAttribute('aria-haspopup', 'dialog');
    this.el.innerHTML = icons.native ?? '';
    this.el.addEventListener('click', this.clickHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    // Nothing to reflect: sharing a page URL is valid whatever the player is
    // doing, including before playback starts.
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
