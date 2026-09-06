/**
 * ScarlettPlayer.vue component tests.
 *
 * The component's contract is which props reach a RUNNING player. `poster`
 * used to be read once, at construction, so a page that swapped the artwork
 * (a playlist moving on, a tenant switching cards) left the old image on the
 * element with nothing to say why.
 *
 * Mounted with plain `createApp` rather than @vue/test-utils, which this
 * package does not depend on.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type { PlayerEventMap } from '@scarlett-player/core';

const mockPlayer = {
  init: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn(),
  load: vi.fn().mockResolvedValue(undefined),
  setVolume: vi.fn(),
  setMuted: vi.fn(),
  setAutoplay: vi.fn(),
  setPoster: vi.fn(),
  on: vi.fn(),
};

vi.mock('@scarlett-player/core', () => ({
  ScarlettPlayer: vi.fn().mockImplementation(() => mockPlayer),
}));

/**
 * Let the component's async onMounted settle.
 *
 * It awaits a dynamic import before constructing the player, so a couple of
 * microtask turns are not enough: the macrotask turn is what lets the module
 * resolve.
 */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
};

describe('ScarlettPlayer.vue poster prop', () => {
  let host: HTMLDivElement;
  let app: ReturnType<typeof createApp> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement('div');
    document.body.appendChild(host);
    app = null;
  });

  afterEach(() => {
    app?.unmount();
    host.remove();
  });

  /**
   * Mount the component with a reactive poster and return a setter for it.
   *
   * @param initial - Poster the player is constructed with
   */
  const mountWithPoster = async (initial?: string) => {
    const { default: ScarlettPlayerComponent } = await import('../src/ScarlettPlayer.vue');
    const poster = ref<string | undefined>(initial);

    app = createApp(
      defineComponent({
        setup() {
          return () => h(ScarlettPlayerComponent, { poster: poster.value });
        },
      })
    );
    app.mount(host);
    await settle();

    return poster;
  };

  it('passes the poster to the player at construction', async () => {
    const { ScarlettPlayer } = (await import('@scarlett-player/core')) as any;

    await mountWithPoster('https://cdn.test/first.jpg');

    expect(ScarlettPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ poster: 'https://cdn.test/first.jpg' })
    );
  });

  it('calls setPoster when the prop changes', async () => {
    const poster = await mountWithPoster('https://cdn.test/first.jpg');

    poster.value = 'https://cdn.test/second.jpg';
    await nextTick();

    expect(mockPlayer.setPoster).toHaveBeenCalledWith('https://cdn.test/second.jpg');
  });

  it('clears the poster when the prop is unset', async () => {
    const poster = await mountWithPoster('https://cdn.test/first.jpg');

    poster.value = undefined;
    await nextTick();

    // '' rather than a skipped call: clearing the prop means "take the image
    // away", and both providers read an empty value as exactly that.
    expect(mockPlayer.setPoster).toHaveBeenCalledWith('');
  });

  it('does not call setPoster while the prop is unchanged', async () => {
    await mountWithPoster('https://cdn.test/first.jpg');

    await nextTick();

    expect(mockPlayer.setPoster).not.toHaveBeenCalled();
  });
});

describe('ScarlettPlayer.vue timeupdate event', () => {
  let host: HTMLDivElement;
  let app: ReturnType<typeof createApp> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement('div');
    document.body.appendChild(host);
    app = null;
  });

  afterEach(() => {
    app?.unmount();
    host.remove();
  });

  it('forwards the core payload unchanged, without a duration', async () => {
    const { default: ScarlettPlayerComponent } = await import('../src/ScarlettPlayer.vue');
    const onTimeUpdate = vi.fn();

    app = createApp(
      defineComponent({
        setup() {
          return () => h(ScarlettPlayerComponent, { onTimeupdate: onTimeUpdate });
        },
      })
    );
    app.mount(host);
    await settle();

    const handler = mockPlayer.on.mock.calls.find(
      ([event]) => event === 'playback:timeupdate'
    )?.[1];
    expect(handler).toBeTypeOf('function');

    handler({ currentTime: 12.5 });

    // The documented contract is `{ currentTime }`. Anything else here would
    // mean the component is padding the payload or the typing is drifting.
    expect(onTimeUpdate).toHaveBeenCalledWith({ currentTime: 12.5 });
  });
});

describe('ScarlettPlayer.vue typed event payloads', () => {
  let host: HTMLDivElement;
  let app: ReturnType<typeof createApp> | null;
  let consoleError: { mockRestore(): void };

  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement('div');
    document.body.appendChild(host);
    app = null;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    app?.unmount();
    host.remove();
    consoleError.mockRestore();
  });

  it('forwards core media, quality, and error payloads unchanged', async () => {
    const { default: ScarlettPlayerComponent } = await import('../src/ScarlettPlayer.vue');
    const onLoaded = vi.fn();
    const onLoadedmetadata = vi.fn();
    const onQualitylevels = vi.fn();
    const onError = vi.fn();
    app = createApp(ScarlettPlayerComponent, {
      onLoaded, onLoadedmetadata, onQualitylevels, onError,
    });
    app.mount(host);
    await settle();

    const payloads: Pick<PlayerEventMap, 'media:loaded' | 'media:loadedmetadata' | 'quality:levels' | 'error'> = {
      'media:loaded': { src: 'track.mp3', type: 'audio/mpeg' },
      'media:loadedmetadata': { duration: 120 },
      'quality:levels': { levels: [{ id: '0', label: '720p' }] },
      error: { code: 'SOURCE_LOAD_FAILED' as PlayerEventMap['error']['code'], message: 'Failed', fatal: true, timestamp: 1 },
    };
    for (const [event, payload] of Object.entries(payloads)) {
      const handler = mockPlayer.on.mock.calls.find(([name]) => name === event)?.[1];
      expect(handler).toBeTypeOf('function');
      handler(payload);
    }

    expect(onLoaded.mock.calls[0][0]).toBe(payloads['media:loaded']);
    expect(onLoadedmetadata.mock.calls[0][0]).toBe(payloads['media:loadedmetadata']);
    expect(onQualitylevels.mock.calls[0][0]).toBe(payloads['quality:levels']);
    expect(onError.mock.calls[0][0]).toBe(payloads.error);
  });

  it.each([new Error('Init failed'), 'Init failed'])('emits an Error for init rejection %s', async (failure) => {
    const { default: ScarlettPlayerComponent } = await import('../src/ScarlettPlayer.vue');
    mockPlayer.init.mockRejectedValueOnce(failure);
    const onError = vi.fn();
    app = createApp(ScarlettPlayerComponent, { onError });
    app.mount(host);
    await settle();

    expect(onError).toHaveBeenCalledOnce();
    const emitted = onError.mock.calls[0][0];
    expect(emitted).toBeInstanceOf(Error);
    expect(emitted.message).toBe('Init failed');
    if (failure instanceof Error) expect(emitted).toBe(failure);
  });
});
