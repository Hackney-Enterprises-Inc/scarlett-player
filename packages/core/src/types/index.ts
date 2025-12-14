/**
 * Scarlett Player Type Definitions
 *
 * Central export for all TypeScript types and interfaces.
 */

// Plugin Types
export type {
  Plugin,
  PluginType,
  PluginState,
  PluginConfig,
  PluginFactory,
  PluginDescriptor,
  IPluginAPI,
} from './plugin';

// State Types
export type {
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
  QualityLevel,
  SeekableRange,
} from './state';

// Event Types
export type {
  PlayerEventMap,
  EventName,
  EventPayload,
  EventHandler,
  EventInterceptor,
  EventSubscription,
  EventBus,
  EventEmitterOptions,
} from './events';
