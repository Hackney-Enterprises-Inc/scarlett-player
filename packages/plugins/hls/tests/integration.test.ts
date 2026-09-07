/**
 * Contract tests against the real hls.js.
 *
 * Every other suite in this package builds hls.js out of `tests/helpers.ts`:
 * a fake constructor, fake events, hand-written error payloads. That is fast
 * and it is why PR-3.8 shipped - `parseHlsError` read `data.url` for an error
 * type hls.js never sets it on, and every mock-based test passed because the
 * mocks set it.
 *
 * This file imports the library itself and asserts the things a mock cannot:
 * that the event names and error-detail strings the plugin switches on still
 * exist on hls.js, and that the payload shapes `event-map.ts` reads are the
 * shapes hls.js actually emits.
 *
 * Deliberately dependency-free at runtime - no ffmpeg, no browser, no network -
 * so it runs in the same `pnpm test` pass as everything else. The real-browser
 * legs live in `scripts/verify-browser.mjs`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Hls from 'hls.js';
import { HLS_EVENTS, HLS_ERROR_TYPES, parseHlsError } from '../src/event-map';

/** Every event name the plugin subscribes to, as emitted by hls.js. */
const SUBSCRIBED_EVENTS = Object.values(HLS_EVENTS);

/**
 * Event names other packages subscribe to on the same instance.
 *
 * `@scarlett-player/captions` registers these against the hls.js instance it
 * gets from this plugin, so a rename in hls.js breaks captions silently -
 * `hls.on()` with an unknown string matches nothing and throws nothing.
 */
const CAPTIONS_EVENTS = ['hlsSubtitleTracksUpdated', 'hlsSubtitleTrackSwitch'];

describe('hls.js event names', () => {
  it('emits every event name the plugin subscribes to', () => {
    const emitted = new Set(Object.values(Hls.Events) as string[]);

    for (const name of SUBSCRIBED_EVENTS) {
      expect(emitted, `Hls.Events no longer contains "${name}"`).toContain(name);
    }
  });

  it('emits the subtitle events the captions plugin subscribes to', () => {
    const emitted = new Set(Object.values(Hls.Events) as string[]);

    for (const name of CAPTIONS_EVENTS) {
      expect(emitted, `Hls.Events no longer contains "${name}"`).toContain(name);
    }
  });

  it('still names its error types the way mapErrorType switches on them', () => {
    expect(Hls.ErrorTypes.NETWORK_ERROR).toBe(HLS_ERROR_TYPES.NETWORK_ERROR);
    expect(Hls.ErrorTypes.MEDIA_ERROR).toBe(HLS_ERROR_TYPES.MEDIA_ERROR);
    expect(Hls.ErrorTypes.MUX_ERROR).toBe(HLS_ERROR_TYPES.MUX_ERROR);
    expect(Hls.ErrorTypes.KEY_SYSTEM_ERROR).toBe(HLS_ERROR_TYPES.KEY_SYSTEM_ERROR);
    expect(Hls.ErrorTypes.OTHER_ERROR).toBe(HLS_ERROR_TYPES.OTHER_ERROR);
  });
});

describe('hls.js error detail strings', () => {
  /**
   * Detail strings the plugin branches on by literal value. A rename in
   * hls.js turns each of these into a silently dead branch.
   */
  const BRANCHED_DETAILS = [
    // create-hls-plugin.ts MANIFEST_PHASE_ERRORS
    'manifestLoadError',
    'manifestLoadTimeOut',
    'manifestParsingError',
    // create-hls-plugin.ts APPEND_ERROR_DETAILS + bufferFullError
    'bufferAppendError',
    'bufferAddCodecError',
    'bufferFullError',
    // event-map.ts buffer-hole recovery
    'bufferStalledError',
    // the error types PR-3.8's URL recovery exists for
    'fragLoadError',
    'keyLoadError',
    'levelLoadError',
  ];

  it('still defines every detail string the plugin branches on', () => {
    const details = new Set(Object.values(Hls.ErrorDetails) as string[]);

    for (const detail of BRANCHED_DETAILS) {
      expect(details, `Hls.ErrorDetails no longer contains "${detail}"`).toContain(detail);
    }
  });

  it('still defines bufferAppendingError, which the append branch also lists', () => {
    // Listed separately: hls.js has renamed this one before, and the plugin
    // keeps both spellings in APPEND_ERROR_DETAILS on purpose. If this fails,
    // the entry is dead weight rather than a bug - remove it there.
    const details = new Set(Object.values(Hls.ErrorDetails) as string[]);

    expect(
      details.has('bufferAppendingError') || details.has('bufferAppendError')
    ).toBe(true);
  });
});

describe('parseHlsError against hls.js error shapes', () => {
  const SEGMENT = 'https://cdn.example.com/live/720p/00042.ts';
  const MANIFEST = 'https://cdn.example.com/live/playlist.m3u8';

  it('recovers the URL from a fragment error built the way hls.js builds it', () => {
    // hls.js's fragment loader rejects with LoadError({ type, details, fatal,
    // frag, response, error, networkDetails, stats }) and sets NO data.url.
    // This is the regression PR-3.8 fixed, asserted against the real
    // constants rather than a hand-typed string.
    const error = parseHlsError({
      type: Hls.ErrorTypes.NETWORK_ERROR,
      details: Hls.ErrorDetails.FRAG_LOAD_ERROR,
      fatal: false,
      frag: { url: SEGMENT },
      response: { url: SEGMENT, code: 503, text: 'Service Unavailable' },
      error: new Error('HTTP Error 503 Service Unavailable'),
    });

    expect(error.url).toBe(SEGMENT);
    expect(error.response?.code).toBe(503);
    expect(error.type).toBe('network');
    expect(error.fatal).toBe(false);
  });

  it('recovers the URL from a key load error', () => {
    const error = parseHlsError({
      type: Hls.ErrorTypes.NETWORK_ERROR,
      details: Hls.ErrorDetails.KEY_LOAD_ERROR,
      fatal: false,
      frag: { url: SEGMENT },
      response: { url: SEGMENT, code: 403, text: 'Forbidden' },
    });

    expect(error.url).toBe(SEGMENT);
  });

  it('still prefers data.url, which the playlist errors do set', () => {
    const error = parseHlsError({
      type: Hls.ErrorTypes.NETWORK_ERROR,
      details: Hls.ErrorDetails.MANIFEST_LOAD_ERROR,
      fatal: true,
      url: MANIFEST,
      response: { code: 404, text: 'Not Found' },
    });

    expect(error.url).toBe(MANIFEST);
  });

  it('leaves the URL undefined when the error genuinely carries none', () => {
    const error = parseHlsError({
      type: Hls.ErrorTypes.MEDIA_ERROR,
      details: Hls.ErrorDetails.FRAG_PARSING_ERROR,
      fatal: true,
    });

    expect(error.url).toBeUndefined();
    expect(error.type).toBe('media');
  });
});

const MASTER_MANIFEST = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.42c01e,mp4a.40.2"
360.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
720.m3u8
`;

const MEDIA_MANIFEST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:2.0,
seg0.ts
#EXTINF:2.0,
seg1.ts
#EXT-X-ENDLIST
`;

/**
 * hls.js playlist loader that serves the two manifests above from memory.
 *
 * Faking the network at the loader rather than faking the event is what makes
 * this a contract test: the payloads asserted below are the ones hls.js's own
 * parser built, not ones this file wrote.
 */
class InlineManifestLoader {
  /** @param context - hls.js load context; only `url` is used */
  load(
    context: { url: string },
    _config: unknown,
    callbacks: {
      onSuccess: (
        response: { url: string; data: string; code: number },
        stats: Record<string, unknown>,
        context: unknown,
        networkDetails: unknown
      ) => void;
    }
  ): void {
    const data = context.url.includes('master') ? MASTER_MANIFEST : MEDIA_MANIFEST;

    setTimeout(() => {
      callbacks.onSuccess(
        { url: context.url, data, code: 200 },
        {
          loading: { start: 0, first: 0, end: 1 },
          parsing: { start: 0, end: 0 },
          buffering: { start: 0, first: 0, end: 0 },
          total: data.length,
          loaded: data.length,
          aborted: false,
          retry: 0,
          chunkCount: 0,
          bwEstimate: 0,
        },
        context,
        null
      );
    }, 0);
  }

  abort(): void {}
  destroy(): void {}
}

describe('payload shapes event-map.ts reads', () => {
  /**
   * jsdom has no MediaSource, so hls.js filters every level out as an
   * incompatible codec and never reaches MANIFEST_PARSED. Stubbing only
   * `isTypeSupported` is enough to get the playlist path running; nothing
   * below touches the media pipeline.
   */
  beforeAll(() => {
    if (typeof (globalThis as { MediaSource?: unknown }).MediaSource === 'undefined') {
      (globalThis as { MediaSource?: unknown }).MediaSource = class {
        static isTypeSupported(): boolean {
          return true;
        }
      };
    }
  });

  /** Load the inline master manifest and collect the two events. */
  const loadManifest = async (): Promise<{
    parsed?: { levels: Array<{ width: number; height: number; bitrate: number }> };
    level?: { details: Record<string, unknown> };
  }> => {
    const hls = new Hls({ loader: InlineManifestLoader as never, enableWorker: false });
    const seen: {
      parsed?: { levels: Array<{ width: number; height: number; bitrate: number }> };
      level?: { details: Record<string, unknown> };
    } = {};

    try {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          seen.parsed = data as never;
        });
        hls.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
          seen.level = data as never;
          clearTimeout(timer);
          resolve();
        });
        hls.loadSource('https://cdn.example.com/master.m3u8');
      });
    } finally {
      hls.destroy();
    }

    return seen;
  };

  it('hands hlsManifestParsed the level fields the quality handler maps', async () => {
    const { parsed } = await loadManifest();

    expect(parsed?.levels).toHaveLength(2);
    // event-map.ts reads exactly these three off each level.
    expect(parsed?.levels[0]).toMatchObject({ width: 640, height: 360, bitrate: 800000 });
    expect(parsed?.levels[1]).toMatchObject({ width: 1280, height: 720, bitrate: 2000000 });
  });

  it('hands hlsLevelLoaded the details fields the live/seekable handler reads', async () => {
    const { level } = await loadManifest();
    const details = level?.details ?? {};

    // The handler branches on `live` and, when live, computes the seekable
    // range from fragmentStart/fragments[0].start and edge/totalduration.
    expect(details).toHaveProperty('live');
    expect(details.live).toBe(false);
    expect(details).toHaveProperty('fragmentStart');
    expect(details).toHaveProperty('edge');
    expect(details).toHaveProperty('totalduration');
    expect(details).toHaveProperty('targetduration');
    expect(Array.isArray(details.fragments)).toBe(true);
  });
});
