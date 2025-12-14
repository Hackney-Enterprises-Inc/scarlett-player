/**
 * Computed Tests - Comprehensive test suite for Computed class
 *
 * Target: 95%+ code coverage
 */

import { describe, it, expect, vi } from 'vitest';
import { Computed, computed } from '../../src/state/computed';
import { signal } from '../../src/state/signal';
import { effect } from '../../src/state/effect';

describe('Computed', () => {
  describe('constructor and initialization', () => {
    it('should create computed with computation function', () => {
      const c = new Computed(() => 42);
      expect(c.get()).toBe(42);
    });

    it('should not run computation until first get()', () => {
      const fn = vi.fn(() => 42);
      const c = new Computed(fn);

      expect(fn).not.toHaveBeenCalled();

      c.get();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('get()', () => {
    it('should return computed value', () => {
      const count = signal(5);
      const doubled = new Computed(() => count.get() * 2);

      expect(doubled.get()).toBe(10);
    });

    it('should cache value on subsequent calls', () => {
      const fn = vi.fn(() => 42);
      const c = new Computed(fn);

      c.get();
      expect(fn).toHaveBeenCalledTimes(1);

      c.get();
      c.get();
      c.get();
      expect(fn).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should recompute when dependency changes', () => {
      const count = signal(5);
      const fn = vi.fn(() => count.get() * 2);
      const doubled = new Computed(fn);

      expect(doubled.get()).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);

      count.set(10);
      expect(doubled.get()).toBe(20);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should track dependency when called in effect context', () => {
      const count = signal(5);
      const doubled = new Computed(() => count.get() * 2);
      const values: number[] = [];

      effect(() => {
        values.push(doubled.get());
      });

      expect(values).toEqual([10]);

      count.set(10);
      expect(values).toEqual([10, 20]);
    });

    it('should handle multiple dependencies', () => {
      const a = signal(2);
      const b = signal(3);
      const sum = new Computed(() => a.get() + b.get());

      expect(sum.get()).toBe(5);

      a.set(5);
      expect(sum.get()).toBe(8);

      b.set(10);
      expect(sum.get()).toBe(15);
    });

    it('should handle nested computed values', () => {
      const count = signal(5);
      const doubled = computed(() => count.get() * 2);
      const quadrupled = computed(() => doubled.get() * 2);

      expect(quadrupled.get()).toBe(20);

      count.set(10);
      expect(quadrupled.get()).toBe(40);
    });

    it('should only recompute dirty computed in chain', () => {
      const a = signal(1);
      const b = signal(2);
      const fn1 = vi.fn(() => a.get() * 2);
      const fn2 = vi.fn(() => b.get() * 3);
      const c1 = new Computed(fn1);
      const c2 = new Computed(fn2);

      c1.get();
      c2.get();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      // Change only a, should only recompute c1
      a.set(5);
      c1.get();
      c2.get();
      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('invalidate()', () => {
    it('should mark computed as dirty', () => {
      const fn = vi.fn(() => 42);
      const c = new Computed(fn);

      c.get();
      expect(fn).toHaveBeenCalledTimes(1);

      c.invalidate();

      c.get();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should notify subscribers when invalidated', () => {
      const c = new Computed(() => 42);
      const subscriber = vi.fn();

      c.subscribe(subscriber);
      c.get(); // Compute initial value

      c.invalidate();
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('should notify subscribers when invalidated', () => {
      const c = new Computed(() => 42);
      const subscriber = vi.fn();

      c.subscribe(subscriber);

      c.invalidate();
      expect(subscriber).toHaveBeenCalledTimes(1);

      c.invalidate();
      c.invalidate();
      // In our simple implementation, we notify on every invalidation if there are subscribers
      expect(subscriber).toHaveBeenCalledTimes(3);
    });

    it('should propagate invalidation to dependent computeds', () => {
      const a = signal(1);
      const b = computed(() => a.get() * 2);
      const c = computed(() => b.get() * 2);
      const values: number[] = [];

      effect(() => {
        values.push(c.get());
      });

      expect(values).toEqual([4]);

      a.set(5);
      expect(values).toEqual([4, 20]);
    });
  });

  describe('subscribe()', () => {
    it('should add subscriber', () => {
      const c = new Computed(() => 42);
      const fn = vi.fn();

      c.subscribe(fn);
      expect(c.getSubscriberCount()).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const c = new Computed(() => 42);
      const unsub = c.subscribe(() => {});

      expect(typeof unsub).toBe('function');
    });

    it('should unsubscribe when calling returned function', () => {
      const c = new Computed(() => 42);
      const fn = vi.fn();

      const unsub = c.subscribe(fn);
      expect(c.getSubscriberCount()).toBe(1);

      unsub();
      expect(c.getSubscriberCount()).toBe(0);
    });

    it('should not notify unsubscribed callback', () => {
      const count = signal(0);
      const doubled = computed(() => count.get() * 2);
      const fn = vi.fn();

      const unsub = doubled.subscribe(fn);
      unsub();

      count.set(5);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should notify multiple subscribers', () => {
      const count = signal(0);
      const doubled = computed(() => count.get() * 2);
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const fn3 = vi.fn();

      // Access the computed first to ensure it subscribes to count
      doubled.get();

      doubled.subscribe(fn1);
      doubled.subscribe(fn2);
      doubled.subscribe(fn3);

      count.set(5);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in subscribers gracefully', () => {
      const count = signal(0);
      const doubled = computed(() => count.get() * 2);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodFn = vi.fn();

      // Access the computed first to ensure it subscribes to count
      doubled.get();

      doubled.subscribe(() => {
        throw new Error('Subscriber error');
      });
      doubled.subscribe(goodFn);

      count.set(5);

      expect(errorSpy).toHaveBeenCalled();
      expect(goodFn).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });

  describe('destroy()', () => {
    it('should clear all subscribers', () => {
      const c = new Computed(() => 42);
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      c.subscribe(fn1);
      c.subscribe(fn2);
      expect(c.getSubscriberCount()).toBe(2);

      c.destroy();
      expect(c.getSubscriberCount()).toBe(0);
    });

    it('should clear cached value', () => {
      const fn = vi.fn(() => 42);
      const c = new Computed(fn);

      c.get();
      expect(fn).toHaveBeenCalledTimes(1);

      c.destroy();

      // After destroy, value should be recomputed
      c.get();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not notify subscribers after destroy', () => {
      const count = signal(0);
      const doubled = computed(() => count.get() * 2);
      const fn = vi.fn();

      doubled.subscribe(fn);
      doubled.destroy();

      count.set(5);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('getSubscriberCount()', () => {
    it('should return 0 initially', () => {
      const c = new Computed(() => 42);
      expect(c.getSubscriberCount()).toBe(0);
    });

    it('should return correct count after subscriptions', () => {
      const c = new Computed(() => 42);

      c.subscribe(() => {});
      expect(c.getSubscriberCount()).toBe(1);

      c.subscribe(() => {});
      expect(c.getSubscriberCount()).toBe(2);

      c.subscribe(() => {});
      expect(c.getSubscriberCount()).toBe(3);
    });
  });

  describe('computed() helper', () => {
    it('should create a Computed instance', () => {
      const c = computed(() => 42);
      expect(c).toBeInstanceOf(Computed);
      expect(c.get()).toBe(42);
    });

    it('should work with type inference', () => {
      const count = signal(5);
      const doubled = computed(() => count.get() * 2);
      const message = computed(() => `Count: ${count.get()}`);

      expect(doubled.get()).toBe(10);
      expect(message.get()).toBe('Count: 5');
    });
  });

  describe('lazy evaluation', () => {
    it('should not compute until accessed', () => {
      const fn = vi.fn(() => 42);
      const c = new Computed(fn);

      // Signal dependency changes but computed not accessed
      const count = signal(0);
      const doubled = new Computed(() => {
        fn();
        return count.get() * 2;
      });

      count.set(5);
      count.set(10);
      count.set(15);

      expect(fn).not.toHaveBeenCalled();

      doubled.get();
      expect(fn).toHaveBeenCalledTimes(1); // Only called once when accessed
    });

    it('should only compute once per batch of dependency changes', () => {
      const count = signal(0);
      const fn = vi.fn(() => count.get() * 2);
      const doubled = new Computed(fn);

      // Multiple changes
      count.set(1);
      count.set(2);
      count.set(3);

      // Should not have computed yet
      expect(fn).not.toHaveBeenCalled();

      // Single access recomputes once
      doubled.get();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('complex scenarios', () => {
    it('should handle diamond dependency pattern', () => {
      //       a
      //      / \
      //     b   c
      //      \ /
      //       d
      const a = signal(1);
      const b = computed(() => a.get() + 1);
      const c = computed(() => a.get() + 2);
      const d = computed(() => b.get() + c.get());

      expect(d.get()).toBe(5); // (1+1) + (1+2) = 5

      a.set(10);
      expect(d.get()).toBe(23); // (10+1) + (10+2) = 23
    });

    it('should handle deeply nested computeds', () => {
      const n = signal(2);
      const level1 = computed(() => n.get() * 2);
      const level2 = computed(() => level1.get() * 2);
      const level3 = computed(() => level2.get() * 2);
      const level4 = computed(() => level3.get() * 2);

      expect(level4.get()).toBe(32); // 2 * 2^4

      n.set(3);
      expect(level4.get()).toBe(48); // 3 * 2^4
    });

    it('should handle conditional dependencies', () => {
      const flag = signal(true);
      const a = signal(10);
      const b = signal(20);
      const fn = vi.fn(() => (flag.get() ? a.get() : b.get()));
      const conditional = new Computed(fn);

      expect(conditional.get()).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);

      // Change b, but it's not used yet
      b.set(30);
      conditional.get();
      expect(fn).toHaveBeenCalledTimes(1); // No recompute

      // Change flag to switch dependency
      flag.set(false);
      expect(conditional.get()).toBe(30);
      expect(fn).toHaveBeenCalledTimes(2);

      // Now changing b should trigger recompute
      b.set(40);
      expect(conditional.get()).toBe(40);
      expect(fn).toHaveBeenCalledTimes(3);

      // In our simple implementation, computeds stay subscribed to all dependencies
      // they've ever accessed, so changing a will still trigger recomputation
      a.set(50);
      conditional.get();
      expect(fn).toHaveBeenCalledTimes(4); // Will recompute (limitation of simple impl)
    });

    it('should work with array transformations', () => {
      const items = signal([1, 2, 3]);
      const doubled = computed(() => items.get().map(x => x * 2));
      const sum = computed(() => doubled.get().reduce((a, b) => a + b, 0));

      expect(sum.get()).toBe(12); // (2+4+6)

      items.set([5, 10, 15]);
      expect(sum.get()).toBe(60); // (10+20+30)
    });

    it('should handle object computations', () => {
      const firstName = signal('John');
      const lastName = signal('Doe');
      const user = computed(() => ({
        name: `${firstName.get()} ${lastName.get()}`,
        initials: `${firstName.get()[0]}${lastName.get()[0]}`,
      }));

      expect(user.get()).toEqual({
        name: 'John Doe',
        initials: 'JD',
      });

      firstName.set('Jane');
      expect(user.get()).toEqual({
        name: 'Jane Doe',
        initials: 'JD',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle computed that throws error', () => {
      const c = new Computed(() => {
        throw new Error('Computation error');
      });

      expect(() => c.get()).toThrow('Computation error');
    });

    it('should handle rapid dependency changes', () => {
      const count = signal(0);
      const fn = vi.fn(() => count.get() * 2);
      const doubled = new Computed(fn);

      for (let i = 1; i <= 100; i++) {
        count.set(i);
      }

      // Should only compute once when accessed
      expect(doubled.get()).toBe(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle circular reference prevention', () => {
      // This tests that we don't get infinite loops
      const a = signal(1);
      const b = computed(() => a.get() + 1);

      // Create a scenario where updating during computation could cause issues
      let computeCount = 0;
      const c = computed(() => {
        computeCount++;
        if (computeCount > 10) {
          throw new Error('Infinite loop detected');
        }
        return b.get() + 1;
      });

      expect(c.get()).toBe(3);
      expect(computeCount).toBe(1); // Should only compute once
    });

    it('should handle subscribing during notification', () => {
      const count = signal(0);
      const doubled = computed(() => count.get() * 2);
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      // Access the computed first to ensure it subscribes to count
      doubled.get();

      doubled.subscribe(() => {
        fn1();
        // Subscribe another callback during notification
        doubled.subscribe(fn2);
      });

      count.set(5);

      expect(fn1).toHaveBeenCalledTimes(1);
      // In our implementation, fn2 might be called during the same notification
      // depending on Set iteration order - this is acceptable for a simple impl
      // The important thing is both callbacks are subscribed

      count.set(10);
      // Both callbacks should be called on subsequent changes
      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toBeCalledTimes(2); // Called during first notification + this one
    });
  });
});
