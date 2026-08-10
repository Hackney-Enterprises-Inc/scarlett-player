/**
 * StateManager.define() - runtime registration of plugin-owned state keys.
 *
 * Core cannot know every plugin's state keys, and get() throws for anything
 * unregistered. define() is how a plugin opts a key in.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateManager } from '../../src/state/state-manager';
import { EventBus } from '../../src/events/event-bus';
import { PluginAPI } from '../../src/plugin-api';
import { createLogger } from '../../src/logger';
import type { StateChangeEvent } from '../../src/types/state';

// Stands in for a plugin package augmenting StateStore.
declare module '../../src/types/state' {
  interface StateStore {
    testPluginValue: number;
    testPluginSelection: { start: number; end: number } | null;
  }
}

describe('StateManager.define', () => {
  let state: StateManager;

  beforeEach(() => {
    state = new StateManager();
  });

  it('registers a key that was previously unknown', () => {
    expect(() => state.getValue('testPluginValue')).toThrow(/Unknown state key/);

    state.define('testPluginValue', 5);

    expect(state.getValue('testPluginValue')).toBe(5);
  });

  it('makes the key writable through set()', () => {
    state.define('testPluginValue', 5);
    state.set('testPluginValue', 9);

    expect(state.getValue('testPluginValue')).toBe(9);
  });

  it('notifies global change subscribers, exactly like a built-in key', () => {
    const changes: StateChangeEvent[] = [];
    state.define('testPluginValue', 0);
    state.subscribe((event) => changes.push(event));

    state.set('testPluginValue', 3);

    expect(changes).toHaveLength(1);
    expect(changes[0]?.key).toBe('testPluginValue');
    expect(changes[0]?.value).toBe(3);
  });

  it('is idempotent - re-defining keeps the live value', () => {
    state.define('testPluginValue', 1);
    state.set('testPluginValue', 42);

    // A plugin re-running setup after a source change must not reset state
    // that is already live.
    state.define('testPluginValue', 1);

    expect(state.getValue('testPluginValue')).toBe(42);
  });

  it('does not resubscribe on re-define', () => {
    const subscriber = vi.fn();
    state.define('testPluginValue', 0);
    state.subscribe(subscriber);

    state.define('testPluginValue', 0);
    state.set('testPluginValue', 1);

    // One notification, not two - re-defining must not stack another
    // signal subscription onto the same key.
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('supports object and null values', () => {
    state.define('testPluginSelection', null);
    expect(state.getValue('testPluginSelection')).toBeNull();

    state.set('testPluginSelection', { start: 1, end: 2 });
    expect(state.getValue('testPluginSelection')).toEqual({ start: 1, end: 2 });
  });

  it('resetKey restores a plugin key to its defined initial value', () => {
    state.define('testPluginValue', 10);
    state.set('testPluginValue', 99);

    state.resetKey('testPluginValue');

    // DEFAULT_STATE has no entry for a plugin key, so without the recorded
    // default this would write undefined.
    expect(state.getValue('testPluginValue')).toBe(10);
  });

  it('reset() restores plugin keys alongside core keys', () => {
    state.define('testPluginValue', 10);
    state.set('testPluginValue', 99);
    state.set('playing', true);

    state.reset();

    expect(state.getValue('testPluginValue')).toBe(10);
    expect(state.getValue('playing')).toBe(false);
  });

  it('leaves built-in keys untouched', () => {
    state.define('testPluginValue', 1);

    expect(state.getValue('playing')).toBe(false);
    expect(() => state.getValue('stillNotAKey' as never)).toThrow(/Unknown state key/);
  });
});

describe('PluginAPI.defineState', () => {
  const createApi = (stateManager: StateManager): PluginAPI =>
    new PluginAPI('test-plugin', {
      stateManager,
      eventBus: new EventBus(),
      logger: createLogger(),
      container: document.createElement('div'),
      getPlugin: () => null,
    });

  it('is the path a plugin actually uses to own state', () => {
    const stateManager = new StateManager();
    const api = createApi(stateManager);

    expect(() => api.getState('testPluginValue')).toThrow(/Unknown state key/);

    api.defineState('testPluginValue', 7);
    expect(api.getState('testPluginValue')).toBe(7);

    api.setState('testPluginValue', 8);
    expect(api.getState('testPluginValue')).toBe(8);
  });

  it('shares one store across plugins, so a second define does not reset it', () => {
    const stateManager = new StateManager();
    const first = createApi(stateManager);
    const second = createApi(stateManager);

    first.defineState('testPluginValue', 1);
    first.setState('testPluginValue', 99);
    second.defineState('testPluginValue', 1);

    expect(second.getState('testPluginValue')).toBe(99);
  });
});
