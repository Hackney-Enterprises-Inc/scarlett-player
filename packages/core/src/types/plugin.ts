/**
 * Plugin system type definitions for Scarlett Player.
 *
 * Plugins are the core extension mechanism for adding functionality
 * to the player (providers, UI, features, analytics, etc.).
 */

import type { StateKey, StateValue, StateChangeEvent } from './state';
import type { EventName, EventPayload, EventHandler } from './events';

/**
 * Plugin types define the category and lifecycle of a plugin.
 */
export type PluginType =
  | 'provider'    // Media providers (HLS, DASH, Native, etc.)
  | 'ui'          // UI components (controls, overlays, etc.)
  | 'feature'     // Feature plugins (chapters, live-controls, etc.)
  | 'analytics'   // Analytics and tracking
  | 'utility';    // Utility plugins (logging, error handling, etc.)

/**
 * Plugin lifecycle states.
 */
export type PluginState =
  | 'registered'    // Plugin registered but not initialized
  | 'initializing'  // Plugin init() is running
  | 'ready'         // Plugin is ready and active
  | 'error'         // Plugin encountered an error
  | 'destroyed';    // Plugin has been destroyed

/**
 * Plugin configuration options (plugin-specific).
 */
export type PluginConfig = Record<string, unknown>;

/**
 * Plugin API surface exposed to plugins for interacting with the player.
 * Plugins should use this API instead of accessing StateManager/EventBus directly.
 */
export interface IPluginAPI {
  /** Unique plugin ID */
  readonly pluginId: string;

  /** Player container element */
  readonly container: HTMLElement;

  /** Logger instance for this plugin */
  readonly logger: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
  };

  /**
   * Get a state value.
   * @param key - State property key
   * @returns Current state value
   */
  getState<K extends StateKey>(key: K): StateValue<K>;

  /**
   * Set a state value.
   * @param key - State property key
   * @param value - New state value
   */
  setState<K extends StateKey>(key: K, value: StateValue<K>): void;

  /**
   * Subscribe to an event.
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): () => void;

  /**
   * Unsubscribe from an event.
   * @param event - Event name
   * @param handler - Event handler to remove
   */
  off<T extends EventName>(event: T, handler: EventHandler<T>): void;

  /**
   * Emit an event.
   * @param event - Event name
   * @param payload - Event payload
   */
  emit<T extends EventName>(event: T, payload: EventPayload<T>): void;

  /**
   * Get another plugin by name (if ready).
   * @param name - Plugin name
   * @returns Plugin instance or null if not found/ready
   */
  getPlugin<T = unknown>(name: string): T | null;

  /**
   * Register a cleanup function to run when plugin is destroyed.
   * @param cleanup - Cleanup function
   */
  onDestroy(cleanup: () => void): void;

  /**
   * Subscribe to state changes.
   * @param callback - Callback function called on any state change
   * @returns Unsubscribe function
   */
  subscribeToState(callback: (event: StateChangeEvent) => void): () => void;
}

/**
 * Core plugin interface that all plugins must implement.
 */
export interface Plugin<TConfig extends PluginConfig = PluginConfig> {
  /** Unique plugin identifier (e.g., 'hls-provider', 'native-controls') */
  readonly id: string;

  /** Human-readable plugin name */
  readonly name: string;

  /** Semantic version (e.g., '1.0.0') */
  readonly version: string;

  /** Plugin type/category */
  readonly type: PluginType;

  /** Optional human-readable description */
  readonly description?: string;

  /** Dependencies - other plugin IDs that must be initialized first */
  readonly dependencies?: string[];

  /**
   * Initialize the plugin.
   * Called when dependencies are ready.
   *
   * @param api - Plugin API surface
   * @param config - Plugin-specific configuration
   */
  init(api: IPluginAPI, config?: TConfig): void | Promise<void>;

  /**
   * Cleanup when plugin is destroyed.
   * Called when the plugin is deactivated or player is destroyed.
   */
  destroy(): void | Promise<void>;

  /**
   * Optional: Called when any state changes.
   * @param event - State change event
   */
  onStateChange?(event: StateChangeEvent): void;

  /**
   * Optional: Called when an error occurs.
   * @param error - Error that occurred
   */
  onError?(error: Error): void;
}

/**
 * Plugin factory function signature.
 */
export type PluginFactory<TConfig extends PluginConfig = PluginConfig> = (
  config?: TConfig
) => Plugin<TConfig>;

/**
 * Internal plugin descriptor used by PluginManager.
 * @internal
 */
export interface PluginDescriptor {
  plugin: Plugin;
  state: PluginState;
  config?: PluginConfig;
  error?: Error;
  cleanupFns: Array<() => void>;
}
