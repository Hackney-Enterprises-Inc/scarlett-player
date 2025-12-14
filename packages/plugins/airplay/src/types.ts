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

/** Webkit-specific video element properties */
export interface WebkitVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

/** Webkit playback target availability event */
export interface WebkitPlaybackTargetAvailabilityEvent extends Event {
  availability: 'available' | 'not-available';
}
