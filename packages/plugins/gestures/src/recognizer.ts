/**
 * Gesture recognizer.
 *
 * A pure state machine. No DOM, no timers, no player: it consumes reduced
 * pointer records and returns what they mean. Every timing and tolerance rule
 * lives here so all of them are testable with plain numbers.
 *
 * The machine has three resting points:
 *
 * - idle: nothing in flight
 * - awaiting-second: one tap landed, a second within the double-tap window
 *   would make it a seek
 * - accumulating: a seek is under way, and each further tap in the same zone
 *   extends it, which is the behaviour every major player now shares
 */

import type { GestureZone, PointerRecord, RecognizerEvent, RecognizerOptions } from './types';

/** Fraction of the width a tap may stray past a zone edge and still count as that zone. */
const ZONE_HYSTERESIS = 0.05;

export const DEFAULT_RECOGNIZER_OPTIONS: RecognizerOptions = {
  doubleTapWindowMs: 275,
  accumulationWindowMs: 650,
  leftZone: 0.33,
  rightZone: 0.33,
  slopPx: 10,
};

interface PendingPointer {
  pointerId: number;
  x: number;
  y: number;
  fraction: number;
  timeStamp: number;
  /** Set when the pointer moved past the slop budget, or a second finger arrived. */
  invalid: boolean;
}

/** The recognizer's public surface. */
export interface Recognizer {
  /** Feed one pointer record. Returns everything it concluded, in order. */
  handle(record: PointerRecord): RecognizerEvent[];
  /**
   * Advance time without a pointer event, so expiry is observable.
   *
   * @param now - Current time in milliseconds
   */
  tick(now: number): RecognizerEvent[];
  /** Drop all in-flight state, for example when the media source changed. */
  reset(): void;
  /** Whether a seek sequence is currently accumulating. */
  isAccumulating(): boolean;
}

/**
 * Work out which zone a horizontal position belongs to.
 *
 * @param fraction - Position as a fraction of the surface width
 * @param options - Zone sizes
 * @returns The zone
 */
export function zoneFor(fraction: number, options: RecognizerOptions): GestureZone {
  if (fraction <= options.leftZone) return 'left';
  if (fraction >= 1 - options.rightZone) return 'right';
  return 'middle';
}

/**
 * Create a gesture recognizer.
 *
 * @param options - Tuning overrides
 * @returns A recognizer instance
 */
export function createRecognizer(options: Partial<RecognizerOptions> = {}): Recognizer {
  const config: RecognizerOptions = { ...DEFAULT_RECOGNIZER_OPTIONS, ...options };

  let pending: PendingPointer | null = null;
  let lastTapZone: GestureZone | null = null;
  let lastTapAt = 0;
  let accumulatingZone: GestureZone | null = null;
  let accumulatedCount = 0;
  let lastAccumulateAt = 0;
  /** More than one pointer down means a pinch or a two-finger scroll, never a tap. */
  let activePointers = 0;

  const resetSequence = (): void => {
    lastTapZone = null;
    lastTapAt = 0;
    accumulatingZone = null;
    accumulatedCount = 0;
    lastAccumulateAt = 0;
  };

  /**
   * Decide the zone for a tap, allowing a small drift across the boundary while
   * a sequence is running. Fingers wander during a repeated tap, and a stray
   * pixel should not silently reverse the seek direction.
   */
  const resolveZone = (fraction: number): GestureZone => {
    const raw = zoneFor(fraction, config);
    const active = accumulatingZone ?? lastTapZone;

    if (!active || raw === active) return raw;

    if (active === 'left' && fraction <= config.leftZone + ZONE_HYSTERESIS) return 'left';
    if (active === 'right' && fraction >= 1 - config.rightZone - ZONE_HYSTERESIS) return 'right';

    return raw;
  };

  const expire = (now: number): RecognizerEvent[] => {
    if (accumulatingZone && now - lastAccumulateAt > config.accumulationWindowMs) {
      resetSequence();
    } else if (!accumulatingZone && lastTapZone && now - lastTapAt > config.doubleTapWindowMs) {
      lastTapZone = null;
      lastTapAt = 0;
    }

    return [];
  };

  return {
    handle(record: PointerRecord): RecognizerEvent[] {
      const events: RecognizerEvent[] = [];

      switch (record.type) {
        case 'down': {
          activePointers += 1;

          if (activePointers > 1) {
            // A second finger means the viewer is pinching or scrolling.
            if (pending) pending.invalid = true;
            if (accumulatingZone || lastTapZone) {
              resetSequence();
              events.push({ type: 'cancel' });
            }
            return events;
          }

          expire(record.timeStamp);

          pending = {
            pointerId: record.pointerId,
            x: record.x,
            y: record.y,
            fraction: record.fraction,
            timeStamp: record.timeStamp,
            invalid: false,
          };

          return events;
        }

        case 'move': {
          if (!pending || pending.pointerId !== record.pointerId || pending.invalid) {
            return events;
          }

          const dx = record.x - pending.x;
          const dy = record.y - pending.y;

          if (Math.hypot(dx, dy) > config.slopPx) {
            // The viewer is dragging, not tapping. Abandon the whole sequence:
            // a drag mid-accumulation is a deliberate change of intent.
            pending.invalid = true;
            if (accumulatingZone || lastTapZone) {
              resetSequence();
              events.push({ type: 'cancel' });
            }
          }

          return events;
        }

        case 'up': {
          activePointers = Math.max(0, activePointers - 1);

          const candidate = pending;
          pending = null;

          if (!candidate || candidate.pointerId !== record.pointerId || candidate.invalid) {
            return events;
          }

          expire(record.timeStamp);

          const zone = resolveZone(record.fraction);

          if (accumulatingZone) {
            if (zone === accumulatingZone) {
              accumulatedCount += 1;
              lastAccumulateAt = record.timeStamp;
              events.push({ type: 'accumulate', zone, count: accumulatedCount });
            } else {
              // A tap in the other zone ends the run rather than reversing it,
              // so a misfire never rockets the playhead the other way.
              resetSequence();
              events.push({ type: 'cancel' });
            }

            return events;
          }

          if (
            lastTapZone &&
            zone === lastTapZone &&
            record.timeStamp - lastTapAt <= config.doubleTapWindowMs
          ) {
            accumulatingZone = zone;
            accumulatedCount = 1;
            lastAccumulateAt = record.timeStamp;
            lastTapZone = null;
            lastTapAt = 0;
            events.push({ type: 'double-tap', zone, count: 1 });

            return events;
          }

          lastTapZone = zone;
          lastTapAt = record.timeStamp;
          events.push({ type: 'tap', zone });

          return events;
        }

        case 'cancel': {
          // The browser took the gesture, usually to scroll the page.
          activePointers = Math.max(0, activePointers - 1);
          pending = null;

          if (accumulatingZone || lastTapZone) {
            resetSequence();
            events.push({ type: 'cancel' });
          }

          return events;
        }

        default:
          return events;
      }
    },

    tick(now: number): RecognizerEvent[] {
      return expire(now);
    },

    reset(): void {
      pending = null;
      activePointers = 0;
      resetSequence();
    },

    isAccumulating(): boolean {
      return accumulatingZone !== null;
    },
  };
}
