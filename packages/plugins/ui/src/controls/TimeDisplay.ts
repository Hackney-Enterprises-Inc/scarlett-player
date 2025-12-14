/**
 * Time Display Control
 *
 * Shows current time / duration for VOD.
 * Shows -mm:ss or LIVE for live streams.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { createElement, formatTime, formatLiveTime } from '../utils';

export class TimeDisplay implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;

  constructor(api: IPluginAPI) {
    this.api = api;
    this.el = createElement('div', { className: 'sp-time' });
    this.el.setAttribute('aria-live', 'off');
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const live = this.api.getState('live');
    const currentTime = this.api.getState('currentTime') || 0;
    const duration = this.api.getState('duration') || 0;

    if (live) {
      // Live mode: show time behind live edge
      const seekableRange = this.api.getState('seekableRange');
      if (seekableRange) {
        const behindLive = seekableRange.end - currentTime;
        this.el.textContent = formatLiveTime(behindLive);
      } else {
        this.el.textContent = formatLiveTime(0);
      }
    } else {
      // VOD mode: show current / duration
      this.el.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
