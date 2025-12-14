/**
 * Computed - Derived reactive values for Scarlett Player.
 *
 * Computed values are lazy-evaluated and cached until dependencies change.
 *
 * Target size: ~400 bytes minified
 */

import { currentEffect, setCurrentEffect, getCurrentEffect, type UnsubscribeFn } from './effect';

/**
 * A computed signal that derives its value from other signals.
 *
 * The computation is lazy (only runs when accessed) and cached
 * until dependencies change.
 *
 * @template T - The type of computed value
 *
 * @example
 * ```ts
 * const count = signal(0);
 * const doubled = new Computed(() => count.get() * 2);
 *
 * doubled.get(); // 0
 * count.set(5);
 * doubled.get(); // 10
 * ```
 */
export class Computed<T> {
  private value: T | undefined;
  private dirty = true;
  private subscribers = new Set<() => void>();
  private computation: () => T;
  private dependencies = new Set<UnsubscribeFn>();
  private invalidateCallback: () => void;

  constructor(computation: () => T) {
    this.computation = computation;
    // Create invalidate callback once to avoid creating new functions
    this.invalidateCallback = () => this.invalidate();
  }

  /**
   * Get the computed value, tracking dependency if in effect context.
   *
   * Recomputes if dirty, otherwise returns cached value.
   *
   * @returns Computed value
   */
  get(): T {
    if (this.dirty) {
      // Run computation with this computed as the current effect
      const prevEffect = getCurrentEffect();
      setCurrentEffect(this.invalidateCallback);

      try {
        this.value = this.computation();
        this.dirty = false;
      } finally {
        setCurrentEffect(prevEffect);
      }
    }

    // Track dependency if in effect context
    if (currentEffect) {
      this.subscribers.add(currentEffect);
    }

    return this.value!;
  }

  /**
   * Mark the computed value as dirty (needs recomputation).
   *
   * Called when a dependency changes.
   * @internal
   */
  invalidate(): void {
    const wasDirty = this.dirty;
    this.dirty = true;

    // Always notify subscribers when invalidated, even if already dirty
    // This ensures subscribers know when dependencies have changed
    if (!wasDirty || this.subscribers.size > 0) {
      this.notifySubscribers();
    }
  }

  /**
   * Subscribe to computed value changes.
   *
   * @param callback - Function to call when computed value may have changed
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): UnsubscribeFn {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify subscribers that this computed value needs recomputation.
   * @internal
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(subscriber => {
      try {
        subscriber();
      } catch (error) {
        console.error('[Scarlett Player] Error in computed subscriber:', error);
      }
    });
  }

  /**
   * Clean up all subscriptions.
   */
  destroy(): void {
    this.dependencies.forEach(unsub => unsub());
    this.dependencies.clear();
    this.subscribers.clear();
    this.value = undefined;
    this.dirty = true;
  }

  /**
   * Get the current number of subscribers (for debugging).
   * @internal
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

/**
 * Helper function to create a computed signal.
 *
 * @param computation - Function that computes the derived value
 * @returns New computed instance
 *
 * @example
 * ```ts
 * const playing = signal(false);
 * const paused = computed(() => !playing.get());
 * ```
 */
export function computed<T>(computation: () => T): Computed<T> {
  return new Computed(computation);
}
