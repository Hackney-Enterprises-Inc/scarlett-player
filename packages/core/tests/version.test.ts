/**
 * Version reporting for @scarlett-player/core.
 *
 * Core did not report a version at all before this: every consumer that wanted
 * one defined its own constant, and every one of those had drifted (plugin
 * descriptors '1.0.0', embed '0.5.3', packages 1.7.0; measured 2026-09-02).
 * `VERSION` is core's answer, filled in from package.json by the `define` in
 * vite.config.ts.
 *
 * vitest reads that same vite.config.ts, so the value under test here is the
 * real package version rather than the '0.0.0-dev' fallback. The equality
 * assertion reads package.json at run time on purpose: it can never go stale,
 * where a pinned literal would have to be edited on every release, which is the
 * habit that let the other version constants drift.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { VERSION } from '../src/index';

/** Semver core with an optional prerelease tag, which '0.0.0-dev' also matches. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf8')
) as { version: string };

describe('@scarlett-player/core VERSION', () => {
  it('is a semver string', () => {
    expect(VERSION).toMatch(SEMVER);
  });

  it('is the version the build-time define injected from package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });
});
