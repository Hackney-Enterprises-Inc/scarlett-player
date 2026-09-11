/**
 * RangeSelector tests: slider ARIA, keyboard moves with preventDefault, pointer
 * drags, clamp feedback, presentation switching and `update()` re-rendering.
 *
 * jsdom 24 has no PointerEvent constructor and no setPointerCapture, so drags
 * are driven with `new MouseEvent('pointerdown' | ...)` (jsdom accepts any event
 * name) and the component's `setPointerCapture?.()` calls no-op - which is
 * itself one of the cases under test: capture failing must not break a drag.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { RangeSelector } from '../src/RangeSelector';
import type { ClipChangeMeta, ClipDragEndInfo, ClipHandle } from '../src/RangeSelector';
import type { ClipSelection, RangeBounds } from '../src/range';
import type { ClipsPluginConfig } from '../src/types';

/** Default world: a 600s media, selection 100..130, generous limits. */
const BOUNDS: RangeBounds = { min: 0, max: 600 };
const SELECTION: ClipSelection = { start: 100, end: 130 };
const CONFIG: ClipsPluginConfig = { minDuration: 5, maxDuration: 300, step: 1 };

interface Harness {
  selector: RangeSelector;
  track: HTMLElement;
  start: HTMLElement;
  end: HTMLElement;
  onChange: ReturnType<typeof vi.fn>;
  onDragStart: ReturnType<typeof vi.fn>;
  onDragMove: ReturnType<typeof vi.fn>;
  onDragEnd: ReturnType<typeof vi.fn>;
}

function setup(options?: {
  selection?: ClipSelection;
  bounds?: RangeBounds;
  config?: ClipsPluginConfig;
  presentation?: 'standalone' | 'timeline';
}): Harness {
  const callbacks = {
    onChange: vi.fn(),
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn(),
  };
  const selector = new RangeSelector({
    selection: options?.selection ?? SELECTION,
    bounds: options?.bounds ?? BOUNDS,
    config: options?.config ?? CONFIG,
    presentation: options?.presentation ?? 'standalone',
    callbacks,
  });
  document.body.appendChild(selector.element);
  // jsdom lays everything out at zero width; give the track a real box so
  // clientX -> time conversion has something to divide by (600px == 600s).
  selector.element.getBoundingClientRect = () =>
    ({
      left: 0, top: 0, width: 600, height: 44,
      right: 600, bottom: 44, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;

  const find = (which: ClipHandle) =>
    selector.element.querySelector<HTMLElement>(`[data-clip-handle="${which}"]`)!;
  return { selector, track: selector.element, start: find('start'), end: find('end'), ...callbacks };
}

/** The recorded onChange invocations. */
function changes(h: Harness): Array<{ selection: ClipSelection; meta: ClipChangeMeta }> {
  return h.onChange.mock.calls.map((call: unknown[]) => ({
    selection: call[0] as ClipSelection,
    meta: call[1] as ClipChangeMeta,
  }));
}

/** The `info` argument of the last onDragEnd call. */
function lastDragEnd(h: Harness): { selection: ClipSelection; info: ClipDragEndInfo } {
  const call = h.onDragEnd.mock.calls.at(-1) as unknown[];
  return { selection: call[0] as ClipSelection, info: call[1] as ClipDragEndInfo };
}

/** A pointer event on a target at the given x (see module header re MouseEvent). */
function pointer(target: EventTarget, type: string, clientX: number, init: MouseEventInit = {}): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true, ...init }));
}

/** A keydown on the given handle; returns the event so defaultPrevented is checkable. */
function key(target: HTMLElement, code: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: code, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

/** Grab a handle at its own position (zero grab offset), then move and release. */
function dragHandle(h: Harness, which: ClipHandle, fromX: number, toX: number): void {
  pointer(h[which], 'pointerdown', fromX);
  pointer(h.track, 'pointermove', toX);
  pointer(h.track, 'pointerup', toX);
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('structure and ARIA', () => {
  it('renders the pinned class structure: track > range + two handles', () => {
    const h = setup();
    expect(h.track.classList.contains('sp-clip-track')).toBe(true);
    expect(h.track.classList.contains('sp-clip-track--standalone')).toBe(true);
    expect(h.track.querySelector('.sp-clip-track__range')).not.toBeNull();
    expect(h.track.querySelectorAll('.sp-clip-handle')).toHaveLength(2);
    expect(h.start.classList.contains('sp-clip-handle--start')).toBe(true);
    expect(h.end.classList.contains('sp-clip-handle--end')).toBe(true);
  });

  it('gives each handle a stem and a labelled block', () => {
    const h = setup();
    expect(h.start.querySelector('.sp-clip-handle__stem')).not.toBeNull();
    expect(h.start.querySelector('.sp-clip-handle__label')!.textContent).toBe('IN 1:40');
    expect(h.end.querySelector('.sp-clip-handle__label')!.textContent).toBe('OUT 2:10');
    // The slider announces its own value; the visible label must not double it.
    expect(h.start.querySelector('.sp-clip-handle__label')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('names the handles IN and OUT rather than by their model field', () => {
    const h = setup();
    expect(h.start.getAttribute('aria-label')).toBe('Clip in point');
    expect(h.end.getAttribute('aria-label')).toBe('Clip out point');
  });

  it('gives each handle slider semantics and value attributes', () => {
    const h = setup();
    expect(h.start.getAttribute('role')).toBe('slider');
    expect(h.end.getAttribute('role')).toBe('slider');
    expect(h.start.getAttribute('tabindex')).toBe('0');
    expect(h.end.getAttribute('tabindex')).toBe('0');
    expect(h.start.getAttribute('aria-valuenow')).toBe('100');
    expect(h.end.getAttribute('aria-valuenow')).toBe('130');
    expect(h.start.getAttribute('aria-valuetext')).toBe('IN 1:40');
    expect(h.end.getAttribute('aria-valuetext')).toBe('OUT 2:10');
  });

  it('announces the limits the endpoint can actually reach, not the whole media', () => {
    const h = setup();
    // start: [max(0, 130 - 300), 130 - 5] = [0, 125]
    expect(h.start.getAttribute('aria-valuemin')).toBe('0');
    expect(h.start.getAttribute('aria-valuemax')).toBe('125');
    // end: [100 + 5, min(600, 100 + 300)] = [105, 400]
    expect(h.end.getAttribute('aria-valuemin')).toBe('105');
    expect(h.end.getAttribute('aria-valuemax')).toBe('400');
  });

  it('labels fractional times when the step can produce them', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 300, step: 0.5 } });
    h.selector.update({ start: 100.5, end: 130 }, BOUNDS);
    expect(h.start.getAttribute('aria-valuetext')).toBe('IN 1:40.5');
    expect(h.start.querySelector('.sp-clip-handle__label')!.textContent).toBe('IN 1:40.5');
  });

  it('positions the range fill and handles from the selection', () => {
    const h = setup();
    const range = h.track.querySelector<HTMLElement>('.sp-clip-track__range')!;
    expect(parseFloat(range.style.left)).toBeCloseTo((100 / 600) * 100, 4);
    expect(parseFloat(range.style.width)).toBeCloseTo((30 / 600) * 100, 4);
    expect(parseFloat(h.start.style.left)).toBeCloseTo((100 / 600) * 100, 4);
    expect(parseFloat(h.end.style.left)).toBeCloseTo((130 / 600) * 100, 4);
  });
});

describe('presentation', () => {
  it('starts standalone and switches to the timeline modifier', () => {
    const h = setup();
    expect(h.selector.getPresentation()).toBe('standalone');

    h.selector.setPresentation('timeline');

    expect(h.selector.getPresentation()).toBe('timeline');
    expect(h.track.classList.contains('sp-clip-track--timeline')).toBe(true);
    expect(h.track.classList.contains('sp-clip-track--standalone')).toBe(false);
  });

  it('keeps the selection across a presentation switch', () => {
    const h = setup();
    key(h.end, 'ArrowRight');
    h.selector.setPresentation('timeline');
    expect(h.end.getAttribute('aria-valuenow')).toBe('131');
  });

  it('ignores background presses on the timeline so the playhead can seek', () => {
    const h = setup({ presentation: 'timeline' });
    pointer(h.track, 'pointerdown', 115);
    expect(h.onDragStart).not.toHaveBeenCalled();
  });

  it('still drags from an explicit handle hit on the timeline', () => {
    const h = setup({ presentation: 'timeline' });
    pointer(h.end, 'pointerdown', 130);
    expect(h.onDragStart).toHaveBeenCalledWith('end');
  });

  it('cancels an in-flight drag when the presentation changes underneath it', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    h.selector.setPresentation('timeline');
    expect(lastDragEnd(h).info.cancelled).toBe(true);
    expect(h.selector.isDragging()).toBe(false);
  });
});

/**
 * The pill is centred on its handle, and a handle can sit at either end of the
 * track. A ~60px label then hangs ~30px past the rail, and the player's
 * `overflow: hidden` cut "IN" clean off - measured 2026-09-09 on a 350px
 * player, where the IN pill spanned x=2..63 against a player starting at 20.
 *
 * Only the label moves. The handle and the stem are the precision: shifting
 * those to keep a label on screen would make the editor point at the wrong
 * timestamp.
 */
describe('label clamping on the timeline', () => {
  const PILL = 60;

  /**
   * Give a handle's label a real box; jsdom measures everything at zero, and a
   * zero-width pill is correctly left alone.
   *
   * @param handle - The handle whose label to measure
   */
  const givePill = (handle: HTMLElement): void => {
    const label = handle.querySelector<HTMLElement>('.sp-clip-handle__label')!;
    label.getBoundingClientRect = () =>
      ({
        left: 0, top: 0, width: PILL, height: 18,
        right: PILL, bottom: 18, x: 0, y: 0, toJSON: () => ({}),
      }) as DOMRect;
  };

  const labelOf = (handle: HTMLElement): HTMLElement =>
    handle.querySelector<HTMLElement>('.sp-clip-handle__label')!;

  /** A timeline selector with both pills measurable and a 600px track. */
  const timeline = (selection: ClipSelection): Harness => {
    const h = setup({ selection, presentation: 'timeline' });
    givePill(h.start);
    givePill(h.end);
    // Re-render now that the boxes exist (setup() stubs the track's rect after
    // construction, so the constructor's own render measured zeros).
    h.selector.update(selection, BOUNDS);
    return h;
  };

  it('pushes the IN pill right when the handle sits at the start of the track', () => {
    const h = timeline({ start: 0, end: 130 });

    // Centre 0, half-pill 30: the label needs 30px to clear the left edge.
    expect(labelOf(h.start).style.transform).toBe('translateX(30px)');
  });

  it('pulls the OUT pill left when the handle sits at the end of the track', () => {
    const h = timeline({ start: 100, end: 600 });

    expect(labelOf(h.end).style.transform).toBe('translateX(-30px)');
  });

  it('leaves a pill with room on both sides untouched', () => {
    const h = timeline({ start: 300, end: 330 });

    expect(labelOf(h.start).style.transform).toBe('');
    expect(labelOf(h.end).style.transform).toBe('');
  });

  it('never moves the handle or its stem', () => {
    const h = timeline({ start: 0, end: 600 });

    // The handle stays exactly on the timestamp it points at.
    expect(h.start.style.left).toBe('0%');
    expect(h.end.style.left).toBe('100%');
    const stem = h.start.querySelector<HTMLElement>('.sp-clip-handle__stem')!;
    expect(stem.style.transform).toBe('');
  });

  it('re-clamps when the track is resized under it', () => {
    const h = timeline({ start: 60, end: 130 });
    // 10% of 600px = 60px in: the 30px half-pill already fits.
    expect(labelOf(h.start).style.transform).toBe('');

    // The player narrowed to 200px, so 10% is now 20px in and it does not.
    h.track.getBoundingClientRect = () =>
      ({
        left: 0, top: 0, width: 200, height: 44,
        right: 200, bottom: 44, x: 0, y: 0, toJSON: () => ({}),
      }) as DOMRect;
    h.selector.update({ start: 60, end: 130 }, BOUNDS);

    expect(labelOf(h.start).style.transform).toBe('translateX(10px)');
  });

  it('leaves standalone labels alone - they are visually hidden there', () => {
    const h = setup({ selection: { start: 0, end: 600 } });
    givePill(h.start);
    h.selector.update({ start: 0, end: 600 }, BOUNDS);

    expect(labelOf(h.start).style.transform).toBe('');
  });

  it('keeps the readable end of a pill wider than the whole track', () => {
    const h = setup({ selection: { start: 300, end: 330 }, presentation: 'timeline' });
    givePill(h.start);
    // A 60px track: the pill cannot fit, so the left edge wins and the tail
    // runs off rather than the prefix being cut.
    h.track.getBoundingClientRect = () =>
      ({
        left: 0, top: 0, width: 60, height: 44,
        right: 60, bottom: 44, x: 0, y: 0, toJSON: () => ({}),
      }) as DOMRect;
    h.selector.update({ start: 300, end: 330 }, BOUNDS);

    // Centre 30, half-pill 30: shifted right by 0 - already flush left.
    expect(labelOf(h.start).style.transform).toBe('');
  });

  /**
   * A drag renders on every pointermove, and each render places both pills.
   * Measuring the track again from inside that render - after the handles have
   * just been repositioned - makes the browser flush layout a second time for a
   * number the move already read off the same box a moment earlier.
   */
  it('measures the track once per pointer event of a drag, not twice', () => {
    const h = timeline({ start: 100, end: 130 });
    const rect = {
      left: 0, top: 0, width: 600, height: 44,
      right: 600, bottom: 44, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect;
    const measure = vi.fn(() => rect);
    h.track.getBoundingClientRect = measure;

    pointer(h.start, 'pointerdown', 100);
    pointer(h.track, 'pointermove', 60);
    pointer(h.track, 'pointerup', 60);

    // One read per event that maps a clientX; the renders they drive reuse it.
    expect(measure).toHaveBeenCalledTimes(3);
    // And the clamp still ran off a real width: 10% of 600px is 60px in, which
    // leaves room for the 30px half-pill.
    expect(labelOf(h.start).style.transform).toBe('');
  });

  it('clamps a dragged pill against the width the move measured', () => {
    const h = timeline({ start: 100, end: 130 });

    // Dragged to the very start of the track: centre 0, half-pill 30.
    pointer(h.start, 'pointerdown', 100);
    pointer(h.track, 'pointermove', 0);

    expect(labelOf(h.start).style.transform).toBe('translateX(30px)');
  });

  /**
   * The pill is exactly as wide as its text, so a move that relabels nothing
   * has nothing to re-measure - and at a one-second step most moves of a drag
   * land back on the timestamp they were already showing.
   */
  it('re-measures a pill only when its text changed', () => {
    const h = timeline({ start: 100, end: 130 });
    const label = labelOf(h.start);
    const measure = vi.fn(label.getBoundingClientRect.bind(label));
    label.getBoundingClientRect = measure;

    pointer(h.start, 'pointerdown', 100);
    pointer(h.track, 'pointermove', 60);
    expect(label.textContent).toBe('IN 1:00');
    expect(measure).toHaveBeenCalledTimes(1);

    // Same second, so the same label: nothing to measure.
    pointer(h.track, 'pointermove', 60.4);
    expect(measure).toHaveBeenCalledTimes(1);

    // A new second relabels the pill, and the new text gets measured.
    pointer(h.track, 'pointermove', 61);
    expect(label.textContent).toBe('IN 1:01');
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it('re-measures the pills after a presentation change restyles them', () => {
    const h = timeline({ start: 100, end: 130 });
    const label = labelOf(h.start);
    const measure = vi.fn(label.getBoundingClientRect.bind(label));
    label.getBoundingClientRect = measure;

    h.selector.update({ start: 0, end: 130 }, BOUNDS);
    expect(measure).toHaveBeenCalledTimes(1);

    // Standalone hides the pills; back on the timeline they are a different
    // box, and the cached width belongs to the presentation it was taken in.
    h.selector.setPresentation('standalone');
    h.selector.setPresentation('timeline');
    h.selector.update({ start: 0, end: 130 }, BOUNDS);
    expect(measure).toHaveBeenCalledTimes(2);
    expect(labelOf(h.start).style.transform).toBe('translateX(30px)');
  });

  it('keeps the left edge of an off-centre pill wider than the whole track', () => {
    const h = setup({ selection: { start: 480, end: 500 }, presentation: 'timeline' });
    givePill(h.start);
    // A 40px track with the IN handle at 80%: centre 32, half-pill 30, so the
    // pill overhangs the right edge by 22 and the left by nothing. Both limits
    // are negative and lo (-2) > hi (-22) - the case the equal-limits test
    // above cannot reach. Taking lo puts the left edge exactly on 0 (32 - 30 -
    // 2) and lets the tail run off, rather than taking hi and cutting "IN".
    h.track.getBoundingClientRect = () =>
      ({
        left: 0, top: 0, width: 40, height: 44,
        right: 40, bottom: 44, x: 0, y: 0, toJSON: () => ({}),
      }) as DOMRect;
    h.selector.update({ start: 480, end: 500 }, BOUNDS);

    expect(labelOf(h.start).style.transform).toBe('translateX(-2px)');
  });
});

describe('keyboard', () => {
  it('ArrowRight/ArrowLeft move the focused handle by one step and preventDefault', () => {
    const h = setup();
    const right = key(h.end, 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 131 });

    const left = key(h.start, 'ArrowLeft');
    expect(left.defaultPrevented).toBe(true);
    expect(changes(h).at(-1)!.selection).toEqual({ start: 99, end: 131 });
  });

  it('reports the moved handle and source on onChange', () => {
    const h = setup();
    key(h.end, 'ArrowRight');
    expect(changes(h)[0].meta).toEqual({
      handle: 'end',
      source: 'keyboard',
      clamped: false,
      clampReason: null,
    });
    expect(h.end.getAttribute('aria-valuenow')).toBe('131');
    expect(h.end.getAttribute('aria-valuetext')).toBe('OUT 2:11');
  });

  it('Shift+Arrow moves five steps', () => {
    const h = setup();
    key(h.end, 'ArrowRight', true);
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 135 });
    key(h.start, 'ArrowLeft', true);
    expect(changes(h).at(-1)!.selection).toEqual({ start: 95, end: 135 });
  });

  it('Home and End go to the endpoint limits, not the media edges', () => {
    const h = setup();
    // start's reachable window is [0, 125]; End must stop at the other handle's
    // minimum distance rather than asking for 600 and being clamped there.
    const event = key(h.start, 'End');
    expect(event.defaultPrevented).toBe(true);
    expect(changes(h)[0].selection).toEqual({ start: 125, end: 130 });
    expect(changes(h)[0].meta.clamped).toBe(false);

    key(h.start, 'Home');
    expect(changes(h).at(-1)!.selection).toEqual({ start: 0, end: 130 });
  });

  it('End on the out handle stops at the shorter of media edge and max duration', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 500, step: 1 } });
    key(h.end, 'End');
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 600 });

    const capped = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    key(capped.end, 'End');
    expect(changes(capped)[0].selection).toEqual({ start: 100, end: 160 });
  });

  it('an arrow past the limit clamps, flags and reports the reason', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    key(h.end, 'End'); // lands exactly on 160
    key(h.end, 'ArrowRight'); // asks for 161, refused

    const last = changes(h).at(-1)!;
    expect(last.selection).toEqual({ start: 100, end: 160 });
    expect(last.meta.clamped).toBe(true);
    expect(last.meta.clampReason).toBe('max-duration');
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);
  });

  it('unhandled keys (Tab) pass through without preventDefault', () => {
    const h = setup();
    const event = key(h.end, 'Tab');
    expect(event.defaultPrevented).toBe(false);
    expect(changes(h)).toHaveLength(0);
  });

  it('honors a fractional step from config', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 300, step: 0.5 } });
    key(h.end, 'ArrowRight');
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 130.5 });
  });
});

describe('pointer drag', () => {
  it('an explicit handle hit wins over the nearer handle', () => {
    const h = setup();
    // 128 is far nearer the out handle, but the press landed on the in one.
    pointer(h.start, 'pointerdown', 128);
    expect(h.onDragStart).toHaveBeenCalledWith('start');
  });

  it('picks the nearer handle for a press on the standalone background', () => {
    const h = setup();
    pointer(h.track, 'pointerdown', 128); // |128-100| = 28 vs |128-130| = 2
    expect(h.onDragStart).toHaveBeenCalledWith('end');
    pointer(h.track, 'pointerup', 128);
  });

  it('resolves an exact-midpoint tie toward the start handle', () => {
    const h = setup();
    pointer(h.track, 'pointerdown', 115); // midpoint of 100..130
    expect(h.onDragStart).toHaveBeenCalledWith('start');
    pointer(h.track, 'pointerup', 115);
  });

  it('does not move anything on the press itself', () => {
    const h = setup();
    pointer(h.start, 'pointerdown', 110);
    expect(h.onDragMove).not.toHaveBeenCalled();
    expect(changes(h)).toHaveLength(0);
    pointer(h.track, 'pointerup', 110);
  });

  it('applies the movement delta from where the handle was grabbed', () => {
    const h = setup();
    // Grabbed 10s to the right of the out handle: dragging 20s further right
    // must move the handle by 20, not teleport it to the finger.
    pointer(h.end, 'pointerdown', 140);
    pointer(h.track, 'pointermove', 160);

    expect(changes(h)[0].selection).toEqual({ start: 100, end: 150 });
    expect(h.onDragMove).toHaveBeenCalledWith('end', 150);
  });

  it('drags the end handle: snaps clientX to time, fires move/onChange, releases on up', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    expect(h.onDragStart).toHaveBeenCalledWith('end');
    expect(h.track.classList.contains('sp-clip-track--dragging')).toBe(true);
    expect(h.end.classList.contains('sp-clip-handle--dragging')).toBe(true);

    pointer(h.track, 'pointermove', 200);
    expect(h.onDragMove).toHaveBeenCalledWith('end', 200);
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 200 });
    expect(changes(h)[0].meta.source).toBe('pointer');
    expect(h.end.getAttribute('aria-valuenow')).toBe('200');

    pointer(h.track, 'pointerup', 200);
    expect(lastDragEnd(h)).toEqual({
      selection: { start: 100, end: 200 },
      info: { cancelled: false },
    });
    expect(h.track.classList.contains('sp-clip-track--dragging')).toBe(false);
    expect(h.end.classList.contains('sp-clip-handle--dragging')).toBe(false);
  });

  it('applies the release position, so a fast drag lands where the finger left', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 180);
    // The gesture outran pointermove: the up carries the real final position.
    pointer(h.track, 'pointerup', 240);

    expect(lastDragEnd(h).selection).toEqual({ start: 100, end: 240 });
    expect(h.end.getAttribute('aria-valuenow')).toBe('240');
  });

  it('drags the start handle and never moves the end one', () => {
    const h = setup();
    dragHandle(h, 'start', 100, 80);
    expect(h.onDragStart).toHaveBeenCalledWith('start');
    expect(h.onDragMove).toHaveBeenCalledWith('start', 80);
    expect(lastDragEnd(h).selection).toEqual({ start: 80, end: 130 });
    expect(h.start.getAttribute('aria-valuenow')).toBe('80');
    expect(h.end.getAttribute('aria-valuenow')).toBe('130');
  });

  it('ignores a secondary or right button', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130, { button: 2 });
    expect(h.onDragStart).not.toHaveBeenCalled();
    expect(h.selector.isDragging()).toBe(false);
  });

  it('ignores a second pointer while one already owns the drag', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130, { detail: 0 });
    // A second finger: a different pointerId (jsdom MouseEvents carry none, so
    // this is the closest available stand-in) must not start or drive anything.
    pointer(h.start, 'pointerdown', 60);
    expect(h.onDragStart).toHaveBeenCalledTimes(1);
    expect(h.onDragStart).toHaveBeenCalledWith('end');
  });

  it('ignores pointermove and pointerup with no drag in progress', () => {
    const h = setup();
    pointer(h.track, 'pointermove', 300);
    pointer(h.track, 'pointerup', 300);
    expect(h.onDragMove).not.toHaveBeenCalled();
    expect(h.onDragEnd).not.toHaveBeenCalled();
    expect(changes(h)).toHaveLength(0);
  });

  it('tracks through the document when pointer capture is unavailable', () => {
    // jsdom has no setPointerCapture at all, which is exactly the fallback
    // case: without it, moves off the handle would never reach the selector.
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    pointer(document, 'pointermove', 210);

    expect(changes(h).at(-1)!.selection).toEqual({ start: 100, end: 210 });
    pointer(document, 'pointerup', 210);
    expect(h.onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('survives a setPointerCapture that throws', () => {
    const h = setup();
    (h.end as HTMLElement & { setPointerCapture: () => void }).setPointerCapture = () => {
      throw new Error('InvalidPointerId');
    };

    pointer(h.end, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 200);

    expect(h.onDragStart).toHaveBeenCalledWith('end');
    expect(changes(h).at(-1)!.selection).toEqual({ start: 100, end: 200 });
  });

  it('pointercancel keeps the committed range and reports the drag as cancelled', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 200);
    pointer(h.track, 'pointercancel', 400);

    expect(lastDragEnd(h)).toEqual({
      selection: { start: 100, end: 200 },
      info: { cancelled: true },
    });
    expect(h.track.classList.contains('sp-clip-track--dragging')).toBe(false);
  });

  it('lostpointercapture ends the drag once, as a cancellation', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    h.track.dispatchEvent(new MouseEvent('lostpointercapture', { bubbles: true }));

    expect(h.onDragEnd).toHaveBeenCalledTimes(1);
    expect(lastDragEnd(h).info.cancelled).toBe(true);
  });

  it('releases ownership exactly once however the drag ends', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    pointer(h.track, 'pointerup', 200);
    // The browser fires lostpointercapture right after a normal release.
    h.track.dispatchEvent(new MouseEvent('lostpointercapture', { bubbles: true }));
    pointer(h.track, 'pointercancel', 200);

    expect(h.onDragEnd).toHaveBeenCalledTimes(1);
    expect(lastDragEnd(h).info.cancelled).toBe(false);
  });

  it('a resize mid-drag maps the next move against the new geometry', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    // The player was resized: the same rail is now half as wide.
    h.track.getBoundingClientRect = () =>
      ({
        left: 0, top: 0, width: 300, height: 44,
        right: 300, bottom: 44, x: 0, y: 0, toJSON: () => ({}),
      }) as DOMRect;
    pointer(h.track, 'pointermove', 100); // 100/300 of 600s = 200s

    expect(changes(h).at(-1)!.selection.end).toBe(200);
  });
});

describe('clamp feedback', () => {
  it('a clamped drag adds --clamped, reports max-duration and clears after ~1s', () => {
    vi.useFakeTimers();
    const h = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    pointer(h.end, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 590); // far past start + maxDuration = 160

    expect(changes(h)[0].selection).toEqual({ start: 100, end: 160 });
    expect(changes(h)[0].meta.clamped).toBe(true);
    expect(changes(h)[0].meta.clampReason).toBe('max-duration');
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);

    pointer(h.track, 'pointerup', 590);
    vi.advanceTimersByTime(1000);
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(false);
  });

  it('keeps reporting clamped on further moves while pinned at the limit', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    pointer(h.end, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 500); // -> end 160 (clamped, changed)
    pointer(h.track, 'pointermove', 590); // still 160: unchanged, but still clamped

    const calls = changes(h);
    expect(calls).toHaveLength(2);
    expect(calls[1].selection).toEqual({ start: 100, end: 160 });
    expect(calls[1].meta.clamped).toBe(true);
    // onDragMove is the continuous channel: fired on both moves.
    expect(h.onDragMove).toHaveBeenCalledTimes(2);
  });

  it('reports min-duration when a start drag tries to pass the end handle', () => {
    const h = setup();
    dragHandle(h, 'start', 100, 128); // start requested 128 -> held at 125
    expect(changes(h).at(-1)!.selection).toEqual({ start: 125, end: 130 });
    expect(changes(h).at(-1)!.meta.clampReason).toBe('min-duration');
    expect(h.start.classList.contains('sp-clip-handle--clamped')).toBe(true);
  });

  it('reports bounds when the stop is the media edge, not a duration limit', () => {
    // Bounds shrink below the selection (a late metadata correction): now the
    // end handle's upper limit is bounds.max, not start + maxDuration.
    const h = setup();
    h.selector.update({ start: 100, end: 130 }, { min: 0, max: 110 });
    key(h.end, 'ArrowLeft'); // 129 -> held at min(110, 400) = 110
    const last = changes(h).at(-1)!;
    expect(last.selection).toEqual({ start: 100, end: 110 });
    expect(last.meta.clampReason).toBe('bounds');
  });

  it('the clamp flash re-arms on a new clamp instead of stacking timers', () => {
    vi.useFakeTimers();
    const h = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    key(h.end, 'End'); // exactly 160, unclamped
    key(h.end, 'ArrowRight'); // refused: flash armed
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);
    vi.advanceTimersByTime(900);
    key(h.end, 'ArrowRight'); // clamped again at 900ms -> re-arm
    vi.advanceTimersByTime(900); // 1800ms total, 900 since re-arm: still on
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(false);
  });
});

describe('applyEndpoint()', () => {
  it('commits an exact time through the same clamping path a drag uses', () => {
    const h = setup();
    const landed = h.selector.applyEndpoint('end', 222.4, 'field');

    expect(landed).toBe(222);
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 222 });
    expect(changes(h)[0].meta.source).toBe('field');
  });

  it('clamps a requested time the other endpoint refuses, and says so', () => {
    const h = setup();
    const landed = h.selector.applyEndpoint('start', 500, 'playhead');

    expect(landed).toBe(125);
    expect(changes(h)[0].meta.clamped).toBe(true);
    expect(changes(h)[0].meta.clampReason).toBe('min-duration');
    // Clamp, never push: the out point stays exactly where it was.
    expect(h.end.getAttribute('aria-valuenow')).toBe('130');
  });
});

describe('setInteractive()', () => {
  it('freezes the handles out of the tab order and refuses pointer input', () => {
    const h = setup();
    h.selector.setInteractive(false);

    expect(h.track.classList.contains('sp-clip-track--frozen')).toBe(true);
    expect(h.start.getAttribute('tabindex')).toBe('-1');
    expect(h.start.getAttribute('aria-disabled')).toBe('true');

    h.selector.setInteractive(true);
    expect(h.track.classList.contains('sp-clip-track--frozen')).toBe(false);
    expect(h.end.getAttribute('tabindex')).toBe('0');
    expect(h.end.getAttribute('aria-disabled')).toBe('false');
  });

  it('cancels a drag in progress rather than leaving a handle latched', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    h.selector.setInteractive(false);

    expect(lastDragEnd(h).info.cancelled).toBe(true);
    expect(h.selector.isDragging()).toBe(false);
  });

  it('refuses arrow keys from a handle that was already focused when it froze', () => {
    // tabindex="-1" keeps a frozen handle out of tabbing, but it does not blur
    // a handle that already had focus, and a focused element still gets
    // keydown - so the range could be walked out from under a submission that
    // is already carrying it.
    const h = setup();
    h.end.focus();
    h.selector.setInteractive(false);

    const event = key(h.end, 'ArrowRight');

    expect(h.end.getAttribute('aria-valuenow')).toBe('130');
    expect(h.onChange).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false); // not ours to swallow while frozen
  });

  it('refuses a pointer grab while frozen, with no stylesheet to rely on', () => {
    // .sp-clip-track--frozen sets pointer-events: none, but the stylesheet is
    // the host page's to override and jsdom applies none of it; the freeze has
    // to hold in the handler too.
    const h = setup();
    h.selector.setInteractive(false);

    pointer(h.end, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 200);

    expect(h.selector.isDragging()).toBe(false);
    expect(h.onDragStart).not.toHaveBeenCalled();
    expect(h.end.getAttribute('aria-valuenow')).toBe('130');
  });

  it('takes keyboard and pointer moves again once thawed', () => {
    const h = setup();
    h.selector.setInteractive(false);
    h.selector.setInteractive(true);

    key(h.end, 'ArrowRight');
    expect(h.end.getAttribute('aria-valuenow')).toBe('131');

    dragHandle(h, 'end', 131, 200);
    expect(h.end.getAttribute('aria-valuenow')).toBe('200');
  });
});

describe('update()', () => {
  it('re-renders positions and ARIA from a new selection without firing callbacks', () => {
    const h = setup();
    h.selector.update({ start: 250, end: 300 }, BOUNDS);
    expect(h.start.getAttribute('aria-valuenow')).toBe('250');
    expect(h.end.getAttribute('aria-valuenow')).toBe('300');
    expect(h.end.getAttribute('aria-valuetext')).toBe('OUT 5:00');
    const range = h.track.querySelector<HTMLElement>('.sp-clip-track__range')!;
    expect(parseFloat(range.style.left)).toBeCloseTo((250 / 600) * 100, 4);
    expect(parseFloat(range.style.width)).toBeCloseTo((50 / 600) * 100, 4);
    expect(h.onChange).not.toHaveBeenCalled();
  });

  it('re-spans the track when bounds change (host configure / Phase 2 DVR hook)', () => {
    const h = setup();
    h.selector.update({ start: 250, end: 300 }, { min: 0, max: 1200 });
    // The end handle can now reach start + maxDuration, which is inside the
    // wider media rather than pinned to its edge.
    expect(h.end.getAttribute('aria-valuemax')).toBe('550');
    expect(parseFloat(h.start.style.left)).toBeCloseTo((250 / 1200) * 100, 4);
  });

  it('accepts replacement config for runtime limit changes', () => {
    const h = setup();
    h.selector.update(SELECTION, BOUNDS, { minDuration: 5, maxDuration: 300, step: 2 });
    key(h.end, 'ArrowRight'); // step 2: 130 -> 132
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 132 });
  });

  it('clamps rendering to the band for out-of-range values (defensive)', () => {
    const h = setup();
    h.selector.update({ start: -10, end: 900 }, BOUNDS);
    expect(parseFloat(h.start.style.left)).toBe(0);
    expect(parseFloat(h.end.style.left)).toBe(100);
  });
});

describe('destroy()', () => {
  it('detaches input handling so later events do nothing', () => {
    const h = setup();
    h.selector.destroy();
    key(h.end, 'ArrowRight');
    pointer(h.track, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 200);
    expect(h.onChange).not.toHaveBeenCalled();
    expect(h.onDragStart).not.toHaveBeenCalled();
    expect(h.onDragMove).not.toHaveBeenCalled();
  });

  it('ends a drag in progress as a cancellation', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    h.selector.destroy();

    expect(lastDragEnd(h).info.cancelled).toBe(true);
  });

  it('leaves no document listeners behind after a capture-less drag', () => {
    const h = setup();
    pointer(h.end, 'pointerdown', 130);
    h.selector.destroy();

    pointer(document, 'pointermove', 400);
    expect(h.onDragMove).not.toHaveBeenCalled();
  });

  it('clears the clamp flash timer', () => {
    vi.useFakeTimers();
    const h = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    key(h.end, 'End');
    key(h.end, 'ArrowRight'); // clamped -> flash armed
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);
    h.selector.destroy();
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });

  it('is idempotent', () => {
    const h = setup();
    h.selector.destroy();
    expect(() => h.selector.destroy()).not.toThrow();
  });
});
