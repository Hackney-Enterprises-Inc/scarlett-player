---
'@scarlett-player/core': minor
'@scarlett-player/ui': minor
---

Plugins can now extend the player without editing core.

Adding a control-bar button previously meant editing `@scarlett-player/ui`, and owning state meant editing `@scarlett-player/core` — `ControlSlot` was a closed union consumed by a `switch`, and `StateManager` threw for any key not in `DEFAULT_STATE`. Captions only looked like a self-contained package because core had already reserved its state keys, its event, and its control slot in advance. That does not scale, and it left third-party plugins with no route in at all.

**Controls.** `registerControl(id, factory)` in `@scarlett-player/ui` registers a control under any id, and `ControlSlot` becomes `BuiltinControlSlot | (string & {})` so custom ids type-check while editors still autocomplete the built-ins. Registering never places a button on its own — a host opts in by listing the id in `uiPlugin({ controls: [...] })`. Because plugin init order is not guaranteed, a control registered after the control bar was built triggers a rebuild rather than being silently dropped, and a factory that throws is contained instead of taking the whole bar down.

**State.** `api.defineState(key, initialValue)` registers plugin-owned state at runtime. It is idempotent, so a plugin re-running setup after a source change cannot reset state that is already live, and `reset()`/`resetKey()` now restore plugin keys to their defined initial value instead of writing `undefined`. State keys are split into `CoreStateStore` (what core owns, and what its defaults must cover exhaustively) and the open `StateStore`, so a plugin augmenting the latter can no longer break core's own compilation with a confusing missing-properties error.

**Events** needed no change: `PlayerEventMap` is an interface and the event bus never validated names, so declaration merging already worked. This is now pinned by tests, and `@scarlett-player/core` type-checks the files carrying those guarantees — previously vitest transpiled them without type-checking, so a type-level contract could rot unnoticed.

See `.claude/docs/plugin-authoring.md` for the conventions, including namespacing events and state keys with the plugin id.
