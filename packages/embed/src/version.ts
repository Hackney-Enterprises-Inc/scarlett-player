/**
 * Build-time version of @scarlett-player/embed.
 *
 * The three entries each carried a hand-written literal ('0.5.3', '0.5.3-video'
 * and '0.5.3-audio') while the package published at 1.7.0, and the CDN's
 * `latest/embed.umd.cjs` still reported `window.ScarlettPlayer.version` as
 * '0.5.3' (both measured 2026-09-02). Support could not tell which build a
 * viewer was running. The value now comes from this package's own package.json,
 * injected by the `define` in vite.config.ts as `__PKG_VERSION__`, the same
 * trick demo/build.cjs has used for the demo bundle.
 *
 * The fallback is for vitest, which runs from vitest.config.ts and so never
 * defines the constant. It is a valid semver string on purpose, because the
 * version tests assert a semver shape rather than a literal: a test that
 * asserted a number would have to be edited on every release, which is how
 * these constants drifted in the first place.
 */
declare const __PKG_VERSION__: string;

/**
 * The package version this build was produced from, or '0.0.0-dev' when the
 * build-time define is absent.
 */
export const PKG_VERSION: string =
  typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : '0.0.0-dev';
