/**
 * Big Play Button
 *
 * The centred play affordance shown over the poster before playback starts,
 * and again as Replay once it has ended.
 *
 * It exists because a poster with no visible play affordance is worse for the
 * viewer than no poster at all: before this control, a mouse click on the
 * picture only revealed the control bar (touch taps belong to the gestures
 * plugin), so the only way to start a video was the small button in the bar.
 * Video.js, the player this one replaces on the watch page, has always had
 * one, so parity matters for the switch.
 *
 * Rendered into the container like the error overlay rather than into a
 * control-bar slot, because it is an overlay over the picture, not a control
 * in the bar.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { getVideo, setHTML, setAttr } from '../utils';

export class BigPlayButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;
  /** Whether an error overlay is currently on screen, asked of its owner. */
  private isOverlayVisible: () => boolean;
  /**
   * Latched on the first `playing`.
   *
   * "Hidden from the first playing onward" cannot be read off `currentTime`
   * alone: a viewer who pauses in the first fraction of a second is still
   * mid-playback, and the button reappearing over live video would cover the
   * picture.
   */
  private hasStarted = false;

  private clickHandler = (): void => {
    this.start();
  };

  /**
   * @param api - Plugin API for state and container access
   * @param isOverlayVisible - Whether the error overlay is showing; the button
   *   must not sit on top of it, and `error` state alone does not say (a
   *   dismissed overlay leaves the error behind)
   */
  constructor(api: IPluginAPI, isOverlayVisible: () => boolean = () => false) {
    this.api = api;
    this.isOverlayVisible = isOverlayVisible;

    const btn = document.createElement('button');
    btn.className = 'sp-big-play';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Play');
    setHTML(btn, icons.play);
    btn.addEventListener('click', this.clickHandler);

    this.el = btn;
  }

  render(): HTMLElement {
    return this.el;
  }

  /**
   * Show or hide the button, and swap in the replay glyph after `ended`.
   *
   * Driven by the same `scheduleUpdate()` pass as every other control, so the
   * button cannot disagree with the control bar about what state playback is
   * in.
   */
  update(): void {
    const playing = this.api.getState('playing');
    const ended = this.hasEnded();
    const currentTime = this.api.getState('currentTime');
    const playbackState = this.api.getState('playbackState');
    const error = this.api.getState('error');

    if (playing) {
      this.hasStarted = true;
    }

    let visible: boolean;

    if (error || this.isOverlayVisible()) {
      // The overlay owns the picture while it is up, and its Try Again is the
      // action the viewer needs, not a play button that would fail again.
      visible = false;
    } else if (playbackState === 'loading') {
      // The spinner owns this state; two things fighting over the middle of
      // the picture reads as a glitch.
      visible = false;
    } else if (playing) {
      visible = false;
    } else if (ended) {
      visible = true;
    } else if (this.hasStarted || currentTime !== 0) {
      visible = false;
    } else {
      visible = playbackState === 'idle' || playbackState === 'ready';
    }

    // Written conditionally: an unconditional innerHTML assignment would
    // rebuild the icon on every state change and swallow in-flight clicks.
    setHTML(this.el, ended ? icons.replay : icons.play);
    setAttr(this.el, 'aria-label', ended ? 'Replay' : 'Play');
    this.el.classList.toggle('sp-big-play--visible', visible);
  }

  /**
   * Whether playback has actually ended, asked of the media element.
   *
   * NOT the `ended` state key. Measured in Chrome on 2026-09-02: neither
   * provider clears that key on a replay (only `load()` does), so after a
   * viewer replays a video it stays true for the rest of the session, while
   * `video.ended` correctly goes false the moment the position leaves the
   * end. Trusting the key would leave this button sitting over playing video,
   * and would make a later pause bring it back as Replay. The key is the
   * fallback for the window before a provider has created an element.
   */
  private hasEnded(): boolean {
    const video = getVideo(this.api.container);

    return video ? video.ended : Boolean(this.api.getState('ended'));
  }

  /**
   * Start (or restart) playback.
   *
   * The same two branches as the control bar's play button: restart from zero
   * after the video ended, otherwise just play. There is no pause branch,
   * because this button is never on screen while playback is running. It reads
   * `video.ended` for the same reason `hasEnded()` does.
   */
  private start(): void {
    const video = getVideo(this.api.container);
    if (!video) return;

    if (video.ended) {
      video.currentTime = 0;
    }

    // play() rejections (autoplay policy, AbortError) must never escape as
    // unhandled rejections.
    video.play().catch(() => {});
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
