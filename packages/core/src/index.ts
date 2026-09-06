/**
 * Scarlett Player Core
 *
 * Lightweight, plugin-based video player with custom reactive signals.
 * @packageDocumentation
 */

/**
 * Version of @scarlett-player/core this build was produced from.
 *
 * Exported so a host application can report the running player version instead
 * of defining its own constant and letting it drift. tsp-web currently tags
 * Sentry with a `__SCARLETT_VERSION__` define of its own (checked 2026-09-02);
 * this is the value it should read instead.
 *
 * It is '0.0.0-dev' when core is bundled from source without the build-time
 * define. See src/version.ts.
 */
export { PKG_VERSION as VERSION } from './version';

// Re-export all state management primitives
export {
  Signal,
  signal,
  Computed,
  computed,
  effect,
  currentEffect,
  setCurrentEffect,
  getCurrentEffect,
  type UnsubscribeFn,
} from './state/index';

// Re-export StateManager
export { StateManager } from './state/state-manager';

// Re-export EventBus
export { EventBus } from './events/event-bus';

// Re-export Logger
export { Logger, createLogger, type LogLevel, type LogEntry, type LogHandler } from './logger';

// Re-export ErrorHandler
export {
  ErrorHandler,
  ErrorCode,
  type PlayerError,
  type PlayerErrorDetail,
} from './error-handler';

// Re-export PluginManager
export { PluginManager, type PluginManagerOptions } from './plugin-manager';

// Re-export PluginAPI
export { PluginAPI, type PluginAPIDeps } from './plugin-api';

// Re-export ScarlettPlayer
export { ScarlettPlayer, createPlayer, type PlayerOptions, type QualityLevel } from './scarlett-player';

// Re-export the fullscreen helpers. Runtime exports, not just types: the UI
// package's fullscreen button and its 'f' shortcut go through these so that
// every way into fullscreen behaves the same, the iPhone fallback included.
export { enterFullscreen, exitFullscreen, isFullscreen } from './fullscreen';

// Re-export URL sanitizer for telemetry-safe logging across packages
export { sanitizeUrl } from './utils/url';

// Re-export all type definitions
export type {
  // Plugin Types
  Plugin,
  PluginType,
  PluginState,
  PluginConfig,
  PluginFactory,
  PluginDescriptor,
  IPluginAPI,
  // State Types
  StateStore,
  CoreStateStore,
  StateKey,
  StateValue,
  StateUpdate,
  StateChangeEvent,
  IStateManager,
  PlaybackState,
  MediaType,
  MediaSource,
  Chapter,
  TextTrack,
  AudioTrack,
  SeekableRange,
  ThumbnailConfig,
  // Event Types
  PlayerEventMap,
  EventName,
  EventPayload,
  EventHandler,
  EventInterceptor,
  EventSubscription,
  EventEmitterOptions,
  // Playlist Track (minimal interface for core events)
  PlaylistTrack,
} from './types/index';
