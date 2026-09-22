/**
 * Accent tone helper for the demo pages.
 *
 * The UI plugin splits its accent in two: `--sp-accent` colours fills, rings
 * and the big play button (non-text, 3:1), while `--sp-accent-text` colours
 * the LIVE label and the active rows in the settings and quality menus (text,
 * 4.5:1). `--sp-accent-text` falls back to `--sp-accent`, so a page that
 * themes the player - as both demo pages do, and as the playground's accent
 * picker does on every input event - has to supply the readable tone itself or
 * it gets the dark accent back on 11-13px labels.
 */

/**
 * The lightest the menus get: their own rgba(20, 20, 20, 0.95) composited over
 * a white video frame. Over black - the usual case - the same surface is
 * #141414, and accent text is lighter than both, so contrast is at its worst
 * against this one. A tone that clears AA here clears it over any frame.
 */
const MENU_BACKGROUND = '#202020';

/** WCAG AA for text below 18pt. */
const AA_TEXT = 4.5;

/** Parse `#rgb` or `#rrggbb` into 0-255 channels; anything else gives null. */
function channels(hex: string): [number, number, number] | null {
  const value = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  const digits = value?.[1];
  if (!digits) return null;

  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((c) => c + c)
          .join('')
      : digits;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Relative luminance of 0-255 channels, per WCAG 2.1. */
function luminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  }) as [number, number, number];

  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** Contrast ratio between two opaque colours, per WCAG 2.1. */
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));

  return (light + 0.05) / (dark + 0.05);
}

/** Mix `color` toward white by `amount` (0-1). */
function lighten(color: [number, number, number], amount: number): [number, number, number] {
  return color.map((channel) => Math.round(channel + (255 - channel) * amount)) as [
    number,
    number,
    number,
  ];
}

/** Format 0-255 channels as `#rrggbb`. */
function hex(color: [number, number, number]): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The nearest readable tone of an accent for text on the player's menus.
 *
 * Returns the colour unchanged when it already clears 4.5:1 there; otherwise
 * mixes it toward white in 4% steps and returns the first tone that does. The
 * hue is kept, so a themed player still reads as its own colour - the Scarlett
 * red (4.38:1 on black, 3.84:1 on the menus) comes back as a lighter red.
 *
 * @param color - Accent as `#rgb` or `#rrggbb`
 * @returns A `#rrggbb` tone clearing AA on the menus, or the input unchanged
 *          when it cannot be parsed (a named colour, a gradient, a var())
 */
export function accentTextTone(color: string): string {
  const parsed = channels(color);
  const background = channels(MENU_BACKGROUND);
  if (!parsed || !background) return color;

  if (contrast(parsed, background) >= AA_TEXT) return hex(parsed);

  for (let amount = 0.04; amount <= 1; amount += 0.04) {
    const candidate = lighten(parsed, amount);
    if (contrast(candidate, background) >= AA_TEXT) return hex(candidate);
  }

  return '#ffffff';
}
