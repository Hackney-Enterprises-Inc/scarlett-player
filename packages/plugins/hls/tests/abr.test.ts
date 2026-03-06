/**
 * ABR & Adaptive Quality Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getInitialBandwidthEstimate } from '../src/quality';
import { setupHlsEventHandlers } from '../src/event-map';
import type { IPluginAPI } from '@scarlett-player/core';
import type { HlsInstance } from '../src/types';

describe('getInitialBandwidthEstimate()', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    // Clean up connection mock
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should return override when provided', () => {
    expect(getInitialBandwidthEstimate(3_000_000)).toBe(3_000_000);
  });

  it('should ignore override of 0', () => {
    expect(getInitialBandwidthEstimate(0)).toBe(500_000);
  });

  it('should ignore negative override', () => {
    expect(getInitialBandwidthEstimate(-1)).toBe(500_000);
  });

  it('should use Network Information API with 0.85 safety factor', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, connection: { downlink: 10 } },
      writable: true,
      configurable: true,
    });

    // 10 Mbps * 1_000_000 * 0.85 = 8_500_000
    expect(getInitialBandwidthEstimate()).toBe(8_500_000);
  });

  it('should handle low connection speed', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, connection: { downlink: 1.5 } },
      writable: true,
      configurable: true,
    });

    // 1.5 Mbps * 1_000_000 * 0.85 = 1_275_000
    expect(getInitialBandwidthEstimate()).toBe(1_275_000);
  });

  it('should fall back to 500kbps when API unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, connection: undefined },
      writable: true,
      configurable: true,
    });

    expect(getInitialBandwidthEstimate()).toBe(500_000);
  });

  it('should fall back when downlink is 0', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, connection: { downlink: 0 } },
      writable: true,
      configurable: true,
    });

    expect(getInitialBandwidthEstimate()).toBe(500_000);
  });

  it('should prefer override over Network Information API', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, connection: { downlink: 10 } },
      writable: true,
      configurable: true,
    });

    expect(getInitialBandwidthEstimate(2_000_000)).toBe(2_000_000);
  });
});

describe('bandwidth state from FRAG_LOADED', () => {
  let mockHls: HlsInstance & { handlers: Record<string, Function> };
  let mockApi: IPluginAPI;
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();

    const handlers: Record<string, Function> = {};
    mockHls = {
      loadSource: vi.fn(),
      attachMedia: vi.fn(),
      detachMedia: vi.fn(),
      startLoad: vi.fn(),
      stopLoad: vi.fn(),
      recoverMediaError: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn((event: string, handler: Function) => {
        handlers[event] = handler;
      }),
      off: vi.fn(),
      levels: [],
      currentLevel: -1,
      autoLevelEnabled: true,
      nextLevel: 0,
      loadLevel: 0,
      media: null,
      bandwidthEstimate: 5_000_000,
      handlers,
    };

    mockApi = {
      pluginId: 'hls-provider',
      container: document.createElement('div'),
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      getState: vi.fn(),
      setState: vi.fn(),
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      emit: vi.fn(),
      getPlugin: vi.fn(),
      onDestroy: vi.fn(),
    };

    cleanup = setupHlsEventHandlers(mockHls, mockApi, {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('should set bandwidth state on FRAG_LOADED', () => {
    mockHls.bandwidthEstimate = 3_500_000;

    // Trigger hlsFragLoaded
    const handler = mockHls.handlers['hlsFragLoaded'];
    expect(handler).toBeDefined();
    handler('hlsFragLoaded', {});

    expect(mockApi.setState).toHaveBeenCalledWith('bandwidth', 3_500_000);
  });

  it('should throttle bandwidth updates to every 2 seconds', () => {
    mockHls.bandwidthEstimate = 3_000_000;
    const handler = mockHls.handlers['hlsFragLoaded'];

    // First call — should update
    handler('hlsFragLoaded', {});
    expect(mockApi.setState).toHaveBeenCalledWith('bandwidth', 3_000_000);

    // Reset to track subsequent calls
    (mockApi.setState as any).mockClear();

    // Call again immediately — should be throttled
    mockHls.bandwidthEstimate = 4_000_000;
    handler('hlsFragLoaded', {});
    expect(mockApi.setState).not.toHaveBeenCalledWith('bandwidth', expect.any(Number));

    // Advance 2 seconds
    vi.advanceTimersByTime(2000);

    // Call again — should update now
    mockHls.bandwidthEstimate = 4_500_000;
    handler('hlsFragLoaded', {});
    expect(mockApi.setState).toHaveBeenCalledWith('bandwidth', 4_500_000);
  });

  it('should not set bandwidth when estimate is undefined', () => {
    mockHls.bandwidthEstimate = undefined;
    const handler = mockHls.handlers['hlsFragLoaded'];

    handler('hlsFragLoaded', {});

    expect(mockApi.setState).not.toHaveBeenCalledWith('bandwidth', expect.any(Number));
  });

  it('should round bandwidth estimate', () => {
    mockHls.bandwidthEstimate = 3_456_789.123;
    const handler = mockHls.handlers['hlsFragLoaded'];

    handler('hlsFragLoaded', {});

    expect(mockApi.setState).toHaveBeenCalledWith('bandwidth', 3_456_789);
  });
});

describe('capLevelToPlayerSize config', () => {
  it('should be included in HLSPluginConfig type', async () => {
    // Type-level test: verify the config accepts capLevelToPlayerSize
    const { createHLSPlugin } = await import('../src/index');
    // Should not throw — config is accepted
    const plugin = createHLSPlugin({ capLevelToPlayerSize: false });
    expect(plugin.id).toBe('hls-provider');
  });

  it('should accept initialBandwidthEstimate config', async () => {
    const { createHLSPlugin } = await import('../src/index');
    const plugin = createHLSPlugin({ initialBandwidthEstimate: 2_000_000 });
    expect(plugin.id).toBe('hls-provider');
  });
});
