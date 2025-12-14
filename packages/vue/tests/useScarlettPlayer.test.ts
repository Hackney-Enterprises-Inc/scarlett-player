/**
 * Test the useScarlettPlayer composable
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

// Mock the core module
vi.mock('@scarlett-player/core', () => {
  const mockPlayer = {
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seek: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    requestFullscreen: vi.fn().mockResolvedValue(undefined),
    exitFullscreen: vi.fn().mockResolvedValue(undefined),
    toggleFullscreen: vi.fn().mockResolvedValue(undefined),
    getQualities: vi.fn().mockReturnValue([]),
    setQuality: vi.fn(),
    getCurrentQuality: vi.fn().mockReturnValue(-1),
    getState: vi.fn().mockReturnValue({ buffering: false }),
    on: vi.fn(),
  };

  return {
    ScarlettPlayer: vi.fn().mockImplementation(() => mockPlayer),
  };
});

describe('useScarlettPlayer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create a mock container element
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('returns expected properties and methods', async () => {
    const { useScarlettPlayer } = await import('../src/composables/useScarlettPlayer');

    const containerRef = ref<HTMLElement | null>(container);
    const result = useScarlettPlayer({
      container: containerRef,
      src: 'https://example.com/video.m3u8',
      autoInit: false, // Don't auto-init so we can test synchronously
    });

    // Check returned state refs
    expect(result.player).toBeDefined();
    expect(result.isReady).toBeDefined();
    expect(result.error).toBeDefined();
    expect(result.playing).toBeDefined();
    expect(result.paused).toBeDefined();
    expect(result.currentTime).toBeDefined();
    expect(result.duration).toBeDefined();
    expect(result.volume).toBeDefined();
    expect(result.muted).toBeDefined();
    expect(result.bufferedAmount).toBeDefined();
    expect(result.fullscreen).toBeDefined();
    expect(result.progress).toBeDefined();
    expect(result.isBuffering).toBeDefined();

    // Check returned methods
    expect(typeof result.init).toBe('function');
    expect(typeof result.play).toBe('function');
    expect(typeof result.pause).toBe('function');
    expect(typeof result.seek).toBe('function');
    expect(typeof result.load).toBe('function');
    expect(typeof result.setVolume).toBe('function');
    expect(typeof result.setMuted).toBe('function');
    expect(typeof result.requestFullscreen).toBe('function');
    expect(typeof result.exitFullscreen).toBe('function');
    expect(typeof result.toggleFullscreen).toBe('function');
    expect(typeof result.getQualities).toBe('function');
    expect(typeof result.setQuality).toBe('function');
    expect(typeof result.getCurrentQuality).toBe('function');
  });

  it('has initial state values', async () => {
    const { useScarlettPlayer } = await import('../src/composables/useScarlettPlayer');

    const containerRef = ref<HTMLElement | null>(container);
    const result = useScarlettPlayer({
      container: containerRef,
      src: 'https://example.com/video.m3u8',
      autoInit: false,
    });

    // Check initial values
    expect(result.player.value).toBeNull();
    expect(result.isReady.value).toBe(false);
    expect(result.error.value).toBeNull();
    expect(result.playing.value).toBe(false);
    expect(result.paused.value).toBe(true);
    expect(result.currentTime.value).toBe(0);
    expect(result.duration.value).toBe(0);
    expect(result.bufferedAmount.value).toBe(0);
    expect(result.fullscreen.value).toBe(false);
  });

  it('uses provided initial volume and muted values', async () => {
    const { useScarlettPlayer } = await import('../src/composables/useScarlettPlayer');

    const containerRef = ref<HTMLElement | null>(container);
    const result = useScarlettPlayer({
      container: containerRef,
      src: 'https://example.com/video.m3u8',
      volume: 0.5,
      muted: true,
      autoInit: false,
    });

    expect(result.volume.value).toBe(0.5);
    expect(result.muted.value).toBe(true);
  });

  it('computes progress correctly', async () => {
    const { useScarlettPlayer } = await import('../src/composables/useScarlettPlayer');

    const containerRef = ref<HTMLElement | null>(container);
    const result = useScarlettPlayer({
      container: containerRef,
      src: 'https://example.com/video.m3u8',
      autoInit: false,
    });

    // Initially 0
    expect(result.progress.value).toBe(0);

    // Simulate time update
    result.currentTime.value = 30;
    result.duration.value = 100;
    expect(result.progress.value).toBe(30);
  });
});
