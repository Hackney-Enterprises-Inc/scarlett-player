# Writing a Scarlett Player Plugin

**Last Updated**: September 7, 2026 (player 1.11.1)

A plugin can add three things to the player: **events**, **state**, and **control-bar controls**. All three are open - a plugin package extends them without editing `@scarlett-player/core` or `@scarlett-player/ui`.

This is what `@scarlett-player/captions`, `@scarlett-player/watermark` and friends do, and it is what any third-party package can do.

## The plugin object

```ts
import type { IPluginAPI, Plugin, PluginType } from '@scarlett-player/core';

export function createExamplePlugin(config: ExampleConfig = {}): Plugin {
  let api: IPluginAPI | null = null;

  return {
    id: 'example',
    name: 'Example',
    version: '1.0.0',
    type: 'feature' as PluginType,

    init(pluginApi: IPluginAPI): void {
      api = pluginApi;
      // wire everything up here
    },

    destroy(): void {
      api = null;
    },
  };
}
```

Anything you attach in `init()` must come off again - via `api.onDestroy(fn)` or in `destroy()`. `api.on(...)` returns its own unsubscribe function, so `api.onDestroy(api.on(...))` at the point of subscription is the pattern that cannot be forgotten later.

Feature, UI, analytics and utility plugins outlive individual media items: a source change does not re-create them. Provider plugins are the exception, and are destroyed and initialised again on every `load()`.

### When `init()` runs

Non-provider plugins are initialised by the player's first `init()` or first `load()`, whichever happens first, in registration order. A plugin registered later with `player.registerPlugin()` is initialised by the next of those calls. Provider plugins are initialised lazily, per source, once `selectProvider()` has picked one.

`player:ready` is emitted at the END of that first pass, after every non-provider plugin's `init()` has resolved. A plugin that subscribes to it inside its own `init()` therefore does receive it, and it fires exactly once for the life of the player.

To expose an imperative API to the host, hang methods off the same object alongside `id`/`init`/`destroy`. `@scarlett-player/playlist` does this, which is why hosts can call `playlistPlugin.play(2)`.

## 1. Events

`PlayerEventMap` is an interface, so you add your events by declaration merging. No core change, and `EventBus` never validates names at runtime.

```ts
declare module '@scarlett-player/core' {
  interface PlayerEventMap {
    'example:started': { at: number };
    'example:finished': void;
  }
}

api.emit('example:started', { at: 12 });
const unsubscribe = api.on('example:started', ({ at }) => { /* typed */ });
```

**Namespace your events with your plugin id.** Core owns these namespaces in `PlayerEventMap`: `player:`, `playback:`, `media:`, `volume:`, `quality:`, `track:`, `fullscreen:`, `pip:`, `airplay:`, `chromecast:`, `live:`, `chapter:`, `gesture:`, `controls:`, `ui:`, `state:`, `plugin:`, `error:` and `playlist:`, plus the single unnamespaced `error`. Anything else is yours.

`EventBus` never validates names at runtime, so a typo in an event name is silent. The state store is the opposite: it throws for a key nobody registered, which is why the next section exists.

## 2. State

Two steps, because state is closed at runtime as well as in the type system - `getState`/`setState` throw for keys nobody registered, which catches typos on core keys.

```ts
declare module '@scarlett-player/core' {
  interface StateStore {
    exampleSelection: { start: number; end: number } | null;
  }
}

init(pluginApi) {
  api = pluginApi;
  api.defineState('exampleSelection', null);   // <- required before first use
}
```

`defineState` is idempotent: re-defining an existing key keeps its current value. Plugins commonly re-run setup after a source change, and that must not wipe live state.

**Namespace your state keys too** (`exampleSelection`, not `selection`).

Note the split between `CoreStateStore` and `StateStore`: core's defaults are declared against `CoreStateStore`, so your augmentation cannot break core's own compilation. `reset()` and `resetKey()` restore plugin keys to the initial value you passed to `defineState`.

## 3. Controls

Implement `Control`, then register a factory under a slot id.

```ts
import { registerControl, type Control } from '@scarlett-player/ui';
import type { IPluginAPI } from '@scarlett-player/core';

class ExampleButton implements Control {
  private el: HTMLButtonElement;

  constructor(private api: IPluginAPI) {
    this.el = document.createElement('button');
    this.el.className = 'sp-example';
    this.el.setAttribute('aria-label', 'Example');
  }

  render(): HTMLElement { return this.el; }

  update(): void {
    // Called on every state change. Hide rather than render something useless:
    this.el.style.display = this.api.getState('duration') > 0 ? '' : 'none';
  }

  destroy(): void { this.el.remove(); }
}

registerControl('example', (api) => new ExampleButton(api));
```

**Registering does not place the button anywhere.** The host opts in by listing the id in its layout:

```ts
uiPlugin({ controls: ['play', 'volume', 'time', 'spacer', 'example', 'fullscreen'] })
```

That is deliberate - a plugin cannot force itself into someone's control bar.

`ControlSlot` is `BuiltinControlSlot | (string & {})`, so custom ids type-check while editors still autocomplete the built-ins.

### Registration order

Plugin init order is **not** guaranteed. If your control registers after the UI plugin has built its control bar, the UI plugin notices and rebuilds - as long as your id is in the active layout. Registering an id nobody listed is inert.

So both of these work:

```ts
registerControl('example', factory);              // at module import time
init(api) { registerControl('example', factory); } // or during init
```

A factory that throws is caught and logged; the rest of the control bar still builds.

### Scope the registration when the factory closes over your plugin

The registry is module-level, so a factory registered without an owner is shared
by every player on the page. That is right for a stateless factory - it receives
the per-player `api` and builds a fresh control from it.

It is wrong the moment your factory captures the plugin instance: a chapter
list, a playlist panel, a share sheet. Every player that installs your plugin
registers again and overwrites the last, so the next rebuild in player A hands
it player B's control, and the two players drive one element. Pass the player's
container as the owner instead, and give the registration back on teardown:

```ts
import { registerControl, unregisterControl } from '@scarlett-player/ui';

init(api) {
  const owner = api.container;
  // Capture the instance in a local. A factory is called long after init
  // returns, so it needs a reference it can close over.
  const self = this;

  // The factory still receives the per-player IPluginAPI - pass it on, and
  // hand the control whatever plugin state it needs alongside. A control that
  // takes plugin state declares it: `constructor(api: IPluginAPI, plugin: ExamplePlugin)`,
  // unlike the one-argument ExampleButton above.
  registerControl('example', (controlApi) => new ExamplePanel(controlApi, self), { owner });

  // Only the id you registered. `unregisterControlsFor(owner)` drops every
  // control scoped to that container, including ones other plugins registered
  // against the same player, so your teardown would take theirs with it.
  api.onDestroy(() => unregisterControl('example', { owner }));
}
```

A player prefers a factory it owns over a global one of the same id, so the two
forms coexist.

### Shared stylesheets

If your plugin injects one `<style id="...">` per document, claim it through
core's `injectSharedStyles()` rather than injecting and removing it yourself.
It reference-counts holders, so two players share one sheet and the first
teardown does not strip the styling from the second:

```ts
import { injectSharedStyles, type ReleaseStyles } from '@scarlett-player/core';

export function examplePlugin(): Plugin {
  // Inside the factory, not at module scope: a module-level handle is shared by
  // every instance, so the second player's init() overwrites the first's and
  // the first destroy() releases a claim it does not own.
  let releaseStyles: ReleaseStyles | null = null;

  return {
    init() { releaseStyles = injectSharedStyles('sp-example-styles', styles); },
    destroy() { releaseStyles?.(); releaseStyles = null; },
  };
}
```

### The control bar can move your control

The bar measures itself and moves low-priority controls into an overflow tray
when it does not fit. Every registered control defaults to rank 3, which puts it
ahead of the cast buttons and behind PiP, and sends it to the tray rather than
off screen.

Three consequences for a control that owns a popover:

- Position the popover relative to your own wrapper element (as `SettingsMenu`
  does), or mount it on `api.container` (as the share plugin's sheet does).
  Anything positioned against the control bar will follow your button into the
  tray. The tray keeps `overflow: visible`, so a popover anchored to your own
  wrapper still opens upward out of it.
- `--sp-menu-max-height`, the height bound the built-in menus read, is sized for
  a menu anchored in the control bar: it is the container's height less the
  bar's own height and a small margin. The tray strip sits above the bar, so a
  popover opened from the tray starts higher than that bound assumes and can run
  off the top of the player. If your control owns a popover and wants the bound,
  either ask the host to pin the control
  (`uiPlugin({ priority: { yourId: 'never' } })`) or size the popover from your
  own anchor. It is why the built-in `quality` control hides rather than moving
  to the tray.
- A host can pin your control with `uiPlugin({ priority: { yourId: 'never' } })`,
  or re-rank it with a number. Nothing in your plugin needs to change either
  way.

### Editing on the playback timeline

Some plugins do not want a button in the bar, they want a layer over the
*timeline*: clip in/out handles, a comment pin, a range marker a viewer can
drag. `@scarlett-player/ui` exposes a second seam for that, and the reason it is
a seam rather than a feature of the UI package is dependency direction - the UI
package knows nothing about clips, reads no clip state, and gains no
`IPluginAPI` surface for it.

```typescript
// Optional peer: feature-detect, exactly as you do for registerControl.
const mod = await import('@scarlett-player/ui');
if (typeof mod.registerTimelineExtension === 'function') {
  release = mod.registerTimelineExtension(api.container, (surface) => {
    surface.element.appendChild(myHandles);      // a positioned layer over the rail
    return {
      update: () => reposition(surface.getRailRect()),
      onSeekStart: () => {},                     // an ordinary seek you do NOT own
      onSeekEnd: () => {},
      destroy: () => myHandles.remove(),
    };
  });
}
```

Four rules that are easy to get wrong:

- **One extension per player, keyed by container.** A second registration
  replaces and destroys the first; the disposer you were handed only removes
  *its own* registration, so a late teardown cannot unmount a successor.
- **The layer takes no pointer input by default.** Give only your explicit hit
  targets `pointer-events: auto`. A layer that swallowed every press would take
  scrubbing away from the viewer for the whole session.
- **Take the leases.** `surface.setEditing(true)` holds the bar visible and
  reserves room around the rail; `surface.setDragging(true)` suppresses the
  timeline's own seeking while you own the pointer. Release both on teardown -
  and expect `destroy()` while your feature is mid-session, because a control-bar
  rebuild or a UI teardown will call it. Have somewhere else to put your UI.
- **Register before or after the UI plugin.** Init order is not guaranteed and
  both orders work; do not try to sequence them.

See `packages/plugins/clips` for a full implementation, including the fallback
presentation it uses when the seam is absent.

### Accessibility

The built-in controls meet WCAG 2.5.5 - 44x44px minimum touch targets, real ARIA labels, keyboard navigation with a focus trap on menus, and visible focus states. Match that. `SettingsMenu` is the reference implementation for a popover control.

### Fullscreen

A control that offers fullscreen goes through core's `enterFullscreen(api.container)`, `exitFullscreen(api.container)` and `isFullscreen(api.container)` (runtime exports of `@scarlett-player/core` since 1.8.0), the way `FullscreenButton` and the `f` shortcut do. Do not call `requestFullscreen()` on the DOM yourself: the helpers carry the iPhone fallback, and the player's `fullscreen` state key and `fullscreen:change` event are driven by the browser's own events, so they stay correct whichever path was taken. `enterFullscreen()` rejects where no fullscreen API exists; catch and ignore it as the built-ins do.

## Testing

Plugins are tested against a mock `IPluginAPI` - see `packages/plugins/captions/tests/captions.test.ts` for the pattern. Two things to know:

- **vitest transpiles without type-checking.** A test that exercises a type contract proves nothing unless `tsc` also sees the file. `packages/core/tsconfig.typecheck.json` shows how that is wired up, including the trap that `exclude` is inherited from an extended config and filters `include`.
- **The control registry is module-level**, shared by every player on the page. Call `resetControlRegistry()` between tests or registrations leak across them.

## Checklist for a new plugin package

- [ ] Mirrors `packages/plugins/captions/` layout - `package.json`, `tsconfig.json`, `tsconfig.typecheck.json`, `tsup.config.ts` (entries, `dts: true`, and the `__PKG_VERSION__` define that `src/version.ts` reads so the plugin descriptor reports the published version), `vitest.config.ts`, `src/`, `tests/`
- [ ] `package.json` declares both a `typecheck` and a `test` script (`scripts/check-package-scripts.mjs` fails CI otherwise, because pnpm's recursive run silently skips a package that has neither)
- [ ] `files: ["dist"]`, so only build output is published
- [ ] `@scarlett-player/core` as a peer dependency; `@scarlett-player/ui` peer *and optional* if it registers a control
- [ ] Events and state keys namespaced with the plugin id
- [ ] Everything attached in `init()` is removed in `destroy()`
- [ ] Works headless - a host with no UI package can still use the plugin
- [ ] TSDoc on all exported functions, classes, and public methods
- [ ] A changeset
