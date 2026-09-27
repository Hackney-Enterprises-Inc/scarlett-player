/**
 * Control-bar layout for embed players that turn on a plugin-registered
 * control.
 *
 * `registerControl` never places anything on its own: a registered control
 * appears only in players whose layout lists its id, and `uiPlugin`'s own
 * default layout has no `share`, `clip` or `chapters` slot. So the embed has
 * to hand the UI plugin a layout whenever one of those is on.
 */

/**
 * A copy of `DEFAULT_LAYOUT` in `@scarlett-player/ui`, which that package
 * does not export. Keep the two in step: a slot added there and missed here
 * would silently go missing from every embed that turns on sharing, chapters
 * or clips. An embed with none of them gets no layout from
 * {@link buildControlLayout} and so keeps the UI plugin's own default, which
 * cannot drift at all.
 */
const BASE_LAYOUT = [
  'play',
  'skip-backward',
  'skip-forward',
  'volume',
  'time',
  'live-indicator',
  'bandwidth-indicator',
  'spacer',
  'settings',
  'captions',
  'chromecast',
  'airplay',
  'pip',
  'fullscreen',
] as const;

/** Which plugin-registered controls the layout should carry. */
export interface ControlLayoutOptions {
  /** The share plugin's `share` control. */
  share?: boolean;
  /** The chapters addon's `chapters` control. */
  chapters?: boolean;
  /** The clips addon's `clip` control. */
  clip?: boolean;
}

/**
 * Build the video UI's control layout for the plugin-registered controls
 * that are on.
 *
 * The UI default with the extra ids inserted at the head of the right-hand
 * group, straight after `spacer`: `share`, then `clip`, then `chapters`, all
 * before the settings menu. `share` keeps the position the embed has always
 * given it, and `clip` / `chapters` follow the playground's order.
 *
 * @param options - Which of `share`, `chapters` and `clip` are on
 * @returns A fresh layout array, or `undefined` when none is on, so the
 * caller leaves `controls` unset and the UI plugin keeps its own default
 */
export function buildControlLayout(options: ControlLayoutOptions): string[] | undefined {
  const extra: string[] = [];
  if (options.share) extra.push('share');
  if (options.clip) extra.push('clip');
  if (options.chapters) extra.push('chapters');
  if (extra.length === 0) return undefined;

  const layout: string[] = [];
  for (const slot of BASE_LAYOUT) {
    layout.push(slot);
    if (slot === 'spacer') layout.push(...extra);
  }
  return layout;
}
