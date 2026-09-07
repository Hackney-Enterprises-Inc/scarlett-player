/**
 * ClipButton - the `'clip'` control-bar button.
 *
 * Registered under the `clip` slot by the plugin (plan "Design > Control");
 * a host opts in by listing `'clip'` in its UI control layout. Clicking it
 * toggles: it opens the selector when closed and closes it when open.
 *
 * The UI package's `Control` contract is matched with the local
 * {@link ClipControl} interface rather than imported (the ShareButton
 * precedent): `@scarlett-player/ui` is an optional peer, and this module must
 * be loadable in a headless build that has no UI package installed.
 *
 * Visibility: {@link ClipButton.update} hides the button when the current
 * media cannot be clipped at all - non-video, live (v1 is VOD-only), an
 * unresolvable `mediaId`, or an unknown duration - with one exception. While
 * the selector is open the button stays **visible** with
 * `aria-expanded="true"`: a hidden button cannot take focus back when the
 * overlay closes, and returning focus there is what the overlay's Escape
 * path relies on. `isMenuOpen()` reports the same state so the control bar
 * holds its auto-hide while the panel is on screen.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { sanitizeIcon } from './sanitize';

/**
 * Matches the `Control` interface in `@scarlett-player/ui` without importing
 * it - the structural contract a registered control must satisfy.
 */
export interface ClipControl {
  render(): HTMLElement;
  update(): void;
  destroy(): void;
  isMenuOpen?(): boolean;
}

/** Default glyph: two in/out bars joined by the shaded selection. */
export const CLIP_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor">' +
  '<path d="M4 4h3v16H4V4zm13 0h3v16h-3V4zM7 11h10v2H7z"/></svg>';

/** Construction options for {@link ClipButton}. */
export interface ClipButtonOptions {
  /**
   * Inline SVG for the button. Sanitised like share's `buttonIcon`; an icon
   * with nothing usable left in it falls back to {@link CLIP_ICON}.
   */
  icon?: string;
  /**
   * Accessible label (also the button's tooltip).
   * @defaultValue 'Create clip'
   */
  label?: string;
  /** Called on click; the plugin opens the selector when closed, closes it when open. */
  onActivate: () => void;
  /** Whether the clip session is currently open (the `clipOpen` state). */
  isOpen: () => boolean;
  /** Whether the current media is clippable (video, VOD, known duration, resolvable `mediaId`). */
  isAvailable: () => boolean;
}

/**
 * Control-bar button implementing the UI package's `Control` contract.
 * Built by the registered factory; the plugin wires its own open/close state
 * and media gate into the {@link ClipButtonOptions} predicates.
 */
export class ClipButton implements ClipControl {
  private readonly el: HTMLButtonElement;
  private readonly options: ClipButtonOptions;

  private readonly clickHandler = (): void => {
    this.options.onActivate();
  };

  /**
   * @param _api - The per-instance plugin API from the control factory; the
   * button reads no player state directly (the options' predicates close over
   * the plugin's own api), so this is kept for the factory signature only
   * @param options - Label, icon and the state predicates wiring (see {@link ClipButtonOptions})
   */
  constructor(_api: IPluginAPI, options: ClipButtonOptions) {
    this.options = options;
    const label = options.label ?? 'Create clip';

    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'sp-clip-control sp-control';
    this.el.setAttribute('aria-label', label);
    this.el.setAttribute('title', label);
    this.el.setAttribute('aria-haspopup', 'dialog');

    // Falls back rather than rendering nothing when an override is unusable:
    // a button with no glyph reads as a broken player, not as a rejected config.
    const icon = options.icon ? sanitizeIcon(options.icon) : null;
    this.el.innerHTML = icon ?? CLIP_ICON;

    this.el.addEventListener('click', this.clickHandler);
    this.update();
  }

  /** The button element; mounted into the control bar by the UI package. */
  render(): HTMLElement {
    return this.el;
  }

  /**
   * Reflect plugin state: hide the button when the media is not clippable
   * unless a session is open (a hidden button cannot receive the focus
   * return from the closing overlay), and mirror the open state in
   * `aria-expanded`.
   */
  update(): void {
    const open = this.options.isOpen();
    const visible = open || this.options.isAvailable();
    this.el.style.display = visible ? '' : 'none';
    this.el.setAttribute('aria-expanded', String(open));
  }

  /**
   * The popover hook of the `Control` contract: true while the clip panel is
   * on screen, which holds the control bar's auto-hide so it cannot vanish
   * under the overlay.
   *
   * @returns Whether the clip selector is open
   */
  isMenuOpen(): boolean {
    return this.options.isOpen();
  }

  /** Detach the click handler and remove the button. Idempotent. */
  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
