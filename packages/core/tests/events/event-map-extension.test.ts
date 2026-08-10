/**
 * Event map extension tests.
 *
 * Plugin packages add their own events by declaration merging into
 * PlayerEventMap. This suite pins the two properties that makes possible, so
 * neither can be broken without a failing test:
 *
 *   1. PlayerEventMap stays an `interface` (a type alias cannot be merged into)
 *   2. EventBus never validates event names at runtime
 *
 * A plugin package augments `'@scarlett-player/core'`; from inside core the
 * equivalent is the module that declares the interface. `@scarlett-player/ui`
 * exercises the real-world form for `ui:control-registered`.
 */

import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/events/event-bus';

declare module '../../src/types/events' {
  interface PlayerEventMap {
    'test:extended': { value: number };
    'test:extended-void': void;
  }
}

describe('PlayerEventMap extension', () => {
  it('accepts a merged event name through on/emit with a typed payload', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('test:extended', handler);
    bus.emit('test:extended', { value: 42 });

    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('accepts a merged void-payload event', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('test:extended-void', handler);
    bus.emit('test:extended-void', undefined);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes a merged event like any built-in', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const unsubscribe = bus.on('test:extended', handler);
    unsubscribe();
    bus.emit('test:extended', { value: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not validate event names at runtime', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    // Cast stands in for a plugin whose augmentation is not visible here.
    // Emitting an unknown name must be inert, never a throw — that runtime
    // openness is what makes declaration merging sufficient on its own.
    bus.on('plugin:not-in-the-map' as never, handler);
    expect(() => bus.emit('plugin:not-in-the-map' as never, undefined as never)).not.toThrow();
    expect(handler).toHaveBeenCalled();
  });

  it('keeps merged events isolated from each other', () => {
    const bus = new EventBus();
    const extended = vi.fn();
    const voidEvent = vi.fn();

    bus.on('test:extended', extended);
    bus.on('test:extended-void', voidEvent);
    bus.emit('test:extended', { value: 7 });

    expect(extended).toHaveBeenCalledTimes(1);
    expect(voidEvent).not.toHaveBeenCalled();
  });
});
