/**
 * Signal - Core reactive primitive for Scarlett Player.
 *
 * Signals are observable values that automatically track dependencies
 * and notify subscribers when the value changes.
 *
 * Target size: ~500 bytes minified
 */

import { currentEffect, type UnsubscribeFn } from './effect';

/**
 * A reactive signal that holds a value and notifies subscribers on changes.
 *
 * @template T - The type of value held by this signal
 *
 * @example
 * ```ts
 * const count = new Signal(0);
 *
 * // Subscribe to changes
 * const unsub = count.subscribe(() => {
 *   console.log('Count changed:', count.get());
 * });
 *
 * count.set(1); // Logs: "Count changed: 1"
 * unsub(); // Stop listening
 * ```
 */
export class Signal<T> {
  private value: T;
  private subscribers = new Set<() => void>();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  /**
   * Get the current value and track dependency if called within an effect.
   *
   * @returns Current value
   */
  get(): T {
    // Track dependency if in effect context
    if (currentEffect) {
      this.subscribers.add(currentEffect);
    }
    return this.value;
  }

  /**
   * Set a new value and notify subscribers if changed.
   *
   * @param newValue - New value to set
   */
  set(newValue: T): void {
    // Skip if value hasn't changed
    if (Object.is(this.value, newValue)) {
      return;
    }

    this.value = newValue;
    this.notify();
  }

  /**
   * Update the value using a function.
   *
   * @param updater - Function that receives current value and returns new value
   *
   * @example
   * ```ts
   * const count = new Signal(0);
   * count.update(n => n + 1); // Increments by 1
   * ```
   */
  update(updater: (current: T) => T): void {
    this.set(updater(this.value));
  }

  /**
   * Subscribe to changes without automatic dependency tracking.
   *
   * @param callback - Function to call when value changes
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): UnsubscribeFn {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of a change.
   * @internal
   */
  private notify(): void {
    this.subscribers.forEach(subscriber => {
      try {
        subscriber();
      } catch (error) {
        console.error('[Scarlett Player] Error in signal subscriber:', error);
      }
    });
  }

  /**
   * Clean up all subscriptions.
   * Call this when destroying the signal.
   */
  destroy(): void {
    this.subscribers.clear();
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
 * Helper function to create a signal.
 *
 * @param initialValue - Initial value for the signal
 * @returns New signal instance
 *
 * @example
 * ```ts
 * const playing = signal(false);
 * playing.set(true);
 * ```
 */
export function signal<T>(initialValue: T): Signal<T> {
  return new Signal(initialValue);
}
