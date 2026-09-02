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
