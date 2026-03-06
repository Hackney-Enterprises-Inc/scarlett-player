/**
 * Tests for Watermark Plugin
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWatermarkPlugin } from '../src/index';
import type { IWatermarkPlugin } from '../src/types';

// Helper to create mock plugin API
function createMockApi() {
  const container = document.createElement('div');
  return {
    container,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    on: vi.fn().mockReturnValue(vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn().mockReturnValue(null),
    subscribeToState: vi.fn().mockReturnValue(vi.fn()),
    onDestroy: vi.fn(),
    getPlugin: vi.fn(),
  };
}

describe('createWatermarkPlugin', () => {
  it('creates a plugin with correct metadata', () => {
    const plugin = createWatermarkPlugin();

    expect(plugin.id).toBe('watermark');
    expect(plugin.name).toBe('Watermark');
    expect(plugin.type).toBe('feature');
  });

  it('accepts empty config', () => {
    const plugin = createWatermarkPlugin();
    expect(plugin).toBeDefined();
  });

  it('accepts full config', () => {
    const plugin = createWatermarkPlugin({
      text: 'test@example.com',
      position: 'top-left',
      opacity: 0.3,
      fontSize: 16,
      imageHeight: 60,
      padding: 20,
      dynamic: true,
      dynamicInterval: 5000,
      showDelay: 1000,
    });
    expect(plugin).toBeDefined();
  });
});

describe('init and DOM', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockApi = createMockApi();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates watermark element in container', () => {
    const plugin = createWatermarkPlugin({ text: 'Hello' });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el).not.toBeNull();
  });

  it('renders text content', () => {
    const plugin = createWatermarkPlugin({ text: 'user@test.com' });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.textContent).toBe('user@test.com');
  });

  it('renders image when imageUrl is provided', () => {
    const plugin = createWatermarkPlugin({ imageUrl: 'https://example.com/wm.png' });
    plugin.init(mockApi);

    const img = mockApi.container.querySelector('.sp-watermark img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/wm.png');
  });

  it('prefers imageUrl over text', () => {
    const plugin = createWatermarkPlugin({
      text: 'should not show',
      imageUrl: 'https://example.com/wm.png',
    });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.textContent).toBe('');
    expect(el?.querySelector('img')).not.toBeNull();
  });

  it('starts hidden', () => {
    const plugin = createWatermarkPlugin({ text: 'test' });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.classList.contains('sp-watermark--hidden')).toBe(true);
    expect(el?.classList.contains('sp-watermark--visible')).toBe(false);
  });

  it('applies position via data attribute', () => {
    const plugin = createWatermarkPlugin({ text: 'test', position: 'top-left' });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.getAttribute('data-position')).toBe('top-left');
  });

  it('applies default position (bottom-right)', () => {
    const plugin = createWatermarkPlugin({ text: 'test' });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.getAttribute('data-position')).toBe('bottom-right');
  });

  it('applies opacity style', () => {
    const plugin = createWatermarkPlugin({ text: 'test', opacity: 0.3 });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark') as HTMLElement;
    expect(el?.style.opacity).toBe('0.3');
  });

  it('uses imageHeight for image max-height instead of fontSize', () => {
    const plugin = createWatermarkPlugin({ imageUrl: 'https://example.com/wm.png', imageHeight: 80 });
    plugin.init(mockApi);

    const img = mockApi.container.querySelector('.sp-watermark img') as HTMLElement;
    expect(img?.style.maxHeight).toBe('80px');
  });

  it('defaults imageHeight to 40px', () => {
    const plugin = createWatermarkPlugin({ imageUrl: 'https://example.com/wm.png' });
    plugin.init(mockApi);

    const img = mockApi.container.querySelector('.sp-watermark img') as HTMLElement;
    expect(img?.style.maxHeight).toBe('40px');
  });

  it('applies custom padding to position styles', () => {
    const plugin = createWatermarkPlugin({ text: 'test', position: 'top-left', padding: 25 });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark') as HTMLElement;
    expect(el?.style.top).toBe('25px');
    expect(el?.style.left).toBe('25px');
  });

  it('uses custom padding for bottom positions', () => {
    const plugin = createWatermarkPlugin({ text: 'test', position: 'bottom-right', padding: 20 });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark') as HTMLElement;
    expect(el?.style.bottom).toBe('20px');
    expect(el?.style.right).toBe('20px');
  });

  it('defaults bottom padding to 40px to clear controls', () => {
    const plugin = createWatermarkPlugin({ text: 'test', position: 'bottom-right' });
    plugin.init(mockApi);

    const el = mockApi.container.querySelector('.sp-watermark') as HTMLElement;
    expect(el?.style.bottom).toBe('40px');
  });
});

describe('show/hide on playback events', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let playCallback: (() => void) | null = null;
  let pauseCallback: (() => void) | null = null;
  let endedCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mockApi = createMockApi();
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'playback:play') playCallback = cb as () => void;
      if (event === 'playback:pause') pauseCallback = cb as () => void;
      if (event === 'playback:ended') endedCallback = cb as () => void;
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows watermark on playback:play', () => {
    const plugin = createWatermarkPlugin({ text: 'test' });
    plugin.init(mockApi);

    playCallback?.();

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.classList.contains('sp-watermark--visible')).toBe(true);
  });

  it('hides watermark on playback:pause', () => {
    const plugin = createWatermarkPlugin({ text: 'test' });
    plugin.init(mockApi);

    playCallback?.();
    pauseCallback?.();

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.classList.contains('sp-watermark--hidden')).toBe(true);
  });

  it('hides watermark on playback:ended', () => {
    const plugin = createWatermarkPlugin({ text: 'test' });
    plugin.init(mockApi);

    playCallback?.();
    endedCallback?.();

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.classList.contains('sp-watermark--hidden')).toBe(true);
  });

  it('respects showDelay before showing', () => {
    const plugin = createWatermarkPlugin({ text: 'test', showDelay: 5000 });
    plugin.init(mockApi);

    playCallback?.();

    // Should still be hidden
    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.classList.contains('sp-watermark--visible')).toBe(false);

    // Advance timer
    vi.advanceTimersByTime(5000);

    expect(el?.classList.contains('sp-watermark--visible')).toBe(true);
  });

  it('cancels showDelay timer on pause', () => {
    const plugin = createWatermarkPlugin({ text: 'test', showDelay: 5000 });
    plugin.init(mockApi);

    playCallback?.();
    pauseCallback?.(); // Pause before delay completes

    vi.advanceTimersByTime(5000);

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.classList.contains('sp-watermark--visible')).toBe(false);
  });
});

describe('dynamic repositioning', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let playCallback: (() => void) | null = null;
  let pauseCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mockApi = createMockApi();
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'playback:play') playCallback = cb as () => void;
      if (event === 'playback:pause') pauseCallback = cb as () => void;
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('repositions periodically when dynamic=true', () => {
    const plugin = createWatermarkPlugin({
      text: 'test',
      dynamic: true,
      dynamicInterval: 3000,
    });
    plugin.init(mockApi);

    playCallback?.();

    const el = mockApi.container.querySelector('.sp-watermark');
    const initialPosition = el?.getAttribute('data-position');

    // After several intervals, position should change at least once
    // (it's random so may take multiple intervals)
    let positionChanged = false;
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(3000);
      if (el?.getAttribute('data-position') !== initialPosition) {
        positionChanged = true;
        break;
      }
    }

    expect(positionChanged).toBe(true);
  });

  it('stops repositioning on pause', () => {
    const plugin = createWatermarkPlugin({
      text: 'test',
      dynamic: true,
      dynamicInterval: 3000,
    });
    plugin.init(mockApi);

    playCallback?.();
    pauseCallback?.();

    const el = mockApi.container.querySelector('.sp-watermark');
    const posAfterPause = el?.getAttribute('data-position');

    vi.advanceTimersByTime(30000);
    // Position should remain the same since dynamic timer was stopped
    expect(el?.getAttribute('data-position')).toBe(posAfterPause);
  });
});

describe('per-track watermark updates', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let changeCallback: ((data: unknown) => void) | null = null;

  beforeEach(() => {
    mockApi = createMockApi();
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'playlist:change') changeCallback = cb as (data: unknown) => void;
      return vi.fn();
    });
  });

  it('updates watermark text from track metadata', () => {
    const plugin = createWatermarkPlugin({ text: 'initial' });
    plugin.init(mockApi);

    changeCallback?.({
      track: {
        id: '1',
        src: 'test.mp4',
        metadata: { watermarkText: 'new-watermark' },
      },
      index: 0,
    });

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.textContent).toBe('new-watermark');
  });

  it('updates watermark image from track metadata', () => {
    const plugin = createWatermarkPlugin({ text: 'initial' });
    plugin.init(mockApi);

    changeCallback?.({
      track: {
        id: '1',
        src: 'test.mp4',
        metadata: { watermarkUrl: 'https://example.com/wm2.png' },
      },
      index: 0,
    });

    const img = mockApi.container.querySelector('.sp-watermark img');
    expect(img?.getAttribute('src')).toBe('https://example.com/wm2.png');
  });
});

describe('runtime API', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let plugin: IWatermarkPlugin;

  beforeEach(() => {
    mockApi = createMockApi();
    plugin = createWatermarkPlugin({ text: 'initial', position: 'bottom-right', opacity: 0.5 });
    plugin.init(mockApi);
  });

  it('setText updates watermark text', () => {
    plugin.setText('new-text');

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.textContent).toBe('new-text');
  });

  it('setImage updates watermark to show an image', () => {
    plugin.setImage('https://example.com/logo.png');

    const img = mockApi.container.querySelector('.sp-watermark img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/logo.png');
  });

  it('setPosition moves the watermark', () => {
    plugin.setPosition('top-left');

    const el = mockApi.container.querySelector('.sp-watermark');
    expect(el?.getAttribute('data-position')).toBe('top-left');
  });

  it('setOpacity changes watermark opacity', () => {
    plugin.setOpacity(0.3);

    const el = mockApi.container.querySelector('.sp-watermark') as HTMLElement;
    expect(el?.style.opacity).toBe('0.3');
  });

  it('setOpacity clamps to 0-1 range', () => {
    plugin.setOpacity(1.5);
    const el = mockApi.container.querySelector('.sp-watermark') as HTMLElement;
    expect(el?.style.opacity).toBe('1');

    plugin.setOpacity(-0.5);
    expect(el?.style.opacity).toBe('0');
  });

  it('show and hide toggle visibility', () => {
    const el = mockApi.container.querySelector('.sp-watermark');

    plugin.show();
    expect(el?.classList.contains('sp-watermark--visible')).toBe(true);
    expect(el?.classList.contains('sp-watermark--hidden')).toBe(false);

    plugin.hide();
    expect(el?.classList.contains('sp-watermark--hidden')).toBe(true);
    expect(el?.classList.contains('sp-watermark--visible')).toBe(false);
  });

  it('getConfig returns current configuration', () => {
    const cfg = plugin.getConfig();
    expect(cfg.position).toBe('bottom-right');
    expect(cfg.opacity).toBe(0.5);
    expect(cfg.text).toBe('initial');
  });

  it('getConfig reflects runtime changes', () => {
    plugin.setPosition('top-left');
    plugin.setOpacity(0.8);

    const cfg = plugin.getConfig();
    expect(cfg.position).toBe('top-left');
    expect(cfg.opacity).toBe(0.8);
  });

  it('setImageHeight updates image max-height', () => {
    plugin.setImage('https://example.com/logo.png');
    plugin.setImageHeight(100);

    const img = mockApi.container.querySelector('.sp-watermark img') as HTMLElement;
    expect(img?.style.maxHeight).toBe('100px');
  });

  it('setImageHeight persists across setImage calls', () => {
    plugin.setImageHeight(100);
    plugin.setImage('https://example.com/new-logo.png');

    const img = mockApi.container.querySelector('.sp-watermark img') as HTMLElement;
    expect(img?.style.maxHeight).toBe('100px');
  });

  it('setPadding updates position and persists across setPosition calls', () => {
    plugin.setPadding(25);
    plugin.setPosition('top-left');

    const el = mockApi.container.querySelector('.sp-watermark') as HTMLElement;
    expect(el?.style.top).toBe('25px');
    expect(el?.style.left).toBe('25px');
  });

  it('getConfig reflects imageHeight and padding changes', () => {
    plugin.setImageHeight(80);
    plugin.setPadding(20);

    const cfg = plugin.getConfig();
    expect(cfg.imageHeight).toBe(80);
    expect(cfg.padding).toBe(20);
  });
});

describe('destroy', () => {
  it('removes DOM element on destroy', () => {
    const mockApi = createMockApi();
    const plugin = createWatermarkPlugin({ text: 'test' });
    plugin.init(mockApi);

    expect(mockApi.container.querySelector('.sp-watermark')).not.toBeNull();

    plugin.destroy();

    expect(mockApi.container.querySelector('.sp-watermark')).toBeNull();
  });

  it('registers onDestroy callback', () => {
    const mockApi = createMockApi();
    const plugin = createWatermarkPlugin({ text: 'test' });
    plugin.init(mockApi);

    expect(mockApi.onDestroy).toHaveBeenCalled();
  });
});
