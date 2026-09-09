/**
 * Timeline extension seam tests.
 *
 * Exercises the registry through real DOM events on a real `ProgressBar`
 * rather than by poking private methods: the whole point of the seam is that
 * an extension's handles take pointer input the timeline does not, and that
 * only shows up when the events actually travel.
 *
 * Registrations are keyed by container, so every test builds its own container
 * and no reset hook is needed between them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressBar } from '../src/controls/ProgressBar';
import {
  registerTimelineExtension,
  unregisterTimelineExtension,
  hasTimelineExtension,
} from '../src/timeline-registry';
import type { TimelineExtension, TimelineSurface } from '../src/timeline-registry';
import type { MockPluginAPI } from './mock-api';

/**
 * A stubbed plugin API bound to a real container.
 *
 * @param container - The player container the bar mounts into
 * @returns The stub
 */
function createMockApi(container: HTMLElement): MockPluginAPI {
  const state: Record<string, unknown> = {
    currentTime: 0,
    duration: 600,
    buffered: null,
    live: false,
    seekableRange: null,
    chapters: [],
  };
  return {
    pluginId: 'test',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    defineState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as MockPluginAPI;
}

/** A recording extension plus the surface it was handed. */
interface Recorded {
  extension: TimelineExtension & {
    update: ReturnType<typeof vi.fn>;
    onSeekStart: ReturnType<typeof vi.fn>;
    onSeekEnd: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  surface: TimelineSurface | null;
  handle: HTMLElement;
}

/** Build a factory that records its surface and paints one hit target. */
function recordingFactory(): { factory: (surface: TimelineSurface) => TimelineExtension; recorded: Recorded } {
  const handle = document.createElement('button');
  handle.className = 'test-handle';
  const recorded: Recorded = {
    extension: {
      update: vi.fn(),
      onSeekStart: vi.fn(),
      onSeekEnd: vi.fn(),
      destroy: vi.fn(),
    },
    surface: null,
    handle,
  };
  const factory = (surface: TimelineSurface): TimelineExtension => {
    recorded.surface = surface;
    surface.element.appendChild(handle);
    return recorded.extension;
  };
  return { factory, recorded };
}

/** A player container with a video element, as the UI plugin's api provides. */
function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  const video = document.createElement('video');
  Object.defineProperty(video, 'paused', { value: true, configurable: true });
  video.play = vi.fn().mockResolvedValue(undefined);
  video.pause = vi.fn();
  container.appendChild(video);
  document.body.appendChild(container);
  return container;
}

/** Mount a ProgressBar on a container, with the state a VOD source publishes. */
function mountBar(
  container: HTMLElement,
  onEditingChange?: (active: boolean) => void
): ProgressBar {
  const api = createMockApi(container);
  const bar = new ProgressBar(api, onEditingChange ? { onEditingChange } : {});
  container.appendChild(bar.render());
  return bar;
}

describe('registerTimelineExtension', () => {
  let containers: HTMLElement[] = [];

  beforeEach(() => {
    containers = [];
  });

  afterEach(() => {
    for (const container of containers) container.remove();
    vi.restoreAllMocks();
  });

  /** Track a container for cleanup. */
  const newContainer = (): HTMLElement => {
    const container = makeContainer();
    containers.push(container);
    return container;
  };

  it('mounts a factory registered before the progress bar exists', () => {
    const container = newContainer();
    const { factory, recorded } = recordingFactory();

    registerTimelineExtension(container, factory);
    mountBar(container);

    expect(recorded.surface).not.toBeNull();
    expect(recorded.handle.isConnected).toBe(true);
    expect(recorded.extension.update).toHaveBeenCalled();
  });

  it('mounts a factory registered after the progress bar exists', () => {
    const container = newContainer();
    mountBar(container);
    const { factory, recorded } = recordingFactory();

    registerTimelineExtension(container, factory);

    expect(recorded.surface).not.toBeNull();
    expect(recorded.handle.isConnected).toBe(true);
  });

  it('keeps two players independent', () => {
    const a = newContainer();
    const b = newContainer();
    const first = recordingFactory();
    const second = recordingFactory();

    registerTimelineExtension(a, first.factory);
    mountBar(a);
    mountBar(b);

    expect(first.recorded.surface).not.toBeNull();
    expect(second.recorded.surface).toBeNull();

    registerTimelineExtension(b, second.factory);
    expect(second.recorded.surface).not.toBeNull();
    expect(first.recorded.extension.destroy).not.toHaveBeenCalled();
  });

  it('replaces and destroys the previous extension', () => {
    const container = newContainer();
    mountBar(container);
    const first = recordingFactory();
    const second = recordingFactory();

    registerTimelineExtension(container, first.factory);
    registerTimelineExtension(container, second.factory);

    expect(first.recorded.extension.destroy).toHaveBeenCalledTimes(1);
    expect(first.recorded.handle.isConnected).toBe(false);
    expect(second.recorded.handle.isConnected).toBe(true);
  });

  it('does not let a stale disposer unmount its replacement', () => {
    const container = newContainer();
    mountBar(container);
    const first = recordingFactory();
    const second = recordingFactory();

    const releaseFirst = registerTimelineExtension(container, first.factory);
    registerTimelineExtension(container, second.factory);
    releaseFirst();

    expect(second.recorded.extension.destroy).not.toHaveBeenCalled();
    expect(second.recorded.handle.isConnected).toBe(true);
    expect(hasTimelineExtension(container)).toBe(true);
  });

  it('unmounts immediately on the disposer', () => {
    const container = newContainer();
    mountBar(container);
    const { factory, recorded } = recordingFactory();

    const release = registerTimelineExtension(container, factory);
    release();

    expect(recorded.extension.destroy).toHaveBeenCalledTimes(1);
    expect(recorded.handle.isConnected).toBe(false);
    expect(hasTimelineExtension(container)).toBe(false);
  });

  it('unregisterTimelineExtension drops a registration wholesale', () => {
    const container = newContainer();
    mountBar(container);
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);

    expect(unregisterTimelineExtension(container)).toBe(true);
    expect(recorded.extension.destroy).toHaveBeenCalled();
    expect(unregisterTimelineExtension(container)).toBe(false);
  });

  it('destroys the extension when the progress bar is destroyed', () => {
    const container = newContainer();
    const bar = mountBar(container);
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);

    bar.destroy();

    expect(recorded.extension.destroy).toHaveBeenCalledTimes(1);
  });

  it('mounts into a rebuilt progress bar without a new registration', () => {
    const container = newContainer();
    const first = mountBar(container);
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);
    first.destroy();

    mountBar(container);

    // Mounted twice in total: once per bar, from the same live registration.
    expect(recorded.surface).not.toBeNull();
    expect(recorded.handle.isConnected).toBe(true);
  });
});

describe('timeline surface', () => {
  let container: HTMLElement;
  let bar: ProgressBar;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    bar?.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  it('exposes the rail geometry the seek slider maps against', () => {
    bar = mountBar(container);
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);

    const rail = bar.render().querySelector('.sp-progress') as HTMLElement;
    rail.getBoundingClientRect = () =>
      ({ left: 20, top: 5, width: 300, height: 3, right: 320, bottom: 8, x: 20, y: 5, toJSON: () => ({}) }) as DOMRect;

    const rect = recorded.surface!.getRailRect();
    expect(rect.left).toBe(20);
    expect(rect.width).toBe(300);
  });

  it('holds the controls open while editing', () => {
    const onEditingChange = vi.fn();
    bar = mountBar(container, onEditingChange);
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);

    recorded.surface!.setEditing(true);
    expect(bar.isTimelineEditing()).toBe(true);
    expect(onEditingChange).toHaveBeenCalledWith(true);
    expect(bar.render().classList.contains('sp-progress-wrapper--editing')).toBe(true);
    expect(bar.render().classList.contains('sp-progress-wrapper--visible')).toBe(true);

    recorded.surface!.setEditing(false);
    expect(bar.isTimelineEditing()).toBe(false);
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
    expect(bar.render().classList.contains('sp-progress-wrapper--editing')).toBe(false);
  });

  it('releases both leases when the extension is replaced', () => {
    const onEditingChange = vi.fn();
    bar = mountBar(container, onEditingChange);
    const first = recordingFactory();
    registerTimelineExtension(container, first.factory);
    first.recorded.surface!.setEditing(true);
    first.recorded.surface!.setDragging(true);

    const second = recordingFactory();
    registerTimelineExtension(container, second.factory);

    expect(bar.isTimelineEditing()).toBe(false);
    expect(bar.render().classList.contains('sp-progress-wrapper--ext-dragging')).toBe(false);
  });

  it('runs the extension update with the progress bar update', () => {
    bar = mountBar(container);
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);
    recorded.extension.update.mockClear();

    bar.update();

    expect(recorded.extension.update).toHaveBeenCalledTimes(1);
  });
});

describe('input arbitration', () => {
  let container: HTMLElement;
  let bar: ProgressBar;
  let video: HTMLVideoElement;

  beforeEach(() => {
    container = makeContainer();
    video = container.querySelector('video') as HTMLVideoElement;
    let time = 0;
    Object.defineProperty(video, 'currentTime', {
      get: () => time,
      set: (value: number) => {
        time = value;
      },
      configurable: true,
    });
    Object.defineProperty(video, 'duration', { value: 600, configurable: true });
    bar = mountBar(container);
    const rail = bar.render().querySelector('.sp-progress') as HTMLElement;
    rail.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 3, right: 600, bottom: 3, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  });

  afterEach(() => {
    bar.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  it('seeks normally on a plain rail press', () => {
    bar.render().dispatchEvent(
      new MouseEvent('mousedown', { clientX: 120, bubbles: true })
    );
    expect(video.currentTime).toBe(120);
  });

  it('does not seek when the press starts inside the extension layer', () => {
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);

    recorded.handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 300, bubbles: true }));

    expect(video.currentTime).toBe(0);
  });

  it('does not seek anywhere on the rail while the extension holds the pointer', () => {
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);
    recorded.surface!.setDragging(true);

    bar.render().dispatchEvent(new MouseEvent('mousedown', { clientX: 240, bubbles: true }));
    bar.render().dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientX: 240 } as unknown as Touch],
      })
    );

    expect(video.currentTime).toBe(0);
  });

  it('resumes normal seeking once the lease is released', () => {
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);
    recorded.surface!.setDragging(true);
    recorded.surface!.setDragging(false);

    bar.render().dispatchEvent(new MouseEvent('mousedown', { clientX: 60, bubbles: true }));

    expect(video.currentTime).toBe(60);
  });

  it('reports the ordinary mouse seek lifecycle to the extension', () => {
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);

    bar.render().dispatchEvent(new MouseEvent('mousedown', { clientX: 60, bubbles: true }));
    expect(recorded.extension.onSeekStart).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 90, bubbles: true }));
    expect(recorded.extension.onSeekEnd).toHaveBeenCalledTimes(1);
  });

  it('reports the keyboard seek lifecycle to the extension', () => {
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);
    const rail = bar.render().querySelector('.sp-progress') as HTMLElement;

    rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(recorded.extension.onSeekStart).toHaveBeenCalledTimes(1);
    expect(recorded.extension.onSeekEnd).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(5);
  });

  it('leaves non-seek keys alone', () => {
    const { factory, recorded } = recordingFactory();
    registerTimelineExtension(container, factory);
    const rail = bar.render().querySelector('.sp-progress') as HTMLElement;

    rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));

    expect(recorded.extension.onSeekStart).not.toHaveBeenCalled();
  });
});
