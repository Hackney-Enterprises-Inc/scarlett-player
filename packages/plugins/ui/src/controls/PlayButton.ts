/**
 * Play/Pause Button Control
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, getVideo } from '../utils';

export class PlayButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;

  private clickHandler = (): void => {
    this.toggle();
  };

  constructor(api: IPluginAPI) {
    this.api = api;
    this.el = createButton('sp-play', 'Play', icons.play);
    this.el.addEventListener('click', this.clickHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const playing = this.api.getState('playing');
    const ended = this.api.getState('ended');

    let icon: string;
    let label: string;

    if (ended) {
      icon = icons.replay;
      label = 'Replay';
    } else if (playing) {
      icon = icons.pause;
      label = 'Pause';
    } else {
      icon = icons.play;
      label = 'Play';
    }

    this.el.innerHTML = icon;
    this.el.setAttribute('aria-label', label);
  }

  private toggle(): void {
    const video = getVideo(this.api.container);
    if (!video) return;

    const ended = this.api.getState('ended');

    if (ended) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else if (!video.paused) {
      // Check video.paused directly for immediate response
      // (state updates lag behind due to 'playing' event delay)
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
