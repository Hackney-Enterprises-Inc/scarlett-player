/**
 * Range model tests - the acceptance list from
 * .docs/plans/scarlett-clips-plugin.md, "Tests > Range model".
 *
 * All arithmetic lives in src/range.ts and is unit-tested without DOM.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  bounds,
  resolveLimits,
  preroll,
  snap,
  moveStart,
  moveEnd,
  validate,
  validateTitle,
} from '../src/range';

const BOUNDS_600 = { min: 0, max: 600 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bounds', () => {
  it('is the whole media for VOD', () => {
    expect(bounds({ duration: 600 })).toEqual({ min: 0, max: 600 });
  });

  it('accepts the wider state shape without change (Phase 2 DVR hook)', () => {
    expect(
      bounds({ duration: 600, live: false, seekableRange: null })
    ).toEqual({ min: 0, max: 600 });
  });
});

describe('resolveLimits', () => {
  it('applies the documented fallback defaults (5 / 60 / 30 / 1)', () => {
    expect(resolveLimits({})).toEqual({
      minDuration: 5,
      maxDuration: 60,
      defaultDuration: 30,
      step: 1,
    });
  });

  it('passes through host values', () => {
    expect(
      resolveLimits({ minDuration: 2, maxDuration: 120, defaultDuration: 45, step: 0.5 })
    ).toEqual({ minDuration: 2, maxDuration: 120, defaultDuration: 45, step: 0.5 });
  });

  it('clamps defaultDuration below minDuration with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveLimits({ minDuration: 10, defaultDuration: 2 }).defaultDuration).toBe(10);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('defaultDuration');
  });

  it('clamps defaultDuration above maxDuration with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveLimits({ maxDuration: 60, defaultDuration: 120 }).defaultDuration).toBe(60);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn when defaultDuration is inside [min, max]', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveLimits({ minDuration: 5, maxDuration: 60, defaultDuration: 30 }).defaultDuration).toBe(30);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('preroll', () => {
  it('respects defaultDuration behind the current time', () => {
    expect(preroll(100, { defaultDuration: 30 }, BOUNDS_600)).toEqual({ start: 70, end: 100 });
  });

  it('uses the default 30s pre-roll when nothing is configured', () => {
    expect(preroll(100, {}, BOUNDS_600)).toEqual({ start: 70, end: 100 });
  });

  it('clamps at media start', () => {
    // start = 2 - 30 = -28 -> 0; length 2 >= min 5 is false, so end extends forward.
    expect(preroll(2, { defaultDuration: 30, minDuration: 5 }, BOUNDS_600)).toEqual({ start: 0, end: 5 });
  });

  it('keeps the pre-roll when clamping at start still leaves a valid range', () => {
    // start = 10 - 30 = -20 -> 0; length 10 >= min 5, no extension.
    expect(preroll(10, { defaultDuration: 30, minDuration: 5 }, BOUNDS_600)).toEqual({ start: 0, end: 10 });
  });

  it('extends end forward to reach minDuration after a start clamp', () => {
    const sel = preroll(1, { defaultDuration: 30, minDuration: 5 }, BOUNDS_600);
    expect(sel.start).toBe(0);
    expect(sel.end).toBe(5);
    expect(sel.end - sel.start).toBeGreaterThanOrEqual(5);
  });

  it('never extends end past the bounds when the media is shorter than minDuration', () => {
    expect(preroll(1, { defaultDuration: 30, minDuration: 5 }, { min: 0, max: 3 })).toEqual({
      start: 0,
      end: 3,
    });
  });

  it('clamps currentTime above the media end', () => {
    expect(preroll(610, { defaultDuration: 30 }, BOUNDS_600)).toEqual({ start: 570, end: 600 });
  });

  it('clamps defaultDuration to [min, max] with a warning before pre-rolling', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(preroll(200, { minDuration: 10, maxDuration: 60, defaultDuration: 120 }, BOUNDS_600)).toEqual({
      start: 140,
      end: 200,
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('snap', () => {
  it('rounds to the nearest whole step', () => {
    expect(snap(12.4, 1)).toBe(12);
    expect(snap(12.6, 1)).toBe(13);
    expect(snap(12.5, 1)).toBe(13);
    expect(snap(12, 1)).toBe(12);
  });

  it('rounds to fractional steps', () => {
    expect(snap(12.26, 0.5)).toBe(12.5);
    expect(snap(12.24, 0.5)).toBe(12);
    expect(snap(37.7, 0.1)).toBeCloseTo(37.7, 6);
  });

  it('falls back to 1 with a warning for step <= 0', () => {
    for (const bad of [0, -2]) {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(snap(12.6, bad)).toBe(13);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('step');
      warn.mockRestore();
    }
  });

  it('falls back to 1 with a warning for a non-finite step', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(snap(12.6, NaN)).toBe(13);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('moveStart (clamp, never push)', () => {
  const cfg = { minDuration: 5, maxDuration: 60 };

  it('cannot pass end - minDuration', () => {
    expect(moveStart({ start: 10, end: 30 }, 27, cfg, BOUNDS_600)).toEqual({ start: 25, end: 30 });
  });

  it('cannot go below the bounds minimum', () => {
    expect(moveStart({ start: 10, end: 30 }, -5, cfg, BOUNDS_600)).toEqual({ start: 0, end: 30 });
  });

  it('cannot make the range longer than maxDuration', () => {
    // end - maxDuration = 80 - 60 = 20 is the lower limit for start.
    expect(moveStart({ start: 40, end: 80 }, 5, cfg, BOUNDS_600)).toEqual({ start: 20, end: 80 });
  });

  it('leaves the other handle untouched', () => {
    const sel = moveStart({ start: 10, end: 30 }, 1000, cfg, BOUNDS_600);
    expect(sel.end).toBe(30);
    expect(sel.start).toBe(25);
  });

  it('accepts a move within the limits', () => {
    expect(moveStart({ start: 10, end: 30 }, 12, cfg, BOUNDS_600)).toEqual({ start: 12, end: 30 });
  });
});

describe('moveEnd (clamp, never push)', () => {
  const cfg = { minDuration: 5, maxDuration: 60 };

  it('cannot exceed start + maxDuration', () => {
    expect(moveEnd({ start: 10, end: 30 }, 100, cfg, BOUNDS_600)).toEqual({ start: 10, end: 70 });
  });

  it('cannot pass start + minDuration', () => {
    expect(moveEnd({ start: 10, end: 30 }, 12, cfg, BOUNDS_600)).toEqual({ start: 10, end: 15 });
  });

  it('cannot go above the bounds maximum', () => {
    // hi = min(bounds.max 600, start + maxDuration 650) = 600.
    expect(moveEnd({ start: 590, end: 598 }, 700, { minDuration: 5, maxDuration: 60 }, BOUNDS_600)).toEqual({
      start: 590,
      end: 600,
    });
  });

  it('leaves the other handle untouched', () => {
    const sel = moveEnd({ start: 10, end: 30 }, -100, cfg, BOUNDS_600);
    expect(sel.start).toBe(10);
    expect(sel.end).toBe(15);
  });

  it('accepts a move within the limits', () => {
    expect(moveEnd({ start: 10, end: 30 }, 45, cfg, BOUNDS_600)).toEqual({ start: 10, end: 45 });
  });
});

describe('validate', () => {
  const cfg = { minDuration: 5, maxDuration: 60 };

  it('returns null for a valid range', () => {
    expect(validate({ start: 10, end: 40 }, cfg, BOUNDS_600)).toBeNull();
  });

  it('accepts a range exactly at minDuration and maxDuration', () => {
    expect(validate({ start: 0, end: 5 }, cfg, BOUNDS_600)).toBeNull();
    expect(validate({ start: 0, end: 60 }, cfg, BOUNDS_600)).toBeNull();
  });

  it("returns 'too-short' below minDuration", () => {
    expect(validate({ start: 10, end: 12 }, cfg, BOUNDS_600)).toBe('too-short');
  });

  it("returns 'too-long' above maxDuration", () => {
    expect(validate({ start: 0, end: 100 }, cfg, BOUNDS_600)).toBe('too-long');
  });

  it("returns 'out-of-bounds' below the minimum", () => {
    expect(validate({ start: -1, end: 20 }, cfg, BOUNDS_600)).toBe('out-of-bounds');
  });

  it("returns 'out-of-bounds' above the maximum", () => {
    expect(validate({ start: 500, end: 601 }, cfg, BOUNDS_600)).toBe('out-of-bounds');
  });

  it("returns 'out-of-bounds' for non-finite handles", () => {
    expect(validate({ start: NaN, end: 20 }, cfg, BOUNDS_600)).toBe('out-of-bounds');
    expect(validate({ start: 0, end: Infinity }, cfg, BOUNDS_600)).toBe('out-of-bounds');
  });

  it("returns 'inverted' when end is before start", () => {
    expect(validate({ start: 30, end: 10 }, cfg, BOUNDS_600)).toBe('inverted');
  });

  it('checks bounds and order before duration', () => {
    // Out of bounds AND too short: out-of-bounds wins.
    expect(validate({ start: -50, end: -48 }, cfg, BOUNDS_600)).toBe('out-of-bounds');
    // Inverted AND too long by absolute size: inverted wins.
    expect(validate({ start: 100, end: 10 }, cfg, BOUNDS_600)).toBe('inverted');
  });

  it('applies host fallback defaults when nothing is configured', () => {
    expect(validate({ start: 0, end: 4 }, {}, BOUNDS_600)).toBe('too-short'); // default min 5
    expect(validate({ start: 0, end: 61 }, {}, BOUNDS_600)).toBe('too-long'); // default max 60
  });
});

describe('validateTitle', () => {
  it('returns null when the title field is disabled', () => {
    expect(validateTitle('', { title: false })).toBeNull();
    expect(validateTitle('anything', { title: false })).toBeNull();
  });

  it('treats an empty title as optional by default', () => {
    expect(validateTitle('', {})).toBeNull();
  });

  it("returns 'title-required' when required and empty", () => {
    expect(validateTitle('', { title: { required: true } })).toBe('title-required');
  });

  it('treats a whitespace-only title as empty', () => {
    expect(validateTitle('   \t\n ', { title: { required: true } })).toBe('title-required');
    expect(validateTitle('   ', { title: { required: false } })).toBeNull();
  });

  it("returns 'title-too-long' over maxLength", () => {
    expect(validateTitle('a'.repeat(6), { title: { maxLength: 5 } })).toBe('title-too-long');
    expect(validateTitle('a'.repeat(5), { title: { maxLength: 5 } })).toBeNull();
  });

  it('applies the 80-character default maxLength', () => {
    expect(validateTitle('a'.repeat(80), {})).toBeNull();
    expect(validateTitle('a'.repeat(81), {})).toBe('title-too-long');
  });

  it('measures the trimmed title, not the raw input', () => {
    expect(validateTitle('  hello  ', { title: { maxLength: 5 } })).toBeNull();
  });
});
