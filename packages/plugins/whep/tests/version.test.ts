/**
 * Version reporting for @scarlett-player/whep.
 *
 * The descriptor's `version` comes from src/version.ts, which the build fills
 * in from this package's own package.json (tsup.config.ts). The assertion is
 * a semver shape, never a literal, so no release has to edit it; vitest does
 * not apply the tsup define, so the value under test is the '0.0.0-dev'
 * fallback.
 */

import { describe, it, expect } from 'vitest';
import { createWHEPPlugin } from '../src/index';
import { PKG_VERSION } from '../src/version';

/** Semver core with an optional prerelease tag, which '0.0.0-dev' also matches. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

describe('@scarlett-player/whep version', () => {
  it('exposes a semver build constant', () => {
    expect(PKG_VERSION).toMatch(SEMVER);
  });

  it('reports the build constant on the descriptor, not a literal', () => {
    expect(createWHEPPlugin().version).toBe(PKG_VERSION);
    expect(createWHEPPlugin().version).toMatch(SEMVER);
  });
});
