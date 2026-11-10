/**
 * The embed's playlist and analytics together, on the real plugins.
 *
 * embed.test.ts mocks every plugin creator, which can only show what the embed
 * passes to them. Whether the first playlist item's videoId reaches a beacon
 * depends on how the embed loads that item (as the player's src, not through
 * the playlist), so this drives the actual analytics and playlist sources
 * against core, with a stub provider that accepts any URL.
 *
 * The 1.28 tests below need the real `use()` as well: an addon loaded beside a
 * build that still bundles its plugin replaces the bundled creator, and what
 * that has to guarantee is exactly one analytics plugin per player.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createEmbedPlayer, createScarlettPlayerAPI } from '../src/create-embed';
import { PKG_VERSION } from '../src/version';

// Workspace sources rather than the packages' built dist, which would test the
// last build instead of this tree. Variable specifiers keep tsc from pulling
// the other packages' sources into this program (TS6059, outside rootDir);
// vitest resolves them at run time.
const analyticsSource = '../../plugins/analytics/src/index';
const playlistSource = '../../plugins/playlist/src/index';

type Beacon = Record<string, unknown>;

const stubProvider = (): any => ({
  id: 'stub-provider',
  name: 'Stub provider',
  version: '1.0.0',
  type: 'provider',
  init: async () => {},
  destroy: async () => {},
  canPlay: () => true,
  loadSource: async () => {},
});

async function embedWith(config: Record<string, unknown>) {
  const { createAnalyticsPlugin } = await import(/* @vite-ignore */ analyticsSource);
  const { createPlaylistPlugin } = await import(/* @vite-ignore */ playlistSource);
  const beacons: Beacon[] = [];

  const player = await createEmbedPlayer(
    document.createElement('div'),
    { controls: false, ...config } as any,
    {
      hls: stubProvider,
      playlist: (c: any) => createPlaylistPlugin({ ...c, preloadNext: false }),
      analytics: (c: any) =>
        createAnalyticsPlugin({
          ...c,
          disableInDev: false,
          customBeacon: (_url: string, payload: Beacon) => beacons.push(payload),
        }),
    },
    ['video']
  );

  return { player, beacons };
}

/**
 * A creators map shaped like the 1.28 full build's, with the analytics slot
 * left for the caller to fill.
 *
 * Both the bundled creator and the addon creator build the real plugin against
 * the same beacon sink, so a player that somehow got both would report two
 * viewStarts and the test could tell.
 *
 * @param beacons - Sink every beacon the plugin builds is pushed into
 * @returns The creators map, analytics included
 */
async function fullBuildCreators(beacons: Beacon[]) {
  const { createAnalyticsPlugin } = await import(/* @vite-ignore */ analyticsSource);
  const { createPlaylistPlugin } = await import(/* @vite-ignore */ playlistSource);

  return {
    hls: stubProvider,
    playlist: (c: any) => createPlaylistPlugin({ ...c, preloadNext: false }),
    analytics: (c: any) =>
      createAnalyticsPlugin({
        ...c,
        disableInDev: false,
        customBeacon: (_url: string, payload: Beacon) => beacons.push(payload),
      }),
  };
}

describe('embed playlist analytics', () => {
  let destroy: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await destroy?.();
    destroy = undefined;
  });

  it('reports the first playlist item videoId from the first view', async () => {
    const { player, beacons } = await embedWith({
      playlist: [{ src: 'one.mp4', videoId: 'first-video', title: 'First' }, { src: 'two.mp4' }],
      analytics: { videoId: 'configured', beaconUrl: 'https://example.com/beacon' },
    });
    expect(player).not.toBeNull();
    destroy = () => player!.destroy();

    expect(beacons[0]).toMatchObject({ event: 'viewStart', videoId: 'first-video', videoTitle: 'First' });
    (player!.getPlugin('analytics') as any).trackEvent('probe');
    expect(beacons.at(-1)?.videoId).toBe('first-video');
  });

  it('keeps the configured videoId when a standalone src is not the first item', async () => {
    const { player, beacons } = await embedWith({
      src: 'standalone.mp4',
      playlist: [{ src: 'one.mp4', videoId: 'first-video' }],
      analytics: { videoId: 'configured', beaconUrl: 'https://example.com/beacon' },
    });
    expect(player).not.toBeNull();
    destroy = () => player!.destroy();

    expect(beacons[0]).toMatchObject({ event: 'viewStart', videoId: 'configured' });
  });

  it('reports exactly one viewStart per player when the bundled copy and the addon are both present', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const beacons: Beacon[] = [];
    const creators = (await fullBuildCreators(beacons)) as any;
    const bundled = vi.fn(creators.analytics);
    const addon = vi.fn(creators.analytics);
    creators.analytics = bundled;

    // The full build's shape: it still carries analytics and lists it as
    // deprecated, so the addon takes the bundled creator's place.
    const api = createScarlettPlayerAPI(creators, ['video'], `${PKG_VERSION}-video`, undefined, {
      deprecatedBundled: ['analytics'],
    });
    api.use('analytics', addon);

    const player = await api.create({
      container: document.createElement('div'),
      controls: false,
      src: 'one.mp4',
      analytics: { beaconUrl: 'https://example.com/beacon' },
    });
    expect(player).not.toBeNull();
    destroy = () => player!.destroy();

    // One plugin, one view: the addon replaced the bundled creator rather
    // than being installed beside it.
    expect(bundled).not.toHaveBeenCalled();
    expect(addon).toHaveBeenCalledTimes(1);
    expect(beacons.filter((beacon) => beacon.event === 'viewStart')).toHaveLength(1);

    // And a host that migrated is not told the bundled copy is on its way out.
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((message) => message.includes('bundled in this build'))).toHaveLength(0);
    warn.mockRestore();
  });

  it('warns once and sends no beacons when no analytics creator is present', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const beacons: Beacon[] = [];
    const creators = (await fullBuildCreators(beacons)) as any;
    delete creators.analytics;

    const player = await createEmbedPlayer(
      document.createElement('div'),
      {
        controls: false,
        src: 'one.mp4',
        analytics: { beaconUrl: 'https://example.com/beacon' },
      } as any,
      creators,
      ['video']
    );
    expect(player).not.toBeNull();
    destroy = () => player!.destroy();

    expect(beacons).toHaveLength(0);

    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((message) => message.includes('data-analytics-beacon-url'))).toHaveLength(1);
    expect(messages.some((message) => message.includes('embed.addon.analytics'))).toBe(true);
    warn.mockRestore();
  });
});
