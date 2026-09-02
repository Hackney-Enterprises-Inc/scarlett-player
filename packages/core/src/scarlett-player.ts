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
  /**
   * Poster image URL, shown until the first frame renders.
   *
   * Seeds the `poster` state key, which the provider plugins mirror onto the
   * media element. Change it later with `setPoster()`; `load()` deliberately
   * leaves it alone.
   */
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
  id: string;
  label: string;
  width: number;
  height: number;
  bitrate: number;
  active: boolean;
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
 * // createPlayer() constructs and initialises in one call; it is the
 * // documented entry point for every consumer.
 * const player = await createPlayer({
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

  /** Counter to detect stale load() calls */
  private loadGeneration = 0;

  /** True once the lifecycle listeners have been wired (they are wired once) */
  private listenersWired = false;

  /** True once `player:ready` has been emitted (it is emitted once) */
  private readyEmitted = false;

  /**
   * In-flight initialisation pass, shared by concurrent callers.
   *
   * `load()` is called from inside the `media:load-request` handler, so a
   * second initialisation pass can start while the first is still awaiting a
   * plugin's `init()`. Without this, `PluginManager.initPlugin()` would see
   * the plugin in the `initializing` state and throw "possible circular
   * dependency". Cleared when the pass settles so a plugin registered later
   * is still picked up by the next call.
   */
  private initializing: Promise<void> | null = null;

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
      poster: options.poster ?? '',
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

    // Keep the `error` state key in sync with error events so consumers can
    // read `player.getState().error` (and the UI can render structured codes).
    // Cleared again whenever a source loads successfully.
    this.eventBus.on('error', (err) => {
      this.stateManager.set('error', err);
    });
    this.eventBus.on('media:loaded', () => {
      this.stateManager.set('error', null);
    });

    // Media element errors are advisory: the provider's own recovery path
    // decides whether they become fatal. Record them for diagnostics
    // without flipping the error state the retry flow checks.
    this.eventBus.on('media:error', ({ error }) => {
      this.errorHandler.record(error, { channel: 'media:error' });
    });

    // Register plugins if provided
    if (options.plugins) {
      for (const plugin of options.plugins) {
        this.pluginManager.register(plugin);
      }
    }

    this.logger.info('ScarlettPlayer constructed', {
      autoplay: options.autoplay,
      plugins: options.plugins?.length ?? 0,
    });

    // `player:ready` is deliberately NOT emitted here. As the constructor's
    // last statement it fired before any consumer or plugin could subscribe,
    // so nothing could ever observe it (the old core test pinned that by
    // asserting the spy was never called). It now fires at the end of the
    // first initialisation instead: see ensureInitialized().
  }

  /**
   * Initialise every registered non-provider plugin and wire the player's
   * own lifecycle listeners. Idempotent, and safe to call re-entrantly.
   *
   * This exists because `new ScarlettPlayer(...)` followed by `load()` used
   * to leave the player with a provider and nothing else: the READMEs and 12
   * plugin `@example` blocks show exactly that shape, and every one of them
   * produced a dead UI (no controls, no overlay, no playlist). `load()` now
   * calls this first, so the trap cannot be reached.
   *
   * The `media:load-request` and `error:retry` listeners live here rather
   * than in the constructor because they are part of initialisation, not
   * construction: without them the playlist plugin cannot load a track and
   * the error overlay's "Try Again" button does nothing.
   *
   * Provider plugins are excluded: they are initialised lazily, per source,
   * by `load()` once `selectProvider()` has picked one.
   *
   * @returns Promise resolving when the pass (or the in-flight one) completes
   */
  private ensureInitialized(): Promise<void> {
    if (this.initializing) return this.initializing;

    this.initializing = this.runInitialization().finally(() => {
      this.initializing = null;
    });

    return this.initializing;
  }

  /**
   * One initialisation pass. Never call directly; go through
   * `ensureInitialized()`, which owns the re-entrancy guard.
   *
   * @returns Promise resolving when the pass completes
   */
  private async runInitialization(): Promise<void> {
    // Initialize non-provider plugins (UI, feature, analytics, utility).
    // Plugins already in any state other than 'registered' are skipped, so a
    // plugin added through registerPlugin() after start-up is picked up by
    // the next call and the rest are not re-initialised.
    for (const id of this.pluginManager.getPluginIds()) {
      if (this.destroyed) return;

      const plugin = this.pluginManager.getPlugin(id);
      if (!plugin || plugin.type === 'provider') continue;
      if (this.pluginManager.getPluginState(id) !== 'registered') continue;

      await this.pluginManager.initPlugin(id);
    }

    if (this.destroyed) return;

    this.wireLifecycleListeners();

    // Emit ready once, at the end of the FIRST pass, so a listener attached
    // between construction and init()/load() sees it.
    if (!this.readyEmitted) {
      this.readyEmitted = true;
      this.eventBus.emit('player:ready', undefined);
    }
  }

  /**
   * Wire the two listeners the player owns, exactly once.
   *
   * Guarded by a flag rather than by "init() runs once" because
   * `ensureInitialized()` runs on every `load()`: wiring them twice would
   * load and play each requested source twice.
   */
  private wireLifecycleListeners(): void {
    if (this.listenersWired) return;
    this.listenersWired = true;

    // Listen for media:load-request events from plugins (e.g., playlist)
    this.eventBus.on('media:load-request', async ({ src, autoplay }) => {
      // When Chromecast is active, the Chromecast plugin handles loading
      if (this.stateManager.getValue('chromecastActive')) return;

      await this.load(src);

      // Same post-await window as error:retry below: an unawaited async
      // closure calling play() on a destroyed player throws into nothing.
      if (this.destroyed) return;

      if (autoplay !== false) {
        await this.play();
      }
    });

    // Listen for retry requests (e.g., the UI error overlay's "Try Again").
    // Reload through the normal provider path rather than poking the video
    // element directly, then restore where the viewer was: live streams
    // rejoin at the live edge, VOD resumes at the previous position.
    this.eventBus.on('error:retry', async ({ src }) => {
      const was_live = this.stateManager.getValue('live');
      const resume_at = this.stateManager.getValue('currentTime');

      await this.load(src);

      // A destroy() while the retry load was in flight (navigation, SPA
      // unmount, a consumer rebuilding the player) tore the state manager
      // down. This handler is an unawaited async closure, so reading state
      // here would surface as an unhandled rejection rather than a caught
      // error. The pre-await reads above need no guard: eventBus.destroy()
      // clears every listener, so the event cannot fire post-destroy.
      if (this.destroyed) return;

      // load() reports failures through the ErrorHandler rather than throwing;
      // if the retry failed, the error state is set again and there is no
      // provider to seek or play against.
      if (this.stateManager.getValue('error')) return;

      if (was_live) {
        this.seekToLive();
      } else if (resume_at > 0) {
        this.seek(resume_at);
      }

      // seek()/seekToLive() emit into consumer handlers, any of which may
      // tear the player down before play() runs.
      if (this.destroyed) return;
      await this.play();
    });
  }

  /**
   * Initialize the player asynchronously.
   *
   * Initialises non-provider plugins, wires the lifecycle listeners and loads
   * `initialSrc` when one was given. Idempotent: calling it twice, or calling
   * it after a `load()` has already initialised the player, wires nothing a
   * second time and re-emits nothing.
   *
   * @returns Promise resolving when initialisation (and any initial load) is done
   */
  async init(): Promise<void> {
    this.checkDestroyed();

    await this.ensureInitialized();

    // Load initial source if provided
    if (this.initialSrc) {
      await this.load(this.initialSrc);
    }
  }

  /**
   * Load a media source.
   *
   * Initialises the player if that has not happened yet (see
   * `ensureInitialized()`), then selects the provider plugin for the source
   * and loads it. The auto-initialisation is what makes the widely copied
   * `new ScarlettPlayer(...)` plus `load()` shape work: before it, that shape
   * produced a player with a provider and no UI, no error overlay and no
   * working playlist.
   *
   * Resets playback state, and deliberately does NOT touch `poster`. The
   * poster is metadata owned by whoever set it (the consumer through
   * `PlayerOptions.poster` or `setPoster()`, or the playlist plugin on a track
   * change), not playback state, and it is written BEFORE the load that goes
   * with it: clearing it here would blank the image over exactly the gap it
   * exists to cover, while the next source loads.
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

    // Increment generation to invalidate any in-flight load
    const generation = ++this.loadGeneration;

    try {
      this.logger.info('Loading source', { source });

      // Reset playback state when loading new source
      this.stateManager.update({
        playing: false,
        paused: true,
        ended: false,
        buffering: true,
        currentTime: 0,
        duration: 0,
        bufferedAmount: 0,
        playbackState: 'loading',
        error: null,
      });

      // Destroy previous provider if switching
      if (this._currentProvider) {
        const previousProviderId = this._currentProvider.id;
        this.logger.info('Destroying previous provider', { provider: previousProviderId });
        await this.pluginManager.destroyPlugin(previousProviderId);
        this._currentProvider = null;
      }

      // Initialise non-provider plugins and the lifecycle listeners before a
      // provider is chosen, so a consumer that never calls init() still gets
      // a working UI. Idempotent, and re-entrant-safe: the media:load-request
      // handler wired by wireLifecycleListeners() calls load(), so this line
      // runs again while the first pass may still be in flight.
      await this.ensureInitialized();

      // Bail if a newer load() was called while we were awaiting
      if (generation !== this.loadGeneration) {
        this.logger.info('Load superseded by newer load call', { source });
        return;
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

      // Bail if superseded
      if (generation !== this.loadGeneration) {
        this.logger.info('Load superseded by newer load call', { source });
        return;
      }

      // Update state
      this.stateManager.set('source', { src: source, type: this.detectMimeType(source) });

      // Call provider's loadSource method and wait for it to complete
      // The provider will emit media:loaded when actually ready
      if (typeof (provider as any).loadSource === 'function') {
        await (provider as any).loadSource(source);
      }

      // Bail if superseded
      if (generation !== this.loadGeneration) {
        this.logger.info('Load superseded by newer load call', { source });
        return;
      }

      // Auto-play if enabled
      if (this.stateManager.getValue('autoplay')) {
        await this.play();
      }
    } catch (error) {
      // Only handle error if this is still the active load
      if (generation === this.loadGeneration) {
        // Providers that emit structured fatal errors (e.g. the HLS plugin
        // after exhausting recovery) have already reported this failure and
        // populated the error state. Re-classifying the thrown message here
        // would overwrite the specific code with a generic one.
        if (this.stateManager.getValue('error')) {
          this.logger.error('Load failed', {
            source,
            error: (error as Error).message,
          });
        } else {
          this.errorHandler.handle(error as Error, {
            operation: 'load',
            source,
          });
        }
      }
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

      // Emit play event - provider will update state when playback actually starts
      // Don't set playing:true optimistically as it causes state sync issues
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

      // Emit pause event - provider will update state when playback actually pauses
      // Don't set paused:true optimistically as it causes state sync issues
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

    // Clamp to valid range (HTML5 spec supports 0.0625-16, common players use 0.25-16)
    const clampedRate = Math.max(0.0625, Math.min(16, rate));

    this.stateManager.set('playbackRate', clampedRate);
    this.eventBus.emit('playback:ratechange', { rate: clampedRate });
  }

  /**
   * Set autoplay state.
   *
   * When enabled, videos will automatically play after loading.
   *
   * @param autoplay - Autoplay flag
   *
   * @example
   * ```ts
   * player.setAutoplay(true);
   * await player.load('video.mp4'); // Will auto-play
   * ```
   */
  setAutoplay(autoplay: boolean): void {
    this.checkDestroyed();

    this.stateManager.set('autoplay', autoplay);
    this.logger.debug('Autoplay set', { autoplay });
  }

  /**
   * Set the poster image shown until the first frame renders.
   *
   * Writes the `poster` state key; the provider plugins subscribe to it and
   * mirror it onto the media element, so this takes effect on a player that
   * is already running. Before this method existed the poster could only be
   * chosen at construction, which left a playlist showing the previous
   * track's art (and a Vue `poster` prop change doing nothing at all).
   *
   * An empty string clears the poster, which is how a consumer takes the
   * image away rather than replacing it.
   *
   * @param url - Poster image URL, or '' to clear it
   *
   * @example
   * ```ts
   * player.setPoster('https://example.com/art.jpg');
   * player.setPoster(''); // back to the bare video surface
   * ```
   */
  setPoster(url: string): void {
    this.checkDestroyed();

    this.stateManager.set('poster', url);
    this.logger.debug('Poster set', { poster: url });
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
   * // player:ready fires once, at the end of the first initialisation, so a
   * // one-shot listener has to be attached before init() or load() runs.
   * const player = new ScarlettPlayer({ container });
   * player.once('player:ready', () => {
   *   console.log('Player ready!');
   * });
   * await player.init();
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
      // Validate index: -1 for auto, or within available quality levels
      if (index !== -1) {
        const levels = this.getQualities();
        if (levels.length > 0 && (index < 0 || index >= levels.length)) {
          this.logger.warn(`Invalid quality index: ${index} (available: ${levels.length})`);
          return;
        }
      }
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

    // Cancel every in-flight load through the mechanism load() already
    // trusts. Its post-await "bail if superseded" checks guard the reads
    // that would otherwise walk into a torn-down state manager, but
    // destroy() did not participate in the generation counter, so a destroy
    // mid-load left the generation matching and the continuation ran on.
    this.loadGeneration++;

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
   * Get autoplay state.
   */
  get autoplay(): boolean {
    return this.stateManager.getValue('autoplay');
  }

  /**
   * Get the current poster URL ('' when there is none).
   *
   * Reads state rather than the media element: the element only exists once a
   * provider has been initialised, and for an audio source it never carries
   * the attribute at all.
   */
  get poster(): string {
    return this.stateManager.getValue('poster');
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
    // Strip query params, fragments, and blob: prefix before parsing extension
    let path = source;
    try {
      path = new URL(source).pathname;
    } catch {
      // Not a valid URL - strip query/fragment manually
      const noQuery = source.split('?')[0] ?? source;
      path = noQuery.split('#')[0] ?? noQuery;
    }
    const ext = path.split('.').pop()?.toLowerCase() ?? '';

    switch (ext) {
      case 'm3u8':
        return 'application/x-mpegURL';
      case 'mpd':
        return 'application/dash+xml';
      case 'mp4':
      case 'm4v':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'ogg':
      case 'ogv':
        return 'video/ogg';
      case 'mov':
        return 'video/quicktime';
      case 'mkv':
        return 'video/x-matroska';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'flac':
        return 'audio/flac';
      case 'aac':
      case 'm4a':
        return 'audio/mp4';
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
