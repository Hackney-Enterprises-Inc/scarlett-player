/**
 * Preview loop controller.
 *
 * While the clip selector is open, playback keeps running and loops over the
 * selection: on `playback:timeupdate`, once `currentTime >= selection.end`
 * the playhead is sent back to `selection.start`. `timeupdate` fires around
 * 4Hz, so the loop can overshoot the out point by up to ~250ms - accepted
 * and documented in the plan. `playback:ended` (out point pinned at
 * duration) also rewinds to the start.
 *
 * The controller is pure logic over `IPluginAPI` events; the only media
 * access is `seekClamped()` from ./media. It owns its own subscriptions
 * (created on `start()`, released on `stop()`) so `stop()` fully unsubscribes
 * even if the surrounding session ends on an unusual path.
 *
 * `suspend()`/`resume()` exist for handle drags (plan task 3.5): while a drag
 * owns the seek, the loop must not fight it.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { seekClamped } from './media';
import type { ClipSelection } from './range';

/** Public surface of the loop controller. */
export interface PreviewLoop {
  /**
   * Begin (or retarget) looping a selection. Called again while running, it
   * updates the loop target without resubscribing, and clears suspension.
   * A no-op when the loop was disabled with `enabled: false`.
   *
   * @param selection - The selection to loop
   */
  start(selection: ClipSelection): void;
  /** Stop looping and release the playback-event subscriptions. Idempotent. */
  stop(): void;
  /** Pause the loop while a drag owns the seek. Subscriptions stay attached. */
  suspend(): void;
  /** Resume looping after a drag ends. */
  resume(): void;
}

/** Options for {@link createPreviewLoop}. */
export interface PreviewLoopOptions {
  /**
   * When false, the loop never starts: no subscriptions, no seeks.
   * The plugin passes `config.loopPreview !== false`.
   * @defaultValue true
   */
  enabled?: boolean;
}

/**
 * Create a preview-loop controller bound to one player.
 *
 * @param api - The plugin API to subscribe to
 * @param options - Loop options (see {@link PreviewLoopOptions})
 * @returns The loop controller
 */
export function createPreviewLoop(api: IPluginAPI, options: PreviewLoopOptions = {}): PreviewLoop {
  const enabled = options.enabled !== false;

  let selection: ClipSelection | null = null;
  let suspended = false;
  let disposers: Array<() => void> = [];

  const rewind = (): void => {
    if (selection) seekClamped(api, selection.start);
  };

  const onTimeUpdate = (payload: { currentTime: number }): void => {
    if (!selection || suspended) return;
    if (payload.currentTime >= selection.end) rewind();
  };

  const onEnded = (): void => {
    if (!selection || suspended) return;
    rewind();
  };

  return {
    start(next: ClipSelection): void {
      if (!enabled) return;
      selection = { start: next.start, end: next.end };
      suspended = false;
      if (disposers.length > 0) return; // already running: retarget only
      disposers = [api.on('playback:timeupdate', onTimeUpdate), api.on('playback:ended', onEnded)];
    },

    stop(): void {
      for (const off of disposers) off();
      disposers = [];
      selection = null;
      suspended = false;
    },

    suspend(): void {
      suspended = true;
    },

    resume(): void {
      suspended = false;
    },
  };
}
