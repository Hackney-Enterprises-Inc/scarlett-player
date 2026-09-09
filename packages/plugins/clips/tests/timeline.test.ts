/**
 * Media gates, the timeline extension seam and preview ownership.
 *
 * Three things this covers that nothing else does:
 *
 * 1. **`mediaType: 'unknown'` is not audio.** The HLS provider used to publish
 *    `audio` whenever intrinsic dimensions had not been measured yet, so a
 *    phone playing ordinary video was told clipping was unsupported. Unknown
 *    now has its own reason, its own message, and never auto-opens later.
 * 2. **The handles belong on the playback timeline** when the UI package
 *    offers a place for them - including when the UI arrives late, rebuilds
 *    its bar mid-edit, or is too old to have the seam at all.
 * 3. **Nobody fights over the playhead.** An ordinary seek takes the loop's
 *    ownership away and keeps it; a drag gives back exactly what it found.
 *
 * `@scarlett-player/ui` is mocked so the seam can be driven deterministically
 * and so the "older UI peer" case can be expressed as a module without the
 * export.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { createClipsPlugin } from '../src/index';
import type { ClipOperationError } from '../src/index';
import type { ClipsPluginConfig } from '../src/types';

/** The surface the mocked UI hands the plugin's extension factory. */
interface Surface {
  element: HTMLElement;
  getRailRect(): DOMRect;
  setEditing: ReturnType<typeof vi.fn>;
  setDragging: ReturnType<typeof vi.fn>;
}

/** What the mocked `@scarlett-player/ui` recorded this test. */
const ui = {
  /** Whether the module exposes `registerTimelineExtension` at all. */
  hasSeam: true,
  factory: null as ((surface: Surface) => {
    update(): void;
    onSeekStart(): void;
    onSeekEnd(): void;
    destroy(): void;
  }) | null,
  surface: null as Surface | null,
  extension: null as { update(): void; onSeekStart(): void; onSeekEnd(): void; destroy(): void } | null,
  released: 0,
};

vi.mock('@scarlett-player/ui', () => ({
  registerControl: vi.fn(),
  unregisterControl: vi.fn(),
  get registerTimelineExtension() {
    if (!ui.hasSeam) return undefined;
    return (owner: HTMLElement, factory: (surface: Surface) => never) => {
      ui.factory = factory as never;
      return () => {
        ui.released += 1;
      };
    };
  },
}));

/** Let queued promise callbacks run - the dynamic ui import settles there. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Mount the recorded factory, as the UI's progress bar would. */
function mountExtension(container: HTMLElement): Surface {
  const element = document.createElement('div');
  container.appendChild(element);
  const surface: Surface = {
    element,
    getRailRect: () =>
      ({ left: 0, top: 300, width: 600, height: 3, right: 600, bottom: 303, x: 0, y: 300, toJSON: () => ({}) }) as DOMRect,
    setEditing: vi.fn(),
    setDragging: vi.fn(),
  };
  ui.surface = surface;
  ui.extension = ui.factory!(surface);
  return surface;
}

type Handler = (payload?: unknown) => unknown;

/** A mock api with a working state-subscription channel. */
function createMockApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  const store: Record<string, unknown> = {
    currentTime: 100,
    duration: 600,
    live: false,
    mediaType: 'video',
    paused: true,
    seekableRange: null,
    ...state,
  };
  const subs: Array<{ event: string; handler: Handler }> = [];
  const stateSubs: Array<(event: { key: string; value: unknown }) => void> = [];

  return {
    pluginId: 'clips',
    container,
    video,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => store[key]),
    setState: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    defineState: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      const entry = { event, handler };
      subs.push(entry);
      return vi.fn(() => {
        const index = subs.indexOf(entry);
        if (index >= 0) subs.splice(index, 1);
      });
    }),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn((listener: (event: { key: string; value: unknown }) => void) => {
      stateSubs.push(listener);
      return vi.fn();
    }),

    // --- test helpers ---
    store,
    fire(event: string, payload?: unknown): void {
      for (const entry of [...subs]) if (entry.event === event) entry.handler(payload);
    },
    /** Write a state key and notify subscribers, as the real store does. */
    writeState(key: string, value: unknown): void {
      store[key] = value;
      for (const listener of [...stateSubs]) listener({ key, value });
    },
  };
}

type MockApi = ReturnType<typeof createMockApi>;

async function setup(
  config: Partial<ClipsPluginConfig> = {},
  state: Record<string, unknown> = {}
): Promise<{ api: MockApi; plugin: ReturnType<typeof createClipsPlugin> }> {
  const api = createMockApi(state);
  const plugin = createClipsPlugin({
    mediaId: 'video-42',
    onCreate: vi.fn().mockResolvedValue({ uuid: 'clip-1' }),
    ...config,
  });
  plugin.init(api as unknown as IPluginAPI);
  await flush(); // let the dynamic ui import settle
  return { api, plugin };
}

/** The last error reported through onError. */
function lastError(onError: ReturnType<typeof vi.fn>): ClipOperationError {
  return onError.mock.calls.at(-1)![0] as ClipOperationError;
}

/** Give the mounted track a real box so clientX maps to seconds 1:1. */
function giveTrackBox(container: HTMLElement): HTMLElement {
  const track = container.querySelector<HTMLElement>('.sp-clip-track')!;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height: 44, right: 600, bottom: 44, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return track;
}

function pointer(target: EventTarget, type: string, clientX: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  ui.hasSeam = true;
  ui.factory = null;
  ui.surface = null;
  ui.extension = null;
  ui.released = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('media gates', () => {
  it('refuses to open on unknown media with its own code and message', async () => {
    const onError = vi.fn();
    const { plugin } = await setup({ onError }, { mediaType: 'unknown' });

    plugin.open();

    expect(plugin.isOpen()).toBe(false);
    const error = lastError(onError);
    expect(error.code).toBe('media-type-unknown');
    expect(error.message).toBe('Video information is not available yet. Press Play and try again.');
  });

  it('says nothing about audio when the media type is merely unmeasured', async () => {
    const onError = vi.fn();
    const { plugin } = await setup({ onError }, { mediaType: 'unknown' });
    plugin.open();
    expect(lastError(onError).message).not.toMatch(/audio/i);
  });

  it('keeps a distinct, audio-specific refusal for confirmed audio', async () => {
    const onError = vi.fn();
    const { plugin } = await setup({ onError }, { mediaType: 'audio' });

    plugin.open();

    const error = lastError(onError);
    expect(error.code).toBe('media-type-unsupported');
    expect(error.message).toMatch(/audio/i);
  });

  it('does not auto-open when the media later turns out to be video', async () => {
    const { api, plugin } = await setup({}, { mediaType: 'unknown' });
    plugin.open();
    expect(plugin.isOpen()).toBe(false);

    api.writeState('mediaType', 'video');

    expect(plugin.isOpen()).toBe(false);
    // ...but it opens now that the viewer asks again.
    plugin.open();
    expect(plugin.isOpen()).toBe(true);
  });

  it('still refuses live media and an unusable duration', async () => {
    const onError = vi.fn();
    const live = await setup({ onError }, { live: true });
    live.plugin.open();
    expect(lastError(onError).code).toBe('live-unsupported');

    const noDuration = await setup({ onError }, { duration: 0 });
    noDuration.plugin.open();
    expect(lastError(onError).code).toBe('duration-unknown');
  });
});

describe('gate changes while the editor is open', () => {
  it('blocks submission with the precise reason when the media turns out to be audio', async () => {
    const { api, plugin } = await setup();
    plugin.open();

    api.writeState('mediaType', 'audio');

    const confirm = api.container.querySelector<HTMLButtonElement>('.sp-clip-btn--confirm')!;
    const notice = api.container.querySelector<HTMLElement>('.sp-clip-notice')!;
    expect(confirm.disabled).toBe(true);
    expect(notice.textContent).toMatch(/audio/i);
    // The selection itself is kept - the viewer's work is not thrown away.
    expect(plugin.isOpen()).toBe(true);
    expect(api.store.clipSelection).toEqual({ start: 70, end: 100 });
  });

  it('refuses the commit itself, not merely the button', async () => {
    const onCreate = vi.fn().mockResolvedValue(null);
    const onError = vi.fn();
    const { api, plugin } = await setup({ onCreate, onError });
    plugin.open();
    api.writeState('live', true);

    await plugin.commit();

    expect(onCreate).not.toHaveBeenCalled();
    expect(lastError(onError).code).toBe('live-unsupported');
    expect(plugin.isOpen()).toBe(true);
  });

  it('unblocks when the media becomes clippable again', async () => {
    const { api, plugin } = await setup();
    plugin.open();
    api.writeState('mediaType', 'unknown');
    api.writeState('mediaType', 'video');

    const confirm = api.container.querySelector<HTMLButtonElement>('.sp-clip-btn--confirm')!;
    expect(confirm.disabled).toBe(false);
  });

  it('re-validates the range against a duration that shrank under it', async () => {
    const onCreate = vi.fn().mockResolvedValue(null);
    const onError = vi.fn();
    const { api, plugin } = await setup({ onCreate, onError });
    plugin.open(); // {70, 100}
    api.writeState('duration', 80); // the selection now runs past the end

    await plugin.commit();

    expect(onCreate).not.toHaveBeenCalled();
    expect(lastError(onError).code).toBe('out-of-bounds');
  });
});

describe('timeline extension', () => {
  it('registers one extension per player and mounts the handles into its layer', async () => {
    const { api, plugin } = await setup();
    const surface = mountExtension(api.container);

    plugin.open();

    const track = api.container.querySelector<HTMLElement>('.sp-clip-track')!;
    expect(track.parentElement).toBe(surface.element);
    expect(track.classList.contains('sp-clip-track--timeline')).toBe(true);
    expect(surface.setEditing).toHaveBeenCalledWith(true);
    expect(document.querySelectorAll('.sp-clip-track')).toHaveLength(1);
  });

  it('mounts into a layer that only appears after the editor is already open', async () => {
    const { api, plugin } = await setup();
    plugin.open();
    expect(api.container.querySelector('.sp-clip-track')!.classList.contains('sp-clip-track--standalone')).toBe(true);

    const surface = mountExtension(api.container);

    expect(api.container.querySelector('.sp-clip-track')!.parentElement).toBe(surface.element);
    expect(surface.setEditing).toHaveBeenCalledWith(true);
  });

  it('falls back to the standalone rail when the UI unmounts mid-session', async () => {
    const { api, plugin } = await setup();
    mountExtension(api.container);
    plugin.open();
    plugin.setRange(200, 240);

    ui.extension!.destroy(); // a control-bar rebuild, or the UI going away

    const track = api.container.querySelector<HTMLElement>('.sp-clip-track')!;
    expect(track.classList.contains('sp-clip-track--standalone')).toBe(true);
    // The session survives it intact - same selection, still open.
    expect(plugin.isOpen()).toBe(true);
    expect(api.store.clipSelection).toEqual({ start: 200, end: 240 });
  });

  it('transfers back to a rebuilt timeline without resetting the session', async () => {
    const { api, plugin } = await setup();
    mountExtension(api.container);
    plugin.open();
    plugin.setTitle('Kept through the rebuild');
    const requestId = plugin.getRange()!.clientRequestId;

    ui.extension!.destroy();
    const rebuilt = mountExtension(api.container);

    expect(api.container.querySelector('.sp-clip-track')!.parentElement).toBe(rebuilt.element);
    expect(plugin.getRange()!.clientRequestId).toBe(requestId);
    expect(plugin.getRange()!.title).toBe('Kept through the rebuild');
  });

  it('uses the standalone editor against a UI peer without the seam', async () => {
    ui.hasSeam = false;
    const { api, plugin } = await setup();

    plugin.open();

    expect(ui.factory).toBeNull();
    const track = api.container.querySelector<HTMLElement>('.sp-clip-track')!;
    expect(track.classList.contains('sp-clip-track--standalone')).toBe(true);
    expect(api.logger.debug).toHaveBeenCalledWith(expect.stringContaining('no timeline seam'));
  });

  it('registers nothing at all in headless mode', async () => {
    const { plugin } = await setup({ ui: 'none' });
    expect(ui.factory).toBeNull();
    plugin.open();
    expect(document.querySelector('.sp-clip-track')).toBeNull();
  });

  it('releases the editing lease when the session ends', async () => {
    const { api, plugin } = await setup();
    const surface = mountExtension(api.container);
    plugin.open();
    surface.setEditing.mockClear();

    plugin.close();

    expect(surface.setEditing).toHaveBeenCalledWith(false);
  });

  it('takes and releases the pointer lease around a handle drag', async () => {
    const { api, plugin } = await setup();
    const surface = mountExtension(api.container);
    plugin.open();
    const track = giveTrackBox(api.container);
    const endHandle = track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;

    pointer(endHandle, 'pointerdown', 100);
    expect(surface.setDragging).toHaveBeenCalledWith(true);

    pointer(track, 'pointerup', 150);
    expect(surface.setDragging).toHaveBeenLastCalledWith(false);
  });

  it('unregisters on destroy', async () => {
    const { plugin } = await setup();
    plugin.destroy();
    expect(ui.released).toBe(1);
  });
});

describe('preview ownership', () => {
  /** Record every seek the plugin makes on the media element. */
  function watchSeeks(api: MockApi): number[] {
    const seeks: number[] = [];
    let currentTime = 0;
    Object.defineProperty(api.video, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
        seeks.push(value);
      },
    });
    Object.defineProperty(api.video, 'duration', { value: 600, configurable: true });
    api.video.play = vi.fn().mockResolvedValue(undefined);
    api.video.pause = vi.fn();
    return seeks;
  }

  it('loops the selection while nothing else owns the playhead', async () => {
    const { api, plugin } = await setup();
    const seeks = watchSeeks(api);
    plugin.open(); // {70, 100}

    api.fire('playback:timeupdate', { currentTime: 101 });

    expect(seeks).toEqual([70]);
  });

  it('an ordinary timeline seek suspends the loop, and it stays suspended', async () => {
    const { api, plugin } = await setup();
    const seeks = watchSeeks(api);
    mountExtension(api.container);
    plugin.open();

    ui.extension!.onSeekStart();
    ui.extension!.onSeekEnd();
    seeks.length = 0;
    api.fire('playback:timeupdate', { currentTime: 400 });

    // Scrubbing past the out point must not snap the viewer back the instant
    // they let go: that is the loop fighting them.
    expect(seeks).toEqual([]);
  });

  it('a retargeting change does not quietly give the loop back', async () => {
    const { api, plugin } = await setup();
    const seeks = watchSeeks(api);
    mountExtension(api.container);
    plugin.open();
    ui.extension!.onSeekStart();

    plugin.setRange(200, 260);
    seeks.length = 0;
    api.fire('playback:timeupdate', { currentTime: 300 });

    expect(seeks).toEqual([]);
  });

  it('a drag that began while suspended ends still suspended', async () => {
    const { api, plugin } = await setup();
    const seeks = watchSeeks(api);
    mountExtension(api.container);
    plugin.open();
    ui.extension!.onSeekStart(); // the viewer scrubbed away first

    const track = giveTrackBox(api.container);
    const endHandle = track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    pointer(endHandle, 'pointerdown', 100);
    pointer(track, 'pointerup', 150);

    seeks.length = 0;
    api.fire('playback:timeupdate', { currentTime: 400 });
    expect(seeks).toEqual([]);
  });

  it('a drag that began while looping gives the loop back on release', async () => {
    const { api, plugin } = await setup();
    const seeks = watchSeeks(api);
    plugin.open();

    const track = giveTrackBox(api.container);
    const endHandle = track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    pointer(endHandle, 'pointerdown', 100);
    pointer(track, 'pointerup', 150);

    seeks.length = 0;
    api.fire('playback:timeupdate', { currentTime: 400 });
    expect(seeks).toEqual([70]);
  });

  it('Preview clip seeks to the in point, arms the loop and plays in the gesture', async () => {
    const { api, plugin } = await setup();
    const seeks = watchSeeks(api);
    mountExtension(api.container);
    plugin.open();
    ui.extension!.onSeekStart(); // suspended by an earlier scrub
    seeks.length = 0;

    api.container.querySelector<HTMLButtonElement>('.sp-clip-tool--preview')!.click();

    expect(seeks).toEqual([70]);
    expect(api.video.play).toHaveBeenCalledTimes(1);
    seeks.length = 0;
    api.fire('playback:timeupdate', { currentTime: 400 });
    expect(seeks).toEqual([70]); // looping again
  });

  it('says how to preview rather than losing the selection when play() is refused', async () => {
    const { api, plugin } = await setup();
    watchSeeks(api);
    api.video.play = vi.fn().mockRejectedValue(new DOMException('NotAllowedError'));
    plugin.open();

    api.container.querySelector<HTMLButtonElement>('.sp-clip-tool--preview')!.click();
    await flush();

    expect(api.container.querySelector('.sp-clip-notice')!.textContent).toBe('Press Play to preview');
    expect(plugin.isOpen()).toBe(true);
    expect(api.store.clipSelection).toEqual({ start: 70, end: 100 });
  });

  it('previews once without enabling a loop when loopPreview is false', async () => {
    const { api, plugin } = await setup({ loopPreview: false });
    const seeks = watchSeeks(api);
    plugin.open();
    seeks.length = 0;

    api.container.querySelector<HTMLButtonElement>('.sp-clip-tool--preview')!.click();
    expect(seeks).toEqual([70]);

    seeks.length = 0;
    api.fire('playback:timeupdate', { currentTime: 400 });
    expect(seeks).toEqual([]);
  });

  it('stays paused after an interrupted drag rather than starting playback', async () => {
    const { api, plugin } = await setup();
    watchSeeks(api);
    Object.defineProperty(api.video, 'paused', { value: false, configurable: true });
    plugin.open();

    const track = giveTrackBox(api.container);
    const endHandle = track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    pointer(endHandle, 'pointerdown', 100);
    pointer(track, 'pointermove', 150);
    pointer(track, 'pointercancel', 150);
    api.video.dispatchEvent(new Event('seeked'));

    expect(api.video.play).not.toHaveBeenCalled();
  });
});

describe('set at playhead', () => {
  it('places the in point at the media element clock, not the state key', async () => {
    const { api, plugin } = await setup();
    Object.defineProperty(api.video, 'currentTime', { value: 88, configurable: true });
    plugin.open(); // {70, 100}

    api.container.querySelector<HTMLButtonElement>('.sp-clip-tool--set-in')!.click();

    expect(api.store.clipSelection).toEqual({ start: 88, end: 100 });
  });

  it('places the out point and emits exactly one clip:changed for it', async () => {
    const { api, plugin } = await setup({ maxDuration: 300 });
    Object.defineProperty(api.video, 'currentTime', { value: 140, configurable: true });
    plugin.open();
    api.emit.mockClear();

    api.container.querySelector<HTMLButtonElement>('.sp-clip-tool--set-out')!.click();

    const changed = api.emit.mock.calls.filter(([name]) => name === 'clip:changed');
    expect(changed).toHaveLength(1);
    expect(changed[0][1]).toEqual({ start: 70, end: 140, reason: 'user' });
  });

  it('clamps a placement the limits refuse and never moves the other endpoint', async () => {
    const { api, plugin } = await setup({ maxDuration: 60 });
    Object.defineProperty(api.video, 'currentTime', { value: 500, configurable: true });
    plugin.open(); // {70, 100}

    api.container.querySelector<HTMLButtonElement>('.sp-clip-tool--set-out')!.click();

    expect(api.store.clipSelection).toEqual({ start: 70, end: 130 });
    const flash = api.container.querySelector<HTMLElement>('.sp-clip-flash')!;
    expect(flash.textContent).toBe('Max 60s');
  });
});

describe('native full screen', () => {
  it('refuses to open with its own reason while the platform owns the picture', async () => {
    const onError = vi.fn();
    const { api, plugin } = await setup({ onError });
    api.video.dispatchEvent(new Event('webkitbeginfullscreen'));

    plugin.open();

    expect(plugin.isOpen()).toBe(false);
    const error = lastError(onError);
    expect(error.code).toBe('native-fullscreen-active');
    expect(error.message).toMatch(/full screen/i);
  });

  it('freezes an open draft and restores it unchanged on the way out', async () => {
    const { api, plugin } = await setup();
    plugin.open();
    plugin.setTitle('Survives the round trip');
    const confirm = api.container.querySelector<HTMLButtonElement>('.sp-clip-btn--confirm')!;

    api.video.dispatchEvent(new Event('webkitbeginfullscreen'));
    expect(confirm.disabled).toBe(true);
    expect(api.container.querySelector('.sp-clip-track')!.classList.contains('sp-clip-track--frozen')).toBe(true);

    api.video.dispatchEvent(new Event('webkitendfullscreen'));
    expect(confirm.disabled).toBe(false);
    expect(plugin.getRange()!.title).toBe('Survives the round trip');
    expect(api.store.clipSelection).toEqual({ start: 70, end: 100 });
  });
});
