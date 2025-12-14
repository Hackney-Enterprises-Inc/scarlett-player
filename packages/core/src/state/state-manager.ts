/**
 * StateManager - Centralized reactive state management for Scarlett Player.
 *
 * Manages all player state using reactive signals. Each state property
 * is a Signal that can be observed for changes.
 *
 * Target size: ~1-2KB (excluding type definitions)
 */

import { signal, type Signal } from './signal';
import type {
  StateStore,
  StateKey,
  StateValue,
  StateUpdate,
  StateChangeEvent,
} from '../types/state';

/**
 * Default initial values for all state properties.
 */
const DEFAULT_STATE: StateStore = {
  // Core Playback State
  playbackState: 'idle',
  playing: false,
  paused: true,
  ended: false,
  buffering: false,
  waiting: false,
  seeking: false,

  // Time & Duration
  currentTime: 0,
  duration: NaN,
  buffered: null,
  bufferedAmount: 0,

  // Media Info
  mediaType: 'unknown',
  source: null,
  title: '',
  poster: '',

  // Volume & Audio
  volume: 1.0,
  muted: false,

  // Playback Controls
  playbackRate: 1.0,
  fullscreen: false,
  pip: false,
  controlsVisible: true,

  // Quality & Tracks
  qualities: [],
  currentQuality: null,
  audioTracks: [],
  currentAudioTrack: null,
  textTracks: [],
  currentTextTrack: null,

  // Live/DVR State (TSP features)
  live: false,
  liveEdge: true,
  seekableRange: null,
  liveLatency: 0,
  lowLatencyMode: false,

  // Chapters (TSP features)
  chapters: [],
  currentChapter: null,

  // Error State
  error: null,

  // Network & Performance
  bandwidth: 0,
  autoplay: false,
  loop: false,

  // Casting State
  airplayAvailable: false,
  airplayActive: false,
  chromecastAvailable: false,
  chromecastActive: false,

  // UI State
  interacting: false,
  hovering: false,
  focused: false,
};

/**
 * StateManager manages all player state using reactive signals.
 *
 * Each state property is a Signal that automatically tracks dependencies
 * and notifies subscribers when changed.
 *
 * @example
 * ```ts
 * const state = new StateManager();
 *
 * // Get a signal
 * const playingSignal = state.get('playing');
 * playingSignal.get(); // false
 *
 * // Set a value
 * state.set('playing', true);
 *
 * // Subscribe to changes
 * state.subscribe((event) => {
 *   console.log(`${event.key} changed to`, event.value);
 * });
 *
 * // Batch updates
 * state.update({
 *   playing: true,
 *   currentTime: 10,
 *   volume: 0.8,
 * });
 * ```
 */
export class StateManager {
  /** Internal map of state signals */
  private signals = new Map<StateKey, Signal<any>>();

  /** Global state change subscribers */
  private changeSubscribers = new Set<(event: StateChangeEvent) => void>();

  /**
   * Create a new StateManager with default initial state.
   *
   * @param initialState - Optional partial initial state (merged with defaults)
   */
  constructor(initialState?: Partial<StateStore>) {
    this.initializeSignals(initialState);
  }

  /**
   * Initialize all state signals with default or provided values.
   * @private
   */
  private initializeSignals(overrides?: Partial<StateStore>): void {
    const initialState = { ...DEFAULT_STATE, ...overrides };

    // Create signals for all state properties
    for (const [key, value] of Object.entries(initialState)) {
      const stateKey = key as StateKey;
      const stateSignal = signal(value);

      // Subscribe to each signal to emit global change events
      stateSignal.subscribe(() => {
        this.notifyChangeSubscribers(stateKey);
      });

      this.signals.set(stateKey, stateSignal);
    }
  }

  /**
   * Get the signal for a state property.
   *
   * @param key - State property key
   * @returns Signal for the property
   *
   * @example
   * ```ts
   * const playingSignal = state.get('playing');
   * playingSignal.get(); // false
   * playingSignal.set(true);
   * ```
   */
  get<K extends StateKey>(key: K): Signal<StateValue<K>> {
    const stateSignal = this.signals.get(key);
    if (!stateSignal) {
      throw new Error(`[StateManager] Unknown state key: ${key}`);
    }
    return stateSignal as Signal<StateValue<K>>;
  }

  /**
   * Get the current value of a state property (convenience method).
   *
   * @param key - State property key
   * @returns Current value
   *
   * @example
   * ```ts
   * state.getValue('playing'); // false
   * ```
   */
  getValue<K extends StateKey>(key: K): StateValue<K> {
    return this.get(key).get();
  }

  /**
   * Set the value of a state property.
   *
   * @param key - State property key
   * @param value - New value
   *
   * @example
   * ```ts
   * state.set('playing', true);
   * state.set('currentTime', 10.5);
   * ```
   */
  set<K extends StateKey>(key: K, value: StateValue<K>): void {
    this.get(key).set(value);
  }

  /**
   * Update multiple state properties at once (batch update).
   *
   * More efficient than calling set() multiple times.
   *
   * @param updates - Partial state object with updates
   *
   * @example
   * ```ts
   * state.update({
   *   playing: true,
   *   currentTime: 0,
   *   volume: 1.0,
   * });
   * ```
   */
  update(updates: StateUpdate): void {
    for (const [key, value] of Object.entries(updates)) {
      const stateKey = key as StateKey;
      if (this.signals.has(stateKey)) {
        this.set(stateKey, value);
      }
    }
  }

  /**
   * Subscribe to changes on a specific state property.
   *
   * @param key - State property key
   * @param callback - Callback function receiving new value
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsub = state.subscribe('playing', (value) => {
   *   console.log('Playing:', value);
   * });
   * ```
   */
  subscribeToKey<K extends StateKey>(
    key: K,
    callback: (value: StateValue<K>) => void
  ): () => void {
    const stateSignal = this.get(key);
    return stateSignal.subscribe(() => {
      callback(stateSignal.get());
    });
  }

  /**
   * Subscribe to all state changes.
   *
   * Receives a StateChangeEvent for every state property change.
   *
   * @param callback - Callback function receiving change events
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsub = state.subscribe((event) => {
   *   console.log(`${event.key} changed:`, event.value);
   * });
   * ```
   */
  subscribe(callback: (event: StateChangeEvent) => void): () => void {
    this.changeSubscribers.add(callback);
    return () => this.changeSubscribers.delete(callback);
  }

  /**
   * Notify all global change subscribers.
   * @private
   */
  private notifyChangeSubscribers<K extends StateKey>(key: K): void {
    const stateSignal = this.get(key);
    const value = stateSignal.get();

    const event: StateChangeEvent<K> = {
      key,
      value,
      previousValue: value, // Note: We don't track previous values in this simple impl
    };

    this.changeSubscribers.forEach(subscriber => {
      try {
        subscriber(event);
      } catch (error) {
        console.error('[StateManager] Error in change subscriber:', error);
      }
    });
  }

  /**
   * Reset all state to default values.
   *
   * @example
   * ```ts
   * state.reset();
   * ```
   */
  reset(): void {
    this.update(DEFAULT_STATE);
  }

  /**
   * Reset a specific state property to its default value.
   *
   * @param key - State property key
   *
   * @example
   * ```ts
   * state.resetKey('playing');
   * ```
   */
  resetKey<K extends StateKey>(key: K): void {
    const defaultValue = DEFAULT_STATE[key] as StateValue<K>;
    this.set(key, defaultValue);
  }

  /**
   * Get a snapshot of all current state values.
   *
   * @returns Frozen snapshot of current state
   *
   * @example
   * ```ts
   * const snapshot = state.snapshot();
   * console.log(snapshot.playing, snapshot.currentTime);
   * ```
   */
  snapshot(): Readonly<StateStore> {
    const snapshot: Partial<StateStore> = {};

    for (const [key, stateSignal] of this.signals) {
      (snapshot as any)[key] = stateSignal.get();
    }

    return Object.freeze(snapshot as StateStore);
  }

  /**
   * Get the number of subscribers for a state property (for debugging).
   *
   * @param key - State property key
   * @returns Number of subscribers
   * @internal
   */
  getSubscriberCount(key: StateKey): number {
    return this.signals.get(key)?.getSubscriberCount() ?? 0;
  }

  /**
   * Destroy the state manager and cleanup all signals.
   *
   * @example
   * ```ts
   * state.destroy();
   * ```
   */
  destroy(): void {
    // Destroy all signals
    this.signals.forEach(stateSignal => stateSignal.destroy());
    this.signals.clear();

    // Clear change subscribers
    this.changeSubscribers.clear();
  }
}
