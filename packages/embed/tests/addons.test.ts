/**
 * Addon bundles: the entry guards, the version rule and the shims.
 *
 * The entries run their registration at module evaluation, so each test
 * resets the module graph and imports the entry afresh against whatever
 * `window.ScarlettPlayer` the test put in place.
 *
 * Seven entries as of 1.28. Chapters and clips are the two no build has ever
 * carried; analytics, playlist, media session, watermark and share are the
 * five the builds still bundle but deprecate, so their guard tables are the
 * same and only the file stem differs. `media-session` is the one stem that
 * does not match its `use()` name (`mediaSession`).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PKG_VERSION } from '../src/version';
import type { AddonName, AddonRuntime } from '../src/addons/runtime';

vi.mock('@scarlett-player/chapters', () => ({ createChaptersPlugin: vi.fn() }));
vi.mock('@scarlett-player/clips', () => ({ createClipsPlugin: vi.fn() }));
vi.mock('@scarlett-player/analytics', () => ({ createAnalyticsPlugin: vi.fn() }));
vi.mock('@scarlett-player/playlist', () => ({ createPlaylistPlugin: vi.fn() }));
vi.mock('@scarlett-player/media-session', () => ({ createMediaSessionPlugin: vi.fn() }));
vi.mock('@scarlett-player/watermark', () => ({ createWatermarkPlugin: vi.fn() }));
vi.mock('@scarlett-player/share', () => ({ createSharePlugin: vi.fn() }));

/** Every addon bundle's file stem, in the order the build emits them. */
const ENTRY_STEMS = [
  'chapters',
  'clips',
  'analytics',
  'playlist',
  'media-session',
  'watermark',
  'share',
] as const;

/** An addon bundle's file stem. */
type EntryStem = (typeof ENTRY_STEMS)[number];

/**
 * The `use()` name each stem registers.
 *
 * `mediaSession` is the only one that differs from its stem, which is why the
 * mapping is spelled out rather than derived: the Laravel package builds
 * `embed.addon.<stem>` from the same list.
 */
const USE_NAMES: Record<EntryStem, AddonName> = {
  chapters: 'chapters',
  clips: 'clips',
  analytics: 'analytics',
  playlist: 'playlist',
  'media-session': 'mediaSession',
  watermark: 'watermark',
  share: 'share',
};

/** Where each entry's plugin creator comes from, for the `use()` assertions. */
const CREATOR_MODULES: Record<EntryStem, [string, string]> = {
  chapters: ['@scarlett-player/chapters', 'createChaptersPlugin'],
  clips: ['@scarlett-player/clips', 'createClipsPlugin'],
  analytics: ['@scarlett-player/analytics', 'createAnalyticsPlugin'],
  playlist: ['@scarlett-player/playlist', 'createPlaylistPlugin'],
  'media-session': ['@scarlett-player/media-session', 'createMediaSessionPlugin'],
  watermark: ['@scarlett-player/watermark', 'createWatermarkPlugin'],
  share: ['@scarlett-player/share', 'createSharePlugin'],
};

type Host = { version?: string; use?: ReturnType<typeof vi.fn>; addonRuntime?: AddonRuntime };

const setHost = (host: Host | undefined): void => {
  (window as unknown as { ScarlettPlayer?: Host }).ScarlettPlayer = host;
};

/** Evaluate an addon entry afresh (the caller resets modules first). */
const loadEntry = (stem: EntryStem): Promise<unknown> => {
  switch (stem) {
    case 'chapters':
      return import('../src/addons/chapters');
    case 'clips':
      return import('../src/addons/clips');
    case 'analytics':
      return import('../src/addons/analytics');
    case 'playlist':
      return import('../src/addons/playlist');
    case 'media-session':
      return import('../src/addons/media-session');
    case 'watermark':
      return import('../src/addons/watermark');
    case 'share':
      return import('../src/addons/share');
  }
};

const fakeRuntime = (version = PKG_VERSION): AddonRuntime =>
  Object.freeze({
    version,
    injectSharedStyles: vi.fn(() => vi.fn()) as unknown as AddonRuntime['injectSharedStyles'],
    registerControl: vi.fn(),
    unregisterControl: vi.fn(() => true),
  });

describe('addon entries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    setHost(undefined);
    vi.restoreAllMocks();
  });

  it.each(ENTRY_STEMS)(
    '%s: logs the load-order error and registers nothing without the embed',
    async (stem) => {
      setHost(undefined);
      await loadEntry(stem);
      expect(console.error).toHaveBeenCalledWith(
        `[ScarlettPlayer] embed.addon.${stem} loaded before the embed; load embed.js first`
      );
    }
  );

  it.each(ENTRY_STEMS)('%s: refuses an embed of another version', async (stem) => {
    const use = vi.fn();
    setHost({ version: '0.1.0', use, addonRuntime: fakeRuntime('0.1.0') });
    await loadEntry(stem);

    expect(use).not.toHaveBeenCalled();
    const message = String(vi.mocked(console.error).mock.calls[0]?.[0]);
    expect(message).toContain('0.1.0');
    expect(message).toContain(PKG_VERSION);
  });

  it.each(ENTRY_STEMS)(
    '%s: a refused load never reaches use() (1.28)',
    async (stem) => {
      // The refusal happens before use(). The bundled creator surviving a
      // refused addon is exercised end to end by harness scenario 14
      // ("[version mismatch] the bundled watermark still runs").
      const use = vi.fn();
      setHost({ version: '0.1.0', use, addonRuntime: fakeRuntime('0.1.0') });

      await loadEntry(stem);

      expect(use).not.toHaveBeenCalled();
    }
  );

  it('refuses an embed that predates addon support', async () => {
    setHost({ version: '1.16.3' });
    await loadEntry('clips');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no addon support'));
  });

  it.each(ENTRY_STEMS)('%s: a second load registers again, for use() to refuse', async (stem) => {
    // Two <script> tags for the same file evaluate twice (classic scripts are
    // not module-cached), and the addon has no self-guard: the embed's use()
    // is what refuses the second registration. What matters here is that the
    // entry does not silently swallow the duplicate.
    const use = vi.fn();
    setHost({ version: `${PKG_VERSION}-video`, use, addonRuntime: fakeRuntime() });

    await loadEntry(stem);
    vi.resetModules();
    await loadEntry(stem);

    expect(use).toHaveBeenCalledTimes(2);
    expect(use).toHaveBeenNthCalledWith(1, USE_NAMES[stem], expect.any(Function));
    expect(use).toHaveBeenNthCalledWith(2, USE_NAMES[stem], expect.any(Function));
  });

  it.each(ENTRY_STEMS)('%s: calls use() with the plugin creator', async (stem) => {
    const use = vi.fn();
    setHost({ version: `${PKG_VERSION}-video`, use, addonRuntime: fakeRuntime() });

    await loadEntry(stem);

    const [moduleId, exportName] = CREATOR_MODULES[stem];
    const creator = (await import(moduleId))[exportName];
    expect(use).toHaveBeenCalledWith(USE_NAMES[stem], creator);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("maps the media-session stem to use('mediaSession', ...)", async () => {
    const use = vi.fn();
    setHost({ version: `${PKG_VERSION}-video`, use, addonRuntime: fakeRuntime() });

    await loadEntry('media-session');

    const { createMediaSessionPlugin } = await import('@scarlett-player/media-session');
    expect(use).toHaveBeenCalledWith('mediaSession', createMediaSessionPlugin);
    expect(use).not.toHaveBeenCalledWith('media-session', expect.anything());
  });
});

describe('addon shims', () => {
  afterEach(() => setHost(undefined));

  it('throw the named error when the runtime is absent', async () => {
    setHost(undefined);
    const core = await import('../src/addons/core-shim');
    const ui = await import('../src/addons/ui-shim');

    expect(() => core.injectSharedStyles('id', '')).toThrow(/addon runtime not found/);
    expect(() => ui.registerControl('x', () => null)).toThrow(/addon runtime not found/);
    expect(() => ui.unregisterControl('x')).toThrow(/addon runtime not found/);
  });

  it('delegate to the runtime at call time', async () => {
    const core = await import('../src/addons/core-shim');
    const ui = await import('../src/addons/ui-shim');
    // Installed AFTER the shims evaluated: resolution is lazy.
    const rt = fakeRuntime();
    setHost({ addonRuntime: rt });
    const owner = document.createElement('div');
    const factory = () => null;

    core.injectSharedStyles('sp-x', '.a{}');
    ui.registerControl('clip', factory, { owner });
    expect(ui.unregisterControl('clip', { owner })).toBe(true);

    expect(rt.injectSharedStyles).toHaveBeenCalledWith('sp-x', '.a{}');
    expect(rt.registerControl).toHaveBeenCalledWith('clip', factory, { owner });
    expect(rt.unregisterControl).toHaveBeenCalledWith('clip', { owner });
  });
});

describe('the core shim pure copies', () => {
  afterEach(() => setHost(undefined));

  it('evaluates ErrorCode with no host runtime, matching core', async () => {
    // A bundled copy, not a runtime delegate: the analytics plugin evaluates
    // Object.values(ErrorCode) while its module loads, which is before
    // registerAddon() can report a load-order problem. A lazy delegate would
    // throw there and take the whole addon down with it.
    setHost(undefined);
    const shim = await import('../src/addons/core-shim');
    const core = await import('@scarlett-player/core');

    expect(Object.values(shim.ErrorCode)).toEqual(Object.values(core.ErrorCode));
    expect(shim.ErrorCode.SOURCE_NOT_SUPPORTED).toBe('SOURCE_NOT_SUPPORTED');
    expect(shim.ErrorCode.MEDIA_NETWORK_ERROR).toBe('MEDIA_NETWORK_ERROR');
  });

  it('sanitizeUrl strips the query string and redacts token segments', async () => {
    const shim = await import('../src/addons/core-shim');

    expect(shim.sanitizeUrl('https://cdn.example.com/live/x.m3u8?token=secret#frag')).toBe(
      'https://cdn.example.com/live/x.m3u8'
    );
    expect(
      shim.sanitizeUrl('https://cdn.example.com/1735689600_ab12cd34ef56ab78_ff00ff00/hls/x.m3u8')
    ).toBe('https://cdn.example.com/:redacted/hls/x.m3u8');
    expect(shim.sanitizeUrl(undefined)).toBeUndefined();
    expect(shim.sanitizeUrl('not a url')).toBeUndefined();
  });
});

describe('addonRuntime identity in a real build entry', () => {
  afterEach(() => setHost(undefined));

  it("the video entry's addonRuntime carries the UI package's own registry functions", async () => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await import('../src/index-video');
    const ui = await import('@scarlett-player/ui');
    const core = await import('@scarlett-player/core');
    const rt = window.ScarlettPlayer.addonRuntime;

    expect(rt.registerControl).toBe(ui.registerControl);
    expect(rt.unregisterControl).toBe(ui.unregisterControl);
    expect(rt.injectSharedStyles).toBe(core.injectSharedStyles);
    expect(rt.version).toBe(PKG_VERSION);
    expect(window.ScarlettPlayer.version).toBe(`${PKG_VERSION}-video`);
    vi.restoreAllMocks();
  });

  it("use('watermark', ...) beside the video entry is silent about deprecation", async () => {
    // embed.test.ts mocks every plugin creator, so it can only show what the
    // embed passes to them; whether an entry actually lists a name in
    // `deprecatedBundled` is only observable against the real entry. The video
    // build bundles watermark and share and lists both, so an addon takes the
    // bundled copy's place instead of being refused with "already provided by
    // this build".
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('../src/index-video');

    window.ScarlettPlayer.use('watermark', vi.fn(() => ({ id: 'watermark' })) as never);

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  // The real entries' `deprecatedBundled` lists. embed.test.ts passes its own
  // lists, so only the real entries can pin what each build declares.
  // [entry, names it deprecates (silent), names it bundles but refuses]
  const DEPRECATED_LISTS: ReadonlyArray<readonly [string, readonly string[], readonly string[]]> = [
    ['index', ['analytics', 'playlist', 'mediaSession', 'watermark', 'share'], []],
    ['index-video', ['watermark', 'share'], []],
    ['index-audio', [], ['playlist', 'mediaSession']],
  ];

  it.each(DEPRECATED_LISTS)('%s: deprecated names are silent for use(), bundled-only names refused', async (entry, silent, refused) => {
    const cases = [...silent.map((n) => [n, true] as const), ...refused.map((n) => [n, false] as const)];
    for (const [name, isSilent] of cases) {
      vi.resetModules();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await import(/* @vite-ignore */ `../src/${entry}`);
      const fn = vi.fn(() => ({ id: name })) as never;

      window.ScarlettPlayer.use(name as never, fn);
      if (isSilent) {
        expect(warn, `${entry} ${name}`).not.toHaveBeenCalled();
        // The first use() was recorded: a second one replaces it.
        window.ScarlettPlayer.use(name as never, fn);
        expect(String(warn.mock.calls[0]?.[0])).toContain('replaces an earlier registration');
      } else {
        expect(String(warn.mock.calls[0]?.[0]), `${entry} ${name}`).toContain('already provided by this build');
      }
      vi.restoreAllMocks();
    }
  });
});
