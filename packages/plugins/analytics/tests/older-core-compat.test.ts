import { describe, it, expect, vi } from 'vitest';

vi.mock('@scarlett-player/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  // Core before 1.23 has no extractHostname export.
  const olderCore = { ...actual };
  delete olderCore.extractHostname;
  return olderCore;
});

import { createAnalyticsPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';

/** Minimal API whose `source` state is the given value. */
function apiWithSource(source: unknown): IPluginAPI {
  const container = document.createElement('div');
  return {
    pluginId: 'analytics',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => (key === 'source' ? source : null)) as any,
    setState: vi.fn(),
    defineState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
    getProviderDiagnostics: vi.fn(() => ({})),
  };
}

async function hostnameFor(src: string): Promise<string | null | undefined> {
  const plugin = createAnalyticsPlugin({ beaconUrl: 'https://beacon.example.com', videoId: 'v' });
  await plugin.init(apiWithSource({ src, type: 'video/mp4' }));
  return plugin.getDiagnostics().playbackState.source?.hostname;
}

describe('Analytics next to a core without extractHostname', () => {
  it('still reports the source host name', async () => {
    expect(await hostnameFor('https://cdn.example.com/a.mp4?token=S')).toBe('cdn.example.com');
  });

  it.each(['blob:https://example.com/3f2a', 'data:video/mp4;base64,AAAA', '   '])(
    'reports a null host name for %s',
    async (src) => {
      expect(await hostnameFor(src)).toBeNull();
    }
  );
});
