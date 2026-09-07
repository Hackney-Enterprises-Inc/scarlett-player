/**
 * Scarlett Player - Custom Signals (~2KB)
 *
 * Lightweight reactive state management with automatic dependency tracking.
 */

export { Signal, signal } from './signal';
export { Computed, computed } from './computed';
export {
  effect,
  currentEffect,
  setCurrentEffect,
  getCurrentEffect,
  pushEffect,
  popEffect,
  trackEffectSubscription,
  type UnsubscribeFn,
} from './effect';
