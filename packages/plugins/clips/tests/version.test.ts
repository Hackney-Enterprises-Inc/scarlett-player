/**
 * Version reporting for @scarlett-player/clips.
 *
 * The assertion is a semver shape, never a literal: a test that pinned the
 * number would have to be edited on every release, which is the habit that
 * let the plugin descriptors drift in the first place. vitest does not apply
 * the tsup define, so the value under test here is the '0.0.0-dev' fallback;
 * the shape is what both the test and the built bundle have to satisfy.
 */

import { describe, it, expect } from 'vitest';
import { createClipsPlugin } from '../src/index';
import { PKG_VERSION } from '../src/version';

/** Semver core with an optional prerelease tag, which '0.0.0-dev' also matches. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

describe('@scarlett-player/clips version', () => {
  it('exposes a semver build constant', () => {
    expect(PKG_VERSION).toMatch(SEMVER);
  });

  it('reports the build constant on the descriptor, not a literal', () => {
    expect(createClipsPlugin({ onCreate: () => undefined }).version).toBe(PKG_VERSION);
    expect(createClipsPlugin({ endpoint: { url: '/api/clips' } }).version).toMatch(SEMVER);
  });
});
