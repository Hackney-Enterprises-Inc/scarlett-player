/**
 * The player's keyboard shortcuts, as one list.
 *
 * This module is the single source of truth the help dialog renders. The
 * dialog lists only what `handleKeyDown` in `index.ts` actually acts on, so
 * a shortcut added to the handler without a row here is invisible to viewers,
 * and a row here without a handler is a lie to them. The keyboard-help suite
 * pins the exact list so neither can drift silently.
 *
 * @packageDocumentation
 */

/**
 * One row of the keyboard help dialog.
 */
export interface ShortcutEntry {
  /** Keys as shown to the viewer, e.g. `Space / K`. */
  keys: string;
  /** What pressing them does. */
  action: string;
  /**
   * The condition the action depends on, shown under the list. Only
   * conditional actions carry one: an unconditional shortcut needs no
   * footnote.
   */
  note?: string;
}

/**
 * Every shortcut the player-wide keydown handler implements, in display
 * order.
 *
 * Home and End are listed with a note rather than left out: they live on the
 * progress bar's focused slider, not the player-wide handler, and a viewer
 * who reads help deserves to know they exist and where they work. No J/L/P
 * seeking is advertised; the old Sprint 3 plan proposed it but nothing
 * implements it.
 */
export const SHORTCUTS: readonly ShortcutEntry[] = [
  { keys: 'Space / K', action: 'Play / pause' },
  { keys: 'Left / Right arrow', action: 'Seek 5 seconds back / forward' },
  { keys: 'Up / Down arrow', action: 'Volume up / down' },
  { keys: 'M', action: 'Toggle mute' },
  { keys: 'F', action: 'Toggle fullscreen' },
  {
    keys: 'C',
    action: 'Toggle captions',
    note: 'Needs caption tracks. Turns the current track off, or enables the first available one.',
  },
  {
    keys: '0-9',
    action: 'Seek to 0-90% of the video',
    note: 'On a live stream with DVR, seeks to the same share of the seekable window; on live without DVR, digits do nothing.',
  },
  { keys: '?', action: 'Show this help' },
  {
    keys: 'Home / End',
    action: 'Jump to the start / end',
    note: 'Only while the progress bar is focused - they are progress-slider shortcuts, not player-wide ones.',
  },
];
