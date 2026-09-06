/**
 * Fullscreen Button Control
 *
 * Toggles fullscreen mode through the core helpers, so the button, the `f`
 * keyboard shortcut and a host calling `player.requestFullscreen()` all behave
 * identically, iPhone fallback included.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { enterFullscreen, exitFullscreen, isFullscreen } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, setHTML, setAttr } from '../utils';

export class FullscreenButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;

  private clickHandler = (): void => {
    this.toggle();
  };

  constructor(api: IPluginAPI) {
    this.api = api;
    this.el = createButton('sp-fullscreen', 'Fullscreen', icons.fullscreen);
    this.el.addEventListener('click', this.clickHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const fullscreen = this.api.getState('fullscreen');

    if (fullscreen) {
      setHTML(this.el, icons.exitFullscreen);
      setAttr(this.el, 'aria-label', 'Exit fullscreen');
    } else {
      setHTML(this.el, icons.fullscreen);
      setAttr(this.el, 'aria-label', 'Fullscreen');
    }
  }

  /**
   * Enter or leave fullscreen.
   *
   * The direction comes from the browser rather than from the `fullscreen`
   * state key: state is a report of what happened, and a stale one would invert
   * the button. Rejections are swallowed because the browser refuses these
   * routinely (no user gesture, denied by permission policy) and an unhandled
   * rejection helps nobody.
   */
  private async toggle(): Promise<void> {
    const container = this.api.container;

    try {
      if (isFullscreen(container)) {
        await exitFullscreen(container);
      } else {
        await enterFullscreen(container);
      }
    } catch {
      // Fullscreen may not be available
    }
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
