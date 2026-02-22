/**
 * Skip Button Control (Rewind / Forward)
 *
 * Seeks the video backward or forward by a configurable number of seconds.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, getVideo } from '../utils';

export type SkipDirection = 'backward' | 'forward';

const DEFAULT_SKIP_SECONDS = 10;

export class SkipButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;
  private direction: SkipDirection;
  private seconds: number;

  private clickHandler = (): void => {
    this.skip();
  };

  constructor(api: IPluginAPI, direction: SkipDirection, seconds = DEFAULT_SKIP_SECONDS) {
    this.api = api;
    this.direction = direction;
    this.seconds = seconds;

    const icon = direction === 'backward' ? icons.replay10 : icons.forward10;
    const label = direction === 'backward' ? `Rewind ${seconds} seconds` : `Forward ${seconds} seconds`;

    this.el = createButton(
      `sp-skip sp-skip--${direction}`,
      label,
      icon
    );
    this.el.addEventListener('click', this.clickHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const live = this.api.getState('live');
    const duration = this.api.getState('duration') ?? 0;
    const seekableRange = this.api.getState('seekableRange');

    // For live without DVR seekable range, hide skip buttons
    if (live && !seekableRange) {
      this.el.style.display = 'none';
      return;
    }

    // Show both buttons for live DVR (seekableRange exists)
    if (live && seekableRange) {
      this.el.style.display = '';
      return;
    }

    // Hide both if no duration (source not loaded)
    if (duration === 0) {
      this.el.style.display = 'none';
      return;
    }

    this.el.style.display = '';
  }

  private skip(): void {
    const video = getVideo(this.api.container);
    if (!video) return;

    const live = this.api.getState('live');
    const seekableRange = this.api.getState('seekableRange');

    if (live && seekableRange) {
      // Live DVR: constrain to seekable range
      if (this.direction === 'backward') {
        video.currentTime = Math.max(seekableRange.start, video.currentTime - this.seconds);
      } else {
        video.currentTime = Math.min(seekableRange.end, video.currentTime + this.seconds);
      }
      return;
    }

    const duration = video.duration || 0;
    if (!duration || !isFinite(duration)) return;

    if (this.direction === 'backward') {
      video.currentTime = Math.max(0, video.currentTime - this.seconds);
    } else {
      video.currentTime = Math.min(duration, video.currentTime + this.seconds);
    }
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
