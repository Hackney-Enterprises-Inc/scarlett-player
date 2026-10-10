/**
 * Captions Button Control
 *
 * Toggles text tracks (subtitles/captions) on and off: with a track active it
 * turns captions off; with none active it enables the first available track.
 * Shows a visual indicator when captions are active.
 *
 * The toggle itself lives in {@link toggleCaptions} so the player-wide `C`
 * shortcut and this button cannot drift apart.
 */

import type { IPluginAPI, TextTrack } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, setHTML, setAttr } from '../utils';

/**
 * Toggle captions the one way the player defines it.
 *
 * No tracks means no action at all. With a track active it emits
 * `track:text` with `trackId: null` (off); with none active it emits the
 * first available track's id. Shared by the bar button and the `C` shortcut,
 * so the two always match.
 *
 * @param api - Player state and event bus
 * @returns True when a toggle was emitted, false when there was nothing to do
 */
export function toggleCaptions(api: IPluginAPI): boolean {
  const textTracks: TextTrack[] = api.getState('textTracks') || [];
  const currentTrack: TextTrack | null = api.getState('currentTextTrack');

  if (textTracks.length === 0) return false;

  if (currentTrack) {
    api.emit('track:text', { trackId: null });
  } else {
    api.emit('track:text', { trackId: textTracks[0].id });
  }

  return true;
}

export class CaptionsButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;

  private clickHandler = (): void => {
    this.toggle();
  };

  constructor(api: IPluginAPI) {
    this.api = api;
    this.el = createButton('sp-captions', 'Captions', icons.captionsOff);
    this.el.addEventListener('click', this.clickHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const textTracks: TextTrack[] = this.api.getState('textTracks') || [];
    const currentTrack: TextTrack | null = this.api.getState('currentTextTrack');

    // Hide button if no text tracks available
    if (textTracks.length === 0) {
      this.el.style.display = 'none';
      return;
    }

    this.el.style.display = '';

    if (currentTrack) {
      setHTML(this.el, icons.captions);
      setAttr(this.el, 'aria-label', `Captions: ${currentTrack.label}`);
      this.el.classList.add('sp-captions--active');
    } else {
      setHTML(this.el, icons.captionsOff);
      setAttr(this.el, 'aria-label', 'Captions');
      this.el.classList.remove('sp-captions--active');
    }
  }

  private toggle(): void {
    toggleCaptions(this.api);
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
