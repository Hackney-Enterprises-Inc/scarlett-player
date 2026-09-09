/**
 * Exact timestamp parsing and formatting for the clip editor.
 *
 * Handles alone cannot express a precise endpoint: on a two hour source a 300px
 * rail puts every second inside 0.04px, so a thirty second selection is about a
 * pixel and a quarter wide. The "Fine tune" fields are how a viewer asks for an
 * exact time, and this module is the whole of their grammar - so that what the
 * field accepts, what the readout prints, and what the tests pin are one thing.
 *
 * Accepted input, leading and trailing whitespace ignored:
 *
 * - `93`, `93.5`      - plain seconds
 * - `1:33`, `1:33.5`  - `mm:ss`
 * - `0:01:33.500`     - `hh:mm:ss`
 *
 * Rejected: anything else, including negatives, `Infinity`, `NaN`, empty
 * strings, minutes or seconds at 60 or above in a colon form, and a colon form
 * with more than three parts. A rejected value returns null and the caller
 * leaves the selection exactly where it was.
 */

/**
 * `mm:ss[.fff]` or `hh:mm:ss[.fff]`, anchored.
 *
 * Minutes and seconds are two digits at most and below 60; hours are free. The
 * fraction is any number of digits - `Number()` handles the rounding, and a
 * viewer who types six of them means the same thing as three.
 */
const CLOCK = /^(?:(\d+):)?([0-5]?\d):([0-5]?\d)(\.\d+)?$/;

/** Plain seconds, with an optional fraction: `93`, `93.5`, `.5`. */
const SECONDS = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * Parse a viewer-entered timestamp into media seconds.
 *
 * Deliberately strict: this runs on a field the viewer commits with Enter or
 * blur, and silently reinterpreting `1:70` as 130 seconds would move an
 * endpoint the viewer did not ask for.
 *
 * @param raw - The field's text
 * @returns Time in seconds, or null when the text is not a timestamp
 *
 * @example
 * ```ts
 * parseTimestamp('1:33.5'); // 93.5
 * parseTimestamp('1:70');   // null
 * parseTimestamp('-4');     // null
 * ```
 */
export function parseTimestamp(raw: string): number | null {
  const text = raw.trim();
  if (text === '') return null;

  if (SECONDS.test(text)) {
    const value = Number(text);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const match = CLOCK.exec(text);
  if (!match) return null;

  const [, hours, minutes, seconds, fraction] = match;
  const value =
    Number(hours ?? 0) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(fraction ?? 0);

  return Number.isFinite(value) ? value : null;
}

/**
 * Format a time for an editable field: the shortest clock form that is exact.
 *
 * Zero-padded so the value round-trips through {@link parseTimestamp}, and
 * carrying a fraction only when the snapping granularity can produce one - a
 * whole-second editor shows `1:33`, a quarter-second editor shows `1:33.25`.
 *
 * @param time - Time in media seconds
 * @param step - Snap granularity in seconds; fractions are shown when below 1
 * @returns The formatted timestamp
 *
 * @example
 * ```ts
 * formatTimestamp(93.5, 0.5);  // '1:33.5'
 * formatTimestamp(3693, 1);    // '1:01:33'
 * ```
 */
export function formatTimestamp(time: number, step = 1): string {
  if (!Number.isFinite(time) || time < 0) return formatTimestamp(0, step);

  const decimals = fractionDigits(step);
  const total = Number(time.toFixed(decimals));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const wholeSeconds = Math.floor(seconds);
  const fraction =
    decimals > 0
      ? (seconds - wholeSeconds).toFixed(decimals).slice(1).replace(/0+$/, '').replace(/\.$/, '')
      : '';

  const body = `${pad(minutes, hours > 0)}:${pad(wholeSeconds, true)}${fraction}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

/**
 * Format a duration in seconds for the readout (`35s`, `35.5s`).
 *
 * @param seconds - Length in seconds
 * @param step - Snap granularity; decides how many decimals are meaningful
 * @returns The formatted length, without a unit
 */
export function formatLength(seconds: number, step = 1): string {
  const decimals = fractionDigits(step);
  const value = Math.max(0, seconds);
  if (decimals === 0) return String(Math.round(value));
  return Number(value.toFixed(decimals)).toString();
}

/**
 * How many decimal places a step warrants.
 *
 * @param step - Snap granularity in seconds
 * @returns 0 for whole-second steps, else up to 3
 */
export function fractionDigits(step: number): number {
  if (!Number.isFinite(step) || step <= 0 || step >= 1) return 0;

  // 0.5 -> 1, 0.25 -> 2, 0.001 -> 3. Derived by asking which power of ten
  // makes the step whole rather than by counting characters in String(step):
  // a small enough step formats exponentially ('1e-7'), which has no decimal
  // point at all and so counted as zero decimals - the one input where the
  // character count gave a confidently wrong answer instead of a capped one.
  for (let digits = 1; digits < 3; digits += 1) {
    if (Number.isInteger(Number((step * 10 ** digits).toFixed(6)))) return digits;
  }

  // Anything finer than a millisecond is beyond what a media element seeks to.
  return 3;
}

/**
 * @internal Two-digit pad, applied only where a leading zero is meaningful.
 *
 * @param value - The number to pad
 * @param always - Pad even when the value is a single digit
 * @returns The padded string
 */
function pad(value: number, always: boolean): string {
  return always && value < 10 ? `0${value}` : String(value);
}
