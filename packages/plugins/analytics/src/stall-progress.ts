/** Sample twice a second: finer than a segment boundary without a busy playback loop. */
export const PROGRESS_SAMPLE_MS = 500;
/** Two seconds tolerates a segment-boundary hiccup but catches stalls before provider recovery. */
export const PROGRESS_STALL_MS = 2000;

/** Injected readers and callbacks; the caller owns visibility/lifecycle gating and timers. */
export interface StallProgressOptions {
  /** Read the clock. @returns Clock time in milliseconds. */
  now(): number;
  /** Read media progress. @returns Element position in seconds, or null when unavailable. */
  position(): number | null;
  /** Report a confirmed freeze. @param lastAdvanceAt - Clock time of the last sampled advance. */
  onStall(lastAdvanceAt: number): void;
  /** An advance ending a previously confirmed freeze. */
  onResume(): void;
  /** Baseline or advance: snapshot playback credit at this clock time. */
  onProgress?(): void;
}

/**
 * Detect a freeze from monotonically advancing media position, once per episode.
 * Reset on lifecycle gates so paused, seeking or hidden time never counts as a freeze.
 * @param options - Injected clock, position reader and episode callbacks
 * @returns Sample, reset and holding methods; no timers are created by the detector
 */
export function createStallProgress(options: StallProgressOptions): {
  sample(): void;
  reset(open?: boolean): void;
  holding(): boolean;
} {
  let position: number | null = null;
  let lastAdvanceAt = 0;
  let stalled = false;
  /**
   * Clear the baseline without emitting callbacks.
   * @param open - Keep an existing episode open across suspended sampling
   */
  function reset(open = false): void { position = null; lastAdvanceAt = 0; stalled = open; }
  /** Read one sample; invalid/backward positions establish a fresh baseline. */
  function sample(): void {
    const current = options.position();
    if (current === null || !Number.isFinite(current)) { reset(stalled); return; }
    const now = options.now();
    if (position === null || current !== position) {
      // A backwards jump is a discontinuity, never evidence of resumed playback.
      if (stalled && position !== null && current > position) {
        options.onResume();
        stalled = false;
      }
      position = current;
      lastAdvanceAt = now;
      if (!stalled) options.onProgress?.();
      return;
    }
    if (!stalled && now - lastAdvanceAt >= PROGRESS_STALL_MS) {
      stalled = true;
      options.onStall(lastAdvanceAt);
    }
  }
  /**
   * Whether the position still reads what it did at the last sampled
   * advance: a freeze in progress that is not yet confirmed.
   * @returns True while a baseline exists, no episode is open and the position has not moved
   */
  function holding(): boolean {
    if (position === null || stalled) return false;
    return options.position() === position;
  }
  return { sample, reset, holding };
}
