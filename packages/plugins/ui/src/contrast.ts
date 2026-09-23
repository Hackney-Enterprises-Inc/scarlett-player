/**
 * Readable accent tones.
 *
 * The stylesheet splits the accent in two: `--sp-accent` colours fills, rings
 * and the big play button (non-text, 3:1), while `--sp-accent-text` colours
 * the LIVE label and the active rows in the settings and quality menus (text,
 * 4.5:1). `--sp-accent-text` falls back to `--sp-accent`, so a host that
 * themes the player gets its own accent on those labels - readable or not.
 *
 * This is how a host, the embed or a demo page derives the readable tone of an
 * accent without shipping the WCAG maths itself. Nothing here runs unless
 * someone asks: the stylesheet's own default already clears AA.
 *
 * It reads the colour forms a host is likely to pass as a brand accent - hex,
 * `rgb()`/`rgba()` and the CSS named colours - with no colour library behind
 * it. Anything else (`hsl()`, `var()`, a gradient, `currentColor`) is handed
 * back as given.
 */

/** 0-255 sRGB channels. */
type Rgb = [number, number, number];

/**
 * The lightest the menus get: their own rgba(20, 20, 20, 0.95) composited over
 * a white video frame. Over black - the usual case - the same surface is
 * #141414, and accent text is lighter than both, so contrast is at its worst
 * against this one. A tone that clears AA here clears it over any frame.
 */
const MENU_BACKGROUND: Rgb = [0x20, 0x20, 0x20];

/** WCAG AA for text below 18pt. */
const AA_TEXT = 4.5;

/**
 * The CSS Color Level 4 named colours, as `name:rrggbb`. `transparent` is left
 * out on purpose: it has no hue to lift, so it parses as nothing.
 */
const NAMED_COLORS = `
  aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff
  beige:f5f5dc bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff
  blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0
  chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed
  cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b
  darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9
  darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00
  darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f
  darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f
  darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff
  dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222
  floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc
  ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000
  greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c
  indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5
  lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080
  lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90
  lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa
  lightskyblue:87cefa lightslategray:778899 lightslategrey:778899
  lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32
  linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa
  mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371
  mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc
  mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1
  moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000
  olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6
  palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093
  papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd
  powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f
  royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460
  seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb
  slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f
  steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347
  turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5
  yellow:ffff00 yellowgreen:9acd32`;

let namedColors: Map<string, string> | undefined;

/** Look up a CSS named colour's `rrggbb` digits, building the table on first use. */
function named(name: string): string | undefined {
  namedColors ??= new Map(
    NAMED_COLORS.trim()
      .split(/\s+/)
      .map((entry) => entry.split(':') as [string, string])
  );
  return namedColors.get(name);
}

/** A CSS `<number>` or `<percentage>`, as the rgb() functions take them. */
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/;

/** Read one number-or-percentage, scaling a percentage against `scale`. */
function component(token: string, scale: number): number | null {
  if (!NUMBER.test(token)) return null;
  const value = token.endsWith('%') ? (parseFloat(token) / 100) * scale : parseFloat(token);
  return Math.min(scale, Math.max(0, value));
}

/**
 * Parse `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` into 0-255 channels and a
 * 0-1 alpha.
 */
function parseHex(value: string): [Rgb, number] | null {
  const digits = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value)?.[1];
  if (!digits) return null;

  const full =
    digits.length <= 4
      ? digits
          .split('')
          .map((c) => c + c)
          .join('')
      : digits;

  const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;

  return [
    [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ],
    alpha,
  ];
}

/**
 * Parse `rgb()` or `rgba()` - comma or space syntax, channels as numbers or
 * percentages, optional alpha as a number or percentage - into 0-255 channels
 * and a 0-1 alpha.
 */
function parseRgb(value: string): [Rgb, number] | null {
  const body = /^rgba?\(([^()]*)\)$/.exec(value)?.[1]?.trim();
  if (!body) return null;

  let parts: string[];
  let alphaToken: string | undefined;

  if (body.includes(',')) {
    parts = body.split(',').map((part) => part.trim());
    if (parts.length === 4) alphaToken = parts.pop();
  } else {
    const [rgb = '', alpha, ...rest] = body.split('/').map((part) => part.trim());
    if (rest.length || alpha === '') return null;
    parts = rgb.split(/\s+/);
    alphaToken = alpha;
  }

  if (parts.length !== 3) return null;

  const rgb = parts.map((part) => component(part, 255));
  const alpha = alphaToken === undefined ? 1 : component(alphaToken, 1);
  if (rgb.some((channel) => channel === null) || alpha === null) return null;

  return [rgb.map((channel) => Math.round(channel as number)) as Rgb, alpha];
}

/**
 * Parse a CSS colour into opaque 0-255 channels as the viewer sees it on the
 * menus: hex, rgb()/rgba() or a named colour, trimmed and case-folded. A
 * translucent colour is composited over `background`; a fully transparent one,
 * like anything else, gives null.
 */
function channels(color: string, background: Rgb): Rgb | null {
  const value = color.trim().toLowerCase();
  const namedHex = named(value);
  const parsed = namedHex ? parseHex(namedHex) : (parseHex(value) ?? parseRgb(value));
  if (!parsed) return null;

  const [rgb, alpha] = parsed;
  if (alpha <= 0) return null;
  if (alpha >= 1) return rgb;

  return rgb.map((channel, i) =>
    Math.round(channel * alpha + (background[i] as number) * (1 - alpha))
  ) as Rgb;
}

/** Relative luminance of 0-255 channels, per WCAG 2.1. */
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  }) as Rgb;

  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** Contrast ratio between two opaque colours, per WCAG 2.1. */
function contrast(a: Rgb, b: Rgb): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));

  return (light + 0.05) / (dark + 0.05);
}

/** Mix `color` toward white by `amount` (0-1). */
function lighten(color: Rgb, amount: number): Rgb {
  return color.map((channel) => Math.round(channel + (255 - channel) * amount)) as Rgb;
}

/** Format 0-255 channels as `#rrggbb`. */
function hex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The nearest readable tone of an accent for text on the player's menus.
 *
 * Returns the colour itself, as `#rrggbb`, when it already clears 4.5:1
 * there (so `#1f9e8b` stays `#1f9e8b` and `white` comes back as `#ffffff`);
 * otherwise mixes it toward white in 4% steps and returns the first tone that
 * does. The hue is kept, so a themed player still reads as its own colour -
 * the Scarlett red (4.38:1 on black, 3.84:1 on the menus) comes back as a
 * lighter red. A translucent accent is composited over the menus first, since
 * that is the colour the viewer sees; the result is always opaque.
 *
 * @param color - Accent as hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`),
 *                `rgb()`/`rgba()` (comma or space syntax, numbers or
 *                percentages, optional alpha) or a CSS named colour; leading
 *                and trailing space and letter case are ignored
 * @returns A `#rrggbb` tone clearing AA on the menus, or the input unchanged
 *          when it cannot be parsed (`transparent` or any fully transparent
 *          colour, `hsl()`, a gradient, a `var()`, an empty string)
 *
 * @example
 * ```ts
 * uiPlugin({ theme: { accentColor: brand, accentTextColor: accentTextTone(brand) } });
 * ```
 */
export function accentTextTone(color: string): string {
  const parsed = channels(color, MENU_BACKGROUND);
  if (!parsed) return color;

  if (contrast(parsed, MENU_BACKGROUND) >= AA_TEXT) return hex(parsed);

  for (let amount = 0.04; amount <= 1; amount += 0.04) {
    const candidate = lighten(parsed, amount);
    if (contrast(candidate, MENU_BACKGROUND) >= AA_TEXT) return hex(candidate);
  }

  return '#ffffff';
}
