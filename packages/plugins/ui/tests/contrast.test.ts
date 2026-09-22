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

/**
 * The declarations of the rule written with exactly this selector.
 *
 * Deliberately not the sweep above: that one reads every rule and would
 * happily return `.sp-live__dot` for `.sp-live`, and it flattens the media
 * query the hover rule lives in.
 */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|[{};])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(styles);

  if (!match) throw new Error(`No rule for ${selector}`);

  return match[1];
}

/** The `background:` a rule declares, as written. */
function backgroundOf(selector: string): string {
  const declaration = /(?:^|[\s;])background:\s*([^;]+);/.exec(ruleBody(selector));

  if (!declaration) throw new Error(`No background on ${selector}`);

  return declaration[1].trim();
}

/** The innermost `color:` fallback of a rule - what renders unthemed. */
function colourOf(selector: string): string {
  const declaration = /(?:^|[\s;])color:\s*([^;]+);/.exec(ruleBody(selector));
  const hexes = declaration?.[1].match(/#[0-9a-fA-F]{3,8}\b/g);

  if (!hexes) throw new Error(`No hex colour on ${selector}`);

  return hexes[hexes.length - 1];
}

describe('the LIVE label', () => {
  /**
   * The only accent TEXT outside the menus: it sits on the control bar, whose
   * gradient bottoms out at rgba(0, 0, 0, 0.8) and so reaches about #333 over
   * a white frame - lighter than any surface `accentTextTone()` measures
   * against. The rule therefore carries its own opaque surface.
   */
  it.each(['.sp-live', '.sp-live:hover'])('is opaque and no lighter than the menus (%s)', (selector) => {
    const background = backgroundOf(selector);

    // A rgba() here would let the picture through and lighten it.
    expect(background).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(luminance(background)).toBeLessThanOrEqual(luminance(SURFACES.brightMenu));
  });

  it('clears AA for its own default accent', () => {
    // A host that themes the player owns its ratio, and accentTextTone() gives
    // it one measured against exactly this surface.
    expect(contrast(colourOf('.sp-live'), backgroundOf('.sp-live'))).toBeGreaterThanOrEqual(
      AA_TEXT
    );
  });
});

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
