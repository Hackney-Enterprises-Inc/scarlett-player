/**
 * Scarlett Player Core
 *
 * Lightweight, plugin-based video player with custom reactive signals.
 * @packageDocumentation
 */

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
export { ErrorHandler, ErrorCode, type PlayerError } from './error-handler';

// Re-export PluginManager
export { PluginManager, type PluginManagerOptions } from './plugin-manager';

// Re-export PluginAPI
export { PluginAPI, type PluginAPIDeps } from './plugin-api';

// Re-export ScarlettPlayer
export { ScarlettPlayer, createPlayer, type PlayerOptions, type QualityLevel } from './scarlett-player';

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
  // Event Types
  PlayerEventMap,
  EventName,
  EventPayload,
  EventHandler,
  EventInterceptor,
  EventSubscription,
  EventEmitterOptions,
} from './types/index';
