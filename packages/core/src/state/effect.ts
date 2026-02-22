/**
 * Effect tracking for automatic dependency management in signals.
 *
 * When a signal is accessed within an effect, it automatically
 * subscribes the effect to that signal's updates.
 */

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
 * Set the current effect context (used internally by computed)
 * @internal
 */
export function setCurrentEffect(effect: (() => void) | null): void {
  effectContext.current = effect;
  currentEffect = effect;
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
 * Create a reactive effect that runs when its dependencies change.
 *
 * The effect runs immediately and tracks any signals accessed during execution.
 * When those signals change, the effect re-runs automatically.
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

    // Set as current effect for dependency tracking
    setCurrentEffect(execute);
    try {
      fn();
    } catch (error) {
      console.error('[Scarlett Player] Error in effect:', error);
      throw error;
    } finally {
      // Clear current effect
      setCurrentEffect(null);
    }
  };

  // Run immediately to establish dependencies
  execute();

  // Return cleanup function that removes effect from all signal subscriber sets
  return () => {
    disposed = true;
    const cleanups = effectCleanups.get(execute);
    if (cleanups) {
      cleanups.forEach(unsub => unsub());
      cleanups.clear();
      effectCleanups.delete(execute);
    }
  };
}
