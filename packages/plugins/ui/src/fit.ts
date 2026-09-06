/**
 * Control bar fit planning.
 *
 * The control bar is a single non-wrapping flex row of fixed-width items
 * inside a host element that clips (`overflow: hidden` on the demo's `#player`
 * and on tsp-web's wrapper). Below roughly 543px of player width the default
 * layout renders past the clipping edge, and on a 390px phone with tsp-web's
 * 17-slot layout the entire right-hand group (settings, captions, cast, PiP,
 * fullscreen) is off canvas: captions and playback speed are not broken, they
 * are unreachable.
 *
 * This module owns the arithmetic that decides what stays. It is deliberately
 * pure and DOM free: jsdom has no layout engine, so a fit strategy expressed in
 * CSS (container queries, width tiers) cannot be unit tested, and a width tier
 * cannot guarantee a fit anyway because the time readout is 87px or ~130px
 * depending on the duration, every control hides itself on state, and hosts add
 * their own registered controls. The caller measures and applies; everything
 * here is inputs to outputs.
 *
 * @packageDocumentation
 */

/**
 * How eagerly a control leaves the bar.
 *
 * Lower numbers leave first. `'never'` pins a control in the bar at every
 * width, which is what keeps play, settings and fullscreen reachable below the
 * point where the bar stops fitting at all.
 */
export type FitRank = number | 'never';

/**
 * Where a control goes when it is pushed out of the bar.
 *
 * `'overflow'` moves the element into the tray, where it is still one tap
 * away. `'hide'` takes it off screen entirely, and is only right for items
 * that convey status rather than offering an action.
 */
export type FitExit = 'overflow' | 'hide';

/**
 * A slot's placement rule: how eagerly it leaves, and where it goes.
 */
export interface FitRule {
  /** Lower leaves first; `'never'` pins the control in the bar. */
  rank: FitRank;
  /** Tray or off screen. */
  exit: FitExit;
}

/**
 * A slot's rule paired with the id it applies to, before measurement.
 */
export type FitTemplate = FitRule & {
  /** Control slot id, as written in the layout. */
  id: string;
};

/**
 * One measured control, ready to be planned.
 */
export interface FitItem extends FitTemplate {
  /** Rendered width in px (border box), or a cached width for items already out of the bar. */
  width: number;
  /** False when the control hid itself (no text tracks, no cast device, and so on). */
  visible: boolean;
}

/**
 * Where every control should be after the fit.
 *
 * All three lists are in layout order, and every input id appears in exactly
 * one of them.
 */
export interface FitPlan {
  /** Controls that stay in the bar. */
  inBar: string[];
  /** Controls that move into the overflow tray. */
  overflow: string[];
  /** Controls that are taken off screen. */
  hidden: string[];
}

/**
 * Rank given to any id that is not in {@link DEFAULT_PRIORITY}.
 *
 * Every registered (non built-in) control lands here: `share`, `chapters`,
 * `playlist-previous`, `playlist-next` and anything a host registers itself.
 * They leave before the cast buttons and after PiP, and they go to the tray
 * rather than off screen because a plugin that shipped a control meant it to be
 * usable.
 */
const UNKNOWN_RANK = 3;

/**
 * Default placement rules, lowest rank first.
 *
 * The order is a reachability argument, not a taste one:
 *
 * - `bandwidth-indicator` (0) is a status glyph, not an action, so it is the
 *   one item that is cheaper to drop than to relocate.
 * - the skip buttons (1) are the first actions to go because the gestures
 *   plugin covers the same seek by double tap on exactly the devices where the
 *   bar runs out of room.
 * - `pip` (2) is desktop-shaped and unavailable on iPhone.
 * - registered controls (3, see {@link UNKNOWN_RANK}).
 * - the cast buttons (4) go to the tray and are never hidden: AirPlay is how an
 *   iPhone viewer gets the stream onto a television.
 * - `volume` (5) is close to inert on iOS, where `video.volume` is read only
 *   and the hardware buttons own it.
 * - `captions` and `quality` (6) are the last actions to leave, and both are
 *   also reachable inside the settings menu, which never moves. They part
 *   company on the way out: `captions` goes to the tray, `quality` hides.
 *   `quality` owns a popover, and the bound that keeps a popover inside the
 *   player (`--sp-menu-max-height`) is sized for a menu anchored in the bar.
 *   The tray strip sits above the bar (60px tall for a single row of buttons,
 *   and taller once they wrap), so a quality menu opened from the tray starts
 *   that much higher than its bound assumes and runs off the top of the player
 *   wherever the bound binds. Nothing is lost by hiding it: the settings menu carries a
 *   Quality row whenever there are qualities to choose.
 * - `time` (7) hides rather than relocating: a time readout inside a tray tells
 *   the viewer nothing, and the scrub tooltip still reports position.
 * - `play`, `live-indicator`, `settings`, `fullscreen` and `spacer` are pinned.
 *   Settings staying put is what keeps speed and captions two taps away at
 *   every width.
 */
export const DEFAULT_PRIORITY: Readonly<Record<string, FitRule>> = {
  'bandwidth-indicator': { rank: 0, exit: 'hide' },
  'skip-backward': { rank: 1, exit: 'overflow' },
  'skip-forward': { rank: 1, exit: 'overflow' },
  pip: { rank: 2, exit: 'overflow' },
  chromecast: { rank: 4, exit: 'overflow' },
  airplay: { rank: 4, exit: 'overflow' },
  volume: { rank: 5, exit: 'overflow' },
  captions: { rank: 6, exit: 'overflow' },
  quality: { rank: 6, exit: 'hide' },
  time: { rank: 7, exit: 'hide' },
  play: { rank: 'never', exit: 'overflow' },
  'live-indicator': { rank: 'never', exit: 'overflow' },
  settings: { rank: 'never', exit: 'overflow' },
  fullscreen: { rank: 'never', exit: 'overflow' },
  spacer: { rank: 'never', exit: 'overflow' },
};

/**
 * Resolve a layout into placement rules, in layout order.
 *
 * @param layout - Control slot ids, exactly as the host configured them
 * @param priority - Per slot rank overrides; `'never'` pins a control in the bar
 * @returns One template per slot, ready to be measured and planned
 */
export function resolveFitItems(
  layout: readonly string[],
  priority?: Record<string, FitRank>
): FitTemplate[] {
  return layout.map((id) => {
    const rule = DEFAULT_PRIORITY[id];
    const rank = priority?.[id] ?? rule?.rank ?? UNKNOWN_RANK;

    return { id, rank, exit: rule?.exit ?? 'overflow' };
  });
}

/**
 * Width a set of items occupies inside the bar.
 *
 * @param widths - Widths of the items that are still in the bar
 * @param gap - Flex gap between bar items in px
 * @param overflowButtonWidth - Width of the tray button in px
 * @param trayUsed - Whether anything has been moved into the tray yet
 * @returns Total px the set needs
 */
function needed(
  widths: number[],
  gap: number,
  overflowButtonWidth: number,
  trayUsed: boolean
): number {
  const content = widths.reduce((sum, width) => sum + width, 0);
  const gaps = gap * Math.max(0, widths.length - 1);
  const tray = trayUsed ? overflowButtonWidth + gap : 0;

  return content + gaps + tray;
}

/**
 * Decide which controls stay in the bar, which move to the tray, and which go
 * off screen.
 *
 * Items that are invisible or have no width are never counted and are never
 * candidates for removal: a control that hid itself occupies nothing, and
 * moving it would only make its own next `update()` fight the fit.
 *
 * The tray button's own width joins the arithmetic as soon as the first item
 * moves, which is what stops the oscillation the naive version has ("moving one
 * item out makes room, so move it back, so it overflows again"). Nothing else
 * is stateful, so the same inputs always give the same plan and no hysteresis
 * is needed.
 *
 * @param items - Measured controls in layout order; exclude the spacer, whose
 *   rendered width is the bar's own slack and would make a fitting bar look
 *   exactly full. An excluded spacer is still a flex child of the row, so the
 *   caller has to deduct one gap per spacer from `available`: this charges
 *   (n - 1) gaps for the n items it is handed, and the bar lays out one more
 * @param available - Inner width of the control bar in px, with the bar's own
 *   padding and one gap per excluded spacer already taken off
 * @param gap - Flex gap between bar items in px
 * @param overflowButtonWidth - Width of the tray button in px
 * @returns The target placement for every input id
 */
export function planFit(
  items: readonly FitItem[],
  available: number,
  gap: number,
  overflowButtonWidth: number
): FitPlan {
  const ids = items.map((item) => item.id);

  // A container with no width is not a bar that does not fit, it is a bar
  // nobody has laid out yet (display: none, detached, first frame). Measuring
  // against it would move every control into the tray on the strength of a
  // number that means nothing.
  if (available <= 0) {
    return { inBar: ids, overflow: [], hidden: [] };
  }

  const counted = items.filter((item) => item.visible && item.width > 0);
  const remaining = [...counted];
  const overflow = new Set<string>();
  const hidden = new Set<string>();

  while (
    needed(
      remaining.map((item) => item.width),
      gap,
      overflowButtonWidth,
      overflow.size > 0
    ) > available
  ) {
    let victim = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (candidate.rank === 'never') continue;

      // Ties go to the later item in layout order: the bar reads left to
      // right, so the rightmost of two equals is the one the viewer is least
      // likely to be reaching for.
      if (victim === -1 || candidate.rank <= (remaining[victim].rank as number)) {
        victim = i;
      }
    }

    // Everything left is pinned. The bar clips below its floor (188px of inner
    // width for play, settings, tray and fullscreen), which is accepted and
    // documented rather than papered over by unpinning something.
    if (victim === -1) break;

    const [removed] = remaining.splice(victim, 1);
    (removed.exit === 'hide' ? hidden : overflow).add(removed.id);
  }

  return {
    inBar: ids.filter((id) => !overflow.has(id) && !hidden.has(id)),
    overflow: ids.filter((id) => overflow.has(id)),
    hidden: ids.filter((id) => hidden.has(id)),
  };
}
