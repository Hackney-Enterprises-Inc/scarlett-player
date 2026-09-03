/**
 * Version reporting for @scarlett-player/analytics.
 *
 * This package had the worst of the drift: PLUGIN_VERSION was the literal
 * '0.1.0' while the package published at 1.7.0 (measured 2026-09-02), and it is
 * not only the descriptor's `version` but the `playerVersion` stamped on every
 * beacon, so the whole analytics store carries a player version that never
 * matched a release. Both readers are asserted here for that reason.
 *
 * The assertion is a semver shape, never a literal: a test that pinned the
 * number would have to be edited on every release, which is the habit that let
 * the constant drift. vitest does not apply the tsup define, so the value under
 * test is the '0.0.0-dev' fallback from src/version.ts; the shape is what both
 * the test and the built bundle have to satisfy.
 */

import { describe, it, expect, vi } from 'vitest';
import { createAnalyticsPlugin } from '../src/index';
import { PKG_VERSION } from '../src/version';
import type { IPluginAPI } from '@scarlett-player/core';
import type { AnalyticsConfig, BeaconPayload } from '../src/types';

/** Semver core with an optional prerelease tag, which '0.0.0-dev' also matches. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * The smallest API surface `init()` touches: it sends the viewStart beacon,
 * subscribes to seven player events and logs. Kept local so this file does not
 * depend on the fixture in analytics.test.ts.
 *
 * @returns A mock plugin API good enough to drive one beacon
 */
function createMinimalApi(): IPluginAPI {
  return {
    pluginId: 'analytics',
    container: document.createElement('div'),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn(() => undefined),
    setState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
  } as unknown as IPluginAPI;
}

/**
 * Analytics config with a capturing beacon, which is the plugin's own testing
 * hook (`customBeacon` short-circuits sendBeacon before any network call).
 *
 * @param beacons - Array the plugin appends every payload to
 * @returns A complete config for createAnalyticsPlugin
 */
function configCapturing(beacons: BeaconPayload[]): AnalyticsConfig {
  return {
    beaconUrl: 'https://api.example.com/analytics',
    videoId: 'version-test',
    disableInDev: false,
    customBeacon: (_url: string, payload: BeaconPayload) => {
      beacons.push(payload);
    },
  };
}

describe('@scarlett-player/analytics version', () => {
  it('exposes a semver build constant', () => {
    expect(PKG_VERSION).toMatch(SEMVER);
  });

  it('reports the build constant on the descriptor, not a literal', () => {
    const plugin = createAnalyticsPlugin(configCapturing([]));

    expect(plugin.version).toBe(PKG_VERSION);
    expect(plugin.version).toMatch(SEMVER);
  });

  it('stamps the same version on every beacon as playerVersion', async () => {
    const beacons: BeaconPayload[] = [];
    const plugin = createAnalyticsPlugin(configCapturing(beacons));

    await plugin.init(createMinimalApi());
    await plugin.destroy();

    expect(beacons.length).toBeGreaterThan(0);
    for (const beacon of beacons) {
      expect(beacon.playerVersion).toBe(PKG_VERSION);
    }
  });
});
