/**
 * EventBus Tests - Comprehensive test suite for EventBus class
 *
 * Target: 95%+ code coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/events/event-bus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('on/off', () => {
    it('should register event listener', () => {
      const handler = vi.fn();
      bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit events to listeners', () => {
      const handler = vi.fn();
      bus.on('playback:timeupdate', handler);

      bus.emit('playback:timeupdate', { currentTime: 10.5 });

      expect(handler).toHaveBeenCalledWith({ currentTime: 10.5 });
    });

    it('should pass event data to handler', () => {
      const handler = vi.fn();
      bus.on('media:loaded', handler);

      const payload = { src: 'test.mp4', type: 'video/mp4' };
      bus.emit('media:loaded', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should support multiple listeners for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      bus.on('playback:play', handler1);
      bus.on('playback:play', handler2);
      bus.on('playback:play', handler3);

      bus.emit('playback:play', undefined);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should remove listener with off()', () => {
      const handler = vi.fn();
      bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);
      expect(handler).toHaveBeenCalledTimes(1);

      bus.off('playback:play', handler);

      bus.emit('playback:play', undefined);
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      bus.emit('playback:play', undefined);
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle removing non-existent listener', () => {
      const handler = vi.fn();

      expect(() => bus.off('playback:play', handler)).not.toThrow();
    });

    it('should handle multiple subscriptions and unsubscriptions', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const unsub1 = bus.on('playback:play', handler1);
      const unsub2 = bus.on('playback:play', handler2);
      const unsub3 = bus.on('playback:play', handler3);

      bus.emit('playback:play', undefined);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      unsub2();

      bus.emit('playback:play', undefined);
      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(1); // Not called
      expect(handler3).toHaveBeenCalledTimes(2);
    });
  });

  describe('once', () => {
    it('should trigger listener only once', () => {
      const handler = vi.fn();
      bus.once('playback:play', handler);

      bus.emit('playback:play', undefined);
      expect(handler).toHaveBeenCalledTimes(1);

      bus.emit('playback:play', undefined);
      expect(handler).toHaveBeenCalledTimes(1); // Still only 1
    });

    it('should auto-unsubscribe after first call', () => {
      const handler = vi.fn();
      bus.once('playback:play', handler);

      expect(bus.listenerCount('playback:play')).toBe(1);

      bus.emit('playback:play', undefined);

      expect(bus.listenerCount('playback:play')).toBe(0);
    });

    it('should support multiple once listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      bus.once('playback:play', handler1);
      bus.once('playback:play', handler2);
      bus.once('playback:play', handler3);

      bus.emit('playback:play', undefined);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      bus.emit('playback:play', undefined);

      expect(handler1).toHaveBeenCalledTimes(1); // Not called again
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = bus.once('playback:play', handler);

      unsub();

      bus.emit('playback:play', undefined);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should pass event data to once handler', () => {
      const handler = vi.fn();
      bus.once('playback:timeupdate', handler);

      bus.emit('playback:timeupdate', { currentTime: 15.5 });

      expect(handler).toHaveBeenCalledWith({ currentTime: 15.5 });
    });
  });

  describe('emit', () => {
    it('should emit events with data', () => {
      const handler = vi.fn();
      bus.on('volume:change', handler);

      bus.emit('volume:change', { volume: 0.5, muted: false });

      expect(handler).toHaveBeenCalledWith({ volume: 0.5, muted: false });
    });

    it('should emit to all registered listeners', () => {
      const handlers: any[] = [];
      for (let i = 0; i < 5; i++) {
        const handler = vi.fn();
        handlers.push(handler);
        bus.on('playback:play', handler);
      }

      bus.emit('playback:play', undefined);

      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle errors in listeners gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodHandler = vi.fn();

      bus.on('playback:play', () => {
        throw new Error('Handler error');
      });
      bus.on('playback:play', goodHandler);

      bus.emit('playback:play', undefined);

      expect(errorSpy).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should continue to other listeners if one throws', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler1 = vi.fn();
      const handler2 = vi.fn(() => { throw new Error('Error'); });
      const handler3 = vi.fn();

      bus.on('playback:play', handler1);
      bus.on('playback:play', handler2);
      bus.on('playback:play', handler3);

      bus.emit('playback:play', undefined);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1); // Still called

      errorSpy.mockRestore();
    });

    it('should emit events in registration order', () => {
      const order: number[] = [];

      bus.on('playback:play', () => order.push(1));
      bus.on('playback:play', () => order.push(2));
      bus.on('playback:play', () => order.push(3));

      bus.emit('playback:play', undefined);

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('emitAsync', () => {
    it('should emit events asynchronously', async () => {
      const handler = vi.fn();
      bus.on('playback:play', handler);

      await bus.emitAsync('playback:play', undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should wait for async handlers', async () => {
      const order: number[] = [];

      bus.on('playback:play', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        order.push(1);
      });

      bus.on('playback:play', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        order.push(2);
      });

      await bus.emitAsync('playback:play', undefined);

      expect(order).toHaveLength(2);
      expect(order).toContain(1);
      expect(order).toContain(2);
    });

    it('should handle errors in async handlers', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodHandler = vi.fn();

      bus.on('playback:play', async () => {
        throw new Error('Async error');
      });
      bus.on('playback:play', goodHandler);

      await bus.emitAsync('playback:play', undefined);

      expect(errorSpy).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should call once listeners asynchronously', async () => {
      const handler = vi.fn();
      bus.once('playback:play', handler);

      await bus.emitAsync('playback:play', undefined);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(bus.listenerCount('playback:play')).toBe(0);
    });
  });

  describe('interceptors', () => {
    it('should run interceptors before listeners', () => {
      const order: string[] = [];

      bus.intercept('playback:timeupdate', (payload) => {
        order.push('interceptor');
        return payload;
      });

      bus.on('playback:timeupdate', () => {
        order.push('listener');
      });

      bus.emit('playback:timeupdate', { currentTime: 10 });

      expect(order).toEqual(['interceptor', 'listener']);
    });

    it('should transform event data', () => {
      const handler = vi.fn();

      bus.intercept('playback:timeupdate', (payload) => {
        return { currentTime: Math.floor(payload.currentTime) };
      });

      bus.on('playback:timeupdate', handler);

      bus.emit('playback:timeupdate', { currentTime: 10.567 });

      expect(handler).toHaveBeenCalledWith({ currentTime: 10 });
    });

    it('should cancel event if interceptor returns null', () => {
      const handler = vi.fn();

      bus.intercept('playback:play', () => null);

      bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple interceptors in chain', () => {
      const handler = vi.fn();

      bus.intercept('playback:timeupdate', (payload) => {
        return { currentTime: payload.currentTime * 2 };
      });

      bus.intercept('playback:timeupdate', (payload) => {
        return { currentTime: payload.currentTime + 5 };
      });

      bus.on('playback:timeupdate', handler);

      bus.emit('playback:timeupdate', { currentTime: 10 });

      // (10 * 2) + 5 = 25
      expect(handler).toHaveBeenCalledWith({ currentTime: 25 });
    });

    it('should run interceptors in registration order', () => {
      const order: number[] = [];

      bus.intercept('playback:play', (payload) => {
        order.push(1);
        return payload;
      });

      bus.intercept('playback:play', (payload) => {
        order.push(2);
        return payload;
      });

      bus.intercept('playback:play', (payload) => {
        order.push(3);
        return payload;
      });

      bus.emit('playback:play', undefined);

      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle errors in interceptors', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn();

      bus.intercept('playback:play', () => {
        throw new Error('Interceptor error');
      });

      bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);

      expect(errorSpy).toHaveBeenCalled();
      // Handler still called with original payload after error
      expect(handler).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('should return remove interceptor function', () => {
      const handler = vi.fn();
      const interceptor = vi.fn((payload) => payload);

      const removeInterceptor = bus.intercept('playback:play', interceptor);

      bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);
      expect(interceptor).toHaveBeenCalledTimes(1);

      removeInterceptor();

      bus.emit('playback:play', undefined);
      expect(interceptor).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should support async interceptors', async () => {
      const handler = vi.fn();

      bus.intercept('playback:timeupdate', async (payload) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { currentTime: payload.currentTime * 2 };
      });

      bus.on('playback:timeupdate', handler);

      await bus.emitAsync('playback:timeupdate', { currentTime: 10 });

      expect(handler).toHaveBeenCalledWith({ currentTime: 20 });
    });

    it('should stop chain if interceptor cancels event', () => {
      const interceptor1 = vi.fn((payload) => payload);
      const interceptor2 = vi.fn(() => null);
      const interceptor3 = vi.fn((payload) => payload);
      const handler = vi.fn();

      bus.intercept('playback:play', interceptor1);
      bus.intercept('playback:play', interceptor2);
      bus.intercept('playback:play', interceptor3);
      bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);

      expect(interceptor1).toHaveBeenCalledTimes(1);
      expect(interceptor2).toHaveBeenCalledTimes(1);
      expect(interceptor3).not.toHaveBeenCalled(); // Chain stopped
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for specific event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('playback:play', handler1);
      bus.on('playback:pause', handler2);

      bus.removeAllListeners('playback:play');

      bus.emit('playback:play', undefined);
      bus.emit('playback:pause', undefined);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for all events', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      bus.on('playback:play', handler1);
      bus.on('playback:pause', handler2);
      bus.on('volume:change', handler3);

      bus.removeAllListeners();

      bus.emit('playback:play', undefined);
      bus.emit('playback:pause', undefined);
      bus.emit('volume:change', { volume: 0.5, muted: false });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should remove once listeners', () => {
      const handler = vi.fn();

      bus.once('playback:play', handler);

      bus.removeAllListeners('playback:play');

      bus.emit('playback:play', undefined);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return 0 for event with no listeners', () => {
      expect(bus.listenerCount('playback:play')).toBe(0);
    });

    it('should return correct count for event', () => {
      bus.on('playback:play', () => {});
      expect(bus.listenerCount('playback:play')).toBe(1);

      bus.on('playback:play', () => {});
      expect(bus.listenerCount('playback:play')).toBe(2);

      bus.on('playback:play', () => {});
      expect(bus.listenerCount('playback:play')).toBe(3);
    });

    it('should include once listeners in count', () => {
      bus.on('playback:play', () => {});
      bus.once('playback:play', () => {});

      expect(bus.listenerCount('playback:play')).toBe(2);
    });

    it('should update count after removing listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('playback:play', handler1);
      bus.on('playback:play', handler2);

      expect(bus.listenerCount('playback:play')).toBe(2);

      bus.off('playback:play', handler1);

      expect(bus.listenerCount('playback:play')).toBe(1);
    });
  });

  describe('destroy', () => {
    it('should clear all listeners', () => {
      bus.on('playback:play', vi.fn());
      bus.on('playback:pause', vi.fn());
      bus.on('volume:change', vi.fn());

      bus.destroy();

      expect(bus.listenerCount('playback:play')).toBe(0);
      expect(bus.listenerCount('playback:pause')).toBe(0);
      expect(bus.listenerCount('volume:change')).toBe(0);
    });

    it('should clear all interceptors', () => {
      const handler = vi.fn();
      const interceptor = vi.fn((payload) => payload);

      bus.intercept('playback:play', interceptor);
      bus.on('playback:play', handler);

      bus.destroy();

      bus.on('playback:play', handler);
      bus.emit('playback:play', undefined);

      expect(interceptor).not.toHaveBeenCalled();
    });

    it('should clear once listeners', () => {
      bus.once('playback:play', vi.fn());

      bus.destroy();

      expect(bus.listenerCount('playback:play')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle emitting with no listeners', () => {
      expect(() => bus.emit('playback:play', undefined)).not.toThrow();
    });

    it('should handle listener adding more listeners during emit', () => {
      const handler2 = vi.fn();

      bus.on('playback:play', () => {
        bus.on('playback:play', handler2);
      });

      bus.emit('playback:play', undefined);

      // handler2 not called in first emit
      expect(handler2).not.toHaveBeenCalled();

      bus.emit('playback:play', undefined);

      // handler2 called in second emit
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle listener removing itself during emit', () => {
      let unsub: (() => void) | undefined;
      const handler = vi.fn(() => {
        if (unsub) unsub();
      });

      unsub = bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);
      expect(handler).toHaveBeenCalledTimes(1);

      bus.emit('playback:play', undefined);
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle recursive emit calls', () => {
      const handler = vi.fn((payload: { currentTime: number }) => {
        if (payload.currentTime < 3) {
          bus.emit('playback:timeupdate', { currentTime: payload.currentTime + 1 });
        }
      });

      bus.on('playback:timeupdate', handler as any);

      bus.emit('playback:timeupdate', { currentTime: 0 });

      // Called for currentTime 0, 1, 2, 3
      expect(handler).toHaveBeenCalledTimes(4);
    });

    it('should handle same handler registered multiple times', () => {
      const handler = vi.fn();

      bus.on('playback:play', handler);
      bus.on('playback:play', handler);
      bus.on('playback:play', handler);

      bus.emit('playback:play', undefined);

      // Called once (Sets deduplicate)
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('options', () => {
    it('should accept maxListeners option', () => {
      const customBus = new EventBus({ maxListeners: 5 });

      for (let i = 0; i < 5; i++) {
        customBus.on('playback:play', () => {});
      }

      expect(customBus.listenerCount('playback:play')).toBe(5);
    });

    it('should warn when max listeners exceeded', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const customBus = new EventBus({ maxListeners: 2 });

      customBus.on('playback:play', () => {});
      customBus.on('playback:play', () => {});
      customBus.on('playback:play', () => {});

      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain('Max listeners');

      warnSpy.mockRestore();
    });

    it('should respect interceptors option', () => {
      const busNoInterceptors = new EventBus({ interceptors: false });
      const interceptor = vi.fn((payload) => payload);
      const handler = vi.fn();

      busNoInterceptors.intercept('playback:play', interceptor);
      busNoInterceptors.on('playback:play', handler);

      busNoInterceptors.emit('playback:play', undefined);

      expect(interceptor).not.toHaveBeenCalled(); // Interceptors disabled
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
