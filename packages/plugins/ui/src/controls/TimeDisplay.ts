/**
 * Time Display Control
 *
 * Shows current time / duration for VOD.
 *
 * For live streams it shows nothing while the viewer is at the live edge (the
 * LIVE indicator already says so), and `-m:ss` behind live once they have
 * scrubbed back on a DVR stream.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { createElement, formatTime, formatLiveTime } from '../utils';

/**
 * The control bar's time readout.
 *
 * "At the live edge" is the `liveEdge` state key, owned by the provider: the
 * HLS plugin's live metrics (`latency <= targetLatency + tolerance`, on both
 * hls.js and native playback) and the WHEP plugin, which is always at the
 * edge. This control reads that flag rather than applying a threshold of its
 * own, so the readout and the LIVE / GO LIVE indicator can never disagree.
 *
 * Layout: on live content with a seekable range the element keeps a reserved
 * width (`sp-time--live`) whether or not it shows an offset, so scrubbing back
 * and returning to live does not shift the controls after it. Live content with
 * no seekable range (WHEP, or before the first playlist) cannot be scrubbed,
 * so the element is taken out of the bar instead of leaving an empty gap.
 *
 * Accessibility: `aria-live` stays off (a readout that changes four times a
 * second must not be announced), and the element is `aria-hidden` while it is
 * blank so assistive tech does not land on an empty node.
 */
export class TimeDisplay implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;

  /**
   * @param api - Plugin API used to read playback and live state
   */
  constructor(api: IPluginAPI) {
    this.api = api;
    this.el = createElement('div', { className: 'sp-time' });
    this.el.setAttribute('aria-live', 'off');
  }

  /**
   * @returns The readout element
   */
  render(): HTMLElement {
    return this.el;
  }

  /** Re-read player state and redraw the readout. */
  update(): void {
    const live = this.api.getState('live');
    const currentTime = this.api.getState('currentTime') || 0;
    const duration = this.api.getState('duration') || 0;

    if (live) {
      const seekableRange = this.api.getState('seekableRange');
      const atEdge = this.api.getState('liveEdge');

      this.el.classList.toggle('sp-time--live', !!seekableRange);
      this.el.style.display = seekableRange ? '' : 'none';

      // formatLiveTime answers 'LIVE' for a non-positive distance; that word
      // belongs to the LIVE indicator, so it renders as blank here.
      const text =
        seekableRange && !atEdge ? formatLiveTime(seekableRange.end - currentTime) : 'LIVE';
      this.setText(text === 'LIVE' ? '' : text);
    } else {
      this.el.classList.remove('sp-time--live');
      this.el.style.display = '';
      this.setText(`${formatTime(currentTime)} / ${formatTime(duration)}`);
    }
  }

  /**
   * Write the readout, hiding the element from assistive tech while blank.
   *
   * @param text - Readout text; an empty string blanks the control
   */
  private setText(text: string): void {
    if (this.el.textContent !== text) {
      this.el.textContent = text;
    }

    if (text) {
      this.el.removeAttribute('aria-hidden');
    } else {
      this.el.setAttribute('aria-hidden', 'true');
    }
  }

  /** Remove the readout from the DOM. */
  destroy(): void {
    this.el.remove();
  }
}
