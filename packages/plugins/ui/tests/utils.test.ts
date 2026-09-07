/**
 * Utility Function Tests
 *
 * The implementations moved to `@scarlett-player/core` and are covered in
 * `packages/core/tests/utils/format.test.ts`. What is left here is the public
 * surface of THIS package: `formatTime` and `formatLiveTime` are exported from
 * `@scarlett-player/ui`, and the move must not have broken that.
 */

import { describe, it, expect } from 'vitest';
import { formatTime, formatLiveTime } from '../src/utils';
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
