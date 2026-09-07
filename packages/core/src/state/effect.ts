/**
 * Effect tracking for automatic dependency management in signals.
 *
 * When a signal is accessed within an effect, it automatically
 * subscribes the effect to that signal's updates.
 */

/**
 * Stack of executing effects.
 *
 * A stack rather than a single slot because effects nest: a computed
 * recomputing inside an effect, or an effect created inside another effect,
 * must restore the enclosing tracking context when it finishes instead of
 * clearing it and silently dropping the outer effect's remaining dependencies.
 * @internal
 */
const effectStack: Array<() => void> = [];

/**
 * Effect context that can be modified
 * @internal
 */
const effectContext = {
  current: null as (() => void) | null,
};

/**
 * Currently executing effect (for dependency tracking)
 * @internal
 */
export let currentEffect: (() => void) | null = null;

/**
 * Sync the exported `currentEffect` binding (and the legacy context object)
 * with the top of the effect stack.
 * @internal
 */
function syncCurrentEffect(): void {
  const top = effectStack.length > 0 ? effectStack[effectStack.length - 1]! : null;
  effectContext.current = top;
  currentEffect = top;
}

/**
 * Push an effect onto the tracking stack.
 *
 * Every push must be paired with a {@link popEffect} in a `finally` block.
 * @internal
 */
export function pushEffect(effectFn: () => void): void {
  effectStack.push(effectFn);
  syncCurrentEffect();
}

/**
 * Pop the innermost effect off the tracking stack, restoring the enclosing one.
 * @internal
 */
export function popEffect(): void {
  effectStack.pop();
  syncCurrentEffect();
}

/**
 * Set the current effect context (used internally by computed).
 *
 * Retained for backwards compatibility with the pre-stack API: passing an
 * effect pushes it, passing `null` pops the innermost one. New code should
 * call {@link pushEffect}/{@link popEffect} directly.
 *
 * @param effect - Effect to push, or `null` to pop the innermost effect
 * @internal
 */
export function setCurrentEffect(effect: (() => void) | null): void {
  if (effect === null) {
    popEffect();
  } else {
    pushEffect(effect);
  }
}

/**
 * Get the current effect context
 * @internal
 */
export function getCurrentEffect(): (() => void) | null {
  return effectContext.current;
}

/**
 * Unsubscribe function returned by effect()
 */
export type UnsubscribeFn = () => void;

/**
 * Map from effect execute functions to their cleanup (unsubscribe from all signals).
 * Signals/Computed call `trackEffectSubscription` when an effect subscribes to them,
 * so the effect can later remove itself from all subscriber sets.
 * @internal
 */
const effectCleanups = new WeakMap<() => void, Set<() => void>>();

/**
 * Register a cleanup function for the current effect.
 * Called by Signal.get() and Computed.get() when they add currentEffect to their subscribers.
 * @internal
 */
export function trackEffectSubscription(effectFn: () => void, unsubscribe: () => void): void {
  let cleanups = effectCleanups.get(effectFn);
  if (!cleanups) {
    cleanups = new Set();
    effectCleanups.set(effectFn, cleanups);
  }
  cleanups.add(unsubscribe);
}

/**
 * Drop every subscription an effect currently holds.
 *
 * Run before each re-execution so dependencies that the effect no longer
 * reads (a branch it stopped taking) stop waking it up.
 * @internal
 */
function clearEffectSubscriptions(effectFn: () => void): void {
  const cleanups = effectCleanups.get(effectFn);
  if (!cleanups) return;

  cleanups.forEach(unsub => unsub());
  cleanups.clear();
}

/**
 * Create a reactive effect that runs when its dependencies change.
 *
 * The effect runs immediately and tracks any signals accessed during execution.
 * When those signals change, the effect re-runs automatically. Dependencies are
 * re-collected on every run, so a signal the effect stops reading stops
 * triggering it.
 *
 * @param fn - Function to run as an effect
 * @returns Unsubscribe function to stop the effect
 *
 * @example
 * ```ts
 * const count = signal(0);
 *
 * effect(() => {
 *   console.log('Count:', count.get());
 * });
 *
 * count.set(1); // Logs: "Count: 1"
 * ```
 */
export function effect(fn: () => void): UnsubscribeFn {
  let disposed = false;

  const execute = () => {
    if (disposed) return;

    // Re-collect dependencies from scratch: anything read on the previous run
    // but not on this one must no longer re-trigger the effect.
    clearEffectSubscriptions(execute);

    // Set as current effect for dependency tracking
    pushEffect(execute);
    try {
      fn();
    } catch (error) {
      console.error('[Scarlett Player] Error in effect:', error);
      throw error;
    } finally {
      // Restore the enclosing effect (or null at the top level)
      popEffect();
    }
  };

  // Run immediately to establish dependencies
  execute();

  // Return cleanup function that removes effect from all signal subscriber sets
  return () => {
    disposed = true;
    clearEffectSubscriptions(execute);
    effectCleanups.delete(execute);
  };
}
