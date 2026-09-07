/**
 * Reactivity tests for the Vue bindings (PR-2.4 / SP-51).
 *
 * `isBuffering` and `live` must track the player's state, and the player
 * instance itself must be held raw rather than wrapped in a reactive proxy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isReactive, isRef, ref, nextTick } from 'vue';
import type { StateChangeEvent } from '@scarlett-player/core';

/** State subscribers the fake player has handed out. */
const stateSubscribers: Array<(event: StateChangeEvent) => void> = [];

/** Snapshot the fake player reports from getState(). */
let snapshot: Record<string, unknown> = { buffering: false, live: false };

vi.mock('@scarlett-player/core', () => {
  class MockPlayer {
    /** A private field: a reactive proxy around the instance breaks these. */
    #secret = 'intact';

    init = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn();
    on = vi.fn();
    getState = vi.fn(() => snapshot);
    subscribeToState = vi.fn((cb: (event: StateChangeEvent) => void) => {
      stateSubscribers.push(cb);

      return vi.fn();
    });

    readSecret(): string {
      return this.#secret;
    }
  }

  return { ScarlettPlayer: MockPlayer };
});

/** Push a state change through every live subscriber. */
const pushState = (key: string, value: unknown, previousValue: unknown = null): void => {
  snapshot = { ...snapshot, [key]: value };
  stateSubscribers.forEach((cb) =>
    cb({ key, value, previousValue } as unknown as StateChangeEvent)
  );
};

describe('useScarlettPlayer reactivity', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    stateSubscribers.length = 0;
    snapshot = { buffering: false, live: false };
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  const mount = async () => {
    const { useScarlettPlayer } = await import('../src/composables/useScarlettPlayer');
    const result = useScarlettPlayer({
      container: ref<HTMLElement | null>(container),
      src: 'https://example.com/video.m3u8',
      autoInit: false,
    });
    await result.init();

    return result;
  };

  it('updates isBuffering when the player starts and stops buffering', async () => {
    const result = await mount();

    expect(result.isBuffering.value).toBe(false);

    pushState('buffering', true, false);
    await nextTick();
    expect(result.isBuffering.value).toBe(true);

    pushState('buffering', false, true);
    await nextTick();
    expect(result.isBuffering.value).toBe(false);
  });

  it('exposes a reactive live ref', async () => {
    const result = await mount();

    expect(isRef(result.live)).toBe(true);
    expect(result.live.value).toBe(false);

    pushState('live', true, false);
    await nextTick();
    expect(result.live.value).toBe(true);
  });

  it('seeds both from the snapshot the player already has', async () => {
    snapshot = { buffering: true, live: true };

    const result = await mount();

    expect(result.isBuffering.value).toBe(true);
    expect(result.live.value).toBe(true);
  });

  it('ignores state changes for other keys', async () => {
    const result = await mount();

    pushState('currentTime', 42, 41);
    await nextTick();

    expect(result.isBuffering.value).toBe(false);
    expect(result.live.value).toBe(false);
  });

  it('holds the player raw rather than in a reactive proxy', async () => {
    const result = await mount();

    expect(result.player.value).not.toBeNull();
    expect(isReactive(result.player.value)).toBe(false);
    // A reactive Proxy would throw reading a private class field through `this`.
    expect(
      (result.player.value as unknown as { readSecret(): string }).readSecret()
    ).toBe('intact');
  });
});
