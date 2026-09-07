/**
 * Shared clock tests.
 *
 * These cases moved here with the implementation: `ui` and `audio-ui` both
 * render times and had independent copies, so the coverage belongs with the
 * one implementation both now use.
 */

import { describe, it, expect } from 'vitest';
import { formatTime, formatLiveTime } from '../../src/utils/format';

describe('formatTime', () => {
  it('should format seconds as mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(125)).toBe('2:05');
  });

  it('should format hours as h:mm:ss', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3665)).toBe('1:01:05');
    expect(formatTime(7325)).toBe('2:02:05');
  });

  it('should handle negative times', () => {
    expect(formatTime(-65)).toBe('-1:05');
    expect(formatTime(-3665)).toBe('-1:01:05');
  });

  it('should handle NaN and Infinity', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-Infinity)).toBe('0:00');
  });
});

describe('formatLiveTime', () => {
  it('should return LIVE when at edge', () => {
    expect(formatLiveTime(0)).toBe('LIVE');
    expect(formatLiveTime(-1)).toBe('LIVE');
  });

  it('should return negative time when behind', () => {
    expect(formatLiveTime(5)).toBe('-0:05');
    expect(formatLiveTime(65)).toBe('-1:05');
    expect(formatLiveTime(3665)).toBe('-1:01:05');
  });

  it('should return LIVE for a non-finite distance', () => {
    // formatTime maps NaN and Infinity to '0:00', so falling through rendered
    // '-0:00' - a precise-looking offset built from an unknown seekable end.
    expect(formatLiveTime(NaN)).toBe('LIVE');
    expect(formatLiveTime(Infinity)).toBe('LIVE');
    expect(formatLiveTime(-Infinity)).toBe('LIVE');
  });

  it('should still render a finite sub-second distance', () => {
    expect(formatLiveTime(0.4)).toBe('-0:00');
  });
});
