/**
 * Timestamp grammar tests.
 *
 * The exact-time fields are the precision the handles cannot give on a long
 * source, so what the parser accepts and refuses is a product decision, not an
 * implementation detail. Strictness is the point: silently reinterpreting
 * `1:70` as 130 seconds would move an endpoint the viewer did not ask for.
 */

import { describe, it, expect } from 'vitest';
import { fractionDigits, formatLength, formatTimestamp, parseTimestamp } from '../src/time-format';

describe('parseTimestamp', () => {
  it('accepts plain seconds, with or without a fraction', () => {
    expect(parseTimestamp('0')).toBe(0);
    expect(parseTimestamp('93')).toBe(93);
    expect(parseTimestamp('93.5')).toBe(93.5);
    expect(parseTimestamp('.5')).toBe(0.5);
  });

  it('accepts mm:ss and hh:mm:ss, with optional fractions', () => {
    expect(parseTimestamp('1:33')).toBe(93);
    expect(parseTimestamp('01:33')).toBe(93);
    expect(parseTimestamp('1:33.5')).toBe(93.5);
    expect(parseTimestamp('0:01:33')).toBe(93);
    expect(parseTimestamp('2:00:00')).toBe(7200);
    expect(parseTimestamp('1:00:33.250')).toBe(3633.25);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseTimestamp('  1:33  ')).toBe(93);
  });

  it('refuses anything that is not a timestamp', () => {
    for (const bad of [
      '',
      '   ',
      'abc',
      '-4',
      '-1:00',
      '1:60', // sixty seconds is the next minute, not a time
      '99:99',
      'Infinity',
      'NaN',
      '1:2:3:4',
      '1:',
      ':30',
      '1,5',
      '1e3',
    ]) {
      expect(parseTimestamp(bad), bad).toBeNull();
    }
  });
});

describe('formatTimestamp', () => {
  it('uses the shortest clock form that stays exact', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(93)).toBe('1:33');
    expect(formatTimestamp(3693)).toBe('1:01:33');
    expect(formatTimestamp(7200)).toBe('2:00:00');
  });

  it('shows a fraction only when the step can produce one', () => {
    expect(formatTimestamp(93.5, 1)).toBe('1:34'); // rounded to the grid
    expect(formatTimestamp(93.5, 0.5)).toBe('1:33.5');
    expect(formatTimestamp(93.25, 0.25)).toBe('1:33.25');
    // A value that lands on a whole second keeps no trailing zeros.
    expect(formatTimestamp(93, 0.5)).toBe('1:33');
  });

  it('round-trips through the parser', () => {
    for (const [time, step] of [[93, 1], [3693, 1], [93.5, 0.5], [7200, 1]] as const) {
      expect(parseTimestamp(formatTimestamp(time, step))).toBe(time);
    }
  });

  it('is defensive about nonsense input', () => {
    expect(formatTimestamp(Number.NaN)).toBe('0:00');
    expect(formatTimestamp(-10)).toBe('0:00');
  });
});

describe('formatLength', () => {
  it('renders a whole-second length without decimals', () => {
    expect(formatLength(35, 1)).toBe('35');
    expect(formatLength(35.4, 1)).toBe('35');
  });

  it('keeps the precision a fractional step warrants', () => {
    expect(formatLength(35.5, 0.5)).toBe('35.5');
    expect(formatLength(35, 0.5)).toBe('35');
  });

  it('never renders a negative length', () => {
    expect(formatLength(-5, 1)).toBe('0');
  });
});

describe('fractionDigits', () => {
  it('reports zero for whole-second and invalid steps', () => {
    for (const step of [1, 2, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fractionDigits(step)).toBe(0);
    }
  });

  it('reports what a fractional step needs, capped at milliseconds', () => {
    expect(fractionDigits(0.5)).toBe(1);
    expect(fractionDigits(0.25)).toBe(2);
    expect(fractionDigits(0.001)).toBe(3);
    expect(fractionDigits(0.00001)).toBe(3);
  });
});
