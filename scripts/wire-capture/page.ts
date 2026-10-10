/**
 * Browser entry for the wire-fixture capture harness
 * (scripts/capture-wire-fixtures.mjs).
 *
 * Builds one player with the REAL analytics and clips transports - no
 * `customBeacon`, no `onCreate`, which is why the demo bundle cannot be the
 * fixture source - and exposes it as `window.wire` for the runner to drive.
 * No UI plugin: neither wire contract depends on it.
 *
 * Query parameters, all set by the runner:
 *   beacon  - the HTTPS beacon recorder's origin (required)
 *   src     - playlist path on the page origin (default: the local fixture)
 *   video      - `vod` (default) or `live`: the videoId/videoTitle the beacons
 *                carry. `isLive` is never configured; analytics reads it from
 *                player state, which is what the live fixtures verify.
 *   reconnect  - shorten existing HLS retry/reconnect delays for the recovery
 *                fixture. Production defaults otherwise.
 *   extended   - fail playlist loads fast for the ten-minute long-outage
 *                fixture; reconnect delays and analytics idleTimeout stay at
 *                production defaults.
 *
 * Bundled by the runner with esbuild into a temp directory, with
 * `__PKG_VERSION__` defined from packages/plugins/analytics/package.json so
 * `playerVersion` in every beacon is the real release number.
 */

import { createPlayer } from '@scarlett-player/core';
import type { IPluginAPI, Plugin, ScarlettPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createNativePlugin } from '@scarlett-player/native';
import { createAnalyticsPlugin } from '@scarlett-player/analytics';
import type { AnalyticsConfig, IAnalyticsPlugin } from '@scarlett-player/analytics';
import { createClipsPlugin } from '@scarlett-player/clips';
import type { ClipsPlugin } from '@scarlett-player/clips';

/** What the runner reads through `page.evaluate`. */
export interface WireHandle {
  player: ScarlettPlayer;
  analytics: IAnalyticsPlugin;
  clips: ClipsPlugin;
  /** Resolves once `createPlayer` has initialised every plugin. */
  ready: Promise<void>;
  /** `quality:change` events heard on the bus since load. */
  qualityChangeCount: number;
  /** Their payloads, in order, for the tripwire's failure message. */
  qualityChanges: Array<{ quality: string; auto: boolean }>;
  /** Actual provider segment measurements, never inferred from network requests. */
  segments: Array<{ durationMs: number; bytes: number; ok: boolean; kind: string }>;
  /**
   * `error` events heard on the bus, reduced to what the runner reports: an
   * error the bus carried but no beacon followed is a player bug, not a
   * harness timeout.
   */
  busErrors: Array<{ fatal: boolean; code: unknown; message: string; isError: boolean }>;
  /** Set when `createPlayer` rejects, so the runner can fail with the reason. */
  initError: string | null;
}

declare global {
  interface Window {
    wire: WireHandle;
  }
}

const params = new URLSearchParams(window.location.search);
const beaconOrigin = params.get('beacon');
if (!beaconOrigin) throw new Error('wire-capture: ?beacon=<https origin> is required');
const src = params.get('src') ?? '/scripts/fixtures/hls/vod.m3u8';
const video = params.get('video') === 'live' ? 'live' : 'vod';
const privacy = params.has('privacy');
const batch = params.has('batch');
const native = params.has('native');
const reconnect = params.has('reconnect');
const extended = params.has('extended');

const hlsConfig = {
  maxBufferLength: 4,
  maxMaxBufferLength: 6,
  ...(reconnect
    ? { maxNetworkRetries: 0, retryDelayMs: 50, reconnectBaseDelayMs: 250 }
    : {}),
  ...(extended ? { maxNetworkRetries: 0, retryDelayMs: 50 } : {}),
};

/**
 * Read a `<meta name>` tag's content, the way a Laravel page exposes its CSRF
 * token.
 *
 * @param name - The meta tag's name attribute
 * @returns Its content, or an empty string when absent
 */
function readMeta(name: string): string {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? '';
}

const analytics = createAnalyticsPlugin({
  beaconUrl: `${beaconOrigin}/api/scarlett/beacons`,
  apiKey: 'wire-capture-key',
  videoId: `wire-fixture-${video}`,
  videoTitle: video === 'live' ? 'Wire fixture (live)' : 'Wire fixture (VOD)',
  // The 10 s default would add minutes to every scenario.
  heartbeatInterval: 1000,
  customDimensions: { tenant: 'wire', planTier: 'free', experiment: 42, beta: true },
  // A function, so the fixtures show a per-beacon host header beside X-API-Key.
  headers: () => ({ 'X-Wire-Token': 'per-beacon' }),
  ...(privacy ? {
    anonymous: true,
    respectDoNotTrack: true,
    playerInitTime: Date.now() - 1000,
    beforeSend: (payload: Parameters<NonNullable<AnalyticsConfig['beforeSend']>>[0]) =>
      payload.event === 'custom:wireDropped' ? null : payload,
  } : {}),
  ...(batch ? { batch: { intervalMs: 10000, maxEvents: 20 } } : {}),
});

const clips = createClipsPlugin({
  mediaId: 'wire-fixture-vod',
  ui: 'none',
  endpoint: {
    url: '/api/scarlett/clips',
    headers: () => ({ 'X-CSRF-TOKEN': readMeta('csrf-token') }),
  },
});

const container = document.getElementById('player');
if (!container) throw new Error('wire-capture: #player container missing');

const handle = {
  analytics,
  clips,
  qualityChangeCount: 0,
  qualityChanges: [],
  segments: [],
  busErrors: [],
  initError: null,
} as unknown as WireHandle;

/**
 * Counts `quality:change` (and notes `error`) on the bus from the moment
 * plugins initialise.
 *
 * A plugin rather than `player.on()` after `createPlayer` resolves, because
 * hls.js's first switch off `auto` can land before that promise settles, and
 * the tripwire compares this count with the `qualityChange` beacons received.
 */
const qualityProbe: Plugin = {
  id: 'wire-quality-probe',
  name: 'Wire quality probe',
  version: '0.0.0',
  type: 'feature',
  init(api: IPluginAPI): void {
    api.on('quality:change', (payload) => {
      handle.qualityChangeCount++;
      handle.qualityChanges.push({ quality: payload.quality, auto: payload.auto });
    });
    api.on('media:segment', (payload) => handle.segments.push(payload));
    api.on('error', (payload) => {
      handle.busErrors.push({
        fatal: payload.fatal === true,
        code: payload.code,
        message: payload.message,
        // Whether the payload was an Error instance. HLS fatals are plain
        // PlayerError objects, which analytics dropped until SCAR-ANALYTICS-5
        isError: (payload as unknown) instanceof Error,
      });
    });
  },
  destroy(): void {},
};

handle.ready = createPlayer({
  container,
  src,
  plugins: [
    // A short forward buffer so holding segment responses for a few seconds
    // starves playback and yields a real rebufferStart/rebufferEnd pair; at
    // the 30 s default the whole fixture buffers ahead and never stalls.
    ...(native ? [createNativePlugin()] : [createHLSPlugin(hlsConfig)]),
    qualityProbe,
    analytics,
    clips,
  ],
}).then(
  (player) => {
    handle.player = player;
  },
  (error: unknown) => {
    handle.initError = error instanceof Error ? error.message : String(error);
  },
);

window.wire = handle;
