/**
 * Preview loop controller.
 *
 * While the clip selector is open, playback keeps running and loops over the
 * selection: on `playback:timeupdate`, once `currentTime >= selection.end` the
 * playhead is sent back to `selection.start`. `timeupdate` fires around 4Hz,
 * so the loop can overshoot the out point by up to ~250ms - accepted and
 * documented in the plan. `playback:ended` (out point pinned at duration) also
 * rewinds, but only when playback was actually running: rewinding a video the
 * viewer let run to the end and walked away from is not a preview, it is a
 * player that will not stop.
 *
 * The controller is pure logic over `IPluginAPI` events; the only media access
 * is `seekClamped()` from ./media. It owns its own subscriptions (created on
 * `start()`, released on `stop()`) so `stop()` fully unsubscribes even if the
 * surrounding session ends on an unusual path.
 *
 * ## Suspension is owned, not toggled
 *
 * `retarget()` and `start()` are deliberately different calls, and separating
 * them is the fix for the loop fighting the viewer. Every selection change used
 * to run through `start()`, which cleared suspension as a side effect - so an
 * ordinary scrub past the out point snapped back the instant the range was
 * re-rendered, and a drag that suspended the loop had it silently restored by
 * its own `clip:changed`.
 *
 * - `retarget()` moves the loop's target and **never** touches suspension.
 * - `suspend()` takes ownership away from the loop; it stays suspended until
 *   something explicitly gives it back.
 * - `resume()` gives it back, and is the only call that does.
 * - `start()` arms the loop for a new session: target plus an explicit resume.
 *
 * That is what lets "seeking beyond OUT keeps working" and "releasing a handle
 * returns to the in point" both be true, and what lets a drag that began while
 * the loop was already suspended end still suspended.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import { seekClamped } from './media';
import type { ClipSelection } from './range';

/** Public surface of the loop controller. */
export interface PreviewLoop {
  /**
   * Arm the loop for a selection and hand it ownership of the playhead.
   *
   * Subscribes on the first call, and always clears suspension - this is the
   * "start previewing" call, used when a session opens and when the viewer
   * explicitly asks to preview. A no-op when the loop was disabled with
   * `enabled: false`.
   *
   * @param selection - The selection to loop
   */
  start(selection: ClipSelection): void;
  /**
   * Move the loop's target without changing who owns the playhead.
   *
   * The call every selection change makes. If the loop is suspended it stays
   * suspended; if it is running it simply loops the new range from now on.
   *
   * @param selection - The new selection to loop
   */
  retarget(selection: ClipSelection): void;
  /** Stop looping and release the playback-event subscriptions. Idempotent. */
  stop(): void;
  /**
   * Suspend looping: something else owns the playhead (a handle drag, or the
   * viewer scrubbing past the out point). Subscriptions stay attached.
   */
  suspend(): void;
  /** Resume looping. The only call that clears suspension besides `start()`. */
  resume(): void;
  /**
   * Whether the loop is currently suspended.
   *
   * @returns True while something else owns the playhead
   */
  isSuspended(): boolean;
  /**
   * Whether the loop is armed at all (enabled and given a selection).
   *
   * @returns True when a selection is loaded, whatever the suspension state
   */
  isArmed(): boolean;
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

  /**
   * The media ran to its end with the out point pinned there.
   *
   * Only rewinds when playback was actually running. `ended` also arrives for
   * a viewer who watched to the end and stopped; restarting under them would
   * be the loop taking the player over rather than previewing a selection.
   */
  const onEnded = (): void => {
    if (!selection || suspended) return;
    if (api.getState('paused') === true) return;
    rewind();
  };

  /** Subscribe once; both entry points share the subscription. */
  const ensureSubscribed = (): void => {
    if (disposers.length > 0) return;
    disposers = [api.on('playback:timeupdate', onTimeUpdate), api.on('playback:ended', onEnded)];
  };

  return {
    start(next: ClipSelection): void {
      if (!enabled) return;
      selection = { start: next.start, end: next.end };
      suspended = false;
      ensureSubscribed();
    },

    retarget(next: ClipSelection): void {
      if (!enabled) return;
      selection = { start: next.start, end: next.end };
      ensureSubscribed();
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

    isSuspended(): boolean {
      return suspended;
    },

    isArmed(): boolean {
      return enabled && selection !== null;
    },
  };
}
