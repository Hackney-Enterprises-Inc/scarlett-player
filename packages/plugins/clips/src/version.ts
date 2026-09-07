/**
 * Build-time version of @scarlett-player/clips.
 *
 * The plugin descriptor's `version` must never be a hand-written literal:
 * the older plugin descriptors drifted (every one still said '1.0.0' while the
 * packages published at 1.7.0, measured 2026-09-02). The value comes from this
 * package's own package.json, injected by tsup as `__PKG_VERSION__` (see
 * tsup.config.ts), the same pattern as the share package.
 *
 * The fallback is for vitest, which does not run the tsup config and so never
 * defines the constant. It is a valid semver string on purpose, because the
 * version tests assert a semver shape rather than a literal: a test that
 * asserted a number would have to be edited on every release.
 */
declare const __PKG_VERSION__: string;

/**
 * The package version this build was produced from, or '0.0.0-dev' when the
 * build-time define is absent (vitest, or any bundler that skips it).
 */
export const PKG_VERSION: string =
  typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : '0.0.0-dev';
