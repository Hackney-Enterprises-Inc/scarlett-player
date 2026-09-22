/**
 * accentTextTone() - the readable-accent derivation hosts and the embed use.
 *
 * The ratios asserted here are measured the same way contrast.test.ts measures
 * the stylesheet's own defaults, against the same surfaces.
 */

import { describe, it, expect } from 'vitest';
import { accentTextTone } from '../src/contrast';

/** Relative luminance of `#rrggbb`, per WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const srgb = parseInt(hex.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two opaque colours, per WCAG 2.1. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];

  return (light + 0.05) / (dark + 0.05);
}

/** The menus over a white frame: their 95% opacity makes this the worst case. */
const BRIGHT_MENU = '#202020';

describe('accentTextTone', () => {
  it.each([
    ['the Scarlett red', '#e50914'],
    ['a dark brand blue', '#00008b'],
    ['near-black', '#111111'],
    ['saturated violet', '#6633cc'],
  ])('lifts %s to AA on the menus', (_name, accent) => {
    expect(contrast(accent, BRIGHT_MENU)).toBeLessThan(4.5);
    expect(contrast(accentTextTone(accent), BRIGHT_MENU)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves a colour that already passes alone', () => {
    // The playground's teal preset. Rewriting a passing accent would change a
    // host's brand for no reason.
    expect(accentTextTone('#1f9e8b')).toBe('#1f9e8b');
  });

  it('keeps the hue rather than washing out to white', () => {
    const tone = accentTextTone('#e50914');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(tone.slice(i, i + 2), 16));

    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    expect(tone).not.toBe('#ffffff');
  });

  it('expands three-digit hex', () => {
    expect(accentTextTone('#f00')).toBe(accentTextTone('#ff0000'));
  });

  it('hands back anything it cannot parse', () => {
    // A named colour, a gradient or a var() is the host's business: guessing
    // at one would be worse than leaving the token as given.
    for (const value of ['red', 'var(--brand)', 'linear-gradient(red, blue)', '']) {
      expect(accentTextTone(value)).toBe(value);
    }
  });

  it('gives white the last word when nothing else clears AA', () => {
    // Only reachable if the loop never finds a passing mix, which white does.
    expect(contrast(accentTextTone('#ffffff'), BRIGHT_MENU)).toBeGreaterThanOrEqual(4.5);
  });
});
