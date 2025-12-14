/**
 * ScarlettPlayer - Main player class integrating all core systems.
 *
 * Provides the public API for video playback, plugin management,
 * state access, and event handling.
 *
 * Target size: ~1-1.5KB
 */

import { EventBus } from './events/event-bus';
import { StateManager } from './state/state-manager';
import { Logger } from './logger';
import { ErrorHandler, ErrorCode } from './error-handler';
import { PluginManager } from './plugin-manager';
import type { Plugin } from './types/plugin';
import type { EventName, EventHandler as EventHandlerFn } from './types/events';
import type { StateStore } from './types/state';

/**
 * Player configuration options.
 */
export interface PlayerOptions {
  /** HTML container element or CSS selector */
  container: HTMLElement | string;
  /** Initial source URL */
  src?: string;
  /** Poster image URL */
  poster?: string;
  /** Initial log level (default: 'warn') */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Autoplay (default: false) */
  autoplay?: boolean;
  /** Loop playback (default: false) */
  loop?: boolean;
  /** Initial volume 0-1 (default: 1.0) */
  volume?: number;
  /** Start muted (default: false) */
  muted?: boolean;
  /** Plugins to register on initialization */
  plugins?: Plugin[];
}

/**
 * Quality level interface for proxy methods.
 */
export interface QualityLevel {
  index: number;
  width: number;
  height: number;
  bitrate: number;
  label: string;
}

/**
 * ScarlettPlayer - Lightweight, plugin-based video player.
 *
 * Features:
 * - Plugin-based architecture
 * - Reactive state management
 * - Type-safe event system
 * - Automatic provider selection
 * - Live/DVR support (TSP)
 * - Chapter/marker support (TSP)
 *
 * @example
 * ```ts
 * const player = new ScarlettPlayer({
 *   container: document.getElementById('player'),
 *   plugins: [hlsPlugin, controlsPlugin],
 * });
 *
 * // Load and play
 * await player.load('video.m3u8');
 * player.play();
 *
 * // Listen to events
 * player.on('playback:play', () => {
 *   console.log('Playing!');
 * });
 *
 * // Access state
 * console.log(player.playing, player.currentTime);
 *
 * // Cleanup
 * player.destroy();
 * ```
 */
export class ScarlettPlayer {
  /** Player container element */
  readonly container: HTMLElement;

  /** Event bus */
  private eventBus: EventBus;

  /** State manager */
  private stateManager: StateManager;

  /** Logger */
  private logger: Logger;

  /** Error handler */
  private errorHandler: ErrorHandler;

  /** Plugin manager */
  private pluginManager: PluginManager;

  /** Current media provider plugin */
  private _currentProvider: Plugin | null = null;

  /** Player destroyed flag */
  private destroyed = false;

  /** Seeking while playing flag */
  private seekingWhilePlaying = false;

  /** Seek resume timeout */
  private seekResumeTimeout: number | null = null;

  /** Initial source URL */
  private initialSrc?: string;

  /**
   * Create a new ScarlettPlayer.
   *
   * @param options - Player configuration
   */
  constructor(options: PlayerOptions) {
    // Resolve container (string selector or HTMLElement)
    if (typeof options.container === 'string') {
      const el = document.querySelector(options.container);
      if (!el || !(el instanceof HTMLElement)) {
        throw new Error(`ScarlettPlayer: container not found: ${options.container}`);
      }
      this.container = el;
    } else if (options.container instanceof HTMLElement) {
      this.container = options.container;
    } else {
      throw new Error('ScarlettPlayer requires a valid HTMLElement container or CSS selector');
    }

    // Store initial source
    this.initialSrc = options.src;

    // Initialize core systems
    this.eventBus = new EventBus();
    this.stateManager = new StateManager({
      autoplay: options.autoplay ?? false,
      loop: options.loop ?? false,
      volume: options.volume ?? 1.0,
      muted: options.muted ?? false,
    });
    this.logger = new Logger({
      level: options.logLevel ?? 'warn',
      scope: 'ScarlettPlayer',
    });
    this.errorHandler = new ErrorHandler(this.eventBus, this.logger);
    this.pluginManager = new PluginManager(
      this.eventBus,
      this.stateManager,
      this.logger,
      { container: this.container }
    );

    // Register plugins if provided
    if (options.plugins) {
      for (const plugin of options.plugins) {
        this.pluginManager.register(plugin);
      }
    }

    this.logger.info('ScarlettPlayer initialized', {
      autoplay: options.autoplay,
      plugins: options.plugins?.length ?? 0,
    });

    // Emit ready event after initialization
    this.eventBus.emit('player:ready', undefined);
  }

  /**
   * Initialize the player asynchronously.
   * Initializes non-provider plugins and loads initial source if provided.
   */
  async init(): Promise<void> {
    this.checkDestroyed();

    // Initialize non-provider plugins (UI, feature, analytics, utility)
    // Providers are initialized on-demand when load() is called
    for (const [id, record] of (this.pluginManager as any).plugins) {
      if (record.plugin.type !== 'provider' && record.state === 'registered') {
        await this.pluginManager.initPlugin(id);
      }
    }

    // Load initial source if provided
    if (this.initialSrc) {
      await this.load(this.initialSrc);
    }

    return Promise.resolve();
  }

  /**
   * Load a media source.
   *
   * Selects appropriate provider plugin and loads the source.
   *
   * @param source - Media source URL
   * @returns Promise that resolves when source is loaded
   *
   * @example
   * ```ts
   * await player.load('video.m3u8');
   * ```
   */
  async load(source: string): Promise<void> {
    this.checkDestroyed();

    try {
      this.logger.info('Loading source', { source });

      // Destroy previous provider if switching
      if (this._currentProvider) {
        const previousProviderId = this._currentProvider.id;
        this.logger.info('Destroying previous provider', { provider: previousProviderId });
        await this.pluginManager.destroyPlugin(previousProviderId);
        this._currentProvider = null;
      }

      // Select provider FIRST (before init)
      const provider = this.pluginManager.selectProvider(source);
      if (!provider) {
        this.errorHandler.throw(
          ErrorCode.PROVIDER_NOT_FOUND,
          `No provider found for source: ${source}`,
          {
            fatal: true,
            context: { source },
          }
        );
        return;
      }

      this._currentProvider = provider;
      this.logger.info('Provider selected', { provider: provider.id });

      // Init ONLY the selected provider (not all plugins)
      await this.pluginManager.initPlugin(provider.id);

      // Update state
      this.stateManager.set('source', { src: source, type: this.detectMimeType(source) });

      // Call provider's loadSource method and wait for it to complete
      // The provider will emit media:loaded when actually ready
      if (typeof (provider as any).loadSource === 'function') {
        await (provider as any).loadSource(source);
      }

      // Auto-play if enabled
      if (this.stateManager.getValue('autoplay')) {
        await this.play();
      }
    } catch (error) {
      this.errorHandler.handle(error as Error, {
        operation: 'load',
        source,
      });
    }
  }

  /**
   * Start playback.
   *
   * @returns Promise that resolves when playback starts
   *
   * @example
   * ```ts
   * await player.play();
   * ```
   */
  async play(): Promise<void> {
    this.checkDestroyed();

    try {
      this.logger.debug('Play requested');

      // Update state
      this.stateManager.update({
        playing: true,
        paused: false,
        playbackState: 'playing',
      });

      // Emit play event
      this.eventBus.emit('playback:play', undefined);
    } catch (error) {
      this.errorHandler.handle(error as Error, { operation: 'play' });
    }
  }

  /**
   * Pause playback.
   *
   * @example
   * ```ts
   * player.pause();
   * ```
   */
  pause(): void {
    this.checkDestroyed();

    try {
      this.logger.debug('Pause requested');

      // Clear seeking while playing flag (user explicitly paused)
      this.seekingWhilePlaying = false;
      if (this.seekResumeTimeout !== null) {
        clearTimeout(this.seekResumeTimeout);
        this.seekResumeTimeout = null;
      }

      // Update state
      this.stateManager.update({
        playing: false,
        paused: true,
        playbackState: 'paused',
      });

      // Emit pause event
      this.eventBus.emit('playback:pause', undefined);
    } catch (error) {
      this.errorHandler.handle(error as Error, { operation: 'pause' });
    }
  }

  /**
   * Seek to a specific time.
   *
   * @param time - Time in seconds
   *
   * @example
   * ```ts
   * player.seek(30); // Seek to 30 seconds
   * ```
   */
  seek(time: number): void {
    this.checkDestroyed();

    try {
      this.logger.debug('Seek requested', { time });

      // Remember if we were playing before seeking
      const wasPlaying = this.stateManager.getValue('playing');

      if (wasPlaying) {
        this.seekingWhilePlaying = true;
      }

      // Clear any existing resume timeout
      if (this.seekResumeTimeout !== null) {
        clearTimeout(this.seekResumeTimeout);
        this.seekResumeTimeout = null;
      }

      // Emit seeking event
      this.eventBus.emit('playback:seeking', { time });

      // Update state
      this.stateManager.set('currentTime', time);

      // If we were playing, set up a debounced resume
      // This handles multiple rapid seeks gracefully
      if (this.seekingWhilePlaying) {
        this.seekResumeTimeout = setTimeout(() => {
          if (this.seekingWhilePlaying && this.stateManager.getValue('playing')) {
            this.logger.debug('Resuming playback after seek');
            this.seekingWhilePlaying = false;
            this.eventBus.emit('playback:play', undefined);
          }
          this.seekResumeTimeout = null;
        }, 300) as unknown as number; // 300ms debounce for rapid seeks
      }
    } catch (error) {
      this.errorHandler.handle(error as Error, { operation: 'seek', time });
    }
  }

  /**
   * Set volume.
   *
   * @param volume - Volume 0-1
   *
   * @example
   * ```ts
   * player.setVolume(0.5); // 50% volume
   * ```
   */
  setVolume(volume: number): void {
    this.checkDestroyed();

    const clampedVolume = Math.max(0, Math.min(1, volume));

    this.stateManager.set('volume', clampedVolume);
    this.eventBus.emit('volume:change', {
      volume: clampedVolume,
      muted: this.stateManager.getValue('muted'),
    });
  }

  /**
   * Set muted state.
   *
   * @param muted - Mute flag
   *
   * @example
   * ```ts
   * player.setMuted(true);
   * ```
   */
  setMuted(muted: boolean): void {
    this.checkDestroyed();

    this.stateManager.set('muted', muted);
    this.eventBus.emit('volume:mute', { muted });
  }

  /**
   * Set playback rate.
   *
   * @param rate - Playback rate (e.g., 1.0 = normal, 2.0 = 2x speed)
   *
   * @example
   * ```ts
   * player.setPlaybackRate(1.5); // 1.5x speed
   * ```
   */
  setPlaybackRate(rate: number): void {
    this.checkDestroyed();

    this.stateManager.set('playbackRate', rate);
    this.eventBus.emit('playback:ratechange', { rate });
  }

  /**
   * Subscribe to an event.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsub = player.on('playback:play', () => {
   *   console.log('Playing!');
   * });
   *
   * // Later: unsubscribe
   * unsub();
   * ```
   */
  on<T extends EventName>(event: T, handler: EventHandlerFn<T>): () => void {
    this.checkDestroyed();
    return this.eventBus.on(event, handler);
  }

  /**
   * Subscribe to an event once.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * player.once('player:ready', () => {
   *   console.log('Player ready!');
   * });
   * ```
   */
  once<T extends EventName>(event: T, handler: EventHandlerFn<T>): () => void {
    this.checkDestroyed();
    return this.eventBus.once(event, handler);
  }

  /**
   * Get a plugin by name.
   *
   * @param name - Plugin name
   * @returns Plugin instance or null
   *
   * @example
   * ```ts
   * const hls = player.getPlugin('hls-plugin');
   * ```
   */
  getPlugin<T extends Plugin>(name: string): T | null {
    this.checkDestroyed();
    return this.pluginManager.getPlugin<T>(name);
  }

  /**
   * Register a plugin.
   *
   * @param plugin - Plugin to register
   *
   * @example
   * ```ts
   * player.registerPlugin(myPlugin);
   * ```
   */
  registerPlugin(plugin: Plugin): void {
    this.checkDestroyed();
    this.pluginManager.register(plugin);
  }

  /**
   * Get current state snapshot.
   *
   * @returns Readonly state snapshot
   *
   * @example
   * ```ts
   * const state = player.getState();
   * console.log(state.playing, state.currentTime);
   * ```
   */
  getState(): Readonly<StateStore> {
    this.checkDestroyed();
    return this.stateManager.snapshot();
  }

  // ===== Quality Methods (proxied to provider) =====

  /**
   * Get available quality levels from the current provider.
   * @returns Array of quality levels or empty array if not available
   */
  getQualities(): QualityLevel[] {
    this.checkDestroyed();
    if (!this._currentProvider) return [];

    const provider = this._currentProvider as any;
    if (typeof provider.getLevels === 'function') {
      return provider.getLevels();
    }
    return [];
  }

  /**
   * Set quality level (-1 for auto).
   * @param index - Quality level index
   */
  setQuality(index: number): void {
    this.checkDestroyed();
    if (!this._currentProvider) {
      this.logger.warn('No provider available for quality change');
      return;
    }

    const provider = this._currentProvider as any;
    if (typeof provider.setLevel === 'function') {
      provider.setLevel(index);
      this.eventBus.emit('quality:change', {
        quality: index === -1 ? 'auto' : `level-${index}`,
        auto: index === -1,
      });
    }
  }

  /**
   * Get current quality level index (-1 = auto).
   */
  getCurrentQuality(): number {
    this.checkDestroyed();
    if (!this._currentProvider) return -1;

    const provider = this._currentProvider as any;
    if (typeof provider.getCurrentLevel === 'function') {
      return provider.getCurrentLevel();
    }
    return -1;
  }

  // ===== Fullscreen Methods =====

  /**
   * Request fullscreen mode.
   */
  async requestFullscreen(): Promise<void> {
    this.checkDestroyed();

    try {
      if (this.container.requestFullscreen) {
        await this.container.requestFullscreen();
      } else if ((this.container as any).webkitRequestFullscreen) {
        await (this.container as any).webkitRequestFullscreen();
      }
      this.stateManager.set('fullscreen', true);
      this.eventBus.emit('fullscreen:change', { fullscreen: true });
    } catch (error) {
      this.logger.error('Fullscreen request failed', { error });
    }
  }

  /**
   * Exit fullscreen mode.
   */
  async exitFullscreen(): Promise<void> {
    this.checkDestroyed();

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      }
      this.stateManager.set('fullscreen', false);
      this.eventBus.emit('fullscreen:change', { fullscreen: false });
    } catch (error) {
      this.logger.error('Exit fullscreen failed', { error });
    }
  }

  /**
   * Toggle fullscreen mode.
   */
  async toggleFullscreen(): Promise<void> {
    if (this.fullscreen) {
      await this.exitFullscreen();
    } else {
      await this.requestFullscreen();
    }
  }

  // ===== Casting Methods (proxied to plugins) =====

  /**
   * Request AirPlay (proxied to airplay plugin).
   */
  requestAirPlay(): void {
    this.checkDestroyed();
    const airplay = this.pluginManager.getPlugin('airplay');
    if (airplay && typeof (airplay as any).showPicker === 'function') {
      (airplay as any).showPicker();
    } else {
      this.logger.warn('AirPlay plugin not available');
    }
  }

  /**
   * Request Chromecast session (proxied to chromecast plugin).
   */
  async requestChromecast(): Promise<void> {
    this.checkDestroyed();
    const chromecast = this.pluginManager.getPlugin('chromecast');
    if (chromecast && typeof (chromecast as any).requestSession === 'function') {
      await (chromecast as any).requestSession();
    } else {
      this.logger.warn('Chromecast plugin not available');
    }
  }

  /**
   * Stop casting (AirPlay or Chromecast).
   */
  stopCasting(): void {
    this.checkDestroyed();

    const airplay = this.pluginManager.getPlugin('airplay');
    if (airplay && typeof (airplay as any).stop === 'function') {
      (airplay as any).stop();
    }

    const chromecast = this.pluginManager.getPlugin('chromecast');
    if (chromecast && typeof (chromecast as any).stopSession === 'function') {
      (chromecast as any).stopSession();
    }
  }

  // ===== Live Stream Methods =====

  /**
   * Seek to live edge (for live streams).
   */
  seekToLive(): void {
    this.checkDestroyed();

    // Check if stream is live
    const isLive = this.stateManager.getValue('live');
    if (!isLive) {
      this.logger.warn('Not a live stream');
      return;
    }

    // Try provider's getLiveInfo for live sync position
    if (this._currentProvider) {
      const provider = this._currentProvider as any;
      if (typeof provider.getLiveInfo === 'function') {
        const liveInfo = provider.getLiveInfo();
        if (liveInfo?.liveSyncPosition !== undefined) {
          this.seek(liveInfo.liveSyncPosition);
          return;
        }
      }
    }

    // Fallback: seek to duration (edge)
    const duration = this.stateManager.getValue('duration');
    if (duration > 0) {
      this.seek(duration);
    }
  }

  /**
   * Destroy the player and cleanup all resources.
   *
   * @example
   * ```ts
   * player.destroy();
   * ```
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.logger.info('Destroying player');

    // Clear any pending seek resume timeout
    if (this.seekResumeTimeout !== null) {
      clearTimeout(this.seekResumeTimeout);
      this.seekResumeTimeout = null;
    }

    // Emit destroy event
    this.eventBus.emit('player:destroy', undefined);

    // Destroy plugins
    this.pluginManager.destroyAll();

    // Cleanup core systems
    this.eventBus.destroy();
    this.stateManager.destroy();

    this.destroyed = true;
    this.logger.info('Player destroyed');
  }

  // ===== State Getters =====

  /**
   * Get playing state.
   */
  get playing(): boolean {
    return this.stateManager.getValue('playing');
  }

  /**
   * Get paused state.
   */
  get paused(): boolean {
    return this.stateManager.getValue('paused');
  }

  /**
   * Get current time in seconds.
   */
  get currentTime(): number {
    return this.stateManager.getValue('currentTime');
  }

  /**
   * Get duration in seconds.
   */
  get duration(): number {
    return this.stateManager.getValue('duration');
  }

  /**
   * Get volume (0-1).
   */
  get volume(): number {
    return this.stateManager.getValue('volume');
  }

  /**
   * Get muted state.
   */
  get muted(): boolean {
    return this.stateManager.getValue('muted');
  }

  /**
   * Get playback rate.
   */
  get playbackRate(): number {
    return this.stateManager.getValue('playbackRate');
  }

  /**
   * Get buffered amount (0-1).
   */
  get bufferedAmount(): number {
    return this.stateManager.getValue('bufferedAmount');
  }

  /**
   * Get current provider plugin.
   */
  get currentProvider(): Plugin | null {
    return this._currentProvider;
  }

  /**
   * Get fullscreen state.
   */
  get fullscreen(): boolean {
    return this.stateManager.getValue('fullscreen');
  }

  /**
   * Get live stream state.
   */
  get live(): boolean {
    return this.stateManager.getValue('live');
  }

  /**
   * Check if player is destroyed.
   * @private
   */
  private checkDestroyed(): void {
    if (this.destroyed) {
      throw new Error('Cannot call methods on destroyed player');
    }
  }

  /**
   * Detect MIME type from source URL.
   * @private
   */
  private detectMimeType(source: string): string {
    const ext = source.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'm3u8':
        return 'application/x-mpegURL';
      case 'mpd':
        return 'application/dash+xml';
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'ogg':
        return 'video/ogg';
      default:
        return 'video/mp4'; // Default fallback
    }
  }
}

/**
 * Create a ScarlettPlayer instance and initialize it.
 *
 * Convenience factory function that creates and initializes
 * the player in a single async call.
 *
 * @param options - Player configuration
 * @returns Promise resolving to initialized player
 *
 * @example
 * ```ts
 * const player = await createPlayer({
 *   container: '#player',
 *   src: 'video.m3u8',
 *   plugins: [hlsPlugin()],
 * });
 *
 * player.play();
 * ```
 */
export async function createPlayer(options: PlayerOptions): Promise<ScarlettPlayer> {
  const player = new ScarlettPlayer(options);
  await player.init();
  return player;
}
