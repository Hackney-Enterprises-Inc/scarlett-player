/**
 * PluginManager Tests - Comprehensive test suite
 *
 * Target: 90%+ code coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../src/plugin-manager';
import { PluginAPI } from '../src/plugin-api';
import { EventBus } from '../src/events/event-bus';
import { StateManager } from '../src/state/state-manager';
import { Logger } from '../src/logger';
import type { Plugin, IPluginAPI, PluginConfig } from '../src/types/plugin';

// Helper to create mock plugins
const createMockPlugin = (overrides?: Partial<Plugin>): Plugin => ({
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  type: 'feature',
  init: vi.fn(),
  destroy: vi.fn(),
  ...overrides,
});

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let eventBus: EventBus;
  let stateManager: StateManager;
  let logger: Logger;
  let container: HTMLElement;

  beforeEach(() => {
    eventBus = new EventBus();
    stateManager = new StateManager();
    logger = new Logger({ level: 'debug' });
    container = document.createElement('div');

    pluginManager = new PluginManager(eventBus, stateManager, logger, { container });

    // Suppress console output
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should create plugin manager with dependencies', () => {
      expect(pluginManager).toBeInstanceOf(PluginManager);
    });
  });

  describe('register()', () => {
    it('should register a valid plugin', () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
    });

    it('should register plugin with config', () => {
      const plugin = createMockPlugin();
      const config = { option: 'value' };
      pluginManager.register(plugin, config);
      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
    });

    it('should throw error for plugin without id', () => {
      const plugin = createMockPlugin({ id: '' });
      expect(() => pluginManager.register(plugin)).toThrow('valid id');
    });

    it('should throw error for plugin without name', () => {
      const plugin = createMockPlugin({ name: '' });
      expect(() => pluginManager.register(plugin)).toThrow('valid name');
    });

    it('should throw error for plugin without version', () => {
      const plugin = createMockPlugin({ version: '' });
      expect(() => pluginManager.register(plugin)).toThrow('valid version');
    });

    it('should throw error for plugin without type', () => {
      const plugin = createMockPlugin({ type: '' as any });
      expect(() => pluginManager.register(plugin)).toThrow('valid type');
    });

    it('should throw error for plugin without init method', () => {
      const plugin = createMockPlugin({ init: undefined as any });
      expect(() => pluginManager.register(plugin)).toThrow('init() method');
    });

    it('should throw error for plugin without destroy method', () => {
      const plugin = createMockPlugin({ destroy: undefined as any });
      expect(() => pluginManager.register(plugin)).toThrow('destroy() method');
    });

    it('should throw error for duplicate plugin', () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      expect(() => pluginManager.register(plugin)).toThrow('already registered');
    });

    it('should emit plugin:registered event', () => {
      const eventSpy = vi.fn();
      eventBus.on('plugin:registered', eventSpy);

      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      expect(eventSpy).toHaveBeenCalledWith({
        name: 'test-plugin',
        type: 'feature',
      });
    });

    it('should log plugin registration', () => {
      const loggerSpy = vi.spyOn(logger, 'info');
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      expect(loggerSpy).toHaveBeenCalledWith('Plugin registered: test-plugin');
    });
  });

  describe('unregister()', () => {
    it('should unregister a registered plugin', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      await pluginManager.unregister('test-plugin');

      expect(pluginManager.hasPlugin('test-plugin')).toBe(false);
    });

    it('should destroy and unregister an active plugin', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      await pluginManager.unregister('test-plugin');

      expect(pluginManager.hasPlugin('test-plugin')).toBe(false);
      expect(plugin.destroy).toHaveBeenCalled();
    });

    it('should handle unregistering non-existent plugin', async () => {
      await expect(pluginManager.unregister('non-existent')).resolves.not.toThrow();
    });
  });

  describe('initAll()', () => {
    it('should init all registered plugins', async () => {
      const plugin1 = createMockPlugin({ id: 'plugin-1' });
      const plugin2 = createMockPlugin({ id: 'plugin-2' });

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      await pluginManager.initAll();

      expect(plugin1.init).toHaveBeenCalled();
      expect(plugin2.init).toHaveBeenCalled();
    });

    it('should resolve dependencies in correct order (A depends on B)', async () => {
      const initOrder: string[] = [];

      const pluginA = createMockPlugin({
        id: 'plugin-a',
        init: vi.fn(() => { initOrder.push('plugin-a'); }),
      });

      const pluginB = createMockPlugin({
        id: 'plugin-b',
        dependencies: ['plugin-a'],
        init: vi.fn(() => { initOrder.push('plugin-b'); }),
      });

      pluginManager.register(pluginA);
      pluginManager.register(pluginB);

      await pluginManager.initAll();

      // plugin-a should init before plugin-b
      expect(initOrder).toEqual(['plugin-a', 'plugin-b']);
    });

    it('should handle complex dependency chains (A -> B -> C)', async () => {
      const initOrder: string[] = [];

      const pluginA = createMockPlugin({
        id: 'plugin-a',
        init: vi.fn(() => { initOrder.push('plugin-a'); }),
      });

      const pluginB = createMockPlugin({
        id: 'plugin-b',
        dependencies: ['plugin-a'],
        init: vi.fn(() => { initOrder.push('plugin-b'); }),
      });

      const pluginC = createMockPlugin({
        id: 'plugin-c',
        dependencies: ['plugin-b'],
        init: vi.fn(() => { initOrder.push('plugin-c'); }),
      });

      pluginManager.register(pluginA);
      pluginManager.register(pluginB);
      pluginManager.register(pluginC);

      await pluginManager.initAll();

      expect(initOrder).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
    });

    it('should handle diamond dependencies (D depends on B and C, both depend on A)', async () => {
      const initOrder: string[] = [];

      const pluginA = createMockPlugin({
        id: 'plugin-a',
        init: vi.fn(() => { initOrder.push('plugin-a'); }),
      });

      const pluginB = createMockPlugin({
        id: 'plugin-b',
        dependencies: ['plugin-a'],
        init: vi.fn(() => { initOrder.push('plugin-b'); }),
      });

      const pluginC = createMockPlugin({
        id: 'plugin-c',
        dependencies: ['plugin-a'],
        init: vi.fn(() => { initOrder.push('plugin-c'); }),
      });

      const pluginD = createMockPlugin({
        id: 'plugin-d',
        dependencies: ['plugin-b', 'plugin-c'],
        init: vi.fn(() => { initOrder.push('plugin-d'); }),
      });

      pluginManager.register(pluginA);
      pluginManager.register(pluginB);
      pluginManager.register(pluginC);
      pluginManager.register(pluginD);

      await pluginManager.initAll();

      // A must be first, D must be last, B and C can be in either order
      expect(initOrder[0]).toBe('plugin-a');
      expect(initOrder[3]).toBe('plugin-d');
      expect(initOrder.slice(1, 3).sort()).toEqual(['plugin-b', 'plugin-c']);
    });
  });

  describe('initPlugin()', () => {
    it('should init a plugin', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      await pluginManager.initPlugin('test-plugin');

      expect(plugin.init).toHaveBeenCalled();
    });

    it('should pass IPluginAPI to init', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      await pluginManager.initPlugin('test-plugin');

      expect(plugin.init).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'test-plugin',
          container: container,
          logger: expect.any(Object),
          getState: expect.any(Function),
          setState: expect.any(Function),
          on: expect.any(Function),
          off: expect.any(Function),
          emit: expect.any(Function),
          getPlugin: expect.any(Function),
          onDestroy: expect.any(Function),
        }),
        undefined
      );
    });

    it('should pass config to init', async () => {
      const plugin = createMockPlugin();
      const config = { option: 'value' };
      pluginManager.register(plugin, config);

      await pluginManager.initPlugin('test-plugin');

      expect(plugin.init).toHaveBeenCalledWith(expect.any(Object), config);
    });

    it('should emit plugin:active event', async () => {
      const eventSpy = vi.fn();
      eventBus.on('plugin:active', eventSpy);

      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      await pluginManager.initPlugin('test-plugin');

      expect(eventSpy).toHaveBeenCalledWith({ name: 'test-plugin' });
    });

    it('should skip if plugin already ready', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      await pluginManager.initPlugin('test-plugin');
      await pluginManager.initPlugin('test-plugin');

      expect(plugin.init).toHaveBeenCalledTimes(1);
    });

    it('should throw error for plugin not found', async () => {
      await expect(pluginManager.initPlugin('non-existent')).rejects.toThrow('not found');
    });

    it('should throw error for missing dependency', async () => {
      const plugin = createMockPlugin({
        id: 'plugin-b',
        dependencies: ['plugin-a'],
      });
      pluginManager.register(plugin);

      await expect(pluginManager.initPlugin('plugin-b')).rejects.toThrow('missing plugin');
    });

    it('should handle init failure', async () => {
      const errorSpy = vi.fn();
      eventBus.on('plugin:error', errorSpy);

      const plugin = createMockPlugin({
        init: vi.fn(() => { throw new Error('Init failed'); }),
      });
      pluginManager.register(plugin);

      await expect(pluginManager.initPlugin('test-plugin')).rejects.toThrow('Init failed');

      expect(errorSpy).toHaveBeenCalledWith({
        name: 'test-plugin',
        error: expect.any(Error),
      });
    });

    it('should update state to error on failure', async () => {
      const plugin = createMockPlugin({
        init: vi.fn(() => { throw new Error('Init failed'); }),
      });
      pluginManager.register(plugin);

      try {
        await pluginManager.initPlugin('test-plugin');
      } catch {}

      expect(pluginManager.getPluginState('test-plugin')).toBe('error');
    });

    it('should subscribe to state changes if plugin has onStateChange', async () => {
      const onStateChange = vi.fn();
      const plugin = createMockPlugin({ onStateChange });
      pluginManager.register(plugin);

      await pluginManager.initPlugin('test-plugin');

      stateManager.set('playing', true);

      expect(onStateChange).toHaveBeenCalled();
    });

    it('should subscribe to errors if plugin has onError', async () => {
      const onError = vi.fn();
      const plugin = createMockPlugin({ onError });
      pluginManager.register(plugin);

      await pluginManager.initPlugin('test-plugin');

      eventBus.emit('error', {
        code: 'UNKNOWN_ERROR' as any,
        message: 'Test error',
        fatal: false,
        timestamp: Date.now(),
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('circular dependency detection', () => {
    it('should throw error for direct circular dependency (A -> B -> A)', async () => {
      const pluginA = createMockPlugin({
        id: 'plugin-a',
        dependencies: ['plugin-b'],
      });

      const pluginB = createMockPlugin({
        id: 'plugin-b',
        dependencies: ['plugin-a'],
      });

      pluginManager.register(pluginA);
      pluginManager.register(pluginB);

      await expect(pluginManager.initAll()).rejects.toThrow('Circular dependency');
    });

    it('should throw error for indirect circular dependency (A -> B -> C -> A)', async () => {
      const pluginA = createMockPlugin({
        id: 'plugin-a',
        dependencies: ['plugin-c'],
      });

      const pluginB = createMockPlugin({
        id: 'plugin-b',
        dependencies: ['plugin-a'],
      });

      const pluginC = createMockPlugin({
        id: 'plugin-c',
        dependencies: ['plugin-b'],
      });

      pluginManager.register(pluginA);
      pluginManager.register(pluginB);
      pluginManager.register(pluginC);

      await expect(pluginManager.initAll()).rejects.toThrow('Circular dependency');
    });

    it('should throw error for self-dependency', async () => {
      const plugin = createMockPlugin({
        id: 'plugin-a',
        dependencies: ['plugin-a'],
      });

      pluginManager.register(plugin);

      await expect(pluginManager.initAll()).rejects.toThrow('Circular dependency');
    });

    it('should include cycle path in error message', async () => {
      const pluginA = createMockPlugin({
        id: 'plugin-a',
        dependencies: ['plugin-b'],
      });

      const pluginB = createMockPlugin({
        id: 'plugin-b',
        dependencies: ['plugin-a'],
      });

      pluginManager.register(pluginA);
      pluginManager.register(pluginB);

      await expect(pluginManager.initAll()).rejects.toThrow('->');
    });
  });

  describe('destroyAll()', () => {
    it('should destroy all ready plugins', async () => {
      const plugin1 = createMockPlugin({ id: 'plugin-1' });
      const plugin2 = createMockPlugin({ id: 'plugin-2' });

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);
      await pluginManager.initAll();

      await pluginManager.destroyAll();

      expect(plugin1.destroy).toHaveBeenCalled();
      expect(plugin2.destroy).toHaveBeenCalled();
    });

    it('should destroy in reverse dependency order', async () => {
      const destroyOrder: string[] = [];

      const pluginA = createMockPlugin({
        id: 'plugin-a',
        destroy: vi.fn(() => { destroyOrder.push('plugin-a'); }),
      });

      const pluginB = createMockPlugin({
        id: 'plugin-b',
        dependencies: ['plugin-a'],
        destroy: vi.fn(() => { destroyOrder.push('plugin-b'); }),
      });

      pluginManager.register(pluginA);
      pluginManager.register(pluginB);
      await pluginManager.initAll();

      await pluginManager.destroyAll();

      // plugin-b should be destroyed before plugin-a
      expect(destroyOrder).toEqual(['plugin-b', 'plugin-a']);
    });
  });

  describe('destroyPlugin()', () => {
    it('should destroy a ready plugin', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      await pluginManager.destroyPlugin('test-plugin');

      expect(plugin.destroy).toHaveBeenCalled();
    });

    it('should emit plugin:destroyed event', async () => {
      const eventSpy = vi.fn();
      eventBus.on('plugin:destroyed', eventSpy);

      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      await pluginManager.destroyPlugin('test-plugin');

      expect(eventSpy).toHaveBeenCalledWith({ name: 'test-plugin' });
    });

    it('should run cleanup functions', async () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      const plugin = createMockPlugin({
        init: vi.fn((api: IPluginAPI) => {
          api.onDestroy(cleanup1);
          api.onDestroy(cleanup2);
        }),
      });

      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      await pluginManager.destroyPlugin('test-plugin');

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
    });

    it('should handle non-existent plugin', async () => {
      await expect(pluginManager.destroyPlugin('non-existent')).resolves.not.toThrow();
    });

    it('should handle non-ready plugin', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      await expect(pluginManager.destroyPlugin('test-plugin')).resolves.not.toThrow();
      expect(plugin.destroy).not.toHaveBeenCalled();
    });

    it('should handle destroy errors', async () => {
      const plugin = createMockPlugin({
        destroy: vi.fn(() => { throw new Error('Destroy failed'); }),
      });

      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      await expect(pluginManager.destroyPlugin('test-plugin')).resolves.not.toThrow();
    });

    it('should reset state to registered (for re-initialization)', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      await pluginManager.destroyPlugin('test-plugin');

      // State is reset to 'registered' so plugin can be re-initialized
      expect(pluginManager.getPluginState('test-plugin')).toBe('registered');
    });
  });

  describe('getPlugin()', () => {
    it('should return ready plugin by id', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      const result = pluginManager.getPlugin('test-plugin');

      expect(result).toBe(plugin);
    });

    it('should return plugin even if not ready', () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      const result = pluginManager.getPlugin('test-plugin');

      expect(result).toBe(plugin);
    });

    it('getReadyPlugin should return null for non-ready plugin', () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      const result = pluginManager.getReadyPlugin('test-plugin');

      expect(result).toBeNull();
    });

    it('should return null for non-existent plugin', () => {
      const result = pluginManager.getPlugin('non-existent');

      expect(result).toBeNull();
    });

    it('should support generic type parameter', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      const result = pluginManager.getPlugin<Plugin>('test-plugin');

      expect(result).toBe(plugin);
    });
  });

  describe('hasPlugin()', () => {
    it('should return true for registered plugin', () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(pluginManager.hasPlugin('non-existent')).toBe(false);
    });
  });

  describe('getPluginState()', () => {
    it('should return registered state after registration', () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);

      expect(pluginManager.getPluginState('test-plugin')).toBe('registered');
    });

    it('should return ready state after init', async () => {
      const plugin = createMockPlugin();
      pluginManager.register(plugin);
      await pluginManager.initPlugin('test-plugin');

      expect(pluginManager.getPluginState('test-plugin')).toBe('ready');
    });

    it('should return null for non-existent plugin', () => {
      expect(pluginManager.getPluginState('non-existent')).toBeNull();
    });
  });

  describe('getPluginIds()', () => {
    it('should return all registered plugin ids', () => {
      pluginManager.register(createMockPlugin({ id: 'plugin-1' }));
      pluginManager.register(createMockPlugin({ id: 'plugin-2' }));
      pluginManager.register(createMockPlugin({ id: 'plugin-3' }));

      const ids = pluginManager.getPluginIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain('plugin-1');
      expect(ids).toContain('plugin-2');
      expect(ids).toContain('plugin-3');
    });

    it('should return empty array if no plugins', () => {
      expect(pluginManager.getPluginIds()).toEqual([]);
    });
  });

  describe('getReadyPlugins()', () => {
    it('should return only ready plugins', async () => {
      const plugin1 = createMockPlugin({ id: 'plugin-1' });
      const plugin2 = createMockPlugin({ id: 'plugin-2' });
      const plugin3 = createMockPlugin({ id: 'plugin-3' });

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);
      pluginManager.register(plugin3);

      await pluginManager.initPlugin('plugin-1');
      await pluginManager.initPlugin('plugin-2');

      const ready = pluginManager.getReadyPlugins();

      expect(ready).toHaveLength(2);
      expect(ready).toContain(plugin1);
      expect(ready).toContain(plugin2);
      expect(ready).not.toContain(plugin3);
    });

    it('should return empty array if no ready plugins', () => {
      expect(pluginManager.getReadyPlugins()).toEqual([]);
    });
  });

  describe('hot-swap (unregister running plugin)', () => {
    it('should allow unregistering and re-registering a plugin', async () => {
      const plugin1 = createMockPlugin();
      pluginManager.register(plugin1);
      await pluginManager.initPlugin('test-plugin');

      await pluginManager.unregister('test-plugin');

      const plugin2 = createMockPlugin();
      pluginManager.register(plugin2);
      await pluginManager.initPlugin('test-plugin');

      expect(plugin1.destroy).toHaveBeenCalled();
      expect(plugin2.init).toHaveBeenCalled();
      expect(pluginManager.getPlugin('test-plugin')).toBe(plugin2);
    });
  });

  describe('getPluginsByType()', () => {
    it('should return plugins of specific type', () => {
      const provider1 = createMockPlugin({ id: 'provider-1', type: 'provider' });
      const provider2 = createMockPlugin({ id: 'provider-2', type: 'provider' });
      const feature = createMockPlugin({ id: 'feature-1', type: 'feature' });

      pluginManager.register(provider1);
      pluginManager.register(provider2);
      pluginManager.register(feature);

      const providers = pluginManager.getPluginsByType('provider');

      expect(providers).toHaveLength(2);
      expect(providers).toContain(provider1);
      expect(providers).toContain(provider2);
    });

    it('should return empty array if no plugins of type', () => {
      const result = pluginManager.getPluginsByType('analytics');
      expect(result).toEqual([]);
    });
  });

  describe('selectProvider()', () => {
    it('should select provider that can play source', () => {
      const hlsProvider = createMockPlugin({
        id: 'hls-provider',
        type: 'provider',
      });
      (hlsProvider as any).canPlay = vi.fn((src: string) => src.endsWith('.m3u8'));

      const dashProvider = createMockPlugin({
        id: 'dash-provider',
        type: 'provider',
      });
      (dashProvider as any).canPlay = vi.fn((src: string) => src.endsWith('.mpd'));

      pluginManager.register(hlsProvider);
      pluginManager.register(dashProvider);

      const result = pluginManager.selectProvider('video.m3u8');

      expect(result).toBe(hlsProvider);
      expect((hlsProvider as any).canPlay).toHaveBeenCalledWith('video.m3u8');
    });

    it('should return null if no provider can play', () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
      });
      (provider as any).canPlay = vi.fn(() => false);

      pluginManager.register(provider);

      const result = pluginManager.selectProvider('video.mp4');

      expect(result).toBeNull();
    });

    it('should return null if no providers registered', () => {
      const result = pluginManager.selectProvider('video.mp4');
      expect(result).toBeNull();
    });

    it('should handle provider without canPlay method', () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
      });

      pluginManager.register(provider);

      const result = pluginManager.selectProvider('video.mp4');

      expect(result).toBeNull();
    });
  });
});

describe('PluginAPI', () => {
  let pluginAPI: PluginAPI;
  let eventBus: EventBus;
  let stateManager: StateManager;
  let logger: Logger;
  let container: HTMLElement;

  beforeEach(() => {
    eventBus = new EventBus();
    stateManager = new StateManager();
    logger = new Logger({ level: 'debug' });
    container = document.createElement('div');

    pluginAPI = new PluginAPI('test-plugin', {
      stateManager,
      eventBus,
      logger,
      container,
      getPlugin: () => null,
    });

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should set pluginId', () => {
      expect(pluginAPI.pluginId).toBe('test-plugin');
    });

    it('should set container', () => {
      expect(pluginAPI.container).toBe(container);
    });
  });

  describe('getState()', () => {
    it('should return state value', () => {
      stateManager.set('volume', 0.5);

      expect(pluginAPI.getState('volume')).toBe(0.5);
    });
  });

  describe('setState()', () => {
    it('should update state value', () => {
      pluginAPI.setState('volume', 0.8);

      expect(stateManager.getValue('volume')).toBe(0.8);
    });
  });

  describe('on()', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      pluginAPI.on('playback:play', handler);

      eventBus.emit('playback:play', undefined);

      expect(handler).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = pluginAPI.on('playback:play', handler);

      unsub();
      eventBus.emit('playback:play', undefined);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('off()', () => {
    it('should unsubscribe from events', () => {
      const handler = vi.fn();
      pluginAPI.on('playback:play', handler);

      pluginAPI.off('playback:play', handler);
      eventBus.emit('playback:play', undefined);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('emit()', () => {
    it('should emit events', () => {
      const handler = vi.fn();
      eventBus.on('playback:timeupdate', handler);

      pluginAPI.emit('playback:timeupdate', { currentTime: 10 });

      expect(handler).toHaveBeenCalledWith({ currentTime: 10 });
    });
  });

  describe('getPlugin()', () => {
    it('should call getPlugin function', () => {
      const getPluginMock = vi.fn(() => ({ id: 'other' }));
      pluginAPI = new PluginAPI('test-plugin', {
        stateManager,
        eventBus,
        logger,
        container,
        getPlugin: getPluginMock,
      });

      pluginAPI.getPlugin('other');

      expect(getPluginMock).toHaveBeenCalledWith('other');
    });
  });

  describe('onDestroy()', () => {
    it('should register cleanup function', () => {
      const cleanup = vi.fn();
      pluginAPI.onDestroy(cleanup);

      expect(pluginAPI.getCleanupFns()).toContain(cleanup);
    });
  });

  describe('runCleanups()', () => {
    it('should run all cleanup functions', () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      pluginAPI.onDestroy(cleanup1);
      pluginAPI.onDestroy(cleanup2);

      pluginAPI.runCleanups();

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
    });

    it('should clear cleanup functions after running', () => {
      pluginAPI.onDestroy(vi.fn());

      pluginAPI.runCleanups();

      expect(pluginAPI.getCleanupFns()).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', () => {
      pluginAPI.onDestroy(() => { throw new Error('Cleanup error'); });
      pluginAPI.onDestroy(vi.fn());

      expect(() => pluginAPI.runCleanups()).not.toThrow();
    });
  });

  describe('logger', () => {
    it('should prefix logs with plugin id', () => {
      const debugSpy = vi.spyOn(logger, 'debug');

      pluginAPI.logger.debug('Test message');

      // Logger also passes metadata parameter (undefined when not provided)
      expect(debugSpy).toHaveBeenCalledWith('[test-plugin] Test message', undefined);
    });
  });
});
