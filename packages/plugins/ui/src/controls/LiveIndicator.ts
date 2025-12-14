/**
 * Live Indicator Control
 *
 * Shows red dot + LIVE text.
 * Click to seek to live edge.
 * Dims when behind live edge.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { createElement, getVideo } from '../utils';

export class LiveIndicator implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;

  constructor(api: IPluginAPI) {
    this.api = api;

    this.el = createElement('div', { className: 'sp-live' });
    this.el.innerHTML = '<div class="sp-live__dot"></div><span>LIVE</span>';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('aria-label', 'Seek to live');
    this.el.setAttribute('tabindex', '0');

    this.el.onclick = () => this.seekToLive();
    this.el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.seekToLive();
      }
    };
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const live = this.api.getState('live');
    const liveEdge = this.api.getState('liveEdge');

    // Hide if not live content
    this.el.style.display = live ? '' : 'none';

    // Dim when behind live edge
    if (liveEdge) {
      this.el.classList.remove('sp-live--behind');
    } else {
      this.el.classList.add('sp-live--behind');
    }
  }

  private seekToLive(): void {
    const video = getVideo(this.api.container);
    if (!video) return;

    const seekableRange = this.api.getState('seekableRange');
    if (seekableRange) {
      video.currentTime = seekableRange.end;
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
