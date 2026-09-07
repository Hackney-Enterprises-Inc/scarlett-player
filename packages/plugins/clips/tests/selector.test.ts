/**
 * RangeSelector tests - the "UI" acceptance items that concern the selector:
 * slider ARIA, keyboard moves with preventDefault, pointer drags with the
 * nearer-handle-wins rule, clamp feedback, and update() re-rendering.
 *
 * jsdom 24 has no PointerEvent constructor and no setPointerCapture, so drags
 * are driven with `new MouseEvent('pointerdown' | ...)` (jsdom accepts any
 * event name) and the component's `setPointerCapture?.()` calls no-op.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { RangeSelector } from '../src/RangeSelector';
import type { ClipChangeMeta, ClipHandle } from '../src/RangeSelector';
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

/** A pointer event on a target at the given x (see module header re MouseEvent). */
function pointer(target: EventTarget, type: string, clientX: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true }));
}

/** A keydown on the given handle; returns the event so defaultPrevented is checkable. */
function key(target: HTMLElement, code: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: code, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

/** Full down/move/up sequence starting at fromX. */
function dragTo(h: Harness, fromX: number, toX: number): void {
  pointer(h.track, 'pointerdown', fromX);
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
    expect(h.track.querySelector('.sp-clip-track__range')).not.toBeNull();
    expect(h.track.querySelectorAll('.sp-clip-handle')).toHaveLength(2);
    expect(h.start.classList.contains('sp-clip-handle--start')).toBe(true);
    expect(h.end.classList.contains('sp-clip-handle--end')).toBe(true);
  });

  it('gives each handle slider semantics and value attributes', () => {
    const h = setup();
    expect(h.start.getAttribute('role')).toBe('slider');
    expect(h.end.getAttribute('role')).toBe('slider');
    expect(h.start.getAttribute('tabindex')).toBe('0');
    expect(h.end.getAttribute('tabindex')).toBe('0');
    expect(h.start.getAttribute('aria-label')).toBe('Clip start');
    expect(h.end.getAttribute('aria-label')).toBe('Clip end');
    expect(h.start.getAttribute('aria-valuemin')).toBe('0');
    expect(h.start.getAttribute('aria-valuemax')).toBe('600');
    expect(h.start.getAttribute('aria-valuenow')).toBe('100');
    expect(h.end.getAttribute('aria-valuenow')).toBe('130');
    // formatTime at whole-second granularity: 100 -> '1:40', 130 -> '2:10'.
    expect(h.start.getAttribute('aria-valuetext')).toBe('1:40');
    expect(h.end.getAttribute('aria-valuetext')).toBe('2:10');
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
    expect(h.end.getAttribute('aria-valuetext')).toBe('2:11');
  });

  it('Shift+Arrow moves five steps', () => {
    const h = setup();
    key(h.end, 'ArrowRight', true);
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 135 });
    key(h.start, 'ArrowLeft', true);
    expect(changes(h).at(-1)!.selection).toEqual({ start: 95, end: 135 });
  });

  it('Home moves the focused handle to bounds.min and preventDefaults', () => {
    const h = setup();
    const event = key(h.start, 'Home');
    expect(event.defaultPrevented).toBe(true);
    expect(changes(h)[0].selection).toEqual({ start: 0, end: 130 });
    expect(changes(h)[0].meta.clamped).toBe(false);
  });

  it('End moves the focused handle to bounds.max when the limits allow', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 500, step: 1 } });
    const event = key(h.end, 'End');
    expect(event.defaultPrevented).toBe(true);
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 600 });
    expect(changes(h)[0].meta.clamped).toBe(false);
  });

  it('a keyboard move stopped by minDuration clamps, flags and reports the reason', () => {
    const h = setup();
    const event = key(h.start, 'End'); // 600 -> held at end - minDuration = 125
    expect(event.defaultPrevented).toBe(true);
    expect(changes(h)[0].selection).toEqual({ start: 125, end: 130 });
    expect(changes(h)[0].meta.clamped).toBe(true);
    expect(changes(h)[0].meta.clampReason).toBe('min-duration');
    expect(h.start.classList.contains('sp-clip-handle--clamped')).toBe(true);
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
  it('pointerdown picks the nearer handle without moving anything', () => {
    const h = setup();
    pointer(h.start, 'pointerdown', 110); // dist to start 10 < to end 20
    expect(h.onDragStart).toHaveBeenCalledWith('start');
    // Pressing beside a handle must not jump it: no commit until pointermove.
    expect(h.onDragMove).not.toHaveBeenCalled();
    expect(changes(h)).toHaveLength(0);
    pointer(h.track, 'pointerup', 110);
  });

  it('picks the end handle when the pointer is nearer it', () => {
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

  it('drags the end handle: snaps clientX to time, fires move/onChange, releases on up', () => {
    const h = setup();
    pointer(h.track, 'pointerdown', 130); // nearer the end handle
    expect(h.onDragStart).toHaveBeenCalledWith('end');
    expect(h.track.classList.contains('sp-clip-track--dragging')).toBe(true);
    expect(h.end.classList.contains('sp-clip-handle--dragging')).toBe(true);

    pointer(h.track, 'pointermove', 200);
    expect(h.onDragMove).toHaveBeenCalledWith('end', 200);
    expect(changes(h)[0].selection).toEqual({ start: 100, end: 200 });
    expect(changes(h)[0].meta).toEqual({
      handle: 'end',
      source: 'pointer',
      clamped: false,
      clampReason: null,
    });
    expect(h.end.getAttribute('aria-valuenow')).toBe('200');

    pointer(h.track, 'pointerup', 200);
    expect(h.onDragEnd).toHaveBeenCalledWith({ start: 100, end: 200 });
    expect(h.track.classList.contains('sp-clip-track--dragging')).toBe(false);
    expect(h.end.classList.contains('sp-clip-handle--dragging')).toBe(false);
  });

  it('drags the start handle and never moves the end one', () => {
    const h = setup();
    dragTo(h, 60, 80); // time 60 is nearer start (40) than end (70)
    expect(h.onDragStart).toHaveBeenCalledWith('start');
    expect(h.onDragMove).toHaveBeenCalledWith('start', 80);
    expect(h.onDragEnd).toHaveBeenCalledWith({ start: 80, end: 130 });
    expect(h.start.getAttribute('aria-valuenow')).toBe('80');
    expect(h.end.getAttribute('aria-valuenow')).toBe('130');
  });

  it('ignores pointermove and pointerup with no drag in progress', () => {
    const h = setup();
    pointer(h.track, 'pointermove', 300);
    pointer(h.track, 'pointerup', 300);
    expect(h.onDragMove).not.toHaveBeenCalled();
    expect(h.onDragEnd).not.toHaveBeenCalled();
    expect(changes(h)).toHaveLength(0);
  });

  it('pointercancel ends the drag like pointerup', () => {
    const h = setup();
    pointer(h.track, 'pointerdown', 130);
    pointer(h.track, 'pointercancel', 150);
    expect(h.onDragEnd).toHaveBeenCalledTimes(1);
    expect(h.track.classList.contains('sp-clip-track--dragging')).toBe(false);
  });
});

describe('clamp feedback', () => {
  it('a clamped drag adds --clamped, reports max-duration and clears after ~1s', () => {
    vi.useFakeTimers();
    const h = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    pointer(h.track, 'pointerdown', 130); // end handle
    pointer(h.track, 'pointermove', 590); // far past start + maxDuration = 160
    pointer(h.track, 'pointerup', 590);

    expect(changes(h)[0].selection).toEqual({ start: 100, end: 160 });
    expect(changes(h)[0].meta.clamped).toBe(true);
    expect(changes(h)[0].meta.clampReason).toBe('max-duration');
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(false);
  });

  it('keeps reporting clamped on further moves while pinned at the limit', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    pointer(h.track, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 500); // -> end 160 (clamped, changed)
    pointer(h.track, 'pointermove', 590); // still 160: unchanged, but still clamped
    pointer(h.track, 'pointerup', 590);

    const calls = changes(h);
    expect(calls).toHaveLength(2);
    expect(calls[1].selection).toEqual({ start: 100, end: 160 });
    expect(calls[1].meta.clamped).toBe(true);
    // onDragMove is the continuous channel: fired on both moves.
    expect(h.onDragMove).toHaveBeenCalledTimes(2);
  });

  it('reports min-duration when a start drag tries to pass the end handle', () => {
    const h = setup();
    dragTo(h, 100, 128); // start requested 128 -> held at end - minDuration = 125
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
    key(h.end, 'ArrowRight'); // 131 -> held at 160? no: 130+1 <= 160, unclamped
    key(h.end, 'End'); // 600 -> held at 160, clamped, flash armed
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);
    vi.advanceTimersByTime(900);
    key(h.end, 'End'); // clamped again at 900ms -> re-arm
    vi.advanceTimersByTime(900); // 1800ms total, 900 since re-arm: still on
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(false);
  });
});

describe('update()', () => {
  it('re-renders positions and ARIA from a new selection without firing callbacks', () => {
    const h = setup();
    h.selector.update({ start: 250, end: 300 }, BOUNDS);
    expect(h.start.getAttribute('aria-valuenow')).toBe('250');
    expect(h.end.getAttribute('aria-valuenow')).toBe('300');
    expect(h.end.getAttribute('aria-valuetext')).toBe('5:00');
    const range = h.track.querySelector<HTMLElement>('.sp-clip-track__range')!;
    expect(parseFloat(range.style.left)).toBeCloseTo((250 / 600) * 100, 4);
    expect(parseFloat(range.style.width)).toBeCloseTo((50 / 600) * 100, 4);
    expect(h.onChange).not.toHaveBeenCalled();
  });

  it('re-spans the track when bounds change (host configure / Phase 2 DVR hook)', () => {
    const h = setup();
    h.selector.update({ start: 250, end: 300 }, { min: 0, max: 1200 });
    expect(h.start.getAttribute('aria-valuemax')).toBe('1200');
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

  it('clears the clamp flash timer', () => {
    vi.useFakeTimers();
    const h = setup({ config: { minDuration: 5, maxDuration: 60, step: 1 } });
    key(h.end, 'End'); // clamped at 160 -> flash armed
    expect(h.end.classList.contains('sp-clip-handle--clamped')).toBe(true);
    h.selector.destroy();
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });
});
