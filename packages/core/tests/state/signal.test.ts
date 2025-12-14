/**
 * Signal Tests - Comprehensive test suite for Signal class
 *
 * Target: 95%+ code coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Signal, signal } from '../../src/state/signal';
import { effect, currentEffect } from '../../src/state/effect';

describe('Signal', () => {
  describe('constructor and initialization', () => {
    it('should create signal with initial value', () => {
      const count = new Signal(0);
      expect(count.get()).toBe(0);
    });

    it('should create signal with complex initial value', () => {
      const obj = { name: 'test', value: 42 };
      const s = new Signal(obj);
      expect(s.get()).toBe(obj);
    });

    it('should create signal with null', () => {
      const s = new Signal(null);
      expect(s.get()).toBe(null);
    });

    it('should create signal with undefined', () => {
      const s = new Signal<string | undefined>(undefined);
      expect(s.get()).toBe(undefined);
    });
  });

  describe('get()', () => {
    it('should return current value', () => {
      const s = new Signal(42);
      expect(s.get()).toBe(42);
    });

    it('should track dependency when called in effect context', () => {
      const s = new Signal(0);
      const fn = vi.fn();

      effect(() => {
        s.get();
        fn();
      });

      expect(fn).toHaveBeenCalledTimes(1);

      s.set(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not track dependency when called outside effect', () => {
      const s = new Signal(0);
      expect(s.get()).toBe(0);
      expect(s.getSubscriberCount()).toBe(0);
    });
  });

  describe('set()', () => {
    it('should update value', () => {
      const s = new Signal(0);
      s.set(42);
      expect(s.get()).toBe(42);
    });

    it('should notify subscribers when value changes', () => {
      const s = new Signal(0);
      const fn = vi.fn();
      s.subscribe(fn);

      s.set(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not notify if value is the same (Object.is)', () => {
      const s = new Signal(42);
      const fn = vi.fn();
      s.subscribe(fn);

      s.set(42);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should handle NaN correctly with Object.is', () => {
      const s = new Signal(NaN);
      const fn = vi.fn();
      s.subscribe(fn);

      s.set(NaN);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should distinguish +0 and -0', () => {
      const s = new Signal(0);
      const fn = vi.fn();
      s.subscribe(fn);

      s.set(-0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should notify multiple subscribers', () => {
      const s = new Signal(0);
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const fn3 = vi.fn();

      s.subscribe(fn1);
      s.subscribe(fn2);
      s.subscribe(fn3);

      s.set(1);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in subscribers gracefully', () => {
      const s = new Signal(0);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodFn = vi.fn();

      s.subscribe(() => {
        throw new Error('Subscriber error');
      });
      s.subscribe(goodFn);

      s.set(1);

      expect(errorSpy).toHaveBeenCalled();
      expect(goodFn).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });

  describe('update()', () => {
    it('should update value using updater function', () => {
      const s = new Signal(0);
      s.update(n => n + 1);
      expect(s.get()).toBe(1);
    });

    it('should pass current value to updater', () => {
      const s = new Signal(10);
      s.update(n => n * 2);
      expect(s.get()).toBe(20);
    });

    it('should notify subscribers when updated', () => {
      const s = new Signal(0);
      const fn = vi.fn();
      s.subscribe(fn);

      s.update(n => n + 1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not notify if updater returns same value', () => {
      const s = new Signal(42);
      const fn = vi.fn();
      s.subscribe(fn);

      s.update(n => n);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should work with complex updaters', () => {
      const s = new Signal({ count: 0, name: 'test' });
      s.update(obj => ({ ...obj, count: obj.count + 1 }));
      expect(s.get()).toEqual({ count: 1, name: 'test' });
    });
  });

  describe('subscribe()', () => {
    it('should add subscriber', () => {
      const s = new Signal(0);
      const fn = vi.fn();

      s.subscribe(fn);
      expect(s.getSubscriberCount()).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const s = new Signal(0);
      const fn = vi.fn();

      const unsub = s.subscribe(fn);
      expect(typeof unsub).toBe('function');
    });

    it('should unsubscribe when calling returned function', () => {
      const s = new Signal(0);
      const fn = vi.fn();

      const unsub = s.subscribe(fn);
      expect(s.getSubscriberCount()).toBe(1);

      unsub();
      expect(s.getSubscriberCount()).toBe(0);
    });

    it('should not call unsubscribed callback', () => {
      const s = new Signal(0);
      const fn = vi.fn();

      const unsub = s.subscribe(fn);
      unsub();

      s.set(1);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribe/unsubscribe', () => {
      const s = new Signal(0);
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      const unsub1 = s.subscribe(fn1);
      const unsub2 = s.subscribe(fn2);
      expect(s.getSubscriberCount()).toBe(2);

      unsub1();
      expect(s.getSubscriberCount()).toBe(1);

      s.set(1);
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledTimes(1);

      unsub2();
      expect(s.getSubscriberCount()).toBe(0);
    });
  });

  describe('destroy()', () => {
    it('should clear all subscribers', () => {
      const s = new Signal(0);
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      s.subscribe(fn1);
      s.subscribe(fn2);
      expect(s.getSubscriberCount()).toBe(2);

      s.destroy();
      expect(s.getSubscriberCount()).toBe(0);
    });

    it('should not notify after destroy', () => {
      const s = new Signal(0);
      const fn = vi.fn();

      s.subscribe(fn);
      s.destroy();

      s.set(1);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('getSubscriberCount()', () => {
    it('should return 0 initially', () => {
      const s = new Signal(0);
      expect(s.getSubscriberCount()).toBe(0);
    });

    it('should return correct count after subscriptions', () => {
      const s = new Signal(0);

      s.subscribe(() => {});
      expect(s.getSubscriberCount()).toBe(1);

      s.subscribe(() => {});
      expect(s.getSubscriberCount()).toBe(2);

      s.subscribe(() => {});
      expect(s.getSubscriberCount()).toBe(3);
    });
  });

  describe('signal() helper', () => {
    it('should create a Signal instance', () => {
      const s = signal(42);
      expect(s).toBeInstanceOf(Signal);
      expect(s.get()).toBe(42);
    });

    it('should work with type inference', () => {
      const count = signal(0);
      const name = signal('test');
      const flag = signal(true);

      expect(count.get()).toBe(0);
      expect(name.get()).toBe('test');
      expect(flag.get()).toBe(true);
    });
  });

  describe('integration with effects', () => {
    it('should trigger effect when signal changes', () => {
      const count = signal(0);
      const values: number[] = [];

      effect(() => {
        values.push(count.get());
      });

      expect(values).toEqual([0]);

      count.set(1);
      expect(values).toEqual([0, 1]);

      count.set(2);
      expect(values).toEqual([0, 1, 2]);
    });

    it('should track multiple signals in one effect', () => {
      const a = signal(1);
      const b = signal(2);
      const fn = vi.fn();

      effect(() => {
        a.get();
        b.get();
        fn();
      });

      expect(fn).toHaveBeenCalledTimes(1);

      a.set(10);
      expect(fn).toHaveBeenCalledTimes(2);

      b.set(20);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not track signals accessed outside effect', () => {
      const a = signal(1);
      const b = signal(2);
      const fn = vi.fn();

      const outsideValue = a.get(); // Not tracked

      effect(() => {
        b.get();
        fn();
      });

      expect(fn).toHaveBeenCalledTimes(1);

      a.set(10); // Should not trigger effect
      expect(fn).toHaveBeenCalledTimes(1);

      b.set(20); // Should trigger effect
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive updates', () => {
      const s = signal(0);
      const fn = vi.fn();
      s.subscribe(fn);

      for (let i = 1; i <= 100; i++) {
        s.set(i);
      }

      expect(fn).toHaveBeenCalledTimes(100);
      expect(s.get()).toBe(100);
    });

    it('should handle object references correctly', () => {
      const obj1 = { value: 1 };
      const obj2 = { value: 1 };
      const s = signal(obj1);
      const fn = vi.fn();
      s.subscribe(fn);

      s.set(obj1); // Same reference, should not notify
      expect(fn).not.toHaveBeenCalled();

      s.set(obj2); // Different reference, should notify
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle array values', () => {
      const s = signal([1, 2, 3]);
      const fn = vi.fn();
      s.subscribe(fn);

      s.set([1, 2, 3]); // Different array instance
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should safely unsubscribe during notification', () => {
      const s = signal(0);
      let unsub: (() => void) | undefined;
      const fn = vi.fn(() => {
        if (unsub) unsub();
      });

      unsub = s.subscribe(fn);

      s.set(1);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(s.getSubscriberCount()).toBe(0);
    });
  });
});
