# Scarlett Player - Architecture Design

**Version**: 1.0.0-alpha
**Last Updated**: October 10, 2025

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Scarlett Player                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              User Application Code                     │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────────┐ │
│  │          Framework Adapter (Optional)                  │ │
│  │        @scarlett-player/react | vue                    │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────────┐ │
│  │                  Core Player                           │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │           Plugin Manager                         │  │ │
│  │  │  ┌────────────────────────────────────────────┐  │  │ │
│  │  │  │  Registered Plugins                        │  │  │ │
│  │  │  │                                            │  │  │ │
│  │  │  │  [Provider] [UI] [Feature] [Analytics]    │  │  │ │
│  │  │  └────────────────────────────────────────────┘  │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │              Event Bus                           │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │            State Manager                         │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │             Plugin API                           │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. ScarlettPlayer (Main Class)

The main entry point that orchestrates all components.

```typescript
class ScarlettPlayer {
  private pluginManager: PluginManager;
  private eventBus: EventBus;
  private stateManager: StateManager;
  private container: HTMLElement;
  private mediaElement: HTMLVideoElement | null = null;

  constructor(
    container: string | HTMLElement,
    options: PlayerOptions
  ) {
    this.container = this.resolveContainer(container);
    this.pluginManager = new PluginManager(this);
    this.eventBus = new EventBus();
    this.stateManager = new StateManager();

    this.initialize(options);
  }

  private initialize(options: PlayerOptions): void {
    // 1. Register plugins
    options.plugins?.forEach(plugin => {
      this.pluginManager.register(plugin);
    });

    // 2. Setup plugins
    this.pluginManager.setupAll();

    // 3. Load initial source if provided
    if (options.src) {
      this.loadSource(options.src);
    }
  }

  // Public API
  loadSource(src: string | SourceObject): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(time: number): void;
  destroy(): void;

  // Plugin API access
  getPluginAPI(): PluginAPI;
}
```

### 2. PluginManager

Manages plugin lifecycle and orchestration.

```typescript
class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private player: ScarlettPlayer;
  private setupQueue: Plugin[] = [];

  register(plugin: Plugin): void {
    const instance: PluginInstance = {
      plugin,
      state: 'registered',
      api: null
    };

    this.plugins.set(plugin.name, instance);
  }

  setupAll(): void {
    for (const [name, instance] of this.plugins) {
      this.setupPlugin(name, instance);
    }
  }

  private setupPlugin(name: string, instance: PluginInstance): void {
    try {
      instance.state = 'setting-up';

      // Create plugin-specific API
      const api = this.createPluginAPI(name);
      instance.api = api;

      // Call plugin setup
      instance.plugin.setup(api);

      instance.state = 'active';
    } catch (error) {
      instance.state = 'error';
      instance.error = error;
      console.error(`Plugin ${name} failed to setup:`, error);
    }
  }

  get<T = Plugin>(name: string): T | null {
    const instance = this.plugins.get(name);
    return instance ? (instance.plugin as T) : null;
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  destroyAll(): void {
    for (const [name, instance] of this.plugins) {
      try {
        instance.plugin.destroy?.();
        instance.state = 'destroyed';
      } catch (error) {
        console.error(`Plugin ${name} cleanup error:`, error);
      }
    }
    this.plugins.clear();
  }
}
```

### 3. EventBus

Central event system for player-plugin and plugin-plugin communication.

```typescript
class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private interceptors: Map<string, EventInterceptor[]> = new Map();

  on(event: string, handler: EventHandler): UnsubscribeFn {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, data?: any): void {
    // Run interceptors first
    const interceptors = this.interceptors.get(event) || [];
    let eventData = data;

    for (const interceptor of interceptors) {
      const result = interceptor(eventData);
      if (result === false) return; // Cancel event
      if (result !== undefined) eventData = result; // Transform data
    }

    // Emit to listeners
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(eventData);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  once(event: string, handler: EventHandler): UnsubscribeFn {
    const wrappedHandler = (data: any) => {
      handler(data);
      this.off(event, wrappedHandler);
    };
    return this.on(event, wrappedHandler);
  }

  intercept(event: string, interceptor: EventInterceptor): void {
    if (!this.interceptors.has(event)) {
      this.interceptors.set(event, []);
    }
    this.interceptors.get(event)!.push(interceptor);
  }

  clear(): void {
    this.listeners.clear();
    this.interceptors.clear();
  }
}
```

### 4. StateManager

Reactive state management using custom signals (~2KB).

```typescript
// Custom Signal Implementation
class Signal<T> {
  private value: T;
  private subscribers = new Set<() => void>();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  get(): T {
    // Track dependency if in effect context
    if (currentEffect) {
      this.subscribers.add(currentEffect);
    }
    return this.value;
  }

  set(newValue: T): void {
    if (this.value === newValue) return;
    this.value = newValue;
    this.notify();
  }

  private notify(): void {
    this.subscribers.forEach(effect => {
      try {
        effect();
      } catch (error) {
        console.error('Error in signal effect:', error);
      }
    });
  }

  subscribe(callback: () => void): UnsubscribeFn {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

// Computed signals
class Computed<T> {
  private value: T | undefined;
  private dirty = true;
  private subscribers = new Set<() => void>();
  private computation: () => T;

  constructor(computation: () => T) {
    this.computation = computation;
  }

  get(): T {
    if (this.dirty) {
      this.value = this.computation();
      this.dirty = false;
    }
    if (currentEffect) {
      this.subscribers.add(currentEffect);
    }
    return this.value!;
  }

  invalidate(): void {
    this.dirty = true;
    this.subscribers.forEach(effect => effect());
  }
}

// Effect tracking
let currentEffect: (() => void) | null = null;

function effect(fn: () => void): UnsubscribeFn {
  const execute = () => {
    currentEffect = execute;
    try {
      fn();
    } finally {
      currentEffect = null;
    }
  };

  execute(); // Run immediately

  return () => {
    // Cleanup logic
  };
}

// StateManager using Signals
class StateManager {
  private signals: Map<string, Signal<any>> = new Map();

  constructor() {
    this.initializeSignals();
  }

  private initializeSignals(): void {
    // Create signals for each state property
    this.signal('playing', false);
    this.signal('paused', true);
    this.signal('ended', false);
    this.signal('waiting', false);
    this.signal('seeking', false);

    this.signal('currentTime', 0);
    this.signal('duration', 0);
    this.signal('buffered', []);

    this.signal('volume', 1);
    this.signal('muted', false);

    this.signal('src', null);
    this.signal('currentSrc', null);

    this.signal('mediaType', null);
    this.signal('streamType', null);

    this.signal('canPlay', false);
    this.signal('canSeek', false);
    this.signal('canSetVolume', true);

    this.signal('fullscreen', false);
    this.signal('pictureInPicture', false);

    this.signal('provider', null);
    this.signal('providerType', null);

    // Live/DVR state
    this.signal('live', false);              // Is live stream
    this.signal('liveEdge', true);           // At live edge or in DVR
    this.signal('seekableRange', null);      // DVR window { start, end }
    this.signal('liveLatency', 0);           // Seconds behind live edge
    this.signal('lowLatencyMode', false);    // LL-HLS/LL-DASH mode

    // Chapters/Markers
    this.signal('chapters', []);             // Chapter markers
    this.signal('currentChapter', null);     // Active chapter
  }

  private signal<T>(key: string, initialValue: T): void {
    this.signals.set(key, new Signal(initialValue));
  }

  get<T>(key: string): T {
    return this.signals.get(key)?.get();
  }

  set<T>(key: string, value: T): void {
    this.signals.get(key)?.set(value);
  }

  subscribe(key: string, callback: () => void): UnsubscribeFn {
    return this.signals.get(key)?.subscribe(callback) || (() => {});
  }

  // Computed state example
  computed<T>(computation: () => T): Computed<T> {
    return new Computed(computation);
  }
}
```

### 5. PluginAPI

The API surface exposed to plugins.

```typescript
class PluginAPIImpl implements PluginAPI {
  private player: ScarlettPlayer;
  private pluginName: string;
  private eventBus: EventBus;
  private stateManager: StateManager;

  constructor(
    player: ScarlettPlayer,
    pluginName: string,
    eventBus: EventBus,
    stateManager: StateManager
  ) {
    this.player = player;
    this.pluginName = pluginName;
    this.eventBus = eventBus;
    this.stateManager = stateManager;
  }

  // Player control
  play(): Promise<void> {
    return this.player.play();
  }

  pause(): Promise<void> {
    return this.player.pause();
  }

  seek(time: number): void {
    this.player.seek(time);
  }

  setVolume(volume: number): void {
    this.player.setVolume(volume);
  }

  setMuted(muted: boolean): void {
    this.player.setMuted(muted);
  }

  // State access
  getState<K extends keyof StateStore>(key?: K): any {
    return key ? this.stateManager.get(key) : this.stateManager.getAll();
  }

  setState<K extends keyof StateStore>(key: K, value: StateStore[K]): void {
    this.stateManager.set(key, value);
  }

  subscribe<K extends keyof StateStore>(
    key: K,
    callback: StateSubscriber<StateStore[K]>
  ): UnsubscribeFn {
    return this.stateManager.subscribe(key, callback);
  }

  // Events
  on(event: string, handler: EventHandler): UnsubscribeFn {
    return this.eventBus.on(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.eventBus.off(event, handler);
  }

  once(event: string, handler: EventHandler): UnsubscribeFn {
    return this.eventBus.once(event, handler);
  }

  emit(event: string, data?: any): void {
    this.eventBus.emit(event, data);
  }

  intercept(event: string, interceptor: EventInterceptor): void {
    this.eventBus.intercept(event, interceptor);
  }

  // Plugin communication
  getPlugin<T = Plugin>(name: string): T | null {
    return this.player.getPluginManager().get<T>(name);
  }

  hasPlugin(name: string): boolean {
    return this.player.getPluginManager().has(name);
  }

  // DOM access
  getContainer(): HTMLElement {
    return this.player.getContainer();
  }

  getMediaElement(): HTMLMediaElement | null {
    return this.player.getMediaElement();
  }

  createMediaElement(type: 'video' | 'audio'): HTMLMediaElement {
    const element = document.createElement(type);
    this.player.setMediaElement(element);
    this.getContainer().appendChild(element);
    return element;
  }

  // Utility
  logger(): Logger {
    return this.player.getLogger().child(this.pluginName);
  }
}
```

## Plugin Interface

### Base Plugin Interface

```typescript
interface Plugin {
  // Required
  readonly name: string;
  readonly version: string;
  readonly type: PluginType;

  // Lifecycle
  setup(api: PluginAPI): void;
  destroy?(): void;
}

type PluginType =
  | 'provider'      // Media playback (HLS, DASH, native, etc.)
  | 'ui'            // User interface components
  | 'feature'       // Features (fullscreen, PiP, etc.)
  | 'analytics'     // Analytics and tracking
  | 'utility';      // Utility plugins

```

### Provider Plugin Interface

```typescript
interface ProviderPlugin extends Plugin {
  type: 'provider';

  // Provider-specific
  canHandle(src: string | SourceObject): boolean;
  loadSource(src: SourceObject, api: PluginAPI): Promise<void>;

  // Playback control
  play?(api: PluginAPI): Promise<void>;
  pause?(api: PluginAPI): Promise<void>;
  seek?(time: number, api: PluginAPI): void;
  setVolume?(volume: number, api: PluginAPI): void;
  setMuted?(muted: boolean, api: PluginAPI): void;
  setPlaybackRate?(rate: number, api: PluginAPI): void;

  // Capabilities
  readonly capabilities?: ProviderCapabilities;
}

interface ProviderCapabilities {
  canSeek: boolean;
  canSetVolume: boolean;
  canSetPlaybackRate: boolean;
  canChangeQuality: boolean;
  supportsFullscreen: boolean;
  supportsPictureInPicture: boolean;
  supportsTextTracks: boolean;
}
```

### UI Plugin Interface

```typescript
interface UIPlugin extends Plugin {
  type: 'ui';

  // UI-specific
  render?(container: HTMLElement, api: PluginAPI): void;
  update?(api: PluginAPI): void;
  hide?(): void;
  show?(): void;
}
```

## Standard Events

### Playback Events
```typescript
'play'              // Playback started
'pause'             // Playback paused
'ended'             // Playback ended
'seeking'           // Seeking started
'seeked'            // Seeking completed
'waiting'           // Buffering
'playing'           // Playback resumed after buffering
'timeupdate'        // Current time changed
'durationchange'    // Duration changed
'volumechange'      // Volume or muted changed
'ratechange'        // Playback rate changed
```

### Loading Events
```typescript
'loadstart'         // Source loading started
'loadedmetadata'    // Metadata loaded
'loadeddata'        // First frame loaded
'canplay'           // Can start playing
'canplaythrough'    // Can play without buffering
'progress'          // Download progress
'error'             // Error occurred
```

### Source Events
```typescript
'sourcechange'      // Source changed
'providerchange'    // Provider plugin changed
'qualitychange'     // Quality changed
```

### UI Events
```typescript
'fullscreenchange'  // Fullscreen state changed
'pipchange'         // Picture-in-picture state changed
'controlschange'    // Controls visibility changed
```

### Custom Events (plugin-defined)
Plugins can emit custom events with namespace:
```typescript
'hls:manifestParsed'
'dash:streamInitialized'
'cast:sessionStarted'
'analytics:eventTracked'
```

## Provider Plugin Priority

When multiple provider plugins can handle a source:

```typescript
class ProviderSelector {
  selectProvider(
    src: SourceObject,
    providers: ProviderPlugin[]
  ): ProviderPlugin | null {
    // 1. Check explicit type hint
    if (src.type) {
      const provider = providers.find(p =>
        p.canHandle({ ...src, type: src.type })
      );
      if (provider) return provider;
    }

    // 2. Check all providers
    const candidates = providers.filter(p => p.canHandle(src));

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // 3. Use priority order (configurable)
    return this.selectByPriority(candidates);
  }
}
```

**Default Priority**:
1. HLS provider (for .m3u8)
2. DASH provider (for .mpd)
3. Native provider (for everything else)

## State Flow

```
User Action → Player Method → Event Emitted
                                    ↓
                        Plugin Intercept (optional)
                                    ↓
                         Plugins React via Listeners
                                    ↓
                         State Manager Updated
                                    ↓
                    State Subscribers Notified
                                    ↓
                         UI Updates
```

## Error Handling

```typescript
class ErrorHandler {
  private eventBus: EventBus;
  private errors: PlayerError[] = [];

  handleError(error: Error, context: ErrorContext): void {
    const playerError: PlayerError = {
      code: this.getErrorCode(error),
      message: error.message,
      fatal: this.isFatal(error),
      context,
      timestamp: Date.now()
    };

    this.errors.push(playerError);

    // Emit error event
    this.eventBus.emit('error', playerError);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Scarlett Player]', playerError);
    }
  }

  getLastError(): PlayerError | null {
    return this.errors[this.errors.length - 1] || null;
  }

  clearErrors(): void {
    this.errors = [];
  }
}
```

## Performance Considerations

### Bundle Size Targets
- **Core**: < 50KB gzipped
- **Provider plugins**: < 20KB each (excluding external libs)
- **UI plugins**: < 15KB each
- **Feature plugins**: < 10KB each

### Optimization Strategies
1. **Tree-shaking**: ESM modules, no side effects
2. **Code splitting**: Lazy load plugins
3. **External dependencies**: HLS.js, DASH.js as peer deps
4. **Minification**: Terser for production builds
5. **Compression**: Brotli + gzip

### Runtime Performance
- Event handler debouncing for high-frequency events
- State updates batched when possible
- DOM updates minimized
- RequestAnimationFrame for smooth UI

## Browser Support

### Targets
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

### Polyfills
None required for core. Plugins may require:
- HLS.js for HLS support (non-Safari)
- DASH.js for DASH support
- Cast SDK for Chromecast

## Security Considerations

### Content Security Policy
```
script-src: Required for plugin loading
media-src: Required for media sources
connect-src: Required for HLS/DASH manifests
frame-src: Required for YouTube/Vimeo embeds
```

### XSS Prevention
- No innerHTML for user content
- Sanitize all URLs
- Validate plugin configuration

### CORS
- HLS/DASH manifests must allow CORS
- Subtitle files must allow CORS
- Thumbnail images must allow CORS

## Testing Strategy

### Core Tests
- Unit tests for all core classes
- Integration tests for plugin system
- Event system tests
- State management tests

### Plugin Tests
- Each plugin has its own test suite
- Provider plugins tested with mock media
- UI plugins tested with DOM snapshots
- Feature plugins integration tested

### E2E Tests
- Playwright for browser testing
- Real media playback tests
- Framework adapter tests
- Accessibility tests

---

**Next**: See `plugin-api.md` for detailed plugin development guide.
