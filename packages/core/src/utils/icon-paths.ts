/**
 * SVG path data shared by more than one UI package.
 *
 * Only the `d` attributes live here, not whole `<svg>` elements: `ui` renders
 * with `fill="currentColor"` and `audio-ui` inherits fill from its own
 * stylesheet, so the wrappers legitimately differ while the glyph must not.
 * An icon only one package draws stays in that package - this is a de-duplication
 * of the three glyphs that were byte-identical in both maps, not a shared icon set.
 */

/**
 * Path data for the glyphs `ui` and `audio-ui` both draw.
 *
 * @example
 * ```ts
 * const play = `<svg viewBox="0 0 24 24"><path d="${SHARED_ICON_PATHS.play}"/></svg>`;
 * ```
 */
export const SHARED_ICON_PATHS = {
  /** Solid right-pointing triangle. */
  play: 'M8 5v14l11-7z',

  /** Speaker with three arcs. */
  volumeHigh:
    'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',

  /** Speaker struck through. */
  volumeMuted:
    'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
} as const;
