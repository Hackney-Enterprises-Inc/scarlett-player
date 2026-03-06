/**
 * Bandwidth Indicator Control
 *
 * Shows a subtle icon when the viewer's bandwidth cannot support
 * the highest available quality in the stream.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { createElement } from '../utils';

// Simple WiFi-warning SVG icon (16x16)
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"/></svg>`;

export class BandwidthIndicator implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;

  constructor(api: IPluginAPI) {
    this.api = api;

    this.el = createElement('div', { className: 'sp-bandwidth-indicator' });
    this.el.innerHTML = ICON_SVG;
    this.el.setAttribute('aria-label', 'Bandwidth is limiting video quality');
    this.el.setAttribute('title', 'Bandwidth is limiting video quality');
    this.el.style.display = 'none';
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const bandwidth = this.api.getState('bandwidth') as number;
    const qualities = this.api.getState('qualities') as Array<{ bitrate: number }> | undefined;

    if (!bandwidth || !qualities || qualities.length === 0) {
      this.el.style.display = 'none';
      return;
    }

    const highestBitrate = Math.max(...qualities.map((q) => q.bitrate));

    if (highestBitrate > 0 && bandwidth < highestBitrate) {
      this.el.style.display = '';
    } else {
      this.el.style.display = 'none';
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
