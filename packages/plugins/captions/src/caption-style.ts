/**
 * Caption text styling.
 *
 * The browser draws the cues, so the only styling hook is the `::cue`
 * pseudo-element. This module turns a small, closed set of options into one
 * scoped `video::cue` rule, validates anything that claims to be a style
 * (integrator config and `localStorage` are both untrusted), and wraps the
 * storage calls so a blocked `localStorage` never throws into the player.
 *
 * No free-form CSS is ever written: every emitted value is either a constant
 * from this file or a number / hex colour that passed {@link sanitizeCaptionStyle}.
 */

/** The named colours the viewer menu offers. */
export type CaptionPaletteColor =
  | 'white'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'magenta'
  | 'red'
  | 'black';

/**
 * A caption colour: a palette key, or a `#rgb` / `#rrggbb` hex string.
 *
 * Hex is for integrator defaults (a brand colour). Other CSS colour syntax
 * (`rgb()`, named colours outside the palette, 8-digit hex) is rejected.
 */
export type CaptionColor = CaptionPaletteColor | `#${string}`;

/** Text edge treatment, drawn with `text-shadow`. */
export type CaptionEdgeStyle = 'none' | 'drop-shadow' | 'raised' | 'depressed' | 'outline';

/** Text size as a percentage of the browser's own cue size. */
export type CaptionFontSize = 50 | 75 | 100 | 150 | 200;

/** Background opacity, 0 (transparent) to 1 (solid). */
export type CaptionBackgroundOpacity = 0 | 0.25 | 0.5 | 0.75 | 1;

/** Generic font family for cue text. */
export type CaptionFontFamily = 'sans-serif' | 'serif' | 'monospace';

/**
 * Caption text style. Every field is optional, and an absent field means
 * "leave the browser default alone".
 */
export interface CaptionStyle {
  /** Text size as a percentage of the browser's cue size. */
  fontSize?: CaptionFontSize;
  /** Text colour. */
  color?: CaptionColor;
  /**
   * Background colour behind each cue line. Without `backgroundOpacity` it is
   * drawn at 0.8, the browser default.
   */
  backgroundColor?: CaptionColor;
  /** Background opacity. Without `backgroundColor` the background is black. */
  backgroundOpacity?: CaptionBackgroundOpacity;
  /** Text edge treatment. `'none'` removes an edge set by a lower layer. */
  edgeStyle?: CaptionEdgeStyle;
  /** Generic font family. */
  fontFamily?: CaptionFontFamily;
}

/**
 * A change to the viewer's caption style. A value sets the field, and `null`
 * clears the viewer's choice for it so the integrator or browser default shows
 * again. Fields left out are untouched.
 */
export type CaptionStylePatch = {
  [K in keyof CaptionStyle]?: CaptionStyle[K] | null;
};

/**
 * The caption style methods of the captions plugin, for hosts that reach it
 * with `player.getPlugin<CaptionsStyleApi>('captions')`.
 *
 * Style has three layers per field: the viewer's override (saved in
 * `localStorage` unless `persistStyle` is false), then the integrator's
 * `style` config, then the browser default.
 */
export interface CaptionsStyleApi {
  /**
   * The style in effect: the integrator `style` config with the viewer's
   * overrides on top.
   *
   * @returns A copy of the effective style; absent fields use the browser default
   */
  getCaptionStyle(): CaptionStyle;

  /**
   * The viewer's own choices only, without the integrator defaults under them.
   *
   * @returns A copy of the viewer layer; empty when the viewer changed nothing
   */
  getCaptionStyleOverrides(): CaptionStyle;

  /**
   * Change the viewer's caption style. Invalid values are ignored with a
   * warning. The result is saved (unless `persistStyle` is false), applied to
   * the cues at once, and written to the `captionStyle` state key.
   *
   * @param patch - Fields to set, or `null` to clear a field back to the default
   */
  setCaptionStyle(patch: CaptionStylePatch): void;

  /**
   * Drop every viewer override, delete the saved style and go back to the
   * integrator defaults.
   */
  resetCaptionStyle(): void;
}

/** Default `localStorage` key for the viewer's caption style. */
export const DEFAULT_STYLE_STORAGE_KEY = 'scarlett-caption-style';

/** Version of the stored shape `{ v, style }`. Any other `v` is ignored. */
const STORAGE_VERSION = 1;

/** Alpha used for a background colour with no opacity: the browser default. */
const DEFAULT_BACKGROUND_ALPHA = 0.8;

/** Palette colours as `#rrggbb`. */
const PALETTE: Record<CaptionPaletteColor, string> = {
  white: '#ffffff',
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  blue: '#0000ff',
  magenta: '#ff00ff',
  red: '#ff0000',
  black: '#000000',
};

/** `text-shadow` value per edge style. */
const EDGE_SHADOWS: Record<CaptionEdgeStyle, string> = {
  none: 'none',
  'drop-shadow': '0.06em 0.06em 0.12em rgba(0, 0, 0, 0.9)',
  raised: '-0.04em -0.04em 0 #fff, 0.04em 0.04em 0 #000',
  depressed: '0.04em 0.04em 0 #fff, -0.04em -0.04em 0 #000',
  outline: '-0.05em -0.05em 0 #000, 0.05em -0.05em 0 #000, -0.05em 0.05em 0 #000, 0.05em 0.05em 0 #000',
};

const FONT_SIZES: readonly number[] = [50, 75, 100, 150, 200];
const BACKGROUND_OPACITIES: readonly number[] = [0, 0.25, 0.5, 0.75, 1];
const FONT_FAMILIES: readonly string[] = ['sans-serif', 'serif', 'monospace'];
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Whether a value is an allowed caption colour.
 *
 * @param value - Candidate value
 * @returns True for a palette key or a `#rgb` / `#rrggbb` hex string
 */
function isColor(value: unknown): value is CaptionColor {
  return typeof value === 'string' && (Object.prototype.hasOwnProperty.call(PALETTE, value) || HEX_COLOR.test(value));
}

/** One validator per style field. A field with no validator is unknown. */
const VALIDATORS: { [K in keyof Required<CaptionStyle>]: (value: unknown) => boolean } = {
  fontSize: (value) => typeof value === 'number' && FONT_SIZES.includes(value),
  color: isColor,
  backgroundColor: isColor,
  backgroundOpacity: (value) => typeof value === 'number' && BACKGROUND_OPACITIES.includes(value),
  edgeStyle: (value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(EDGE_SHADOWS, value),
  fontFamily: (value) => typeof value === 'string' && FONT_FAMILIES.includes(value),
};

/**
 * Whether a key names a caption style field.
 *
 * @param key - Candidate key
 * @returns True when the key is a field of {@link CaptionStyle}
 */
export function isCaptionStyleKey(key: string): key is keyof CaptionStyle {
  return Object.prototype.hasOwnProperty.call(VALIDATORS, key);
}

/**
 * Reduce an untrusted value to a valid {@link CaptionStyle}.
 *
 * Used for integrator config, embed attributes and stored viewer styles alike.
 * Unknown keys and values outside the allowed sets are dropped and reported, so
 * nothing that reaches the stylesheet is free-form text. A field whose value is
 * `undefined` is treated as absent, not as rejected.
 *
 * @param input - Anything: a config object, parsed JSON, or garbage
 * @returns The valid fields, and the keys that were dropped
 */
export function sanitizeCaptionStyle(input: unknown): { style: CaptionStyle; rejected: string[] } {
  const style: Record<string, unknown> = {};
  const rejected: string[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { style: {}, rejected };
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    if (isCaptionStyleKey(key) && VALIDATORS[key](value)) {
      style[key] = value;
    } else {
      rejected.push(key);
    }
  }

  return { style: style as CaptionStyle, rejected };
}

/**
 * Convert a validated caption colour to its red, green and blue channels.
 *
 * @param color - Palette key or hex string that passed validation
 * @returns Channels as `[r, g, b]`, each 0-255
 */
function toRgb(color: CaptionColor): [number, number, number] {
  let hex = (PALETTE[color as CaptionPaletteColor] ?? color).slice(1);
  if (hex.length === 3) {
    hex = hex.replace(/./g, '$&$&');
  }

  const value = parseInt(hex, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Build the `video::cue` rule for a style.
 *
 * Only properties `::cue` accepts are used: `font-size`, `color`,
 * `background-color`, `text-shadow` and `font-family`. A background colour with
 * no opacity is drawn at 0.8 (the browser default), and an opacity with no
 * colour is drawn on black.
 *
 * @param scopeSelector - Selector for the player container, placed before `video::cue`
 * @param style - A style that already passed {@link sanitizeCaptionStyle}
 * @returns The CSS rule, or an empty string when no field is set
 */
export function buildCueCss(scopeSelector: string, style: CaptionStyle): string {
  const declarations: string[] = [];

  if (style.fontSize !== undefined) {
    declarations.push(`font-size: ${style.fontSize}%`);
  }

  if (style.color !== undefined) {
    declarations.push(`color: ${PALETTE[style.color as CaptionPaletteColor] ?? style.color}`);
  }

  if (style.backgroundColor !== undefined || style.backgroundOpacity !== undefined) {
    const [r, g, b] = toRgb(style.backgroundColor ?? 'black');
    const alpha = style.backgroundOpacity ?? DEFAULT_BACKGROUND_ALPHA;
    declarations.push(`background-color: rgba(${r}, ${g}, ${b}, ${alpha})`);
  }

  if (style.edgeStyle !== undefined) {
    declarations.push(`text-shadow: ${EDGE_SHADOWS[style.edgeStyle]}`);
  }

  if (style.fontFamily !== undefined) {
    declarations.push(`font-family: ${style.fontFamily}`);
  }

  if (declarations.length === 0) return '';

  return `${scopeSelector} video::cue { ${declarations.join('; ')}; }`;
}

/**
 * Styles held in memory for keys `localStorage` refused, so a choice still
 * reaches players created later on the same page.
 *
 * A `null` entry means the key was deliberately cleared and storage never
 * heard about it, so a read must not fall back to the value still sitting in
 * storage. An entry outranks storage only while storage is unreadable, or
 * still holds the raw value recorded in {@link knownRaw} - or holds nothing
 * recorded at all, because the last observation was lost: once storage answers
 * with something other than that, it is a newer change and the entry is
 * dropped.
 */
const memoryStyles = new Map<string, CaptionStyle | null>();

/**
 * The raw string `localStorage` last held for each key, as far as this module
 * saw it: recorded on every successful read and write. `null` means the key
 * was absent. A key with no entry has never been read successfully, or the
 * last observation was lost - see {@link writeStoredStyle} - so nothing is
 * known to compare against.
 *
 * It is the baseline a held value in {@link memoryStyles} is judged against.
 */
const knownRaw = new Map<string, string | null>();

/**
 * Read the viewer's saved caption style.
 *
 * The viewer's most recent action on this key wins unless a storage change
 * observed after it differs from what was last observed.
 *
 * Never throws. A value held in memory because `localStorage` refused a write
 * or a removal wins while storage is unreadable, or still holds what it held
 * when the write failed, so a stale value - or a reset preference - cannot
 * come back for the next player. It does not mask storage for good: when a
 * read finds storage holding something else (another tab saved, or storage
 * came back changed), storage wins and the held value is dropped. When the
 * failed write or removal came while storage could not be read either, no
 * baseline is knowable, so the first readable answer becomes the baseline and
 * the held value stays until storage changes after that. A blocked
 * `localStorage` (sandboxed iframe, Safari private mode) therefore falls back
 * to the in-memory copy from {@link writeStoredStyle}. Stored data is
 * untrusted: malformed JSON, an unknown version and invalid fields are all
 * dropped.
 *
 * @param key - Storage key
 * @returns The saved style, or an empty object when there is none
 */
export function readStoredStyle(key: string): CaptionStyle {
  const held = memoryStyles.get(key);
  let raw: string | null;

  try {
    raw = localStorage.getItem(key);
  } catch {
    if (held === undefined || held === null) return {};
    return { ...held };
  }

  if (held !== undefined) {
    const unchanged = !knownRaw.has(key) || knownRaw.get(key) === raw;
    knownRaw.set(key, raw);

    if (unchanged) return held === null ? {} : { ...held };

    memoryStyles.delete(key);
  } else {
    knownRaw.set(key, raw);
  }

  if (raw === null) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || (parsed as { v?: unknown }).v !== STORAGE_VERSION) {
      return {};
    }

    return sanitizeCaptionStyle((parsed as { style?: unknown }).style).style;
  } catch {
    return {};
  }
}

/**
 * Save the viewer's caption style as `{ v: 1, style }`, or delete it.
 *
 * Never throws. When `localStorage` refuses the write, the value is held in
 * memory instead, and {@link readStoredStyle} prefers it over the value
 * storage held at that moment - including a deliberate clear, which must not
 * let the removed value reappear. The held value gives way as soon as storage
 * is seen to hold something different, or a later write succeeds.
 *
 * A refusal while storage can still be read records what storage holds right
 * then, so a later read can tell a genuine change from the stale value this
 * write failed to replace. A refusal while storage cannot be read leaves
 * nothing knowable to compare against: the baseline is dropped, and the next
 * readable read establishes it while the held value stands. Keeping the last
 * value seen instead would let an older stored preference undo the viewer's
 * latest choice the moment storage answers again unchanged.
 *
 * @param key - Storage key
 * @param style - Style to save, or `null` to delete the saved style
 */
export function writeStoredStyle(key: string, style: CaptionStyle | null): void {
  try {
    if (style === null) {
      localStorage.removeItem(key);
      knownRaw.set(key, null);
    } else {
      const raw = JSON.stringify({ v: STORAGE_VERSION, style });
      localStorage.setItem(key, raw);
      knownRaw.set(key, raw);
    }
    memoryStyles.delete(key);
  } catch {
    memoryStyles.set(key, style === null ? null : { ...style });

    // Note what storage holds right now, so a later read can tell a genuine
    // change from the stale value this write failed to replace. Storage that
    // cannot be read either leaves the baseline unknowable, so it is dropped
    // rather than left at a value this failure may already have outdated.
    try {
      knownRaw.set(key, localStorage.getItem(key));
    } catch {
      knownRaw.delete(key);
    }
  }
}
