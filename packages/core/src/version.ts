/**
 * Build-time version of @scarlett-player/core.
 *
 * Every version string in this repo used to be hand-written and every one of
 * them had drifted: the plugin descriptors said '1.0.0' and the embed builds
 * said '0.5.3' while all 17 packages published at 1.7.0 (measured 2026-09-02).
 * The value now comes from this package's own package.json, injected by the
 * `define` in vite.config.ts as `__PKG_VERSION__`, which is the same trick
 * demo/build.cjs has used for the demo bundle.
 *
 * The fallback covers any consumer that bundles core from source without the
 * define. Core's vitest run reads the same vite.config.ts, so tests here see
 * the real version; the version tests still assert a semver shape rather than
 * a literal, because a test that asserted a number would have to be edited on
 * every release, which is how the descriptors drifted in the first place.
 */
declare const __PKG_VERSION__: string;

/**
 * The package version this build was produced from, or '0.0.0-dev' when the
 * build-time define is absent.
 */
export const PKG_VERSION: string =
  typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : '0.0.0-dev';
