# Scarlett Player - Architecture

**Version**: 1.11.1 (fixed versioning: every package in the workspace ships this number)
**Last Updated**: September 7, 2026

This describes the player as it is built, not as it was planned. Every class,
method and event named here exists in `packages/*/src`. Where a name in an
older revision of this document did not survive contact with the code (the
plugin lifecycle hook has never been called `setup`, and no package name has
ever carried a `plugin-` prefix), the name here is the one the code uses.

## System overview

```
+---------------------------------------------------------------+
|  Host application                                             |
|    createPlayer(options) -> ScarlettPlayer                    |
|    or the Vue wrapper (@scarlett-player/vue)                  |
|    or the CDN embed (@scarlett-player/embed)                  |
+------------------------------+--------------------------------+
                               |
+------------------------------v--------------------------------+
|  @scarlett-player/core                                        |
|                                                               |
|   ScarlettPlayer    public API, lifecycle,                    |
|                     provider selection, load                  |
|                     generations                               |
|                                                               |
|   PluginManager     register / init / destroy,                |
|                     plugin states, dependency                 |
|                     order, canPlay() selection                |
|                                                               |
|   PluginAPI         what a plugin is handed in                |
|                     init(api): state, events,                 |
|                     container, scoped logger,                 |
|                     cleanup registration                      |
|                                                               |
|   EventBus          typed pub/sub over                        |
|                     PlayerEventMap, plus                      |
|                     interceptors                              |
|                                                               |
|   StateManager      one Signal per state key,                 |
|                     change subscribers,                       |
|                     define() for plugin keys                  |
|                                                               |
|   ErrorHandler      classification, history,                  |
|                     emission                                  |
|                                                               |
|   Logger            levelled, scoped per plugin               |
+------------------------------+--------------------------------+
                               |
+------------------------------v--------------------------------+
|  Plugins (one npm package each)                               |
|   provider:  hls, native                                      |
|   ui:        ui, audio-ui                                     |
|   feature:   playlist, captions, chapters, clips,             |
|              gestures, share, watermark, media-session,       |
|              airplay, chromecast                              |
|   analytics: analytics                                        |
+---------------------------------------------------------------+
```

Nothing outside the core layer is required: a host can build a player with a
provider and nothing else. The four plugins that contribute control-bar
controls (playlist, chapters, share, clips) declare `@scarlett-player/ui` as an
OPTIONAL peer and register their controls through a dynamic import, so they keep
working when no UI package is installed.

`@scarlett-player/ui` exposes two extension seams, both through module-level
registries rather than through `IPluginAPI`, and both feature-detected by their
callers:

- **The control registry** (`registerControl`) contributes a *button* to a slot
  in the bar, which the host's layout has to name for it to appear.
- **The timeline registry** (`registerTimelineExtension`) contributes an editing
  *layer* over the playback rail: a positioned element with the rail's exact
  horizontal geometry, plus leases for holding the bar visible and for
  suppressing ordinary seeking while the extension owns a pointer. One
  extension per player, keyed by container. `@scarlett-player/clips` mounts its
  in/out handles there and falls back to a self-contained rail when the seam is
  absent, so an older UI peer degrades rather than failing.

Both registries are keyed by the player container where per-player state is
involved, which is what keeps two players on one page from driving each other's
controls.

## Packages

Eighteen packages, all published at one version by a fixed Changesets group.

| Path | Package |
|---|---|
| `packages/core` | `@scarlett-player/core` |
| `packages/vue` | `@scarlett-player/vue` |
| `packages/embed` | `@scarlett-player/embed` |
| `packages/plugins/hls` | `@scarlett-player/hls` |
| `packages/plugins/native` | `@scarlett-player/native` |
| `packages/plugins/ui` | `@scarlett-player/ui` |
| `packages/plugins/audio-ui` | `@scarlett-player/audio-ui` |
| `packages/plugins/playlist` | `@scarlett-player/playlist` |
| `packages/plugins/captions` | `@scarlett-player/captions` |
| `packages/plugins/chapters` | `@scarlett-player/chapters` |
| `packages/plugins/gestures` | `@scarlett-player/gestures` |
| `packages/plugins/share` | `@scarlett-player/share` |
| `packages/plugins/clips` | `@scarlett-player/clips` |
| `packages/plugins/watermark` | `@scarlett-player/watermark` |
| `packages/plugins/media-session` | `@scarlett-player/media-session` |
| `packages/plugins/airplay` | `@scarlett-player/airplay` |
| `packages/plugins/chromecast` | `@scarlett-player/chromecast` |
| `packages/plugins/analytics` | `@scarlett-player/analytics` |

There is no React package and no presets package. Every directory under
`packages/plugins/` is one of the fifteen plugin packages above; the empty
placeholder directories that used to sit beside them were deleted on
2026-09-02. A name under `packages/plugins/` means a package only when it has a
`package.json`.

## Lifecycle

### Construction

`new ScarlettPlayer(options)` resolves the container (an `HTMLElement` or a CSS
selector, throwing when neither resolves), builds the `EventBus`,
`StateManager`, `Logger`, `ErrorHandler` and `PluginManager`, wires the three
listeners that keep the `error` state key in sync (`error` sets it,
`media:loaded` clears it, `media:error` is recorded through
`ErrorHandler.record()` without flipping the state), wires the four fullscreen
listeners through the private `wireFullscreenListeners()` (see Fullscreen
below), and calls `PluginManager.register()` for each plugin in
`options.plugins`.

Registration is all the constructor does to plugins. No plugin's `init()` runs
yet, and no source is loaded.

### Initialisation

`init()` and `load()` both go through the private `ensureInitialized()`, which
is idempotent and safe to call re-entrantly. One pass (`runInitialization()`):

1. Walk `PluginManager.getPluginIds()`. For every plugin that is not
   `type: 'provider'` and is still in the `registered` state, call
   `PluginManager.initPlugin()`. Plugins in any other state are skipped, so a
   plugin added through `registerPlugin()` after start-up is picked up by the
   next call and nothing is initialised twice.
2. `wireLifecycleListeners()`, guarded by the private `listenersWired` flag so
   the two listeners it installs exist exactly once no matter how many times
   `load()` runs.
3. Emit `player:ready`, guarded by the private `readyEmitted` flag so it is
   emitted at the end of the FIRST pass only.

`ensureInitialized()` returns the in-flight promise when a pass is already
running. That matters because one of the listeners wired in step 2 calls
`load()`, which calls `ensureInitialized()` again: without the shared promise,
`initPlugin()` would find a plugin in the `initializing` state and throw
"possible circular dependency".

`init()` is `ensureInitialized()` followed by a `load()` of `options.src` when
one was given. `createPlayer(options)` is `new ScarlettPlayer(options)` plus
`await player.init()`, and is the documented entry point.

`load()` calls `ensureInitialized()` before it selects a provider, so
constructing a player and calling `load()` without `init()` produces a fully
wired player rather than a provider with no UI, no error overlay and no working
playlist. That shape was widely copied out of the READMEs, which is why the
auto-initialisation exists.

Two listeners are installed by `wireLifecycleListeners()`:

- `media:load-request` (emitted by the playlist plugin, among others): loads the
  requested source, then plays unless the payload says `autoplay: false`. It
  returns early while Chromecast is active, because the Chromecast plugin owns
  loading then.
- `error:retry` (emitted by the UI error overlay's Try Again button): reloads
  through the normal provider path, then restores position, live streams at the
  live edge through `seekToLive()`, VOD at the previous `currentTime`.

Both handlers re-check the destroyed flag after each await. They are unawaited
async closures, so a read against a torn-down `StateManager` would surface as an
unhandled rejection rather than a caught error.

### `player:ready`

Emitted once, at the end of the first initialisation pass. It used to be the
constructor's last statement, where no consumer and no plugin could have
subscribed yet, so no listener could ever observe it. A host that wants the
event subscribes between construction and the first `init()`/`load()`; a host
using `createPlayer()` has the returned promise as its readiness signal and does
not need the event at all.

### Loading a source

`load(source)`:

1. Increments `loadGeneration` and captures the value. Every post-await step
   compares against it and bails when a newer `load()` (or a `destroy()`, which
   also increments the counter) has started.
2. Resets the playback state keys through `StateManager.update()` and clears
   `error`.
3. Destroys the previous provider through `PluginManager.destroyPlugin()`, which
   returns it to the `registered` state so it can be initialised again later.
4. `ensureInitialized()`.
5. `PluginManager.selectProvider(source)`. No provider means
   `ErrorHandler.throw(ErrorCode.PROVIDER_NOT_FOUND, ...)` and a return, not an
   exception.
6. `PluginManager.initPlugin()` for the selected provider only. Providers are
   initialised lazily, per source; every other plugin was initialised in step 4.
7. Writes `source` state (`src` plus the MIME type derived by the private
   `detectMimeType()`), calls the provider's `loadSource()`, and plays when the
   `autoplay` state key is set.

Failures inside `load()` are reported, never thrown at the caller: when the
error state is already populated (a provider that emitted a structured fatal
error of its own) the catch only logs, so a specific code is not overwritten by
a generic one.

### Destruction

`destroy()` increments `loadGeneration` so in-flight loads self-cancel through
the mechanism `load()` already trusts, clears the pending seek-resume timeout,
removes the four fullscreen listeners, emits `player:destroy`, then
`PluginManager.destroyAll()`, `EventBus.destroy()` and `StateManager.destroy()`. Every public method calls the private
`checkDestroyed()` first and throws on a destroyed player. The state getters do
not: they read through `StateManager`, which raises its own destroyed-specific
error rather than the misleading unknown-key one.

## PluginManager

`register(plugin, config?)` validates the plugin (`id`, `name`, `version`,
`type`, `init`, `destroy` all present and of the right kind), rejects a
duplicate `id`, builds that plugin's `PluginAPI`, stores the record in the
`registered` state and emits `plugin:registered`.

`PluginState` is `registered`, `initializing`, `ready`, `error` or `destroyed`.
`initPlugin(id)` returns immediately when the plugin is already `ready`, throws
when it is `initializing` (the circular-dependency guard), initialises any
entries in the plugin's `dependencies` array first, subscribes the plugin's
optional `onStateChange` and `onError` hooks (unsubscribing them through
`api.onDestroy()`), then awaits `plugin.init(api, config)`. Success emits
`plugin:active`; a throw sets the `error` state, emits `plugin:error` and
rethrows.

`destroyPlugin(id)` awaits `plugin.destroy()`, runs the API's registered cleanup
functions and resets the record to `registered` so the plugin can be
initialised again. `initAll()` and `destroyAll()` walk
`resolveDependencyOrder()`, a topological sort that throws
`Circular dependency detected` with the cycle path; `destroyAll()` walks it in
reverse.

`getPlugin(id)` returns any registered plugin. `getReadyPlugin(id)` returns it
only when it is `ready`, and is what `IPluginAPI.getPlugin()` is wired to, so a
plugin can never reach another plugin that has not finished initialising.

### Provider selection

`selectProvider(source)` takes the plugins with `type: 'provider'` in
registration order and returns the first whose `canPlay(source)` returns true.
There is no priority table and no scoring: registration order is the priority,
so a host that wants HLS to win registers `createHLSPlugin()` before
`createNativePlugin()`.

- `@scarlett-player/hls`: `canPlay()` requires hls.js support or native HLS, and
  a source whose path ends in `.m3u8` or whose URL carries an mpegurl MIME hint.
- `@scarlett-player/native`: `canPlay()` requires a known extension and a
  positive `HTMLMediaElement.canPlayType()` answer for the mapped MIME type.

A source no provider accepts produces `ErrorCode.PROVIDER_NOT_FOUND`.

## Plugin interface

```ts
interface Plugin<TConfig extends PluginConfig = PluginConfig> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: PluginType;
  readonly description?: string;
  readonly dependencies?: string[];

  init(api: IPluginAPI, config?: TConfig): void | Promise<void>;
  destroy(): void | Promise<void>;

  onStateChange?(event: StateChangeEvent): void;
  onError?(error: Error): void;
}

type PluginType = 'provider' | 'ui' | 'feature' | 'analytics' | 'utility';
```

The lifecycle hook is `init(api)`. There is no `setup()`, and `destroy()` is
required, not optional.

A provider adds `canPlay(src: string): boolean` and
`loadSource(src: string): Promise<void>`; `ScarlettPlayer` calls both by duck
typing rather than through a separate interface, and proxies `getLevels()`,
`setLevel()`, `getCurrentLevel()` and `getLiveInfo()` the same way, so a
provider that implements none of them still works.

Plugins expose an imperative API by hanging methods off the same object
(`@scarlett-player/playlist` is the example: `add()`, `play()`, `next()`,
`previous()`), which a host reaches through `player.getPlugin(id)`.

`PluginFactory` is the exported type for the `createXPlugin(config?)` factory
functions every package ships.

## IPluginAPI

The whole surface a plugin is handed. `PluginAPI` in
`packages/core/src/plugin-api.ts` is the implementation; the interface lives in
`packages/core/src/types/plugin.ts`.

| Member | Purpose |
|---|---|
| `pluginId` | The plugin's own id |
| `container` | The player container element |
| `logger` | `debug`/`info`/`warn`/`error`, prefixed with the plugin id |
| `getState(key)` | Read one state key, typed by `StateValue<K>` |
| `setState(key, value)` | Write one state key |
| `defineState(key, initialValue)` | Register a key this plugin owns, before first use |
| `on(event, handler)` | Subscribe; returns an unsubscribe function |
| `off(event, handler)` | Unsubscribe |
| `emit(event, payload)` | Emit a typed event |
| `getPlugin(id)` | Another plugin, only if it is `ready` |
| `onDestroy(cleanup)` | Register a cleanup function |
| `subscribeToState(callback)` | Every state change, as a `StateChangeEvent` |

There is no `play()`, `pause()` or `seek()` on the API: a plugin drives playback
by emitting `playback:play`, `playback:pause` or `playback:seeking`, which the
active provider is subscribed to. That keeps plugins independent of which
provider is loaded.

`runCleanups()` and `getCleanupFns()` exist on the concrete `PluginAPI` for
`PluginManager` to call; they are marked `@internal` and are not part of
`IPluginAPI`.

## State

`StateManager` holds one `Signal` per key. `DEFAULT_STATE` supplies the initial
values and is typed against `CoreStateStore`, not `StateStore`:

- `CoreStateStore` is the closed set of keys core owns, so `DEFAULT_STATE` can
  be exhaustive over exactly those keys.
- `StateStore extends CoreStateStore` and is open. A plugin adds the state it
  owns by declaration merging into `StateStore`, so augmenting it cannot break
  core's own compilation with a "missing properties" error.

At runtime the store is closed too: `get()` throws `Unknown state key` for a key
nobody registered, which is a deliberate typo-catcher. A plugin therefore calls
`api.defineState(key, initialValue)` in `init()` before first use. `define()` is
idempotent: re-defining an existing key keeps the current value, because plugins
re-run setup after a source change and that must not wipe live state. The
initial value is remembered in `definedDefaults` so `reset()` and `resetKey()`
work on plugin keys, which have no entry in `DEFAULT_STATE`.

Reads and writes: `get(key)` (the `Signal`), `getValue(key)`, `set(key, value)`,
`update(partial)`, `snapshot()` (a frozen `StateStore`), `reset()`,
`resetKey(key)`. Subscriptions: `subscribeToKey(key, cb)` for one key,
`subscribe(cb)` for every change. `ScarlettPlayer.getState()` returns
`snapshot()`.

After `destroy()`, `get()` throws a destroyed-specific message rather than the
unknown-key one. Returning last-known values instead was considered and
rejected: it masks the lifecycle bugs the throw exposes.

The signal primitives (`Signal`, `signal`, `Computed`, `computed`, `effect`, and
the `currentEffect` tracking helpers) are exported from core for consumers that
want them directly.

## Events

`PlayerEventMap` is the single typed map of event name to payload; `EventName`,
`EventPayload<T>` and `EventHandler<T>` derive from it. Like `StateStore`, it is
an interface, so a plugin adds its own events by declaration merging without a
core change.

Core owns these namespaces: `player:`, `playback:`, `media:`, `volume:`,
`quality:`, `track:`, `fullscreen:`, `pip:`, `airplay:`, `chromecast:`, `live:`,
`chapter:`, `gesture:`, `controls:`, `ui:`, `state:`, `plugin:`, `error:` and
`playlist:`, plus the single unnamespaced `error`. A plugin namespaces its own
events with its plugin id.

`EventBus` provides `on`, `once`, `off`, `emit`, `emitAsync`, `intercept`,
`removeAllListeners`, `listenerCount` and `destroy`. A handler that throws is
caught and logged, so one bad listener cannot stop the others. An
`EventInterceptor` runs before the handlers and can rewrite the payload or
cancel the event by returning `null`; interceptors are enabled by default and
can be turned off through `EventEmitterOptions`.

## Error and reconnect model

`ErrorHandler` normalises anything thrown into a `PlayerError`
(`code`, `message`, `fatal`, `timestamp`, optional `context`, `originalError`
and `detail`), keeps a bounded history (ten entries by default), logs it at
error level when fatal and warn level otherwise, and emits `error`.

- `handle(error, context)` does all of that.
- `record(error, context)` does everything except emit, for advisory channels:
  media element errors go through it so they are visible in `getHistory()`
  without flipping the error state that the retry flow reads.
- `throw(code, message, options)` builds a `PlayerError` from an `ErrorCode` and
  handles it. It does not throw a JavaScript exception.

`ErrorCode` covers source loading (`SOURCE_NOT_SUPPORTED`,
`SOURCE_LOAD_FAILED`), providers (`PROVIDER_NOT_FOUND`,
`PROVIDER_SETUP_FAILED`), plugins (`PLUGIN_SETUP_FAILED`, `PLUGIN_NOT_FOUND`),
playback and media (`PLAYBACK_FAILED`, `MEDIA_DECODE_ERROR`,
`MEDIA_NETWORK_ERROR`, `MEDIA_APPEND_ERROR`, `MEDIA_BUFFER_FULL`,
`PLAYLIST_INVALID`) and `UNKNOWN_ERROR`. `SOURCE_NOT_SUPPORTED`,
`PROVIDER_NOT_FOUND` and `MEDIA_DECODE_ERROR` are classified fatal by default.

Providers attach diagnostics through `PlayerErrorDetail`: `type`,
`retriesExhausted`, `attempts`, `reconnectExhausted`, `httpStatus` and `url`.
`url` must be sanitised by the provider before it is set. The HLS plugin does
that with its exported `sanitizeUrl()`, which strips the query string and the
fragment and keeps origin plus pathname. Path segments are NOT made safe by it,
so a consumer whose playback URLs carry a credential in the path scrubs the path
on its own side before forwarding the value to telemetry.

Recovery lives in the provider, not in core. In `@scarlett-player/hls`:

- Bounded retries first, with jittered exponential backoff:
  `maxNetworkRetries` (default 3) and `maxMediaRetries` (default 2). Both
  budgets apply on the hls.js branch and, through `handleNativeFatalError()`, on
  the native Safari branch, where recovery means reloading the source and
  restoring the position captured at the first failure. The budgets reset once
  media flows again, so a long event's transient blips never accumulate.
- `emitFatalError()` emits the fatal `error` and then calls
  `maybeScheduleReconnect()`, which hands over to the auto-reconnect scheduler
  only when playback had already started and the failure was a network or media
  one. `scheduleReconnectAttempt()` emits `error:reconnecting`
  (`{ attempt, delayMs, elapsedMs?, windowMs? }`) and `attemptReconnect()`
  rebuilds the pipeline, resuming VOD at the previous position and rejoining
  live at the edge.
- Giving up is decided by a TIME WINDOW (`reconnectWindowMs`, default 300000ms),
  not by an attempt count, which is why the payload reports
  `elapsedMs`/`windowMs` and there is no `maxAttempts` to render against.
- `emitReconnectExhausted()` closes the cycle exactly once, behind a latch that
  `cancelReconnect()` clears: it emits `error:reconnect-exhausted`
  (`{ attempts, elapsedMs, windowMs }`) and then a final fatal `error` carrying
  `detail.reconnectExhausted`. The final error deliberately does not go through
  `emitFatalError()`, which would re-enter the scheduler.

The ordering guarantee a UI can rely on: one or more `error:reconnecting`, then
exactly one of `error:recovered` or `error:reconnect-exhausted`. A consumer that
shows a reconnecting state on the first can take it down on either terminator
and will never be stranded.

The UI plugin's `ErrorOverlay` renders viewer-facing copy per `ErrorCode`, shows
the reconnecting state while the provider self-heals, and emits `error:retry`
when Try Again is pressed, which core's own listener turns back into a `load()`.

## Live and low latency

Five state keys describe a live stream - `live`, `liveEdge`, `seekableRange`,
`liveLatency` and `lowLatencyMode` - and four events announce changes to them:
`live:edgechange`, `live:latency`, `live:seekablerange` and `live:lowlatency`.

**One writer.** `packages/plugins/hls/src/live-metrics.ts` is the only place
that writes four of those five keys. `computeLiveMetrics(source)` measures, and
`applyLiveMetrics(api, metrics)` writes and emits, each key only when its value
actually changed. `hlsLevelLoaded` owns `live` itself and nothing else does.

That rule exists because it was broken. `hlsLevelLoaded` used to compute an edge
flag from the playlist and the `timeupdate` handler then recomputed it four
times a second as `latency < 10` off `video.seekable` - the wrong source under
MSE, where `seekable.start(0)` stays 0 instead of following the sliding window,
and a threshold that is unconditionally true at a 2-4 second low-latency target.
"GO LIVE" could not appear however far a viewer drifted. Anything that needs a
new live reading calls `computeLiveMetrics`; nothing writes those keys directly.

**Latency truth differs by path.** On hls.js (MSE), `hls.latency` is real
wall-clock latency measured against `EXT-X-PROGRAM-DATE-TIME` drift where the
manifest carries it, and `hls.targetLatency` derives from `PART-HOLD-BACK` /
`HOLD-BACK`. On the native path (Safari/iOS) there is no latency API, so the
distance to `video.seekable.end` stands in - a buffer distance, not a latency -
and the edge threshold stays deliberately loose (the historical 10s) unless a
target latency carried over from an hls.js session on the same source.

A viewer is at the edge when `latency <= targetLatency + tolerance`, with
`tolerance = max(1.5, partTarget ?? targetduration / 2)`. That formula is what
decides when "GO LIVE" appears.

**`lowLatencyMode` reports effect, not intent.** It is true only when the
manifest carries `EXT-X-PART` or advertises `CAN-BLOCK-RELOAD=YES` *and* the
host asked for low latency in the HLS plugin config. A flag set against a plain
live manifest gets no badge, and neither does an LL manifest played without the
flag - hls.js will not load its parts.

**Rejoining the edge goes through core.** A control emits `live:seektolive`;
`ScarlettPlayer` subscribes and calls `seekToLive()`, which prefers the
provider's `liveSyncPosition` and only then falls back to `seekableRange.end`
and `duration`. The two are not interchangeable under low latency: the end of
the seekable range is past the last loaded part, and seeking there stalls. The
UI's `LiveIndicator` used to seek there itself; it now carries no target at all.

## Fullscreen

Core owns fullscreen since 1.8.0. `packages/core/src/fullscreen.ts` exports
`enterFullscreen(container)`, `exitFullscreen(container)` and
`isFullscreen(container)` as runtime exports, and every way in goes through
them: `ScarlettPlayer.requestFullscreen()`, `exitFullscreen()` and
`toggleFullscreen()`, the UI package's `FullscreenButton` and its `f` shortcut.
Before that there were three implementations, and only the button carried the
iPhone fallback, so `player.requestFullscreen()` (what the Vue wrapper and the
`useScarlettPlayer` composable call) did nothing at all on an iPhone.

- `enterFullscreen()` tries `Element.requestFullscreen`, then
  `webkitRequestFullscreen`, then the iPhone's `video.webkitEnterFullscreen()`
  on the container's video element, looked up on every call because a provider
  creates that element per source. Exhausting all three throws rather than
  resolving: a silent no-op would arm the optimistic write below and announce a
  transition that never happened.
- `exitFullscreen()` checks the video's `webkitDisplayingFullscreen` FIRST and
  calls `webkitExitFullscreen()` there, because a WebKit that exposes
  `document.exitFullscreen` while the native player is up has no fullscreen
  element and would reject. Then `document.exitFullscreen`, then
  `webkitExitFullscreen`.
- `isFullscreen()` reads the browser (`fullscreenElement`,
  `webkitFullscreenElement`, `webkitDisplayingFullscreen`), never the state
  key, so a stale key cannot invert a toggle.

The `fullscreen` state key is written from real browser events. The player
listens for `fullscreenchange` and `webkitfullscreenchange` on the document,
and for `webkitbeginfullscreen` and `webkitendfullscreen` in the capture phase
on its container, because those two are dispatched on the video element and do
not bubble. Each one calls the private `setFullscreenState()`, which writes the
key and emits `fullscreen:change` only when the value actually changed. The
spec fires `fullscreenchange` before `requestFullscreen()` resolves, so the
optimistic write that follows the await in `requestFullscreen()` and
`exitFullscreen()` runs only where the browser stayed silent (the private
`fullscreenAnnounced` flag): jsdom never fires the event, and neither does the
iPhone's native player until it has finished opening. All four listeners are
removed in `destroy()`.

## Data flow

```
host call or user gesture
        |
        v
ScarlettPlayer method  ->  EventBus.emit(...)
        |                        |
        |                        v
        |                 interceptors (may rewrite or cancel)
        |                        |
        |                        v
        |                 plugin handlers, provider handlers
        v                        |
StateManager.set/update  <-------+
        |
        v
signal subscribers  ->  StateManager change subscribers
        |                        |
        v                        v
   plugin.onStateChange     api.subscribeToState(...)
        |
        v
   UI controls redraw
```

Playback state is written by the provider from real media element events, not
optimistically by the player: `play()` emits `playback:play` and lets the
provider report what actually happened, because setting `playing: true` up front
caused state to drift from the element.

## Build and distribution

- `@scarlett-player/core`, `@scarlett-player/vue` and `@scarlett-player/embed`
  build with Vite; every plugin builds with tsup and emits its own declarations
  through `dts: true` in its `tsup.config.ts`, which also `define`s the
  package's own version for `src/version.ts`. Core's build is
  `rimraf dist tsconfig.tsbuildinfo && tsc && vite build`: `tsc` emits
  declarations only (`emitDeclarationOnly`) and Vite writes the runtime bundles
  into the same `dist`, so the Vite config pins `emptyOutDir: false`. Emptying
  `dist` between the two steps would delete the declarations that `types` and
  every plugin's tsconfig `paths` point at.
- Every package restricts `files` to its build output, so nothing but `dist`
  is published (embed also ships its `iframe.html`).
- hls.js is loaded lazily by `loadHlsJs()` through a dynamic `import`, so a page
  that never plays HLS never fetches it. `@scarlett-player/hls/light` is a second
  entry over the same factory (`src/create-hls-plugin.ts`) built on hls.js/light:
  no subtitles, no ID3, no DRM.
- The playlist plugin registers its control-bar controls through
  `void import('@scarlett-player/ui')` and logs and continues when the UI package
  is absent, which is what makes it work headless.
- Versioning is Changesets in fixed mode: all eighteen packages share one
  version number.

## Testing

- Vitest per package, with jsdom. `pnpm test` fans out over the workspace.
- Typechecking is a separate gate: vitest transpiles without type-checking, so a
  test that exercises a type contract proves nothing unless `tsc` also sees the
  file. Every build `tsconfig.json` scopes the program to `src`, so several
  packages carry a `tsconfig.typecheck.json` that adds the type-contract tests
  back in; core's copy documents the trap that `exclude` is inherited from the
  extended config and filters `include`, so it has to be restated.
  `scripts/check-package-scripts.mjs` fails the build when a workspace package
  declares no `typecheck` or `test` script, which is how the gap that left ten
  packages silently unchecked is kept closed.
- Three further guards run after the build, each for a defect class that shipped
  green once: `scripts/check-package-artifacts.mjs` (a manifest advertising a
  path the build did not leave on disk), `scripts/check-embed-chunks.mjs` (an
  embed bundle importing a chunk that was never emitted) and
  `scripts/check-package-types.mjs` (a shipped `.d.ts` that exists but does not
  compile for a consumer).
- `scripts/verify-browser.mjs` drives the built demo in a real headless Chrome
  through Playwright, covering what jsdom cannot: manifest failures, a
  mid-playback outage and automatic recovery, destroy-mid-append races against a
  locally generated HLS fixture, malformed live playlist refreshes, the shape of
  the `window.ScarlettPlayer` global the CDN embed publishes, control-bar
  reachability at phone widths (which needs a layout engine and a coarse
  pointer), and LL-HLS end to end against a rolling low-latency playlist
  assembled from the fixture's 0.5s part rendition. Fifty-nine checks across
  eight scenarios; CI runs it on pushes to `main` only, not on pull requests.
- `scripts/hls-fixture.mjs` generates both renditions the harness plays: 2s
  segments for everything else, and 0.5s parts for the LL scenario. The parts
  are real segments on keyframe boundaries rather than byte-range slices of the
  2s ones, so four of them concatenate to exactly their parent segment. Slicing
  instead was tried and produces truncated access units that Chromium rejects
  with `PIPELINE_ERROR_DECODE` a few seconds into part-driven playback.

## Browser support

Chrome and Edge 80+, Firefox 78+, Safari 14+, iOS Safari 14+, Android Chrome
90+. The same list is in the root README; keep the two in step.

## See also

- `docs/plugin-authoring.md` - writing a plugin: events, state and controls
- `docs/contributing.md` - code standards, testing and review conventions
- `README.md` - installation, quick starts and the package table
