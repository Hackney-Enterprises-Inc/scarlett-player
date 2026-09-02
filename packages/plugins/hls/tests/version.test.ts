/**
 * Version reporting for @scarlett-player/hls.
 *
 * The descriptor's `version` was the hand-written literal '1.0.0' while the
 * package published at 1.7.0 (measured 2026-09-02), so nothing a consumer read
 * off the plugin matched a release. It comes from src/version.ts now, which the
 * build fills in from this package's own package.json (tsup.config.ts).
 *
 * Both entries are covered because both wrap the one factory in
 * create-hls-plugin.ts: if the light build ever stopped reporting the same
 * version as the full build, the two had been forked again, which is the exact
 * regression the shared factory exists to prevent.
 *
 * The assertion is a semver shape, never a literal: a test that pinned the
 * number would have to be edited on every release, which is the habit that let
 * the descriptor drift. vitest does not apply the tsup define, so the value
 * under test here is the '0.0.0-dev' fallback; the shape is what both the test
 * and the built bundle have to satisfy.
 */

import { describe, it, expect } from 'vitest';
import { createHLSPlugin } from '../src/index';
import { createHLSPlugin as createLightPlugin } from '../src/light';
import { PKG_VERSION } from '../src/version';

/** Semver core with an optional prerelease tag, which '0.0.0-dev' also matches. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

describe('@scarlett-player/hls version', () => {
  it('exposes a semver build constant', () => {
    expect(PKG_VERSION).toMatch(SEMVER);
  });

  it('reports the build constant on the full descriptor, not a literal', () => {
    expect(createHLSPlugin().version).toBe(PKG_VERSION);
    expect(createHLSPlugin().version).toMatch(SEMVER);
  });

  it('reports the same version on the light descriptor', () => {
    expect(createLightPlugin().version).toBe(createHLSPlugin().version);
  });
});
