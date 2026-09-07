/**
 * AirPlay Plugin Types
 */

import type { Plugin } from '@scarlett-player/core';

/** AirPlay plugin interface */
export interface IAirPlayPlugin extends Plugin {
  readonly id: 'airplay';

  /** Show the AirPlay device picker (Safari only) */
  showPicker(): void;

  /** Check if AirPlay is available (Safari + devices found) */
  isAvailable(): boolean;

  /** Check if currently casting via AirPlay */
  isActive(): boolean;

  /** Stop AirPlay casting */
  stop(): void;
}

/** AirPlay availability event */
export interface AirPlayAvailabilityEvent {
  available: boolean;
}

/** AirPlay connection event */
export interface AirPlayConnectionEvent {
  connected: boolean;
}

/**
 * The slice of the Remote Playback API this plugin uses.
 *
 * Read off the element through a cast rather than declared on
 * {@link WebkitVideoElement}: lib.dom types `remote` as a non-optional
 * `RemotePlayback`, so re-declaring it optional makes the interface an illegal
 * extension of HTMLVideoElement, while the property is genuinely absent in
 * browsers that do not implement the API.
 */
export interface RemotePlaybackLike {
  /** Start watching device availability; resolves with the callback id. */
  watchAvailability(callback: (available: boolean) => void): Promise<number>;
  /** Stop a watch started by {@link watchAvailability}. */
  cancelWatchAvailability(id?: number): Promise<void>;
}

/** Webkit-specific video element properties */
export interface WebkitVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

/** Webkit playback target availability event */
export interface WebkitPlaybackTargetAvailabilityEvent extends Event {
  availability: 'available' | 'not-available';
}
