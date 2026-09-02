# Writing a Scarlett Player Plugin

**Last Updated**: September 2, 2026 (player 1.7.0)

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

### Accessibility

The built-in controls meet WCAG 2.5.5 - 44x44px minimum touch targets, real ARIA labels, keyboard navigation with a focus trap on menus, and visible focus states. Match that. `SettingsMenu` is the reference implementation for a popover control.

## Testing

Plugins are tested against a mock `IPluginAPI` - see `packages/plugins/captions/tests/captions.test.ts` for the pattern. Two things to know:

- **vitest transpiles without type-checking.** A test that exercises a type contract proves nothing unless `tsc` also sees the file. `packages/core/tsconfig.typecheck.json` shows how that is wired up, including the trap that `exclude` is inherited from an extended config and filters `include`.
- **The control registry is module-level**, shared by every player on the page. Call `resetControlRegistry()` between tests or registrations leak across them.

## Checklist for a new plugin package

- [ ] Mirrors `packages/plugins/captions/` layout - `package.json`, `tsconfig.json`, `tsconfig.typecheck.json`, `vitest.config.ts`, `src/`, `tests/`
- [ ] `package.json` declares both a `typecheck` and a `test` script (`scripts/check-package-scripts.mjs` fails CI otherwise, because pnpm's recursive run silently skips a package that has neither)
- [ ] `files: ["dist"]`, so only build output is published
- [ ] `@scarlett-player/core` as a peer dependency; `@scarlett-player/ui` peer *and optional* if it registers a control
- [ ] Events and state keys namespaced with the plugin id
- [ ] Everything attached in `init()` is removed in `destroy()`
- [ ] Works headless - a host with no UI package can still use the plugin
- [ ] TSDoc on all exported functions, classes, and public methods
- [ ] A changeset
