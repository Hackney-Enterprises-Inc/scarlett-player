/**
 * Addon bundles: the entry guards, the version rule and the shims.
 *
 * The entries run their registration at module evaluation, so each test
 * resets the module graph and imports the entry afresh against whatever
 * `window.ScarlettPlayer` the test put in place.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PKG_VERSION } from '../src/version';
import type { AddonRuntime } from '../src/addons/runtime';

vi.mock('@scarlett-player/chapters', () => ({ createChaptersPlugin: vi.fn() }));
vi.mock('@scarlett-player/clips', () => ({ createClipsPlugin: vi.fn() }));

type Host = { version?: string; use?: ReturnType<typeof vi.fn>; addonRuntime?: AddonRuntime };

const setHost = (host: Host | undefined): void => {
  (window as unknown as { ScarlettPlayer?: Host }).ScarlettPlayer = host;
};

/** Evaluate an addon entry afresh (the caller resets modules first). */
const loadEntry = (name: 'chapters' | 'clips'): Promise<unknown> =>
  name === 'chapters' ? import('../src/addons/chapters') : import('../src/addons/clips');

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

  it.each(['chapters', 'clips'] as const)(
    '%s: logs the load-order error and registers nothing without the embed',
    async (name) => {
      setHost(undefined);
      await loadEntry(name);
      expect(console.error).toHaveBeenCalledWith(
        `[ScarlettPlayer] embed.addon.${name} loaded before the embed; load embed.js first`
      );
    }
  );

  it.each(['chapters', 'clips'] as const)('%s: refuses an embed of another version', async (name) => {
    const use = vi.fn();
    setHost({ version: '0.1.0', use, addonRuntime: fakeRuntime('0.1.0') });
    await loadEntry(name);

    expect(use).not.toHaveBeenCalled();
    const message = String(vi.mocked(console.error).mock.calls[0]?.[0]);
    expect(message).toContain('0.1.0');
    expect(message).toContain(PKG_VERSION);
  });

  it('refuses an embed that predates addon support', async () => {
    setHost({ version: '1.16.3' });
    await loadEntry('clips');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no addon support'));
  });

  it('calls use() with the plugin creator when the versions match', async () => {
    const use = vi.fn();
    setHost({ version: `${PKG_VERSION}-video`, use, addonRuntime: fakeRuntime() });

    await loadEntry('chapters');
    await loadEntry('clips');
    const { createChaptersPlugin } = await import('@scarlett-player/chapters');
    const { createClipsPlugin } = await import('@scarlett-player/clips');

    expect(use).toHaveBeenCalledWith('chapters', createChaptersPlugin);
    expect(use).toHaveBeenCalledWith('clips', createClipsPlugin);
    expect(console.error).not.toHaveBeenCalled();
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
});
