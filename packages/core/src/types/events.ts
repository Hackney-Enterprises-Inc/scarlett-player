/**
 * Event system type definitions for Scarlett Player.
 *
 * Type-safe event bus for plugin communication and player events.
 */

import type { StateChangeEvent } from './state';
import type { Chapter } from './state';
import type { PlayerError } from '../error-handler';

/**
 * Core player events.
 */
export interface PlayerEventMap {
  // === Lifecycle Events ===
  /** Player is ready (initialized) */
  'player:ready': void;

  /** Player is being destroyed */
  'player:destroy': void;

  // === Playback Events ===
  /** Playback started */
  'playback:play': void;

  /** Playback paused */
  'playback:pause': void;

  /** Playback ended */
  'playback:ended': void;

  /** Playback time updated */
  'playback:timeupdate': { currentTime: number };

  /** Seeking started */
  'playback:seeking': { time: number };

  /** Seeking completed */
  'playback:seeked': { time: number };

  /** Playback rate changed */
  'playback:ratechange': { rate: number };

  // === Media Events ===
  /** Media source loaded */
  'media:loaded': { src: string; type: string };

  /** Media metadata loaded (duration, dimensions, etc.) */
  'media:loadedmetadata': { duration: number };

  /** Media can play (buffered enough) */
  'media:canplay': void;

  /** Media can play through without buffering */
  'media:canplaythrough': void;

  /** Media is buffering/loading */
  'media:waiting': void;

  /** Media progress (buffering) */
  'media:progress': { buffered: number };

  /** Media error occurred */
  'media:error': { error: Error };

  // === Volume Events ===
  /** Volume changed */
  'volume:change': { volume: number; muted: boolean };

  /** Mute toggled */
  'volume:mute': { muted: boolean };

  // === Quality Events ===
  /** Quality level changed */
  'quality:change': { quality: string; auto: boolean };

  /** Available qualities updated */
  'quality:levels': { levels: Array<{ id: string; label: string }> };

  /** User selected a quality level */
  'quality:select': { quality: string; auto?: boolean };

  // === Track Events ===
  /** Text track (subtitle/caption) changed */
  'track:text': { trackId: string | null };

  /** Audio track changed */
  'track:audio': { trackId: string | null };

  // === Fullscreen Events ===
  /** Entered fullscreen */
  'fullscreen:enter': void;

  /** Exited fullscreen */
  'fullscreen:exit': void;

  /** Fullscreen changed */
  'fullscreen:change': { fullscreen: boolean };

  // === Picture-in-Picture Events ===
  /** Entered PiP */
  'pip:enter': void;

  /** Exited PiP */
  'pip:exit': void;

  /** PiP changed */
  'pip:change': { pip: boolean };

  // === Casting Events ===
  /** AirPlay devices available */
  'airplay:available': void;

  /** AirPlay devices not available */
  'airplay:unavailable': void;

  /** AirPlay connected */
  'airplay:connected': void;

  /** AirPlay disconnected */
  'airplay:disconnected': void;

  /** Chromecast available */
  'chromecast:available': void;

  /** Chromecast unavailable */
  'chromecast:unavailable': void;

  /** Chromecast connected */
  'chromecast:connected': { deviceName: string };

  /** Chromecast disconnected */
  'chromecast:disconnected': void;

  /** Chromecast error */
  'chromecast:error': { error: Error };

  // === Live/DVR Events (NEW for TSP) ===
  /** Live edge state changed */
  'live:edgechange': { atEdge: boolean };

  /** Live latency updated */
  'live:latency': { latency: number };

  /** Seekable range updated (DVR window) */
  'live:seekablerange': { start: number; end: number };

  /** Low-latency mode toggled */
  'live:lowlatency': { enabled: boolean };

  // === Chapter Events (NEW for TSP) ===
  /** Chapter changed (based on playback time) */
  'chapter:change': { chapter: Chapter | null; previous: Chapter | null };

  /** Chapters loaded/updated */
  'chapter:loaded': { chapters: Chapter[] };

  /** User clicked/selected a chapter */
  'chapter:select': { chapter: Chapter };

  // === Control Events ===
  /** Controls shown */
  'controls:show': void;

  /** Controls hidden */
  'controls:hide': void;

  /** Controls visibility changed */
  'controls:change': { visible: boolean };

  // === UI Events ===
  /** User started interacting */
  'ui:interact:start': void;

  /** User stopped interacting */
  'ui:interact:end': void;

  /** Mouse entered player */
  'ui:mouseenter': void;

  /** Mouse left player */
  'ui:mouseleave': void;

  /** Player gained focus */
  'ui:focus': void;

  /** Player lost focus */
  'ui:blur': void;

  // === State Events ===
  /** Any state changed */
  'state:change': StateChangeEvent;

  // === Plugin Events ===
  /** Plugin registered */
  'plugin:registered': { name: string; type: string };

  /** Plugin activated */
  'plugin:active': { name: string };

  /** Plugin destroyed */
  'plugin:destroyed': { name: string };

  /** Plugin error */
  'plugin:error': { name: string; error: Error };

  // === Error Events ===
  /** General error occurred */
  'error': PlayerError;

  /** Network error */
  'error:network': { error: Error };

  /** Media error (decode, format, etc.) */
  'error:media': { error: Error };

  /** Plugin error */
  'error:plugin': { error: Error; plugin: string };
}

/**
 * Event names (type-safe).
 */
export type EventName = keyof PlayerEventMap;

/**
 * Event payload for a specific event name.
 */
export type EventPayload<T extends EventName> = PlayerEventMap[T];

/**
 * Event handler function signature.
 */
export type EventHandler<T extends EventName = EventName> = (
  payload: EventPayload<T>
) => void | Promise<void>;

/**
 * Event interceptor function signature.
 * Can modify payload or cancel event propagation.
 */
export type EventInterceptor<T extends EventName = EventName> = (
  payload: EventPayload<T>
) => EventPayload<T> | null | Promise<EventPayload<T> | null>;

/**
 * Event subscription interface.
 */
export interface EventSubscription {
  /** Unsubscribe from event */
  unsubscribe(): void;
}

/**
 * Event bus interface.
 */
export interface EventBus {
  /**
   * Subscribe to an event.
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): () => void;

  /**
   * Subscribe to an event once (auto-unsubscribe after first call).
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  once<T extends EventName>(event: T, handler: EventHandler<T>): () => void;

  /**
   * Unsubscribe from an event.
   *
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off<T extends EventName>(event: T, handler: EventHandler<T>): void;

  /**
   * Emit an event.
   *
   * @param event - Event name
   * @param payload - Event payload
   */
  emit<T extends EventName>(event: T, payload: EventPayload<T>): void;

  /**
   * Emit an event asynchronously (next tick).
   *
   * @param event - Event name
   * @param payload - Event payload
   */
  emitAsync<T extends EventName>(event: T, payload: EventPayload<T>): Promise<void>;

  /**
   * Add an event interceptor.
   * Interceptors run before handlers and can modify/cancel events.
   *
   * @param event - Event name
   * @param interceptor - Interceptor function
   * @returns Remove interceptor function
   */
  intercept<T extends EventName>(event: T, interceptor: EventInterceptor<T>): () => void;

  /**
   * Remove all listeners for an event (or all events if no event specified).
   *
   * @param event - Optional event name
   */
  removeAllListeners(event?: EventName): void;

  /**
   * Get listener count for an event.
   *
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: EventName): number;

  /**
   * Destroy event bus and cleanup all listeners.
   */
  destroy(): void;
}

/**
 * Event emitter options.
 */
export interface EventEmitterOptions {
  /** Maximum listeners per event (default: 100) */
  maxListeners?: number;

  /** Enable async event emission (default: false) */
  async?: boolean;

  /** Enable event interceptors (default: true) */
  interceptors?: boolean;
}
