/**
 * PluginManager - Plugin lifecycle and dependency management with
 * topological dependency resolution and circular dependency detection.
 */

import type { EventBus } from './events/event-bus';
import type { StateManager } from './state/state-manager';
import type { Logger } from './logger';
import type { Plugin, PluginState, PluginConfig, PluginDescriptor } from './types/plugin';
import { PluginAPI } from './plugin-api';

export interface PluginManagerOptions {
  container: HTMLElement;
}

/** @internal */
interface PluginRecord extends PluginDescriptor {
  api: PluginAPI;
}

export class PluginManager {
  private plugins = new Map<string, PluginRecord>();
  private eventBus: EventBus;
  private stateManager: StateManager;
  private logger: Logger;
  private container: HTMLElement;

  constructor(
    eventBus: EventBus,
    stateManager: StateManager,
    logger: Logger,
    options: PluginManagerOptions
  ) {
    this.eventBus = eventBus;
    this.stateManager = stateManager;
    this.logger = logger;
    this.container = options.container;
  }

  /** Register a plugin with optional configuration. */
  register<T extends PluginConfig>(plugin: Plugin<T>, config?: T): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }

    this.validatePlugin(plugin);

    const api = new PluginAPI(plugin.id, {
      stateManager: this.stateManager,
      eventBus: this.eventBus,
      logger: this.logger,
      container: this.container,
      getPlugin: <T = unknown>(id: string): T | null => this.getReadyPlugin(id) as T | null,
    });

    this.plugins.set(plugin.id, {
      plugin,
      state: 'registered',
      config,
      cleanupFns: [],
      api,
    });

    this.logger.info(`Plugin registered: ${plugin.id}`);
    this.eventBus.emit('plugin:registered', { name: plugin.id, type: plugin.type });
  }

  /** Unregister a plugin. Destroys it first if active. */
  async unregister(id: string): Promise<void> {
    const record = this.plugins.get(id);
    if (!record) return;

    if (record.state === 'ready') {
      await this.destroyPlugin(id);
    }

    this.plugins.delete(id);
    this.logger.info(`Plugin unregistered: ${id}`);
  }

  /** Initialize all registered plugins in dependency order. */
  async initAll(): Promise<void> {
    const order = this.resolveDependencyOrder();

    for (const id of order) {
      await this.initPlugin(id);
    }
  }

  /** Initialize a specific plugin. */
  async initPlugin(id: string): Promise<void> {
    const record = this.plugins.get(id);
    if (!record) {
      throw new Error(`Plugin "${id}" not found`);
    }

    if (record.state === 'ready') return;
    if (record.state === 'initializing') {
      throw new Error(`Plugin "${id}" is already initializing (possible circular dependency)`);
    }

    // Ensure dependencies are ready
    for (const depId of record.plugin.dependencies || []) {
      const dep = this.plugins.get(depId);
      if (!dep) {
        throw new Error(`Plugin "${id}" depends on missing plugin "${depId}"`);
      }
      if (dep.state !== 'ready') {
        await this.initPlugin(depId);
      }
    }

    try {
      record.state = 'initializing';

      if (record.plugin.onStateChange) {
        const unsub = this.stateManager.subscribe(record.plugin.onStateChange.bind(record.plugin));
        record.api.onDestroy(unsub);
      }

      if (record.plugin.onError) {
        const unsub = this.eventBus.on('error', (err) => {
          record.plugin.onError?.(err.originalError || new Error(err.message));
        });
        record.api.onDestroy(unsub);
      }

      await record.plugin.init(record.api, record.config);

      record.state = 'ready';
      this.logger.info(`Plugin ready: ${id}`);
      this.eventBus.emit('plugin:active', { name: id });
    } catch (error) {
      record.state = 'error';
      record.error = error as Error;
      this.logger.error(`Plugin init failed: ${id}`, { error });
      this.eventBus.emit('plugin:error', { name: id, error: error as Error });
      throw error;
    }
  }

  /** Destroy all plugins in reverse dependency order. */
  async destroyAll(): Promise<void> {
    const order = this.resolveDependencyOrder().reverse();

    for (const id of order) {
      await this.destroyPlugin(id);
    }
  }

  /** Destroy a specific plugin. */
  async destroyPlugin(id: string): Promise<void> {
    const record = this.plugins.get(id);
    if (!record || record.state !== 'ready') return;

    try {
      await record.plugin.destroy();
      record.api.runCleanups();
      // Reset to 'registered' so it can be re-initialized later
      record.state = 'registered';
      this.logger.info(`Plugin destroyed: ${id}`);
      this.eventBus.emit('plugin:destroyed', { name: id });
    } catch (error) {
      this.logger.error(`Plugin destroy failed: ${id}`, { error });
      // Even on error, reset state so plugin can be retried
      record.state = 'registered';
    }
  }

  /** Get a plugin by ID (returns any registered plugin). */
  getPlugin<T extends Plugin = Plugin>(id: string): T | null {
    const record = this.plugins.get(id);
    return record ? (record.plugin as T) : null;
  }

  /** Get a plugin by ID only if ready (used by PluginAPI). */
  getReadyPlugin<T extends Plugin = Plugin>(id: string): T | null {
    const record = this.plugins.get(id);
    return record?.state === 'ready' ? (record.plugin as T) : null;
  }

  /** Check if a plugin is registered. */
  hasPlugin(id: string): boolean {
    return this.plugins.has(id);
  }

  /** Get plugin state. */
  getPluginState(id: string): PluginState | null {
    return this.plugins.get(id)?.state ?? null;
  }

  /** Get all registered plugin IDs. */
  getPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /** Get all ready plugins. */
  getReadyPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
      .filter((r) => r.state === 'ready')
      .map((r) => r.plugin);
  }

  /** Get plugins by type. */
  getPluginsByType(type: string): Plugin[] {
    return Array.from(this.plugins.values())
      .filter((r) => r.plugin.type === type)
      .map((r) => r.plugin);
  }

  /** Select a provider plugin that can play a source. */
  selectProvider(source: string): Plugin | null {
    const providers = this.getPluginsByType('provider');
    for (const provider of providers) {
      const canPlay = (provider as any).canPlay;
      if (typeof canPlay === 'function' && canPlay(source)) {
        return provider;
      }
    }
    return null;
  }

  /** Resolve plugin initialization order using topological sort. */
  private resolveDependencyOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: string[] = [];

    const visit = (id: string, path: string[] = []) => {
      if (visited.has(id)) return;

      if (visiting.has(id)) {
        const cycle = [...path, id].join(' -> ');
        throw new Error(`Circular dependency detected: ${cycle}`);
      }

      const record = this.plugins.get(id);
      if (!record) return;

      visiting.add(id);

      for (const depId of record.plugin.dependencies || []) {
        if (this.plugins.has(depId)) {
          visit(depId, [...path, id]);
        }
      }

      visiting.delete(id);
      visited.add(id);
      sorted.push(id);
    };

    for (const id of this.plugins.keys()) {
      visit(id);
    }

    return sorted;
  }

  /** Validate plugin has required properties. */
  private validatePlugin(plugin: Plugin): void {
    if (!plugin.id || typeof plugin.id !== 'string') {
      throw new Error('Plugin must have a valid id');
    }
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error(`Plugin "${plugin.id}" must have a valid name`);
    }
    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error(`Plugin "${plugin.id}" must have a valid version`);
    }
    if (!plugin.type || typeof plugin.type !== 'string') {
      throw new Error(`Plugin "${plugin.id}" must have a valid type`);
    }
    if (typeof plugin.init !== 'function') {
      throw new Error(`Plugin "${plugin.id}" must have an init() method`);
    }
    if (typeof plugin.destroy !== 'function') {
      throw new Error(`Plugin "${plugin.id}" must have a destroy() method`);
    }
  }
}
