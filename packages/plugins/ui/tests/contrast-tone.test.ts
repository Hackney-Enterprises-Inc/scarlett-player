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

  it.each([
    ['navy', '#000080'],
    ['RED', '#ff0000'],
    [' DarkSlateGray ', '#2f4f4f'],
    ['rebeccapurple', '#663399'],
  ])('reads the named colour %j as its hex', (name, hex) => {
    expect(accentTextTone(name)).toBe(accentTextTone(hex));
    expect(contrast(accentTextTone(name), BRIGHT_MENU)).toBeGreaterThanOrEqual(4.5);
  });

  it('returns a passing named colour as its hex', () => {
    expect(accentTextTone('white')).toBe('#ffffff');
    expect(accentTextTone('Gold')).toBe('#ffd700');
  });

  it.each([
    ['comma syntax', 'rgb(229, 9, 20)'],
    ['space syntax', 'rgb(229 9 20)'],
    ['rgba() with an opaque alpha', 'rgba(229, 9, 20, 1)'],
    ['space syntax with an opaque alpha', 'rgb(229 9 20 / 100%)'],
    ['upper case and loose spacing', ' RGB( 229 , 9 , 20 ) '],
  ])('reads rgb() in %s', (_name, value) => {
    expect(accentTextTone(value)).toBe(accentTextTone('#e50914'));
  });

  it('reads rgb() channels given as percentages', () => {
    expect(accentTextTone('rgb(100% 0% 0%)')).toBe(accentTextTone('#ff0000'));
    expect(accentTextTone('rgb(0%, 0%, 54.5%)')).toBe(accentTextTone('#00008b'));
  });

  it('returns a passing rgb() accent as its hex', () => {
    expect(accentTextTone('rgb(31 158 139)')).toBe('#1f9e8b');
  });

  it('reads eight- and four-digit hex', () => {
    expect(accentTextTone('#00008bff')).toBe(accentTextTone('#00008b'));
    expect(accentTextTone('#f00f')).toBe(accentTextTone('#ff0000'));
  });

  it('composites a translucent accent over the menus before measuring', () => {
    // Half of #00008b over #202020 is #101056: what the viewer actually sees.
    const composited = accentTextTone('#101056');

    for (const value of ['rgb(0 0 139 / 50%)', 'rgba(0, 0, 139, 0.5)', '#00008b80']) {
      const tone = accentTextTone(value);
      expect(tone).toBe(composited);
      expect(tone).toMatch(/^#[0-9a-f]{6}$/);
      expect(tone).not.toBe(accentTextTone('#00008b'));
      expect(contrast(tone, BRIGHT_MENU)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('hands back anything it cannot parse', () => {
    // A var(), a gradient or an hsl() is the host's business: guessing at one
    // would be worse than leaving the token as given. A fully transparent
    // colour has no hue to lift.
    for (const value of [
      'var(--brand)',
      'linear-gradient(red, blue)',
      'hsl(0 100% 50%)',
      '',
      'transparent',
      'rgba(0, 0, 0, 0)',
      'currentColor',
      'rgb(1 2)',
      'rgb(1, 2, 3, 4, 5)',
      'notacolour',
    ]) {
      expect(accentTextTone(value)).toBe(value);
    }
  });

  it('gives white the last word when nothing else clears AA', () => {
    // Only reachable if the loop never finds a passing mix, which white does.
    expect(contrast(accentTextTone('#ffffff'), BRIGHT_MENU)).toBeGreaterThanOrEqual(4.5);
  });
});
