/**
 * Types for the Gestures Plugin.
 */

/** Horizontal region of the gesture surface a pointer landed in. */
export type GestureZone = 'left' | 'middle' | 'right';

/**
 * A pointer event reduced to what the recognizer needs.
 *
 * Deliberately not a DOM event: the recognizer is a pure state machine, and
 * every timing rule in it is testable without a browser.
 */
export interface PointerRecord {
  /** What happened. */
  type: 'down' | 'move' | 'up' | 'cancel';
  /** Horizontal position in CSS pixels, for slop measurement. */
  x: number;
  /** Vertical position in CSS pixels, for slop measurement. */
  y: number;
  /** Horizontal position as a fraction of the surface width, for zoning. */
  fraction: number;
  /** Pointer identity, so a second finger can be told apart from a retap. */
  pointerId: number;
  /** Event timestamp in milliseconds. */
  timeStamp: number;
}

/** What the recognizer concluded from a stream of pointer records. */
export type RecognizerEvent =
  | { type: 'tap'; zone: GestureZone }
  | { type: 'double-tap'; zone: GestureZone; count: number }
  | { type: 'accumulate'; zone: GestureZone; count: number }
  | { type: 'cancel' };

/** Recognizer tuning. */
export interface RecognizerOptions {
  /** Milliseconds within which a second tap counts as a double tap. */
  doubleTapWindowMs: number;
  /** Milliseconds within which a further tap extends an active seek sequence. */
  accumulationWindowMs: number;
  /** Fraction of the width belonging to the left zone. */
  leftZone: number;
  /** Fraction of the width belonging to the right zone. */
  rightZone: number;
  /** Movement in CSS pixels that turns a tap into a drag and cancels it. */
  slopPx: number;
}

/** Configuration for the Gestures Plugin. */
export interface GesturesPluginConfig {
  /**
   * Whether gestures are active.
   *
   * `'auto'` enables them when the device reports a coarse pointer, and every
   * individual gesture is additionally checked for `pointerType === 'touch'`,
   * so a touchscreen laptop works with a finger and is untouched by the mouse.
   * Never UA sniffing.
   *
   * @defaultValue 'auto'
   */
  enabled?: boolean | 'auto';

  /**
   * Seconds moved per seek step.
   *
   * @defaultValue 10
   */
  seekSeconds?: number;

  /**
   * Milliseconds within which a second tap counts as a double tap.
   *
   * @defaultValue 275
   */
  doubleTapWindowMs?: number;

  /**
   * Milliseconds within which a further tap extends the current seek.
   *
   * @defaultValue 650
   */
  accumulationWindowMs?: number;

  /**
   * Fractions of the width given to the seek zones. The remainder in the middle
   * is deliberately inert: a mistap in the centre of the picture should do
   * nothing rather than jump the video.
   *
   * @defaultValue \{ left: 0.33, right: 0.33 \}
   */
  zones?: { left?: number; right?: number };

  /**
   * Movement in CSS pixels that cancels a tap.
   *
   * @defaultValue 10
   */
  slopPx?: number;

  /**
   * Show the ripple and seek amount.
   *
   * @defaultValue true
   */
  feedback?: boolean;

  /**
   * Vibrate on each seek step where the platform supports it. Android Chrome
   * does; iOS Safari has no vibration API and silently ignores it.
   *
   * @defaultValue true
   */
  haptics?: boolean;

  /**
   * Let a single tap toggle the controls.
   *
   * @defaultValue true
   */
  tapToToggleControls?: boolean;

  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}
