import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayer } from '@scarlett-player/core';
import type { Plugin, ScarlettPlayer } from '@scarlett-player/core';
import { createAnalyticsPlugin } from '../src/index';

// PR #143 review: a plugin whose init() fails makes PluginManager emit
// `plugin:error` AND rethrow, and a failing provider is then reported again by
// load() through the general `error` event. One failed initialisation must be
// one error beacon (HEI-SCARLETT-69 reports it; it must not report it twice).
describe('a plugin that fails to initialise, with the real core', () => {
  let container: HTMLElement;
  let player: ScarlettPlayer | null;
  let beacons: Array<Record<string, unknown>>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    player = null;
    beacons = [];
    for (const method of ['debug', 'info', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
  });

  afterEach(async () => {
    await player?.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  const analytics = () =>
    createAnalyticsPlugin({
      beaconUrl: 'https://beacon.example.com/b',
      videoId: 'v1',
      customBeacon: (_url, payload) => { beacons.push(payload as Record<string, unknown>); },
    });

  const errorBeacons = () => beacons.filter((beacon) => beacon.event === 'error');
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  it('sends one error beacon for a provider whose init fails during load()', async () => {
    const provider: Plugin = {
      id: 'bad-provider', name: 'Bad provider', type: 'provider', version: '1.0.0',
      canPlay: () => true,
      init: vi.fn(async () => { throw new Error('boom'); }),
      destroy: vi.fn(),
      loadSource: vi.fn(),
    } as unknown as Plugin;
    player = await createPlayer({ container, plugins: [analytics(), provider] } as any);
    await player.load('https://cdn.example.com/a.m3u8');
    await settle();

    expect(errorBeacons()).toHaveLength(1);
    // It ends the view as before, and still names the plugin that failed
    expect(errorBeacons()[0]).toMatchObject({ fatal: true, errorSeverity: 'fatal' });
    expect(String(errorBeacons()[0].errorMessage)).toContain('bad-provider');
    expect(beacons.filter((beacon) => beacon.event === 'viewEnd')).toHaveLength(1);
  });

  it('still reports a plugin whose init fails outside load() as one non-fatal beacon', async () => {
    const feature: Plugin = {
      id: 'bad-feature', name: 'Bad feature', type: 'feature', version: '1.0.0',
      init: () => { throw new Error('kaput'); },
      destroy: vi.fn(),
    } as unknown as Plugin;
    await expect(createPlayer({ container, plugins: [analytics(), feature] } as any)).rejects.toThrow('kaput');
    await settle();

    expect(errorBeacons()).toHaveLength(1);
    expect(errorBeacons()[0]).toMatchObject({ errorCode: 'PLUGIN_SETUP_FAILED', fatal: false });
    expect(String(errorBeacons()[0].errorMessage)).toContain('bad-feature');
    expect(beacons.filter((beacon) => beacon.event === 'viewEnd')).toHaveLength(0);
  });
});
