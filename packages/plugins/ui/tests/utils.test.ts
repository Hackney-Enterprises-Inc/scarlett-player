/**
 * Utility Function Tests
 *
 * The implementations moved to `@scarlett-player/core` and are covered in
 * `packages/core/tests/utils/format.test.ts`. What is left here is the public
 * surface of THIS package: `formatTime` and `formatLiveTime` are exported from
 * `@scarlett-player/ui`, and the move must not have broken that.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { clearChildren, formatTime, formatLiveTime } from '../src/utils';
import { formatTime as coreFormatTime } from '@scarlett-player/core';

describe('re-exported formatters', () => {
  it('still resolves through the ui package', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatLiveTime(65)).toBe('-1:05');
  });

  it('is the same function core exports, not a second copy', () => {
    expect(formatTime).toBe(coreFormatTime);
  });
});

describe('clearChildren', () => {
  it('removes every child node, text included', () => {
    const el = document.createElement('div');
    el.append(document.createElement('span'), 'text', document.createElement('b'));

    clearChildren(el);

    expect(el.childNodes).toHaveLength(0);
  });
});

/**
 * Every file under a directory, recursively.
 *
 * @param dir - Directory to walk
 * @returns Absolute file paths
 */
function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

// Fails today: Element.replaceChildren() is Chrome 86 / Safari 14, below the
// documented Chrome 80 floor, and LG NetCast TVs lack it (Sentry TSP-WEB-2JN).
// jsdom implements it, so no behavioural test can see a new call; this scan
// is what keeps one from coming back.
describe('engine floor', () => {
  it('ships no Element.replaceChildren() call', () => {
    const src = resolve(__dirname, '../src');
    const offenders = listFiles(src)
      .filter((file) => readFileSync(file, 'utf8').includes('.replaceChildren('))
      .map((file) => relative(src, file));

    expect(offenders).toEqual([]);
  });
});
