/**
 * The embed's playlist and analytics together, on the real plugins.
 *
 * embed.test.ts mocks every plugin creator, which can only show what the embed
 * passes to them. Whether the first playlist item's videoId reaches a beacon
 * depends on how the embed loads that item (as the player's src, not through
 * the playlist), so this drives the actual analytics and playlist sources
 * against core, with a stub provider that accepts any URL.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createEmbedPlayer } from '../src/create-embed';

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
});
