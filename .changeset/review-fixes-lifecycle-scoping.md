---
'@scarlett-player/core': patch
'@scarlett-player/ui': patch
'@scarlett-player/hls': patch
'@scarlett-player/chromecast': patch
'@scarlett-player/chapters': patch
'@scarlett-player/playlist': patch
'@scarlett-player/share': patch
'@scarlett-player/airplay': patch
---

Review fixes: control-registration scoping, plugin teardown and reactive
context correctness.

**Core**

- `setCurrentEffect()` now replaces the innermost tracking frame instead of
  pushing a new one. The documented save/restore idiom
  (`const prev = getCurrentEffect(); setCurrentEffect(x); setCurrentEffect(prev)`)
  grew the effect stack by a frame on every restore, so the enclosing
  `effect()`'s own unwind landed on `x` rather than clearing the context.
- `StateManager` dispatches change events over a snapshot of its subscribers. A
  subscriber that unsubscribed and resubscribed while handling an event was
  re-added mid-iteration and notified twice for one change.
- `injectSharedStyles()` holds the element it claimed rather than resolving the
  id again at release time. A host that swapped the sheet for its own `<style>`
  under the same id had the replacement deleted by a release that never owned
  it.

**Control registration (chapters, playlist, share)**

- Teardown unregisters only the ids the plugin registered.
  `unregisterControlsFor(owner)` dropped every control scoped to the player's
  container, so destroying one plugin also unregistered the controls its
  neighbours had registered against the same container.
- The runtime `import('@scarlett-player/ui')` is guarded by an init generation.
  A resolve that landed after `destroy()` registered a control wired to a
  torn-down instance, and overwrote a later lifecycle's registration.

**UI**

- `QualityMenu` closes itself when the rendition list empties. The control bar's
  auto-hide waits on `isMenuOpen()`, so a menu left open behind the now hidden
  control kept the bar on screen for the rest of the session.
- Every handler that changes the error overlay's visibility (`error`,
  `error:reconnecting`, `error:recovered`, `media:loaded`) now schedules a
  render. The big play button reads the overlay's visibility rather than state,
  and `media:loaded` carries no state write to drive one, so the button stayed
  hidden over a freshly loaded source.

**HLS**

- Tearing down the event handlers clears `audioTracks` and `currentAudioTrack`.
  Neither was reset on a source switch, and the native provider clears
  `qualities` but has never touched these, so the previous stream's audio menu
  survived into the next one.
- `audioTrackIndex()` requires the whole id to match the canonical `audio-N`
  form. Stripping the prefix and calling `parseInt` accepted `audio-2invalid`
  and `audio-02` as rendition 2.

**Chromecast**

- `resetCastLoader()` rejects the in-flight load instead of muting it. Callers
  holding the promise from `loadCastSDK()` were left awaiting one that nothing
  would ever settle.

**AirPlay**

- `destroy()` always detaches from the video element. Gating it on
  `isAirPlaySupported()` leaked the listeners whenever support was reported
  differently at teardown than at init.
