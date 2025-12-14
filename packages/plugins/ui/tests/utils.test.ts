/**
 * Utility Function Tests
 */

import { describe, it, expect } from 'vitest';
import { formatTime, formatLiveTime } from '../src/utils';

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
});
