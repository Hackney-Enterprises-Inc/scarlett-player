/**
 * Version reporting for @scarlett-player/embed.
 *
 * The three entries each carried a hand-written literal ('0.5.3',
 * '0.5.3-video', '0.5.3-audio') while the package published at 1.7.0, and the
 * CDN's latest/embed.umd.cjs still answered `window.ScarlettPlayer.version ===
 * '0.5.3'` (both measured 2026-09-02). That number is the only thing support
 * can read off a page to tell which build a viewer is running, so it has to be
 * the package's own version.
 *
 * Each entry assigns its API to `window.ScarlettPlayer` at module scope, which
 * is exactly what the CDN <script> tag causes, so importing the entry is the
 * cheapest faithful test of what a page sees. The built UMD is checked in a
 * real browser too, by scripts/verify-browser.mjs.
 *
 * The assertions are shapes, never literals: a test that pinned the number
 * would have to be edited on every release, which is the habit that let these
 * constants drift. vitest runs from vitest.config.ts and so does not apply the
 * `define` in vite.config.ts, which means the value under test is the
 * '0.0.0-dev' fallback from src/version.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PKG_VERSION } from '../src/version';

/** Semver core with an optional prerelease tag, which '0.0.0-dev' also matches. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

describe('@scarlett-player/embed version', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as unknown as Record<string, unknown>).ScarlettPlayer;
  });

  it('exposes a semver build constant', () => {
    expect(PKG_VERSION).toMatch(SEMVER);
  });

  it('the full build reports the package version unsuffixed', async () => {
    await import('../src/index');

    expect(window.ScarlettPlayer?.version).toBe(PKG_VERSION);
    expect(window.ScarlettPlayer?.version).toMatch(SEMVER);
  });

  it('the video build reports the package version with the -video suffix', async () => {
    await import('../src/index-video');

    expect(window.ScarlettPlayer?.version).toBe(`${PKG_VERSION}-video`);
    expect(window.ScarlettPlayer?.version).toMatch(SEMVER);
  });

  it('the audio build reports the package version with the -audio suffix', async () => {
    await import('../src/index-audio');

    expect(window.ScarlettPlayer?.version).toBe(`${PKG_VERSION}-audio`);
    expect(window.ScarlettPlayer?.version).toMatch(SEMVER);
  });
});
