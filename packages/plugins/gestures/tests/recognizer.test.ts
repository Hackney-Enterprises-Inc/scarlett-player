/**
 * Recognizer tests.
 *
 * This is where "flawless" is won or lost, so it is tested exhaustively and
 * without a DOM: every rule here is arithmetic on timestamps and positions.
 */

import { describe, it, expect } from 'vitest';
import { createRecognizer, zoneFor, DEFAULT_RECOGNIZER_OPTIONS } from '../src/recognizer';
import type { PointerRecord, RecognizerEvent } from '../src/types';

/** Build a pointer record with sensible defaults. */
function record(
  type: PointerRecord['type'],
  fraction: number,
  timeStamp: number,
  overrides: Partial<PointerRecord> = {}
): PointerRecord {
  return {
    type,
    fraction,
    x: fraction * 1000,
    y: 300,
    pointerId: 1,
    timeStamp,
    ...overrides,
  };
}

/** Tap once: down then up at the same spot. */
function tap(
  recognizer: ReturnType<typeof createRecognizer>,
  fraction: number,
  at: number,
  pointerId = 1
): RecognizerEvent[] {
  recognizer.handle(record('down', fraction, at, { pointerId }));
  return recognizer.handle(record('up', fraction, at + 20, { pointerId }));
}

describe('zoneFor', () => {
  const options = DEFAULT_RECOGNIZER_OPTIONS;

  it('splits the surface into left, middle and right', () => {
    expect(zoneFor(0.1, options)).toBe('left');
    expect(zoneFor(0.5, options)).toBe('middle');
    expect(zoneFor(0.9, options)).toBe('right');
  });

  it('treats the boundaries as belonging to the seek zones', () => {
    expect(zoneFor(0.33, options)).toBe('left');
    expect(zoneFor(0.67, options)).toBe('right');
  });
});

describe('createRecognizer', () => {
  it('reports a single tap', () => {
    const recognizer = createRecognizer();

    expect(tap(recognizer, 0.8, 1000)).toEqual([{ type: 'tap', zone: 'right' }]);
  });

  it('reports a double tap when the second lands inside the window', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    const events = tap(recognizer, 0.8, 1200);

    expect(events).toEqual([{ type: 'double-tap', zone: 'right', count: 1 }]);
  });

  it('does not double tap once the window has passed', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    const events = tap(recognizer, 0.8, 1400);

    expect(events).toEqual([{ type: 'tap', zone: 'right' }]);
  });

  it('does not double tap across different zones', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.1, 1000);
    const events = tap(recognizer, 0.9, 1100);

    expect(events).toEqual([{ type: 'tap', zone: 'right' }]);
  });

  it('accumulates further taps in the same zone', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    tap(recognizer, 0.8, 1200);

    expect(tap(recognizer, 0.8, 1500)).toEqual([{ type: 'accumulate', zone: 'right', count: 2 }]);
    expect(tap(recognizer, 0.8, 1900)).toEqual([{ type: 'accumulate', zone: 'right', count: 3 }]);
  });

  it('keeps accumulating on a longer window than the double-tap window', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    tap(recognizer, 0.8, 1200);

    // 400ms is past the 275ms double-tap window but inside the 650ms run.
    expect(tap(recognizer, 0.8, 1600)).toEqual([{ type: 'accumulate', zone: 'right', count: 2 }]);
  });

  it('ends the run when the accumulation window lapses', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    tap(recognizer, 0.8, 1200);

    expect(tap(recognizer, 0.8, 2000)).toEqual([{ type: 'tap', zone: 'right' }]);
  });

  it('cancels rather than reverses when the other zone is tapped mid-run', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    tap(recognizer, 0.8, 1200);

    // A stray tap on the far side must not rocket the playhead backwards.
    expect(tap(recognizer, 0.1, 1400)).toEqual([{ type: 'cancel' }]);
    expect(recognizer.isAccumulating()).toBe(false);
  });

  it('tolerates a finger drifting slightly across the zone edge mid-run', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.7, 1000);
    tap(recognizer, 0.7, 1200);

    // 0.65 is just inside the middle zone, but the run owns the right zone.
    expect(tap(recognizer, 0.65, 1500)).toEqual([{ type: 'accumulate', zone: 'right', count: 2 }]);
  });

  it('cancels a tap that turned into a drag', () => {
    const recognizer = createRecognizer();

    recognizer.handle(record('down', 0.8, 1000));
    recognizer.handle(record('move', 0.9, 1050, { x: 900 }));

    expect(recognizer.handle(record('up', 0.9, 1100, { x: 900 }))).toEqual([]);
  });

  it('allows movement inside the slop budget', () => {
    const recognizer = createRecognizer();

    recognizer.handle(record('down', 0.8, 1000, { x: 800, y: 300 }));
    recognizer.handle(record('move', 0.8, 1020, { x: 805, y: 302 }));

    expect(recognizer.handle(record('up', 0.8, 1050, { x: 805, y: 302 }))).toEqual([
      { type: 'tap', zone: 'right' },
    ]);
  });

  it('abandons a run when a drag starts mid-sequence', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    tap(recognizer, 0.8, 1200);

    recognizer.handle(record('down', 0.8, 1400, { x: 800 }));
    const events = recognizer.handle(record('move', 0.9, 1420, { x: 900 }));

    expect(events).toEqual([{ type: 'cancel' }]);
    expect(recognizer.isAccumulating()).toBe(false);
  });

  it('treats a second finger as a pinch and abandons everything', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    recognizer.handle(record('down', 0.8, 1100, { pointerId: 1 }));
    const events = recognizer.handle(record('down', 0.4, 1120, { pointerId: 2 }));

    expect(events).toEqual([{ type: 'cancel' }]);
    expect(recognizer.handle(record('up', 0.8, 1200, { pointerId: 1 }))).toEqual([]);
  });

  it('abandons the sequence when the browser cancels the pointer', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    tap(recognizer, 0.8, 1200);

    // Happens when the browser decides the gesture is a page scroll.
    expect(recognizer.handle(record('cancel', 0.8, 1300))).toEqual([{ type: 'cancel' }]);
    expect(recognizer.isAccumulating()).toBe(false);
  });

  it('ignores an up from a pointer it never saw go down', () => {
    const recognizer = createRecognizer();

    expect(recognizer.handle(record('up', 0.8, 1000))).toEqual([]);
  });

  it('ignores moves from a pointer it is not tracking', () => {
    const recognizer = createRecognizer();

    recognizer.handle(record('down', 0.8, 1000, { pointerId: 1 }));

    expect(recognizer.handle(record('move', 0.2, 1020, { pointerId: 7, x: 200 }))).toEqual([]);
  });

  it('reports taps in the inert middle zone without starting a seek', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.5, 1000);
    const events = tap(recognizer, 0.5, 1150);

    // A double tap in the middle is still recognised, but the zone is 'middle'
    // and the plugin does not seek on it.
    expect(events).toEqual([{ type: 'double-tap', zone: 'middle', count: 1 }]);
  });

  it('expires a stale first tap on tick', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    recognizer.tick(2000);

    expect(tap(recognizer, 0.8, 2010)).toEqual([{ type: 'tap', zone: 'right' }]);
  });

  it('ends a stale run on tick', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    tap(recognizer, 0.8, 1200);
    recognizer.tick(3000);

    expect(recognizer.isAccumulating()).toBe(false);
  });

  it('drops everything on reset', () => {
    const recognizer = createRecognizer();

    tap(recognizer, 0.8, 1000);
    tap(recognizer, 0.8, 1200);
    recognizer.reset();

    expect(recognizer.isAccumulating()).toBe(false);
    expect(tap(recognizer, 0.8, 1300)).toEqual([{ type: 'tap', zone: 'right' }]);
  });

  it('honours custom zone widths', () => {
    const recognizer = createRecognizer({ leftZone: 0.5, rightZone: 0.5 });

    expect(tap(recognizer, 0.45, 1000)).toEqual([{ type: 'tap', zone: 'left' }]);
  });

  it('honours a custom double-tap window', () => {
    const recognizer = createRecognizer({ doubleTapWindowMs: 500 });

    tap(recognizer, 0.8, 1000);

    expect(tap(recognizer, 0.8, 1400)).toEqual([{ type: 'double-tap', zone: 'right', count: 1 }]);
  });
});
