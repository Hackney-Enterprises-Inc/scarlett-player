/**
 * PluginAPI - Scoped API surface for plugins.
 *
 * Wraps StateManager and EventBus to provide a controlled interface
 * for plugins to interact with player state and events.
 *
 * Target size: ~0.5KB
 */

import type { StateManager } from './state/state-manager';
import type { EventBus } from './events/event-bus';
import type { Logger } from './logger';
import type { StateKey, StateValue, StateChangeEvent } from './types/state';
import type { EventName, EventPayload, EventHandler } from './types/events';
import type { IPluginAPI } from './types/plugin';

/**
 * PluginAPI dependencies.
 */
export interface PluginAPIDeps {
  stateManager: StateManager;
  eventBus: EventBus;
  logger: Logger;
  container: HTMLElement;
  getPlugin: <T = unknown>(id: string) => T | null;
  getProviderDiagnostics?: () => Record<string, unknown>;
}

/**
 * PluginAPI provides a scoped interface for plugins to interact with the player.
 *
 * Instead of giving plugins direct access to StateManager and EventBus,
 * PluginAPI provides controlled methods that can be scoped, logged, and monitored.
 *
 * @example
 * ```ts
 * // Inside a plugin's init() method:
 * init(api: IPluginAPI) {
 *   // Get state
 *   const isPlaying = api.getState('playing');
 *
 *   // Set state
 *   api.setState('volume', 0.8);
 *
 *   // Subscribe to events
 *   const unsub = api.on('playback:play', () => {
 *     console.log('Playback started');
 *   });
 *
 *   // Emit events
 *   api.emit('plugin:ready', { name: this.id });
 *
 *   // Register cleanup
 *   api.onDestroy(unsub);
 * }
 * ```
 */
export class PluginAPI implements IPluginAPI {
  /** Plugin ID this API belongs to */
  readonly pluginId: string;

  /** The player's container, while the API is live */
  private readonly playerContainer: HTMLElement;

  /** Stand-in container handed out once the API is revoked */
  private detachedContainer: HTMLElement | null = null;

  /** Set by `revoke()`, cleared by `restore()` */
  private revoked = false;

  /** Scoped logger for this plugin */
  readonly logger: IPluginAPI['logger'];

  /** State manager reference */
  private stateManager: StateManager;

  /** Event bus reference */
  private eventBus: EventBus;

  /** Function to get other plugins */
  private getPluginFn: <T = unknown>(id: string) => T | null;

  /** Optional function to get provider diagnostics */
  private getProviderDiagnosticsFn?: () => Record<string, unknown>;

  /** Cleanup functions registered by this plugin */
  private cleanupFns: Array<() => void> = [];

  /**
   * Create a new PluginAPI.
   *
   * @param pluginId - ID of the plugin this API belongs to
   * @param deps - Dependencies (stateManager, eventBus, logger, container, getPlugin, getProviderDiagnostics)
   */
  constructor(pluginId: string, deps: PluginAPIDeps) {
    this.pluginId = pluginId;
    this.stateManager = deps.stateManager;
    this.eventBus = deps.eventBus;
    this.playerContainer = deps.container;
    this.getPluginFn = deps.getPlugin;
    this.getProviderDiagnosticsFn = deps.getProviderDiagnostics;

    // Create scoped logger for this plugin
    this.logger = {
      debug: (msg: string, metadata?: Record<string, any>) => deps.logger.debug(`[${pluginId}] ${msg}`, metadata),
      info: (msg: string, metadata?: Record<string, any>) => deps.logger.info(`[${pluginId}] ${msg}`, metadata),
      warn: (msg: string, metadata?: Record<string, any>) => deps.logger.warn(`[${pluginId}] ${msg}`, metadata),
      error: (msg: string, metadata?: Record<string, any>) => deps.logger.error(`[${pluginId}] ${msg}`, metadata),
    };
  }

  /**
   * Player container element. Once the API is revoked this is a detached
   * stand-in, so a late teardown neither finds nor changes the player's DOM.
   */
  get container(): HTMLElement {
    if (!this.revoked) return this.playerContainer;
    this.detachedContainer ??= document.createElement('div');
    return this.detachedContainer;
  }

  /**
   * Get a state value.
   *
   * @param key - State property key
   * @returns Current state value
   */
  getState<K extends StateKey>(key: K): StateValue<K> {
    return this.stateManager.getValue(key);
  }

  /**
   * Set a state value.
   *
   * @param key - State property key
   * @param value - New state value
   */
  setState<K extends StateKey>(key: K, value: StateValue<K>): void {
    if (this.revoked) return;
    this.stateManager.set(key, value);
  }

  /**
   * Register a state key this plugin owns, before first use.
   *
   * Idempotent - re-defining an existing key keeps its current value.
   * See {@link IPluginAPI.defineState}.
   *
   * @param key - State property key
   * @param initialValue - Value used only when the key is new
   */
  defineState<K extends StateKey>(key: K, initialValue: StateValue<K>): void {
    if (this.revoked) return;
    this.stateManager.define(key, initialValue);
  }

  /**
   * Subscribe to an event.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): () => void {
    if (this.revoked) return () => {};
    return this.eventBus.on(event, handler);
  }

  /**
   * Unsubscribe from an event.
   *
   * @param event - Event name
   * @param handler - Event handler to remove
   */
  off<T extends EventName>(event: T, handler: EventHandler<T>): void {
    this.eventBus.off(event, handler);
  }

  /**
   * Emit an event.
   *
   * @param event - Event name
   * @param payload - Event payload
   */
  emit<T extends EventName>(event: T, payload: EventPayload<T>): void {
    if (this.revoked) return;
    this.eventBus.emit(event, payload);
  }

  /**
   * Get another plugin by ID (if ready).
   *
   * @param id - Plugin ID
   * @returns Plugin instance or null if not found/ready
   */
  getPlugin<T = unknown>(id: string): T | null {
    return this.getPluginFn<T>(id);
  }

  /**
   * Register a cleanup function to run when plugin is destroyed.
   *
   * @param cleanup - Cleanup function
   */
  onDestroy(cleanup: () => void): void {
    this.cleanupFns.push(cleanup);
  }

  /**
   * Subscribe to state changes.
   *
   * @param callback - Callback function called on any state change
   * @returns Unsubscribe function
   */
  subscribeToState(callback: (event: StateChangeEvent) => void): () => void {
    if (this.revoked) return () => {};
    return this.stateManager.subscribe(callback);
  }

  /**
   * Collect sanitized diagnostic contributions from ready provider plugins.
   *
   * @returns Map of provider plugin ID to sanitized diagnostic values
   */
  getProviderDiagnostics(): Record<string, unknown> {
    if (this.getProviderDiagnosticsFn) {
      return this.getProviderDiagnosticsFn();
    }
    return {};
  }

  /**
   * Run all registered cleanup functions.
   * Called by PluginManager when destroying the plugin.
   *
   * @internal
   */
  runCleanups(): void {
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (error) {
        this.logger.error('Cleanup function failed', { error });
      }
    }
    this.cleanupFns = [];
  }

  /**
   * Cut the plugin off from the player while its teardown is still pending:
   * run its cleanups now, make `setState`, `defineState`, `emit`, `on` and
   * `subscribeToState` no-ops, and hand out a detached `container`. Used when
   * the player stops waiting for a provider's teardown. Idempotent.
   *
   * @returns `true` when this call revoked it, `false` when it already was
   * @internal
   */
  revoke(): boolean {
    if (this.revoked) return false;
    this.revoked = true;
    this.runCleanups();
    return true;
  }

  /**
   * Undo `revoke()` before a fresh `init()`.
   *
   * @internal
   */
  restore(): void {
    this.revoked = false;
  }

  /**
   * Get all registered cleanup functions.
   *
   * @returns Array of cleanup functions
   * @internal
   */
  getCleanupFns(): Array<() => void> {
    return this.cleanupFns;
  }
}
