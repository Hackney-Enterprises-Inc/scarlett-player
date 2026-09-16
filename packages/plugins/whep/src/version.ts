/**
 * Build-time version of @scarlett-player/whep.
 *
 * The plugin descriptor's `version` comes from this package's own
 * package.json, injected by tsup as `__PKG_VERSION__` (see tsup.config.ts),
 * the same arrangement every other plugin uses since the descriptors drifted
 * from the published version (measured 2026-09-02).
 *
 * The fallback is for vitest, which does not run the tsup config and so never
 * defines the constant. It is a valid semver string on purpose, because the
 * version test asserts a semver shape rather than a literal.
 */
declare const __PKG_VERSION__: string;

/**
 * The package version this build was produced from, or '0.0.0-dev' when the
 * build-time define is absent (vitest, or any bundler that skips it).
 */
export const PKG_VERSION: string =
  typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : '0.0.0-dev';
