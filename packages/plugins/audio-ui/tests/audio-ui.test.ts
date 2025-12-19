/**
 * Tests for Audio UI Plugin
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAudioUIPlugin, type IAudioUIPlugin } from '../src/index';

// Mock requestAnimationFrame
let rafCallbacks: ((time: number) => void)[] = [];
const mockRAF = vi.fn((cb: (time: number) => void) => {
  rafCallbacks.push(cb);
  return rafCallbacks.length;
});
const mockCAF = vi.fn((id: number) => {
  rafCallbacks = rafCallbacks.filter((_, i) => i !== id - 1);
});

// Mock performance.now
const mockPerformanceNow = vi.fn(() => Date.now());

// Setup global mocks
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', mockRAF);
  vi.stubGlobal('cancelAnimationFrame', mockCAF);
  vi.stubGlobal('performance', { now: mockPerformanceNow });
  rafCallbacks = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    emit: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn().mockImplementation((key: string) => {
      const defaults: Record<string, unknown> = {
        playing: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        muted: false,
        title: '',
        poster: '',
      };
      return defaults[key];
    }),
    subscribeToState: vi.fn().mockReturnValue(vi.fn()),
    onDestroy: vi.fn(),
    getPlugin: vi.fn(),
  };
}

describe('createAudioUIPlugin', () => {
  it('creates a plugin with correct metadata', () => {
    const plugin = createAudioUIPlugin();

    expect(plugin.id).toBe('audio-ui');
    expect(plugin.name).toBe('Audio UI');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.type).toBe('ui');
    expect(plugin.description).toContain('audio player');
  });

  it('has required methods', () => {
    const plugin = createAudioUIPlugin();

    expect(typeof plugin.init).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
    expect(typeof plugin.getElement).toBe('function');
    expect(typeof plugin.setLayout).toBe('function');
    expect(typeof plugin.setTheme).toBe('function');
    expect(typeof plugin.show).toBe('function');
    expect(typeof plugin.hide).toBe('function');
    expect(typeof plugin.toggle).toBe('function');
  });

  it('accepts custom configuration', () => {
    const plugin = createAudioUIPlugin({
      layout: 'compact',
      showArtwork: false,
      showVolume: false,
      theme: {
        primary: '#ff0000',
        background: '#000000',
      },
    });

    expect(plugin).toBeDefined();
  });
});

describe('init and destroy', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
  });

  afterEach(async () => {
    try {
      await plugin.destroy();
    } catch {
      // Already destroyed
    }
  });

  it('initializes without error', async () => {
    await expect(plugin.init(mockApi)).resolves.not.toThrow();
    expect(mockApi.logger.info).toHaveBeenCalledWith('Audio UI plugin initialized');
  });

  it('creates UI container element', async () => {
    await plugin.init(mockApi);

    const element = plugin.getElement();
    expect(element).not.toBeNull();
    expect(element?.classList.contains('scarlett-audio')).toBe(true);
  });

  it('appends UI to player container', async () => {
    await plugin.init(mockApi);

    expect(mockApi.container.querySelector('.scarlett-audio')).not.toBeNull();
  });

  it('injects styles into document head', async () => {
    await plugin.init(mockApi);

    const styleElement = document.head.querySelector('style');
    expect(styleElement).not.toBeNull();
    expect(styleElement?.textContent).toContain('.scarlett-audio');
  });

  it('registers event listeners', async () => {
    await plugin.init(mockApi);

    expect(mockApi.subscribeToState).toHaveBeenCalled();
    expect(mockApi.on).toHaveBeenCalledWith('playback:timeupdate', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('playlist:change', expect.any(Function));
  });

  it('registers onDestroy callback', async () => {
    await plugin.init(mockApi);
    expect(mockApi.onDestroy).toHaveBeenCalled();
  });

  it('removes UI element on destroy', async () => {
    await plugin.init(mockApi);
    await plugin.destroy();

    expect(mockApi.container.querySelector('.scarlett-audio')).toBeNull();
  });

  it('removes styles on destroy', async () => {
    await plugin.init(mockApi);
    const stylesBefore = document.head.querySelectorAll('style').length;

    await plugin.destroy();

    // Should have one less style element
    expect(document.head.querySelectorAll('style').length).toBeLessThan(stylesBefore);
  });
});

describe('layouts', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  afterEach(async () => {
    try {
      await plugin.destroy();
    } catch {
      // Already destroyed
    }
  });

  it('creates full layout by default', async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    expect(element?.classList.contains('scarlett-audio--full')).toBe(true);
  });

  it('creates compact layout when specified', async () => {
    plugin = createAudioUIPlugin({ layout: 'compact' });
    mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    expect(element?.classList.contains('scarlett-audio--compact')).toBe(true);
  });

  it('creates mini layout when specified', async () => {
    plugin = createAudioUIPlugin({ layout: 'mini' });
    mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    expect(element?.classList.contains('scarlett-audio--mini')).toBe(true);
  });

  it('changes layout dynamically', async () => {
    plugin = createAudioUIPlugin({ layout: 'full' });
    mockApi = createMockApi();
    await plugin.init(mockApi);

    plugin.setLayout('compact');

    const element = plugin.getElement();
    expect(element?.classList.contains('scarlett-audio--compact')).toBe(true);
    expect(element?.classList.contains('scarlett-audio--full')).toBe(false);
  });
});

describe('UI elements', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(async () => {
    await plugin.destroy();
  });

  it('creates play button', () => {
    const element = plugin.getElement();
    const playBtn = element?.querySelector('.scarlett-audio__btn--play');

    expect(playBtn).not.toBeNull();
  });

  it('creates progress bar', () => {
    const element = plugin.getElement();
    const progressBar = element?.querySelector('.scarlett-audio__progress-bar');

    expect(progressBar).not.toBeNull();
  });

  it('creates time displays in full layout', async () => {
    const element = plugin.getElement();
    const currentTime = element?.querySelector('.scarlett-audio__time--current');
    const duration = element?.querySelector('.scarlett-audio__time--duration');

    expect(currentTime).not.toBeNull();
    expect(duration).not.toBeNull();
  });

  it('creates artwork in full layout', () => {
    const element = plugin.getElement();
    const artwork = element?.querySelector('.scarlett-audio__artwork');

    expect(artwork).not.toBeNull();
  });

  it('creates title element', () => {
    const element = plugin.getElement();
    const title = element?.querySelector('.scarlett-audio__title');

    expect(title).not.toBeNull();
  });

  it('creates volume control in full layout', () => {
    const element = plugin.getElement();
    const volume = element?.querySelector('.scarlett-audio__volume');

    expect(volume).not.toBeNull();
  });

  it('creates shuffle button in full layout', () => {
    const element = plugin.getElement();
    const shuffleBtn = element?.querySelector('.scarlett-audio__btn--shuffle');

    expect(shuffleBtn).not.toBeNull();
  });

  it('creates repeat button in full layout', () => {
    const element = plugin.getElement();
    const repeatBtn = element?.querySelector('.scarlett-audio__btn--repeat');

    expect(repeatBtn).not.toBeNull();
  });

  it('creates navigation buttons in full layout', () => {
    const element = plugin.getElement();
    const prevBtn = element?.querySelector('.scarlett-audio__btn--prev');
    const nextBtn = element?.querySelector('.scarlett-audio__btn--next');

    expect(prevBtn).not.toBeNull();
    expect(nextBtn).not.toBeNull();
  });
});

describe('conditional elements', () => {
  afterEach(async () => {
    // Clean up any style elements
    document.head.querySelectorAll('style').forEach(s => s.remove());
  });

  it('hides artwork when showArtwork is false', async () => {
    const plugin = createAudioUIPlugin({ showArtwork: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    const artwork = element?.querySelector('.scarlett-audio__artwork');

    expect(artwork).toBeNull();

    await plugin.destroy();
  });

  it('hides time when showTime is false', async () => {
    const plugin = createAudioUIPlugin({ showTime: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    const time = element?.querySelector('.scarlett-audio__time');

    expect(time).toBeNull();

    await plugin.destroy();
  });

  it('hides volume when showVolume is false', async () => {
    const plugin = createAudioUIPlugin({ showVolume: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    const volume = element?.querySelector('.scarlett-audio__volume');

    expect(volume).toBeNull();

    await plugin.destroy();
  });

  it('hides shuffle when showShuffle is false', async () => {
    const plugin = createAudioUIPlugin({ showShuffle: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    const shuffle = element?.querySelector('.scarlett-audio__btn--shuffle');

    expect(shuffle).toBeNull();

    await plugin.destroy();
  });

  it('hides repeat when showRepeat is false', async () => {
    const plugin = createAudioUIPlugin({ showRepeat: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    const repeat = element?.querySelector('.scarlett-audio__btn--repeat');

    expect(repeat).toBeNull();

    await plugin.destroy();
  });

  it('hides navigation when showNavigation is false', async () => {
    const plugin = createAudioUIPlugin({ showNavigation: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    const prev = element?.querySelector('.scarlett-audio__btn--prev');
    const next = element?.querySelector('.scarlett-audio__btn--next');

    expect(prev).toBeNull();
    expect(next).toBeNull();

    await plugin.destroy();
  });
});

describe('button interactions', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(async () => {
    await plugin.destroy();
  });

  it('emits playback:play when play button clicked while paused', () => {
    mockApi.getState.mockReturnValue(false); // Not playing
    const playBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--play') as HTMLButtonElement;

    playBtn.click();

    expect(mockApi.emit).toHaveBeenCalledWith('playback:play', undefined);
  });

  it('emits playback:pause when play button clicked while playing', () => {
    mockApi.getState.mockImplementation((key: string) => {
      if (key === 'playing') return true;
      return 0;
    });
    const playBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--play') as HTMLButtonElement;

    playBtn.click();

    expect(mockApi.emit).toHaveBeenCalledWith('playback:pause', undefined);
  });

  it('calls playlist.previous when prev button clicked', () => {
    const mockPlaylist = { previous: vi.fn() };
    mockApi.getPlugin.mockReturnValue(mockPlaylist);

    const prevBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--prev') as HTMLButtonElement;
    prevBtn.click();

    expect(mockPlaylist.previous).toHaveBeenCalled();
  });

  it('emits seeking to 0 when prev clicked without playlist', () => {
    mockApi.getPlugin.mockReturnValue(null);

    const prevBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--prev') as HTMLButtonElement;
    prevBtn.click();

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 0 });
  });

  it('calls playlist.next when next button clicked', () => {
    const mockPlaylist = { next: vi.fn() };
    mockApi.getPlugin.mockReturnValue(mockPlaylist);

    const nextBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--next') as HTMLButtonElement;
    nextBtn.click();

    expect(mockPlaylist.next).toHaveBeenCalled();
  });

  it('calls playlist.toggleShuffle when shuffle button clicked', () => {
    const mockPlaylist = { toggleShuffle: vi.fn(), getState: vi.fn().mockReturnValue({ shuffle: false }) };
    mockApi.getPlugin.mockReturnValue(mockPlaylist);

    const shuffleBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--shuffle') as HTMLButtonElement;
    shuffleBtn.click();

    expect(mockPlaylist.toggleShuffle).toHaveBeenCalled();
  });

  it('calls playlist.cycleRepeat when repeat button clicked', () => {
    const mockPlaylist = { cycleRepeat: vi.fn(), getState: vi.fn().mockReturnValue({ repeat: 'none' }) };
    mockApi.getPlugin.mockReturnValue(mockPlaylist);

    const repeatBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--repeat') as HTMLButtonElement;
    repeatBtn.click();

    expect(mockPlaylist.cycleRepeat).toHaveBeenCalled();
  });

  it('toggles mute when volume button clicked', () => {
    mockApi.getState.mockImplementation((key: string) => {
      if (key === 'muted') return false;
      return 0;
    });

    const volumeBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--volume') as HTMLButtonElement;
    volumeBtn.click();

    expect(mockApi.emit).toHaveBeenCalledWith('volume:mute', { muted: true });
  });
});

describe('progress bar interaction', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    mockApi.getState.mockImplementation((key: string) => {
      if (key === 'duration') return 100;
      return 0;
    });
    await plugin.init(mockApi);
  });

  afterEach(async () => {
    await plugin.destroy();
  });

  it('seeks when progress bar clicked', () => {
    const progressBar = plugin.getElement()?.querySelector('.scarlett-audio__progress-bar') as HTMLElement;

    // Mock getBoundingClientRect
    progressBar.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      width: 200,
    });

    // Simulate click at 50% position
    const clickEvent = new MouseEvent('click', {
      clientX: 100, // 50% of 200
      bubbles: true,
    });
    progressBar.dispatchEvent(clickEvent);

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 50 });
  });
});

describe('volume slider interaction', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(async () => {
    await plugin.destroy();
  });

  it('changes volume when slider clicked', () => {
    const volumeSlider = plugin.getElement()?.querySelector('.scarlett-audio__volume-slider') as HTMLElement;

    // Mock getBoundingClientRect
    volumeSlider.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      width: 80,
    });

    // Simulate click at 50% position
    const clickEvent = new MouseEvent('click', {
      clientX: 40, // 50% of 80
      bubbles: true,
    });
    volumeSlider.dispatchEvent(clickEvent);

    expect(mockApi.emit).toHaveBeenCalledWith('volume:change', { volume: 0.5, muted: false });
  });
});

describe('visibility controls', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(async () => {
    await plugin.destroy();
  });

  it('hides UI with hide()', () => {
    plugin.hide();

    const element = plugin.getElement();
    expect(element?.classList.contains('scarlett-audio--hidden')).toBe(true);
  });

  it('shows UI with show()', () => {
    plugin.hide();
    plugin.show();

    const element = plugin.getElement();
    expect(element?.classList.contains('scarlett-audio--hidden')).toBe(false);
  });

  it('toggles visibility with toggle()', () => {
    plugin.toggle();
    expect(plugin.getElement()?.classList.contains('scarlett-audio--hidden')).toBe(true);

    plugin.toggle();
    expect(plugin.getElement()?.classList.contains('scarlett-audio--hidden')).toBe(false);
  });
});

describe('theming', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(async () => {
    await plugin.destroy();
  });

  it('applies custom theme on init', async () => {
    await plugin.destroy();

    const customPlugin = createAudioUIPlugin({
      theme: {
        primary: '#ff0000',
        background: '#000000',
      },
    });
    await customPlugin.init(mockApi);

    const styleElement = document.head.querySelector('style');
    expect(styleElement?.textContent).toContain('#ff0000');
    expect(styleElement?.textContent).toContain('#000000');

    await customPlugin.destroy();
  });

  it('updates theme dynamically', () => {
    plugin.setTheme({ primary: '#00ff00' });

    const styleElement = document.head.querySelector('style');
    expect(styleElement?.textContent).toContain('#00ff00');
  });
});

describe('custom class prefix', () => {
  it('uses custom class prefix', async () => {
    const plugin = createAudioUIPlugin({ classPrefix: 'custom-player' });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    const element = plugin.getElement();
    expect(element?.classList.contains('custom-player')).toBe(true);

    await plugin.destroy();
  });
});

describe('getElement', () => {
  it('returns null before init', () => {
    const plugin = createAudioUIPlugin();
    expect(plugin.getElement()).toBeNull();
  });

  it('returns element after init', async () => {
    const plugin = createAudioUIPlugin();
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    expect(plugin.getElement()).not.toBeNull();

    await plugin.destroy();
  });

  it('returns null after destroy', async () => {
    const plugin = createAudioUIPlugin();
    const mockApi = createMockApi();
    await plugin.init(mockApi);
    await plugin.destroy();

    expect(plugin.getElement()).toBeNull();
  });
});

describe('time formatting', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;
  let stateCallback: (event: { key: string; value: unknown }) => void;

  beforeEach(async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    mockApi.subscribeToState.mockImplementation((cb) => {
      stateCallback = cb;
      return vi.fn();
    });
    await plugin.init(mockApi);
  });

  afterEach(async () => {
    await plugin.destroy();
  });

  it('displays duration in correct format', () => {
    mockApi.getState.mockImplementation((key: string) => {
      if (key === 'duration') return 125; // 2:05
      return 0;
    });

    // Trigger state update
    stateCallback({ key: 'duration', value: 125 });

    const duration = plugin.getElement()?.querySelector('.scarlett-audio__time--duration');
    expect(duration?.textContent).toBe('2:05');
  });

  it('displays hours for long durations', () => {
    mockApi.getState.mockImplementation((key: string) => {
      if (key === 'duration') return 3725; // 1:02:05
      return 0;
    });

    stateCallback({ key: 'duration', value: 3725 });

    const duration = plugin.getElement()?.querySelector('.scarlett-audio__time--duration');
    expect(duration?.textContent).toBe('1:02:05');
  });
});

describe('playlist state updates', () => {
  let plugin: IAudioUIPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    plugin = createAudioUIPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(async () => {
    await plugin.destroy();
  });

  it('updates shuffle button state', () => {
    const mockPlaylist = { getState: vi.fn().mockReturnValue({ shuffle: true, repeat: 'none' }) };
    mockApi.getPlugin.mockReturnValue(mockPlaylist);

    // Trigger UI update by simulating state change
    const stateCallback = mockApi.subscribeToState.mock.calls[0][0];
    stateCallback({ key: 'playing', value: false });

    const shuffleBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--shuffle');
    expect(shuffleBtn?.classList.contains('scarlett-audio__btn--active')).toBe(true);
  });

  it('updates repeat button state', () => {
    const mockPlaylist = { getState: vi.fn().mockReturnValue({ shuffle: false, repeat: 'all' }) };
    mockApi.getPlugin.mockReturnValue(mockPlaylist);

    const stateCallback = mockApi.subscribeToState.mock.calls[0][0];
    stateCallback({ key: 'playing', value: false });

    const repeatBtn = plugin.getElement()?.querySelector('.scarlett-audio__btn--repeat');
    expect(repeatBtn?.classList.contains('scarlett-audio__btn--active')).toBe(true);
  });
});
