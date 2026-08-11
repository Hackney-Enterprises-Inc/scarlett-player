/**
 * Control-bar share button.
 *
 * Registered under the `share` slot; a host opts in by listing it in
 * `uiPlugin({ controls: [...] })`.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { icons } from './targets';
import { sanitizeIcon } from './sanitize';

/** Matches the Control interface in @scarlett-player/ui without importing it. */
export interface ShareControl {
  render(): HTMLElement;
  update(): void;
  destroy(): void;
}

/** Appearance overrides for {@link ShareButton}. */
export interface ShareButtonOptions {
  /**
   * Inline SVG for the button. Defaults to the universal three-node glyph.
   *
   * Sanitised before it is inserted: anything that is not an SVG drawing
   * element, every `on*` handler and every script URL is stripped, and markup
   * containing no `<svg>` at all falls back to the default icon.
   */
  icon?: string;
  /** Accessible label. Defaults to 'Share'. */
  label?: string;
}

export class ShareButton implements ShareControl {
  private el: HTMLButtonElement;

  private readonly clickHandler = (): void => {
    this.onActivate();
  };

  constructor(
    _api: IPluginAPI,
    private onActivate: () => void,
    options: ShareButtonOptions = {},
  ) {
    const label = options.label ?? 'Share';

    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'sp-share sp-control';
    this.el.setAttribute('aria-label', label);
    this.el.setAttribute('title', label);
    this.el.setAttribute('aria-haspopup', 'dialog');
    // Falls back rather than rendering nothing when an override is unusable: a
    // button with no glyph reads as a broken player, not as a rejected config.
    const icon = options.icon ? sanitizeIcon(options.icon) : null;
    this.el.innerHTML = icon ?? icons.share ?? '';
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
