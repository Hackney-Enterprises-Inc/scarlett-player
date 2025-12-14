/**
 * Chromecast Plugin Types
 *
 * Minimal type definitions for Google Cast SDK.
 * These cover the subset of the API we actually use.
 */

import type { Plugin } from '@scarlett-player/core';

// ============================================
// Chrome Cast Media Types (defined first as CastFramework references them)
// ============================================

/** Chrome cast media types */
export namespace ChromeCastMedia {
  export interface MediaInfo {
    contentId: string;
    contentType: string;
    streamType?: string;
    metadata?: object;
  }

  export interface LoadRequest {
    mediaInfo: MediaInfo;
    autoplay: boolean;
    currentTime: number;
  }

  export interface Media {
    getEstimatedTime(): number;
    playerState: string;
  }
}

// ============================================
// Cast Framework Type Definitions
// ============================================

/** Cast framework namespace */
export namespace CastFramework {
  export interface CastContext {
    getInstance(): CastContext;
    setOptions(options: CastOptions): void;
    addEventListener(
      type: CastContextEventType,
      handler: (event: CastStateEventData | SessionStateEventData) => void
    ): void;
    removeEventListener(
      type: CastContextEventType,
      handler: (event: CastStateEventData | SessionStateEventData) => void
    ): void;
    requestSession(): Promise<void>;
    getCurrentSession(): CastSession | null;
    endCurrentSession(stopCasting: boolean): void;
    getCastState(): CastState;
  }

  export interface CastOptions {
    receiverApplicationId: string;
    autoJoinPolicy: string;
  }

  export interface CastSession {
    getSessionId(): string;
    getCastDevice(): CastDevice;
    loadMedia(request: ChromeCastMedia.LoadRequest): Promise<void>;
    endSession(stopCasting: boolean): void;
    getMediaSession(): ChromeCastMedia.Media | null;
  }

  export interface CastDevice {
    friendlyName: string;
    deviceId: string;
  }

  export interface RemotePlayer {
    currentTime: number;
    duration: number;
    isPaused: boolean;
    isMediaLoaded: boolean;
    volumeLevel: number;
    isMuted: boolean;
    playerState: string;
  }

  export interface RemotePlayerController {
    addEventListener(
      type: RemotePlayerEventType,
      handler: (event: RemotePlayerChangedEvent) => void
    ): void;
    removeEventListener(
      type: RemotePlayerEventType,
      handler: (event: RemotePlayerChangedEvent) => void
    ): void;
    playOrPause(): void;
    stop(): void;
    seek(): void;
    setVolumeLevel(): void;
    muteOrUnmute(): void;
  }

  export interface CastStateEventData {
    castState: CastState;
  }

  export interface SessionStateEventData {
    sessionState: SessionState;
    session?: CastSession;
  }

  export interface RemotePlayerChangedEvent {
    field: string;
    value: unknown;
  }

  export enum CastContextEventType {
    CAST_STATE_CHANGED = 'caststatechanged',
    SESSION_STATE_CHANGED = 'sessionstatechanged',
  }

  export enum RemotePlayerEventType {
    ANY_CHANGE = 'anyChanged',
    IS_CONNECTED_CHANGED = 'isConnectedChanged',
    IS_MEDIA_LOADED_CHANGED = 'isMediaLoadedChanged',
    CURRENT_TIME_CHANGED = 'currentTimeChanged',
    DURATION_CHANGED = 'durationChanged',
    IS_PAUSED_CHANGED = 'isPausedChanged',
    VOLUME_LEVEL_CHANGED = 'volumeLevelChanged',
    IS_MUTED_CHANGED = 'isMutedChanged',
  }

  export enum CastState {
    NO_DEVICES_AVAILABLE = 'NO_DEVICES_AVAILABLE',
    NOT_CONNECTED = 'NOT_CONNECTED',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
  }

  export enum SessionState {
    NO_SESSION = 'NO_SESSION',
    SESSION_STARTING = 'SESSION_STARTING',
    SESSION_STARTED = 'SESSION_STARTED',
    SESSION_START_FAILED = 'SESSION_START_FAILED',
    SESSION_ENDING = 'SESSION_ENDING',
    SESSION_ENDED = 'SESSION_ENDED',
    SESSION_RESUMED = 'SESSION_RESUMED',
  }
}

// ============================================
// Global Window Extensions
// ============================================

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework: {
        CastContext: {
          getInstance(): CastFramework.CastContext;
        };
        RemotePlayer: new () => CastFramework.RemotePlayer;
        RemotePlayerController: new (
          player: CastFramework.RemotePlayer
        ) => CastFramework.RemotePlayerController;
        CastContextEventType: typeof CastFramework.CastContextEventType;
        RemotePlayerEventType: typeof CastFramework.RemotePlayerEventType;
        CastState: typeof CastFramework.CastState;
        SessionState: typeof CastFramework.SessionState;
      };
    };
    chrome?: {
      cast: {
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (contentId: string, contentType: string) => ChromeCastMedia.MediaInfo;
          LoadRequest: new (mediaInfo: ChromeCastMedia.MediaInfo) => ChromeCastMedia.LoadRequest;
        };
        AutoJoinPolicy: {
          ORIGIN_SCOPED: string;
          TAB_AND_ORIGIN_SCOPED: string;
          PAGE_SCOPED: string;
        };
      };
    };
  }
}

// ============================================
// Plugin Types
// ============================================

/** Chromecast plugin interface */
export interface IChromecastPlugin extends Plugin {
  readonly id: 'chromecast';

  /** Request a cast session (opens device picker) */
  requestSession(): Promise<void>;

  /** End the current cast session */
  endSession(): void;

  /** Check if Chromecast devices are available */
  isAvailable(): boolean;

  /** Check if currently connected to a Chromecast */
  isConnected(): boolean;

  /** Get the connected device name */
  getDeviceName(): string | null;

  /** Play on cast device */
  play(): void;

  /** Pause on cast device */
  pause(): void;

  /** Seek on cast device */
  seek(time: number): void;

  /** Set volume on cast device (0-1) */
  setVolume(level: number): void;

  /** Mute/unmute cast device */
  setMuted(muted: boolean): void;
}

/** Chromecast error event payload */
export interface ChromecastErrorEvent {
  error: Error;
  code?: string;
}

/** Chromecast connected event payload */
export interface ChromecastConnectedEvent {
  deviceName: string;
}
