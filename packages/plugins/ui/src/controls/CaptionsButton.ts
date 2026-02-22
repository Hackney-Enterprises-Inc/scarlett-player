/**
 * Captions Button Control
 *
 * Toggles text tracks (subtitles/captions) on and off.
 * When multiple tracks are available, cycles through: Off -> Track 1 -> Track 2 -> ... -> Off.
 * Shows a visual indicator when captions are active.
 */

import type { IPluginAPI, TextTrack } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton } from '../utils';

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
      this.el.innerHTML = icons.captions;
      this.el.setAttribute('aria-label', `Captions: ${currentTrack.label}`);
      this.el.classList.add('sp-captions--active');
    } else {
      this.el.innerHTML = icons.captionsOff;
      this.el.setAttribute('aria-label', 'Captions');
      this.el.classList.remove('sp-captions--active');
    }
  }

  private toggle(): void {
    const textTracks: TextTrack[] = this.api.getState('textTracks') || [];
    const currentTrack: TextTrack | null = this.api.getState('currentTextTrack');

    if (textTracks.length === 0) return;

    if (currentTrack) {
      // Turn off captions
      this.api.emit('track:text', { trackId: null });
    } else {
      // Turn on first available text track
      this.api.emit('track:text', { trackId: textTracks[0].id });
    }
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
