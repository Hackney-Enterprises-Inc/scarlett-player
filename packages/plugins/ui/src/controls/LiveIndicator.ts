/**
 * Live Indicator Control
 *
 * Shows red dot + LIVE text when at live edge.
 * Shows "GO LIVE" when behind live edge.
 * Click to seek to live edge.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { createElement, getVideo } from '../utils';

export class LiveIndicator implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;
  private dot: HTMLDivElement;
  private label: HTMLSpanElement;

  constructor(api: IPluginAPI) {
    this.api = api;

    this.el = createElement('div', { className: 'sp-live' });
    this.dot = createElement('div', { className: 'sp-live__dot' }) as HTMLDivElement;
    this.label = document.createElement('span');
    this.label.textContent = 'LIVE';
    this.el.appendChild(this.dot);
    this.el.appendChild(this.label);
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('aria-label', 'Seek to live');
    this.el.setAttribute('tabindex', '0');

    this.el.addEventListener('click', this.handleClick);
    this.el.addEventListener('keydown', this.handleKeyDown);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const live = this.api.getState('live');
    const liveEdge = this.api.getState('liveEdge');

    // Hide if not live content
    this.el.style.display = live ? '' : 'none';

    // Update appearance based on live edge state
    if (liveEdge) {
      this.el.classList.remove('sp-live--behind');
      this.label.textContent = 'LIVE';
      this.el.setAttribute('aria-label', 'At live edge');
    } else {
      this.el.classList.add('sp-live--behind');
      this.label.textContent = 'GO LIVE';
      this.el.setAttribute('aria-label', 'Seek to live');
    }
  }

  private handleClick = (): void => {
    this.seekToLive();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.seekToLive();
    }
  };

  private seekToLive(): void {
    const video = getVideo(this.api.container);
    if (!video) return;

    const seekableRange = this.api.getState('seekableRange');
    if (seekableRange) {
      video.currentTime = seekableRange.end;
    }
  }

  destroy(): void {
    this.el.removeEventListener('click', this.handleClick);
    this.el.removeEventListener('keydown', this.handleKeyDown);
    this.el.remove();
  }
}
