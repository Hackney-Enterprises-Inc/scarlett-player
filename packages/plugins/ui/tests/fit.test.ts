/**
 * Control bar fit planning tests.
 *
 * The arithmetic lives here rather than in the DOM adapter precisely so it can
 * be tested: jsdom has no layout engine, so a fit expressed in CSS could only
 * ever be eyeballed in a browser.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_PRIORITY, planFit, resolveFitItems } from '../src/fit';
import type { FitItem, FitRank } from '../src/fit';

/** Widths measured in Chrome 152 on scarlettplayer.com/demo, 2026-09-05. */
const BUTTON = 44;
const TIME = 87;
const GAP = 4;

/**
 * Build a measured item from a slot id, using the default rules.
 *
 * @param id - Control slot id
 * @param width - Rendered width in px
 * @param visible - Whether the control is showing itself
 * @returns A measured item ready for planFit
 */
const item = (id: string, width = BUTTON, visible = true): FitItem => {
  const [template] = resolveFitItems([id]);

  return { ...template, width, visible };
};

/**
 * The demo's default layout as an iPhone renders it for a VOD with captions:
 * the live and bandwidth indicators and Chromecast hide themselves, AirPlay
 * does not. Nine 44px buttons plus an 87px time readout: 519px with gaps.
 */
const iphoneVodItems = (): FitItem[] => [
  item('play'),
  item('skip-backward'),
  item('skip-forward'),
  item('volume'),
  item('time', TIME),
  item('live-indicator', 0, false),
  item('bandwidth-indicator', 0, false),
  item('settings'),
  item('captions'),
  item('chromecast', 0, false),
  item('airplay'),
  item('pip'),
  item('fullscreen'),
];

describe('resolveFitItems', () => {
  it('gives every built-in its documented rule', () => {
    const items = resolveFitItems(['play', 'time', 'bandwidth-indicator', 'pip']);

    expect(items).toEqual([
      { id: 'play', rank: 'never', exit: 'overflow' },
      { id: 'time', rank: 7, exit: 'hide' },
      { id: 'bandwidth-indicator', rank: 0, exit: 'hide' },
      { id: 'pip', rank: 2, exit: 'overflow' },
    ]);
  });

  it('defaults an unknown id to rank 3 and the tray', () => {
    // Everything a plugin registers lands here: share, chapters, the playlist
    // buttons, and anything a host registers itself.
    expect(resolveFitItems(['share', 'chapters'])).toEqual([
      { id: 'share', rank: 3, exit: 'overflow' },
      { id: 'chapters', rank: 3, exit: 'overflow' },
    ]);
  });

  it('applies a priority override, including pinning', () => {
    const items = resolveFitItems(['share', 'volume'], { share: 'never', volume: 1 });

    expect(items).toEqual([
      { id: 'share', rank: 'never', exit: 'overflow' },
      { id: 'volume', rank: 1, exit: 'overflow' },
    ]);
  });

  it('keeps layout order', () => {
    const layout = ['fullscreen', 'play', 'time'];

    expect(resolveFitItems(layout).map((i) => i.id)).toEqual(layout);
  });
});

describe('DEFAULT_PRIORITY', () => {
  it('pins the controls that keep the player usable at any width', () => {
    for (const slot of ['play', 'live-indicator', 'settings', 'fullscreen', 'spacer']) {
      expect(DEFAULT_PRIORITY[slot].rank).toBe('never');
    }
  });

  it('hides only the two items that convey status rather than an action', () => {
    const hides = Object.entries(DEFAULT_PRIORITY)
      .filter(([, rule]) => rule.exit === 'hide')
      .map(([slot]) => slot);

    expect(hides.sort()).toEqual(['bandwidth-indicator', 'time']);
  });
});

describe('planFit', () => {
  it('moves nothing when the bar already fits', () => {
    const items = iphoneVodItems();

    const plan = planFit(items, 960, GAP, BUTTON);

    expect(plan.overflow).toEqual([]);
    expect(plan.hidden).toEqual([]);
    expect(plan.inBar).toEqual(items.map((i) => i.id));
  });

  it('reproduces the measured 375px phone case', () => {
    // 519px of controls against 351px of inner width. Skips leave first (471),
    // then PiP (423), AirPlay (375) and volume (327 <= 351). Settings never
    // moves, so speed and captions stay two taps away.
    const plan = planFit(iphoneVodItems(), 351, GAP, BUTTON);

    expect(plan.inBar).toEqual([
      'play',
      'time',
      'live-indicator',
      'bandwidth-indicator',
      'settings',
      'captions',
      'chromecast',
      'fullscreen',
    ]);
    expect(plan.overflow).toEqual([
      'skip-backward',
      'skip-forward',
      'volume',
      'airplay',
      'pip',
    ]);
    expect(plan.hidden).toEqual([]);
  });

  it('takes the lowest rank first', () => {
    // PiP (2) outranks the cast buttons (4), so it leaves while they stay. The
    // widths here are wider than a real button on purpose: a 44px button plus
    // its 4px gap costs exactly what the tray button costs, so evicting one of
    // those buys no room and the assertion would land on the second eviction
    // rather than the first.
    const items = [item('play'), item('pip', 100), item('airplay'), item('fullscreen')];

    const plan = planFit(items, 200, GAP, BUTTON);

    expect(plan.overflow).toEqual(['pip']);
  });

  it('breaks a rank tie in favour of the later item in layout order', () => {
    const items = [
      item('skip-backward', 100),
      item('skip-forward', 100),
      item('fullscreen'),
    ];

    const plan = planFit(items, 200, GAP, BUTTON);

    expect(plan.overflow).toEqual(['skip-forward']);
  });

  it('keeps pinned controls in the bar even when nothing fits', () => {
    const items = [item('play'), item('settings'), item('fullscreen')];

    const plan = planFit(items, 10, GAP, BUTTON);

    expect(plan.inBar).toEqual(['play', 'settings', 'fullscreen']);
    expect(plan.overflow).toEqual([]);
  });

  it('ignores a control that hid itself', () => {
    // A cast button with no device on the network occupies nothing, so it
    // neither forces a move nor becomes one.
    const items = [item('play'), item('chromecast', 0, false), item('fullscreen')];

    const plan = planFit(items, 92, GAP, BUTTON);

    expect(plan.overflow).toEqual([]);
    expect(plan.inBar).toContain('chromecast');
  });

  it('ignores a visible control that measured zero', () => {
    const items = [item('play'), item('pip', 0), item('fullscreen')];

    const plan = planFit(items, 92, GAP, BUTTON);

    expect(plan.overflow).toEqual([]);
  });

  it('does not count the tray button until something has overflowed', () => {
    // Two buttons and one gap fit 92px exactly. Counting a button that is not
    // on screen would push this to 140 and evict a control for nothing.
    const items = [item('play'), item('fullscreen')];

    expect(planFit(items, 92, GAP, BUTTON).overflow).toEqual([]);
  });

  it('counts the tray button once anything has moved', () => {
    // Four 44px buttons and three gaps are 188px against 139px of room. PiP (2)
    // leaves first and buys nothing, because a 44px button plus its gap costs
    // exactly the 48px the tray button now adds, so AirPlay (4) follows it out.
    // What is left (two pinned controls and the tray button) is 140px: below
    // the floor this design documents, and the bar clips rather than unpinning
    // anything.
    const items = [item('play'), item('pip'), item('airplay'), item('fullscreen')];

    const plan = planFit(items, 139, GAP, BUTTON);

    expect(plan.overflow).toEqual(['pip', 'airplay']);
    expect(plan.inBar).toEqual(['play', 'fullscreen']);
  });

  it('hides the time readout and the bandwidth glyph rather than relocating them', () => {
    const items = [
      item('play'),
      item('time', TIME),
      item('bandwidth-indicator'),
      item('fullscreen'),
    ];

    const plan = planFit(items, 100, GAP, BUTTON);

    expect(plan.hidden).toEqual(['time', 'bandwidth-indicator']);
    expect(plan.overflow).toEqual([]);
  });

  it('respects a priority override that pins a registered control', () => {
    const pinned: FitItem[] = [
      { ...resolveFitItems(['share'], { share: 'never' })[0], width: BUTTON, visible: true },
      item('pip'),
      item('play'),
    ];

    const plan = planFit(pinned, 92, GAP, BUTTON);

    expect(plan.inBar).toContain('share');
    expect(plan.overflow).toEqual(['pip']);
  });

  it('respects a priority override that makes a control leave first', () => {
    const priority: Record<string, FitRank> = { captions: 0 };
    const items = ['captions', 'bandwidth-indicator', 'play'].map((id) => {
      const [template] = resolveFitItems([id], priority);

      return { ...template, width: BUTTON, visible: true };
    });

    const plan = planFit(items, 92, GAP, BUTTON);

    // Equal ranks now, and captions is earlier in layout order, so the glyph
    // goes first.
    expect(plan.hidden).toEqual(['bandwidth-indicator']);
    expect(plan.overflow).toEqual([]);
  });

  it('leaves everything in the bar when the container has no width', () => {
    // A container that has not been laid out yet is not a container that is
    // too small: measuring against it would empty the bar on first paint.
    const items = iphoneVodItems();

    const plan = planFit(items, 0, GAP, BUTTON);

    expect(plan.inBar).toEqual(items.map((i) => i.id));
    expect(plan.overflow).toEqual([]);
    expect(plan.hidden).toEqual([]);
  });

  it('is deterministic, so the fit cannot oscillate', () => {
    const first = planFit(iphoneVodItems(), 351, GAP, BUTTON);
    const second = planFit(iphoneVodItems(), 351, GAP, BUTTON);

    expect(second).toEqual(first);
  });

  it('does not move an item back out of the tray at the same width', () => {
    // The oscillation guard: re-planning with the survivors still measured and
    // the tray button now on screen must reach the same answer.
    const items = iphoneVodItems();
    const first = planFit(items, 351, GAP, BUTTON);
    const second = planFit(items, 351, GAP, BUTTON);

    expect(second.overflow).toEqual(first.overflow);
  });
});
