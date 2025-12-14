/**
 * StateManager Tests - Comprehensive test suite for StateManager class
 *
 * Target: 95%+ code coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateManager } from '../../src/state/state-manager';
import type { StateChangeEvent } from '../../src/types/state';

describe('StateManager', () => {
  let state: StateManager;

  beforeEach(() => {
    state = new StateManager();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(state.getValue('playing')).toBe(false);
      expect(state.getValue('paused')).toBe(true);
      expect(state.getValue('playbackState')).toBe('idle');
      expect(state.getValue('currentTime')).toBe(0);
      expect(state.getValue('duration')).toBeNaN();
      expect(state.getValue('volume')).toBe(1.0);
      expect(state.getValue('muted')).toBe(false);
    });

    it('should initialize all 50+ state properties', () => {
      const snapshot = state.snapshot();

      // Core playback
      expect(snapshot).toHaveProperty('playbackState');
      expect(snapshot).toHaveProperty('playing');
      expect(snapshot).toHaveProperty('paused');
      expect(snapshot).toHaveProperty('ended');
      expect(snapshot).toHaveProperty('buffering');
      expect(snapshot).toHaveProperty('waiting');

      // Time
      expect(snapshot).toHaveProperty('currentTime');
      expect(snapshot).toHaveProperty('duration');
      expect(snapshot).toHaveProperty('buffered');
      expect(snapshot).toHaveProperty('bufferedAmount');

      // Media info
      expect(snapshot).toHaveProperty('mediaType');
      expect(snapshot).toHaveProperty('source');
      expect(snapshot).toHaveProperty('title');
      expect(snapshot).toHaveProperty('poster');

      // Volume
      expect(snapshot).toHaveProperty('volume');
      expect(snapshot).toHaveProperty('muted');

      // Controls
      expect(snapshot).toHaveProperty('playbackRate');
      expect(snapshot).toHaveProperty('fullscreen');
      expect(snapshot).toHaveProperty('pip');
      expect(snapshot).toHaveProperty('controlsVisible');

      // Quality & Tracks
      expect(snapshot).toHaveProperty('qualities');
      expect(snapshot).toHaveProperty('currentQuality');
      expect(snapshot).toHaveProperty('audioTracks');
      expect(snapshot).toHaveProperty('currentAudioTrack');
      expect(snapshot).toHaveProperty('textTracks');
      expect(snapshot).toHaveProperty('currentTextTrack');

      // Live/DVR (TSP)
      expect(snapshot).toHaveProperty('live');
      expect(snapshot).toHaveProperty('liveEdge');
      expect(snapshot).toHaveProperty('seekableRange');
      expect(snapshot).toHaveProperty('liveLatency');
      expect(snapshot).toHaveProperty('lowLatencyMode');

      // Chapters (TSP)
      expect(snapshot).toHaveProperty('chapters');
      expect(snapshot).toHaveProperty('currentChapter');

      // Error
      expect(snapshot).toHaveProperty('error');

      // Network
      expect(snapshot).toHaveProperty('bandwidth');
      expect(snapshot).toHaveProperty('autoplay');
      expect(snapshot).toHaveProperty('loop');

      // UI
      expect(snapshot).toHaveProperty('interacting');
      expect(snapshot).toHaveProperty('hovering');
      expect(snapshot).toHaveProperty('focused');
    });

    it('should accept custom initial state', () => {
      const custom = new StateManager({
        playing: true,
        volume: 0.5,
        title: 'Test Video',
      });

      expect(custom.getValue('playing')).toBe(true);
      expect(custom.getValue('volume')).toBe(0.5);
      expect(custom.getValue('title')).toBe('Test Video');
      expect(custom.getValue('paused')).toBe(true); // Still default
    });

    it('should merge custom state with defaults', () => {
      const custom = new StateManager({ playing: true });

      expect(custom.getValue('playing')).toBe(true);
      expect(custom.getValue('volume')).toBe(1.0); // Default preserved
    });
  });

  describe('get()', () => {
    it('should return a signal', () => {
      const playingSignal = state.get('playing');

      expect(playingSignal).toBeDefined();
      expect(typeof playingSignal.get).toBe('function');
      expect(typeof playingSignal.set).toBe('function');
    });

    it('should return signal with current value', () => {
      state.set('playing', true);

      const playingSignal = state.get('playing');
      expect(playingSignal.get()).toBe(true);
    });

    it('should throw error for unknown key', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid key
        state.get('unknownKey');
      }).toThrow('[StateManager] Unknown state key');
    });

    it('should return same signal instance on multiple calls', () => {
      const signal1 = state.get('playing');
      const signal2 = state.get('playing');

      expect(signal1).toBe(signal2);
    });
  });

  describe('getValue()', () => {
    it('should get current value directly', () => {
      state.set('playing', true);
      expect(state.getValue('playing')).toBe(true);
    });

    it('should reflect signal changes', () => {
      const playingSignal = state.get('playing');

      playingSignal.set(true);
      expect(state.getValue('playing')).toBe(true);

      playingSignal.set(false);
      expect(state.getValue('playing')).toBe(false);
    });
  });

  describe('set()', () => {
    it('should set signal value', () => {
      state.set('playing', true);
      expect(state.getValue('playing')).toBe(true);
    });

    it('should update multiple different properties', () => {
      state.set('playing', true);
      state.set('currentTime', 10.5);
      state.set('volume', 0.8);

      expect(state.getValue('playing')).toBe(true);
      expect(state.getValue('currentTime')).toBe(10.5);
      expect(state.getValue('volume')).toBe(0.8);
    });

    it('should not notify if value unchanged', () => {
      const fn = vi.fn();
      state.subscribeToKey('playing', fn);

      state.set('playing', false); // Same as default
      expect(fn).not.toHaveBeenCalled();

      state.set('playing', true); // Changed
      expect(fn).toHaveBeenCalledTimes(1);

      state.set('playing', true); // Unchanged
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('update()', () => {
    it('should update multiple properties at once', () => {
      state.update({
        playing: true,
        currentTime: 15,
        volume: 0.7,
      });

      expect(state.getValue('playing')).toBe(true);
      expect(state.getValue('currentTime')).toBe(15);
      expect(state.getValue('volume')).toBe(0.7);
    });

    it('should only update provided properties', () => {
      state.update({ playing: true });

      expect(state.getValue('playing')).toBe(true);
      expect(state.getValue('paused')).toBe(true); // Unchanged
    });

    it('should handle empty update', () => {
      expect(() => state.update({})).not.toThrow();
    });

    it('should ignore invalid keys', () => {
      state.update({
        playing: true,
        // @ts-expect-error - Testing invalid key
        invalidKey: 'test',
      });

      expect(state.getValue('playing')).toBe(true);
    });
  });

  describe('subscribeToKey()', () => {
    it('should subscribe to specific state property', () => {
      const fn = vi.fn();
      state.subscribeToKey('playing', fn);

      state.set('playing', true);
      expect(fn).toHaveBeenCalledWith(true);
    });

    it('should receive current value on change', () => {
      const values: number[] = [];
      state.subscribeToKey('currentTime', (value) => {
        values.push(value);
      });

      state.set('currentTime', 10);
      state.set('currentTime', 20);
      state.set('currentTime', 30);

      expect(values).toEqual([10, 20, 30]);
    });

    it('should return unsubscribe function', () => {
      const fn = vi.fn();
      const unsub = state.subscribeToKey('playing', fn);

      state.set('playing', true);
      expect(fn).toHaveBeenCalledTimes(1);

      unsub();

      state.set('playing', false);
      expect(fn).toHaveBeenCalledTimes(1); // Not called after unsub
    });

    it('should not notify other properties', () => {
      const playingFn = vi.fn();
      const volumeFn = vi.fn();

      state.subscribeToKey('playing', playingFn);
      state.subscribeToKey('volume', volumeFn);

      state.set('playing', true);

      expect(playingFn).toHaveBeenCalledTimes(1);
      expect(volumeFn).not.toHaveBeenCalled();
    });
  });

  describe('subscribe()', () => {
    it('should subscribe to all state changes', () => {
      const events: StateChangeEvent[] = [];
      state.subscribe((event) => events.push(event));

      state.set('playing', true);
      state.set('volume', 0.5);

      expect(events).toHaveLength(2);
      expect(events[0].key).toBe('playing');
      expect(events[0].value).toBe(true);
      expect(events[1].key).toBe('volume');
      expect(events[1].value).toBe(0.5);
    });

    it('should return unsubscribe function', () => {
      const fn = vi.fn();
      const unsub = state.subscribe(fn);

      state.set('playing', true);
      expect(fn).toHaveBeenCalledTimes(1);

      unsub();

      state.set('playing', false);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in subscribers gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodFn = vi.fn();

      state.subscribe(() => {
        throw new Error('Subscriber error');
      });
      state.subscribe(goodFn);

      state.set('playing', true);

      expect(errorSpy).toHaveBeenCalled();
      expect(goodFn).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should notify multiple subscribers', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const fn3 = vi.fn();

      state.subscribe(fn1);
      state.subscribe(fn2);
      state.subscribe(fn3);

      state.set('playing', true);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset()', () => {
    it('should reset all state to defaults', () => {
      state.update({
        playing: true,
        currentTime: 100,
        volume: 0.5,
        title: 'Test',
      });

      state.reset();

      expect(state.getValue('playing')).toBe(false);
      expect(state.getValue('currentTime')).toBe(0);
      expect(state.getValue('volume')).toBe(1.0);
      expect(state.getValue('title')).toBe('');
    });

    it('should notify subscribers on reset', () => {
      const fn = vi.fn();
      state.subscribeToKey('playing', fn);

      state.set('playing', true);
      expect(fn).toHaveBeenCalledTimes(1);

      state.reset();
      expect(fn).toHaveBeenCalledTimes(2); // Called again
      expect(fn).toHaveBeenLastCalledWith(false);
    });
  });

  describe('resetKey()', () => {
    it('should reset single property to default', () => {
      state.set('playing', true);
      state.set('volume', 0.5);

      state.resetKey('playing');

      expect(state.getValue('playing')).toBe(false);
      expect(state.getValue('volume')).toBe(0.5); // Unchanged
    });

    it('should notify subscribers', () => {
      const fn = vi.fn();
      state.subscribeToKey('playing', fn);

      state.set('playing', true);
      state.resetKey('playing');

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith(false);
    });
  });

  describe('snapshot()', () => {
    it('should return current state snapshot', () => {
      state.update({
        playing: true,
        currentTime: 10,
        volume: 0.8,
      });

      const snapshot = state.snapshot();

      expect(snapshot.playing).toBe(true);
      expect(snapshot.currentTime).toBe(10);
      expect(snapshot.volume).toBe(0.8);
    });

    it('should return frozen object', () => {
      const snapshot = state.snapshot();

      expect(Object.isFrozen(snapshot)).toBe(true);
    });

    it('should not reflect future changes', () => {
      const snapshot = state.snapshot();
      const initialPlaying = snapshot.playing;

      state.set('playing', true);

      expect(snapshot.playing).toBe(initialPlaying); // Unchanged
    });
  });

  describe('getSubscriberCount()', () => {
    it('should include internal subscriber for change tracking', () => {
      // StateManager subscribes to each signal internally for global change events
      expect(state.getSubscriberCount('playing')).toBe(1);
    });

    it('should return correct count after subscriptions', () => {
      // Starts at 1 due to internal subscriber
      const initial = state.getSubscriberCount('playing');

      state.subscribeToKey('playing', () => {});
      expect(state.getSubscriberCount('playing')).toBe(initial + 1);

      state.subscribeToKey('playing', () => {});
      expect(state.getSubscriberCount('playing')).toBe(initial + 2);
    });

    it('should include global subscribers', () => {
      const initial = state.getSubscriberCount('playing');

      state.subscribe(() => {});
      // Global subscribers don't add extra subscriptions (already subscribed internally)
      expect(state.getSubscriberCount('playing')).toBe(initial);
    });
  });

  describe('destroy()', () => {
    it('should destroy all signals', () => {
      const playingSignal = state.get('playing');

      state.destroy();

      expect(playingSignal.getSubscriberCount()).toBe(0);
    });

    it('should clear all subscribers', () => {
      const fn = vi.fn();
      state.subscribe(fn);

      state.destroy();

      // After destroy, setting values should not notify
      // (though technically the signals are destroyed so set() might error)
      expect(() => state.set('playing', true)).toThrow();
    });

    it('should clear signals map', () => {
      state.destroy();

      expect(() => state.get('playing')).toThrow();
    });
  });

  describe('Live/DVR state (TSP features)', () => {
    it('should manage live state', () => {
      expect(state.getValue('live')).toBe(false);

      state.set('live', true);
      expect(state.getValue('live')).toBe(true);
    });

    it('should manage live edge state', () => {
      expect(state.getValue('liveEdge')).toBe(true);

      state.set('liveEdge', false);
      expect(state.getValue('liveEdge')).toBe(false);
    });

    it('should manage seekable range', () => {
      expect(state.getValue('seekableRange')).toBe(null);

      state.set('seekableRange', { start: 0, end: 300 });
      expect(state.getValue('seekableRange')).toEqual({ start: 0, end: 300 });
    });

    it('should track live latency', () => {
      expect(state.getValue('liveLatency')).toBe(0);

      state.set('liveLatency', 2.5);
      expect(state.getValue('liveLatency')).toBe(2.5);
    });

    it('should manage low latency mode', () => {
      expect(state.getValue('lowLatencyMode')).toBe(false);

      state.set('lowLatencyMode', true);
      expect(state.getValue('lowLatencyMode')).toBe(true);
    });

    it('should subscribe to live state changes', () => {
      const fn = vi.fn();
      state.subscribeToKey('live', fn);

      state.set('live', true);
      expect(fn).toHaveBeenCalledWith(true);
    });
  });

  describe('Chapters state (TSP features)', () => {
    it('should manage chapters array', () => {
      expect(state.getValue('chapters')).toEqual([]);

      const chapters = [
        { time: 0, label: 'Intro' },
        { time: 60, label: 'Round 1' },
        { time: 180, label: 'Round 2' },
      ];

      state.set('chapters', chapters);
      expect(state.getValue('chapters')).toEqual(chapters);
    });

    it('should manage current chapter', () => {
      expect(state.getValue('currentChapter')).toBe(null);

      const chapter = { time: 60, label: 'Round 1' };
      state.set('currentChapter', chapter);

      expect(state.getValue('currentChapter')).toEqual(chapter);
    });

    it('should subscribe to chapter changes', () => {
      const fn = vi.fn();
      state.subscribeToKey('currentChapter', fn);

      const chapter = { time: 60, label: 'Round 1' };
      state.set('currentChapter', chapter);

      expect(fn).toHaveBeenCalledWith(chapter);
    });

    it('should handle chapters with metadata', () => {
      const chapters = [
        {
          time: 0,
          label: 'Fight Start',
          thumbnail: 'https://example.com/thumb1.jpg',
          metadata: { round: 1, fighterId: 'fighter-1' },
        },
      ];

      state.set('chapters', chapters);
      expect(state.getValue('chapters')).toEqual(chapters);
    });
  });

  describe('complex state updates', () => {
    it('should handle rapid successive updates', () => {
      const times: number[] = [];
      state.subscribeToKey('currentTime', (value) => times.push(value));

      // Start from 1 to avoid 0 === 0 (default value)
      for (let i = 1; i <= 100; i++) {
        state.set('currentTime', i * 0.1);
      }

      expect(times).toHaveLength(100);
      expect(state.getValue('currentTime')).toBe(10.0);
    });

    it('should handle batch updates efficiently', () => {
      const fn = vi.fn();
      state.subscribe(fn);

      state.update({
        playing: true,
        currentTime: 10,
        volume: 0.8,
        fullscreen: true,
        playbackRate: 1.5,
      });

      expect(fn).toHaveBeenCalledTimes(5); // Once per property
    });

    it('should maintain consistency across related state', () => {
      state.update({
        playing: true,
        paused: false,
        playbackState: 'playing',
      });

      expect(state.getValue('playing')).toBe(true);
      expect(state.getValue('paused')).toBe(false);
      expect(state.getValue('playbackState')).toBe('playing');
    });
  });

  describe('edge cases', () => {
    it('should handle NaN values', () => {
      state.set('duration', NaN);
      expect(state.getValue('duration')).toBeNaN();

      state.set('duration', 100);
      expect(state.getValue('duration')).toBe(100);
    });

    it('should handle null values', () => {
      state.set('source', { src: 'test.mp4', type: 'video/mp4' });
      expect(state.getValue('source')).not.toBe(null);

      state.set('source', null);
      expect(state.getValue('source')).toBe(null);
    });

    it('should handle empty arrays', () => {
      state.set('chapters', [{ time: 0, label: 'Test' }]);
      state.set('chapters', []);

      expect(state.getValue('chapters')).toEqual([]);
    });

    it('should handle object references correctly', () => {
      const obj1 = { time: 0, label: 'Test' };
      const obj2 = { time: 0, label: 'Test' };

      state.set('currentChapter', obj1);

      const fn = vi.fn();
      state.subscribeToKey('currentChapter', fn);

      state.set('currentChapter', obj1); // Same reference
      expect(fn).not.toHaveBeenCalled();

      state.set('currentChapter', obj2); // Different reference
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
