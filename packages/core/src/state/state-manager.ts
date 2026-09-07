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
  CoreStateStore,
  StateUpdate,
  StateChangeEvent,
} from '../types/state';

/**
 * Default initial values for every core state property.
 *
 * Typed against CoreStateStore rather than the open StateStore so a plugin
 * augmenting the latter cannot break this object's exhaustiveness check.
 */
const DEFAULT_STATE: CoreStateStore = {
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

  // Thumbnail Preview
  thumbnails: null,

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

  /** Initial values for keys registered via define(), for reset support */
  private definedDefaults = new Map<StateKey, unknown>();

  /**
   * Last value seen for each key, so a change event can report what the value
   * was before it changed. Tracked here rather than in set() because a signal
   * can also be written directly through get(key).set(value).
   */
  private lastValues = new Map<StateKey, unknown>();

  /**
   * Set by destroy(). Kept so a read after teardown reports a lifecycle
   * problem instead of masquerading as an unknown-key typo.
   */
  private destroyed = false;

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
      this.createSignal(key as StateKey, value);
    }
  }

  /**
   * Create and register a signal, wired to the global change subscribers.
   *
   * Shared by initializeSignals() and define() so a plugin-defined key behaves
   * exactly like a built-in one and the two paths cannot drift apart.
   *
   * @private
   */
  private createSignal(key: StateKey, value: unknown): void {
    const stateSignal = signal(value);
    this.lastValues.set(key, value);

    // Subscribe to each signal to emit global change events
    stateSignal.subscribe(() => {
      this.notifyChangeSubscribers(key);
    });

    this.signals.set(key, stateSignal);
  }

  /**
   * Register a state key at runtime, for state a plugin owns.
   *
   * Core cannot know every plugin's keys, and {@link get} deliberately throws
   * for unregistered ones - that throw is a useful typo-catcher and is worth
   * keeping - so a plugin declares its keys before first use.
   *
   * Idempotent by design: re-defining an existing key leaves the current value
   * untouched. Plugins commonly re-run setup after a source change, and that
   * must not reset state that is already live.
   *
   * Namespace plugin keys with the plugin's own name to avoid collisions. A
   * redefinition with a *different* default is a collision rather than a
   * re-run, so it warns: the first definition still wins, but silently
   * diverging state was previously impossible to diagnose.
   *
   * @param key - State property key
   * @param initialValue - Value used only when the key is new
   *
   * @example
   * ```ts
   * state.define('clipSelection', null);
   * ```
   */
  define<K extends StateKey>(key: K, initialValue: StateValue<K>): void {
    if (this.signals.has(key)) {
      // Membership, not a truthy value: a key defined with an explicit
      // `undefined` default is still defined, and a second plugin claiming it
      // with a real default is still a collision. Core keys never reach
      // definedDefaults, so theirs comes from DEFAULT_STATE instead - without
      // that, redefining `volume` or `muted` passed unnoticed.
      const isPluginKey = this.definedDefaults.has(key);
      const isCoreKey = key in DEFAULT_STATE;
      const existing = isPluginKey
        ? this.definedDefaults.get(key)
        : (DEFAULT_STATE as unknown as Record<string, unknown>)[key as string];

      // A re-run of the same plugin's setup passes the same default and stays
      // quiet; two plugins claiming one key with different defaults do not.
      if ((isPluginKey || isCoreKey) && !Object.is(existing, initialValue)) {
        // The values go to console.warn as arguments rather than through
        // JSON.stringify: a circular default or a BigInt would throw out of
        // the diagnostic and turn a warning into a broken define().
        console.warn(
          `[StateManager] State key "${String(key)}" is already defined with a ` +
            `different default. Keeping:`,
          existing,
          'ignoring:',
          initialValue
        );
      }
      return;
    }

    // Remembered so reset() and resetKey() work on plugin state too - they read
    // DEFAULT_STATE, which by definition has no entry for a plugin's key.
    this.definedDefaults.set(key, initialValue);
    this.createSignal(key, initialValue);
  }

  /**
   * Get the signal for a state property.
   *
   * @param key - State property key
   * @returns Signal for the property
   * @throws If the manager has been destroyed, or the key was never registered
   *
   * @example
   * ```ts
   * const playingSignal = state.get('playing');
   * playingSignal.get(); // false
   * playingSignal.set(true);
   * ```
   */
  get<K extends StateKey>(key: K): Signal<StateValue<K>> {
    // destroy() clears the signals map, so without this branch EVERY key -
    // including perfectly registered ones - fails with the unknown-key
    // message and a lifecycle bug reads as a typo. Consumers hit this when
    // an async continuation (a load, an overlay retry) outlives destroy().
    if (this.destroyed) {
      throw new Error(`[StateManager] Manager is destroyed (reading '${key}')`);
    }

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
   * @throws If the manager has been destroyed, or the key was never registered
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
    const previousValue = this.lastValues.get(key) as StateValue<K>;

    // Record before dispatching: a subscriber may write more state, and the
    // nested change event for this key must see the value we just published.
    this.lastValues.set(key, value);

    const event: StateChangeEvent<K> = {
      key,
      value,
      previousValue,
    };

    // Snapshot before dispatch: a subscriber that unsubscribes and resubscribes
    // while handling the event would otherwise be re-added mid-iteration, and a
    // Set's forEach visits entries added during iteration - so it would be
    // notified twice for one change. Same reason Signal.notify() snapshots.
    Array.from(this.changeSubscribers).forEach(subscriber => {
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
    this.update({
      ...DEFAULT_STATE,
      ...Object.fromEntries(this.definedDefaults),
    } as StateUpdate);
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
    // Plugin-defined keys have no entry in DEFAULT_STATE; their default is the
    // initial value handed to define(). Without this fallback, resetting one
    // would quietly write undefined.
    const defaultValue = (
      key in DEFAULT_STATE
        ? (DEFAULT_STATE as unknown as Record<string, unknown>)[key as string]
        : this.definedDefaults.get(key)
    ) as StateValue<K>;

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
   * After this, every read or write ({@link get}, {@link getValue},
   * {@link set}) throws a destroyed-specific error. Returning last-known
   * values instead was considered and rejected: it silently masks the
   * lifecycle bugs this throw exposes.
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
    this.lastValues.clear();

    this.destroyed = true;
  }
}
