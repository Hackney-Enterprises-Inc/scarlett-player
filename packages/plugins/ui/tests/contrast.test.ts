/**
 * Contrast of the stylesheet's own colour defaults.
 *
 * The defaults are what almost every player renders with - a host has to opt
 * into theming - so they are the values worth holding to WCAG here. A host
 * that overrides `--sp-accent` or `--sp-accent-text` owns its own ratios, and
 * nothing in this file can check those.
 */

import { describe, it, expect } from 'vitest';
import { styles } from '../src/styles';

/** Surfaces the accent is read against, darkest first. */
const SURFACES = {
  /** The player itself, and the control bar's gradient at its darkest. */
  black: '#000000',
  /** `.sp-quality-menu` / `.sp-settings-panel`, composited over black. */
  menu: '#141414',
  /**
   * The same menus over a white video frame - their background is 95% opaque,
   * not opaque, so the picture behind lightens it. Text on the menus is
   * lighter than any of these surfaces, so this is the worst case of the
   * three; a colour that clears AA here clears it over any frame.
   */
  brightMenu: '#202020',
};

/** WCAG AA for text below 18pt. */
const AA_TEXT = 4.5;

/** Parse `#rgb` or `#rrggbb` into 0-255 channels. */
function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two opaque colours, per WCAG 2.1. */
function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));

  return (light + 0.05) / (dark + 0.05);
}

/**
 * Every `color:` declaration in the stylesheet that resolves to a hex default,
 * as [selector, hex] pairs. Rules whose colour is a keyword, a rgba() or
 * `currentColor` are left out: those are either transparent-on-unknown or
 * inherited, and neither can be measured from the sheet alone.
 */
function colourDefaults(): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  // Comments first: left in, each one is swept up as part of the selector of
  // the rule that follows it and a failure names the comment rather than the
  // rule.
  const sheet = styles.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const [, selector, body] of sheet.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const declaration = /(?:^|[\s;])color:\s*([^;]+);/.exec(body);
    if (!declaration) continue;

    // The last hex in the declaration is the innermost var() fallback, which
    // is what renders when the host sets no token at all.
    const hexes = declaration[1].match(/#[0-9a-fA-F]{3,8}\b/g);
    if (!hexes) continue;

    found.push([selector.trim().replace(/\s+/g, ' '), hexes[hexes.length - 1]]);
  }

  return found;
}

describe('stylesheet colour defaults', () => {
  it('finds the accent text rules', () => {
    // A guard on the parser rather than the styles: a regex that silently
    // matched nothing would make every assertion below vacuously true.
    const accentRules = colourDefaults().filter(([, hex]) => hex !== '#fff' && hex !== '#ffffff');

    expect(accentRules.length).toBeGreaterThanOrEqual(5);
  });

  it.each(Object.entries(SURFACES))('clears AA for text on %s', (_name, background) => {
    // The brand red (#e50914) is 4.38:1 on black and 3.84:1 on the menus,
    // which is why accent TEXT reads --sp-accent-text and its default is the
    // lighter tone. Fills, rings and outlines keep --sp-accent: they are
    // non-text, answer to 3:1, and are not measured here.
    const failures = colourDefaults()
      .map(([selector, hex]) => ({
        selector,
        hex,
        ratio: Number(contrast(hex, background).toFixed(2)),
      }))
      .filter(({ ratio }) => ratio < AA_TEXT);

    expect(failures).toEqual([]);
  });
});
