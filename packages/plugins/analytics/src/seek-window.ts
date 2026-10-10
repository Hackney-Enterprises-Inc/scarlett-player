/**
 * Bounded emission of player-requested seek beacons (HEI-SCARLETT-42).
 *
 * Every `playback:seeking` request is a real seek and keeps its raw
 * accounting in the plugin (seekCount, echo reservation, live and rebuffer
 * bookkeeping); what this window bounds is only how many `seeking` beacons
 * those requests may send. The policy is a fixed one-second, per-view,
 * leading-and-trailing window:
 *
 * - The first request sends immediately (leading edge) and opens the window.
 * - Further requests inside the window replace one pending target and send
 *   nothing yet; the target is the scalar resolved at request time, never a
 *   mutable event object.
 * - At the window deadline the pending target sends once (trailing edge),
 *   and that send opens the next window. A window with nothing pending
 *   closes quietly: a single isolated seek never gets a trailing duplicate.
 * - The deadline is processed before a request at that exact instant: a due
 *   pending target flushes once, its send opens the next window, and the new
 *   request becomes pending there. A delayed timer and an event at the
 *   deadline produce the same result, without a double send. There is at
 *   most one timer, armed only while a target is pending, and never a
 *   backlog of catch-up timers.
 * - A clock moving backwards ends the window safely: the held target is
 *   delivered once and the next request starts a fresh window, rather than
 *   freezing suppression for seconds or carrying a negative delay.
 *
 * Requests to 10 at 0 ms, 20 at 500 ms and 30 at 1000 ms therefore emit 10
 * at 0 ms, 20 at 1000 ms and 30 at 2000 ms, and continuous scrubbing sends
 * at most one seeking beacon per second after the first.
 */

/** How the window delivers resolved seek targets, and the fixed interval. */
export interface SeekEmissionWindowOptions {
  /**
   * Window length in ms. The plugin fixes this at one second; it is an
   * internal policy constant, not a configuration switch.
   */
  intervalMs: number;
  /** Send a beacon through the normal transport. */
  emit: (seekTo: number) => void;
  /** Send a beacon through the synchronous unload transport (page unload). */
  emitUnload: (seekTo: number) => void;
  /** Clock, defaults to `Date.now`; injectable for the helper's own tests. */
  now?: () => number;
}

/** The bounded player-seek emission window of one view generation. */
export interface SeekEmissionWindow {
  /**
   * Record a request whose target was resolved to `seekTo` at request time.
   * Sends immediately on a leading edge, otherwise holds the latest target
   * for the window deadline.
   *
   * @param seekTo - The resolved scalar target of the seek request
   */
  request: (seekTo: number) => void;
  /**
   * Deliver the pending target, if any, while keeping the window's cadence
   * (the background-visibility flush). The window then closes quietly at its
   * deadline unless a new request pends.
   *
   * @param unload - Use the synchronous unload transport
   */
  flushPending: (unload: boolean) => void;
  /**
   * Deliver the pending target, if any, and close the window (view
   * finalization). Cancels the timer; nothing owed afterwards.
   *
   * @param unload - Use the synchronous unload transport
   */
  end: (unload: boolean) => void;
  /** Drop the pending target and cancel the timer without sending (new view, destroy). */
  reset: () => void;
}

/**
 * Create the per-view bounded emission window for player-requested seeks.
 *
 * @param options - Emission callbacks and the fixed interval
 * @returns The window: request/flush/end/reset
 */
export function createSeekEmissionWindow(options: SeekEmissionWindowOptions): SeekEmissionWindow {
  const { intervalMs } = options;
  const now = options.now ?? Date.now;
  // Null while no window is open. A window with nothing pending needs no
  // timer: the next request closes it lazily once it finds it expired.
  let windowStart: number | null = null;
  // The latest request-time target inside the window; a scalar copy.
  let pending: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Bumped on every close, so a callback from a discarded window is inert.
  let generation = 0;

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function closeWindow(): void {
    clearTimer();
    windowStart = null;
    generation++;
  }

  /** Send the pending target once, if there is one. */
  function deliverPending(unload: boolean): void {
    if (pending === null) return;
    const seekTo = pending;
    pending = null;
    if (unload) options.emitUnload(seekTo);
    else options.emit(seekTo);
  }

  /** Arm the one timer for the current window's deadline. */
  function armTimer(): void {
    clearTimer();
    if (windowStart === null) return;
    const captured = generation;
    // Never a negative delay, even with a clock that jumped past the deadline.
    const delay = Math.max(0, windowStart + intervalMs - now());
    timer = setTimeout(() => {
      if (captured === generation) onDeadline();
    }, delay);
  }

  /**
   * The trailing edge: deliver the pending target once and let that send
   * open the next window from the nominal deadline, or close a quiet window.
   * Never sends twice for one deadline and never schedules catch-up bursts.
   */
  function onDeadline(): void {
    timer = null;
    if (windowStart === null) return;
    const at = now();
    if (at < windowStart) {
      // The clock moved backwards: deliver and end rather than suppressing.
      deliverPending(false);
      closeWindow();
      return;
    }
    if (at - windowStart < intervalMs) {
      // Fired ahead of the deadline: wait out the rest of the window.
      armTimer();
      return;
    }
    if (pending === null) {
      // A quiet window closes without a beacon.
      closeWindow();
      return;
    }
    deliverPending(false);
    windowStart += intervalMs;
    if (at - windowStart >= intervalMs) {
      // A very late timer: the window the trailing send opened has already
      // passed quietly, so it closes instead of owing catch-up sends.
      closeWindow();
    }
    // No timer while nothing is pending; the next request re-arms.
  }

  return {
    request(seekTo: number): void {
      const at = now();
      if (windowStart !== null) {
        if (at < windowStart) {
          // Backward clock: deliver what is held and start fresh.
          deliverPending(false);
          closeWindow();
        } else if (at - windowStart >= intervalMs) {
          // Process the expired window's deadline before this request.
          if (pending !== null) {
            deliverPending(false);
            windowStart += intervalMs;
            if (at - windowStart >= intervalMs) closeWindow();
          } else {
            closeWindow();
          }
        }
      }

      if (windowStart === null) {
        // Leading edge: immediate, and the window opens without a timer.
        options.emit(seekTo);
        windowStart = at;
      } else {
        // Inside the window: the latest target goes out at the deadline.
        pending = seekTo;
        armTimer();
      }
    },

    flushPending(unload: boolean): void {
      deliverPending(unload);
    },

    end(unload: boolean): void {
      deliverPending(unload);
      closeWindow();
    },

    reset(): void {
      pending = null;
      closeWindow();
    },
  };
}
