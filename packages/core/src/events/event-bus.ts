/**
 * EventBus - Type-safe event system for Scarlett Player.
 *
 * Provides pub/sub event communication between player components and plugins
 * with optional interceptors for event modification/cancellation.
 *
 * Target size: ~1KB
 */

import type {
  EventName,
  EventPayload,
  EventHandler,
  EventInterceptor,
  EventEmitterOptions,
} from '../types/events';

/**
 * Default options for EventBus.
 */
const DEFAULT_OPTIONS: Required<EventEmitterOptions> = {
  maxListeners: 100,
  async: false,
  interceptors: true,
};

/**
 * EventBus provides type-safe event emission and subscription.
 *
 * Features:
 * - Type-safe events based on PlayerEventMap
 * - Event interceptors for modification/cancellation
 * - One-time subscriptions with once()
 * - Async event emission
 * - Error handling for handlers
 *
 * @example
 * ```ts
 * const events = new EventBus();
 *
 * // Subscribe to event
 * events.on('playback:play', () => {
 *   console.log('Playing!');
 * });
 *
 * // Emit event
 * events.emit('playback:play', undefined);
 *
 * // Intercept events
 * events.intercept('playback:timeupdate', (payload) => {
 *   // Modify payload or return null to cancel
 *   return { currentTime: Math.floor(payload.currentTime) };
 * });
 * ```
 */
export class EventBus {
  /** Event listeners map */
  private listeners = new Map<EventName, Set<EventHandler<any>>>();

  /** One-time listeners (removed after first call) */
  private onceListeners = new Map<EventName, Set<EventHandler<any>>>();

  /** Event interceptors map */
  private interceptors = new Map<EventName, Set<EventInterceptor<any>>>();

  /** Configuration options */
  private options: Required<EventEmitterOptions>;

  /**
   * Create a new EventBus.
   *
   * @param options - Optional configuration
   */
  constructor(options?: EventEmitterOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Subscribe to an event.
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsub = events.on('playback:play', () => {
   *   console.log('Playing!');
   * });
   *
   * // Later: unsubscribe
   * unsub();
   * ```
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;
    handlers.add(handler);

    // Warn if max listeners exceeded
    this.checkMaxListeners(event);

    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call).
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * events.once('player:ready', () => {
   *   console.log('Player ready!');
   * });
   * ```
   */
  once<T extends EventName>(event: T, handler: EventHandler<T>): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }

    const handlers = this.onceListeners.get(event)!;
    handlers.add(handler);

    // Also track in regular listeners for counting
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    return () => {
      handlers.delete(handler);
    };
  }

  /**
   * Unsubscribe from an event.
   *
   * @param event - Event name
   * @param handler - Event handler function to remove
   *
   * @example
   * ```ts
   * const handler = () => console.log('Playing!');
   * events.on('playback:play', handler);
   * events.off('playback:play', handler);
   * ```
   */
  off<T extends EventName>(event: T, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }

    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      onceHandlers.delete(handler);
      if (onceHandlers.size === 0) {
        this.onceListeners.delete(event);
      }
    }
  }

  /**
   * Emit an event synchronously.
   *
   * Runs interceptors first, then calls all handlers.
   *
   * @param event - Event name
   * @param payload - Event payload
   *
   * @example
   * ```ts
   * events.emit('playback:play', undefined);
   * events.emit('playback:timeupdate', { currentTime: 10.5 });
   * ```
   */
  emit<T extends EventName>(event: T, payload: EventPayload<T>): void {
    // Run interceptors
    const interceptedPayload = this.runInterceptors(event, payload);
    if (interceptedPayload === null) {
      // Event cancelled by interceptor
      return;
    }

    // Call regular handlers
    const handlers = this.listeners.get(event);
    if (handlers) {
      // Create array to avoid calling handlers added during iteration
      const handlersArray = Array.from(handlers);
      handlersArray.forEach(handler => {
        this.safeCallHandler(handler, interceptedPayload);
      });
    }

    // Call once handlers
    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      // Create array to avoid modification during iteration
      const handlersArray = Array.from(onceHandlers);
      handlersArray.forEach(handler => {
        this.safeCallHandler(handler, interceptedPayload);
      });
      // Clear once handlers after calling
      this.onceListeners.delete(event);
    }
  }

  /**
   * Emit an event asynchronously (next tick).
   *
   * @param event - Event name
   * @param payload - Event payload
   * @returns Promise that resolves when all handlers complete
   *
   * @example
   * ```ts
   * await events.emitAsync('media:loaded', { src: 'video.mp4', type: 'video/mp4' });
   * ```
   */
  async emitAsync<T extends EventName>(
    event: T,
    payload: EventPayload<T>
  ): Promise<void> {
    // Run interceptors
    const interceptedPayload = await this.runInterceptorsAsync(event, payload);
    if (interceptedPayload === null) {
      // Event cancelled by interceptor
      return;
    }

    // Call regular handlers
    const handlers = this.listeners.get(event);
    if (handlers) {
      const promises = Array.from(handlers).map(handler =>
        this.safeCallHandlerAsync(handler, interceptedPayload)
      );
      await Promise.all(promises);
    }

    // Call once handlers
    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      const handlersArray = Array.from(onceHandlers);
      const promises = handlersArray.map(handler =>
        this.safeCallHandlerAsync(handler, interceptedPayload)
      );
      await Promise.all(promises);
      // Clear once handlers after calling
      this.onceListeners.delete(event);
    }
  }

  /**
   * Add an event interceptor.
   *
   * Interceptors run before handlers and can modify or cancel events.
   *
   * @param event - Event name
   * @param interceptor - Interceptor function
   * @returns Remove interceptor function
   *
   * @example
   * ```ts
   * events.intercept('playback:timeupdate', (payload) => {
   *   // Round time to 2 decimals
   *   return { currentTime: Math.round(payload.currentTime * 100) / 100 };
   * });
   *
   * // Cancel events
   * events.intercept('playback:play', (payload) => {
   *   if (notReady) return null; // Cancel event
   *   return payload;
   * });
   * ```
   */
  intercept<T extends EventName>(
    event: T,
    interceptor: EventInterceptor<T>
  ): () => void {
    if (!this.options.interceptors) {
      return () => {}; // No-op if interceptors disabled
    }

    if (!this.interceptors.has(event)) {
      this.interceptors.set(event, new Set());
    }

    const interceptorsSet = this.interceptors.get(event)!;
    interceptorsSet.add(interceptor);

    return () => {
      interceptorsSet.delete(interceptor);
      if (interceptorsSet.size === 0) {
        this.interceptors.delete(event);
      }
    };
  }

  /**
   * Remove all listeners for an event (or all events if no event specified).
   *
   * @param event - Optional event name
   *
   * @example
   * ```ts
   * events.removeAllListeners('playback:play'); // Remove all playback:play listeners
   * events.removeAllListeners(); // Remove ALL listeners
   * ```
   */
  removeAllListeners(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event.
   *
   * @param event - Event name
   * @returns Number of listeners
   *
   * @example
   * ```ts
   * events.listenerCount('playback:play'); // 3
   * ```
   */
  listenerCount(event: EventName): number {
    const regularCount = this.listeners.get(event)?.size ?? 0;
    const onceCount = this.onceListeners.get(event)?.size ?? 0;
    return regularCount + onceCount;
  }

  /**
   * Destroy event bus and cleanup all listeners/interceptors.
   *
   * @example
   * ```ts
   * events.destroy();
   * ```
   */
  destroy(): void {
    this.listeners.clear();
    this.onceListeners.clear();
    this.interceptors.clear();
  }

  /**
   * Run interceptors synchronously.
   * @private
   */
  private runInterceptors<T extends EventName>(
    event: T,
    payload: EventPayload<T>
  ): EventPayload<T> | null {
    if (!this.options.interceptors) {
      return payload;
    }

    const interceptorsSet = this.interceptors.get(event);
    if (!interceptorsSet || interceptorsSet.size === 0) {
      return payload;
    }

    let currentPayload: EventPayload<T> | null = payload;

    for (const interceptor of interceptorsSet) {
      try {
        currentPayload = interceptor(currentPayload as any) as EventPayload<T> | null;
        if (currentPayload === null) {
          // Event cancelled
          return null;
        }
      } catch (error) {
        console.error('[EventBus] Error in interceptor:', error);
        // Continue with other interceptors
      }
    }

    return currentPayload;
  }

  /**
   * Run interceptors asynchronously.
   * @private
   */
  private async runInterceptorsAsync<T extends EventName>(
    event: T,
    payload: EventPayload<T>
  ): Promise<EventPayload<T> | null> {
    if (!this.options.interceptors) {
      return payload;
    }

    const interceptorsSet = this.interceptors.get(event);
    if (!interceptorsSet || interceptorsSet.size === 0) {
      return payload;
    }

    let currentPayload: EventPayload<T> | null = payload;

    for (const interceptor of interceptorsSet) {
      try {
        const result = interceptor(currentPayload as any);
        currentPayload = (result instanceof Promise ? await result : result) as EventPayload<T> | null;
        if (currentPayload === null) {
          // Event cancelled
          return null;
        }
      } catch (error) {
        console.error('[EventBus] Error in interceptor:', error);
        // Continue with other interceptors
      }
    }

    return currentPayload;
  }

  /**
   * Safely call a handler with error handling.
   * @private
   */
  private safeCallHandler<T extends EventName>(
    handler: EventHandler<T>,
    payload: EventPayload<T>
  ): void {
    try {
      handler(payload);
    } catch (error) {
      console.error('[EventBus] Error in event handler:', error);
    }
  }

  /**
   * Safely call a handler asynchronously with error handling.
   * @private
   */
  private async safeCallHandlerAsync<T extends EventName>(
    handler: EventHandler<T>,
    payload: EventPayload<T>
  ): Promise<void> {
    try {
      const result = handler(payload);
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error('[EventBus] Error in event handler:', error);
    }
  }

  /**
   * Check if max listeners exceeded and warn.
   * @private
   */
  private checkMaxListeners(event: EventName): void {
    const count = this.listenerCount(event);
    if (count > this.options.maxListeners) {
      console.warn(
        `[EventBus] Max listeners (${this.options.maxListeners}) exceeded for event: ${event}. ` +
        `Current count: ${count}. This may indicate a memory leak.`
      );
    }
  }
}
