---
'@scarlett-player/core': patch
'@scarlett-player/embed': patch
'@scarlett-player/vue': patch
'@scarlett-player/hls': patch
'@scarlett-player/ui': patch
'@scarlett-player/native': patch
'@scarlett-player/airplay': patch
'@scarlett-player/chromecast': patch
'@scarlett-player/analytics': patch
'@scarlett-player/playlist': patch
'@scarlett-player/media-session': patch
'@scarlett-player/audio-ui': patch
'@scarlett-player/captions': patch
'@scarlett-player/watermark': patch
'@scarlett-player/share': patch
'@scarlett-player/chapters': patch
'@scarlett-player/gestures': patch
'@scarlett-player/clips': patch
---

Emit `playback:play` and `playback:pause` from the HLS provider's own media
element, so the bus hears about playback the viewer started.

**`@scarlett-player/hls`**

- The element handlers wrote state on `playing` and `pause` and emitted
  nothing. Every play control in the UI package calls `video.play()` /
  `video.pause()` on the element directly, so on an HLS source `playback:play`
  never fired at all — for the whole session. Anything waiting on it was dark:
  the watermark (which is hidden until the first play by contract), the
  analytics QoE timeline, media-session, the clips preview. Measured on the
  demo 2026-09-09: video playing, `.sp-watermark` still `visibility: hidden`.
  The native provider has always emitted play from its element; this is the
  same bridge on the shared factory, so both the hls.js and the native-HLS
  pipeline get it.
- `playback:pause` is emitted the same way, on both providers. Nothing emitted
  it before except `ScarlettPlayer.pause()`, so a viewer pausing with the play
  button, the keyboard or the browser's own controls produced no event.
- Neither is emitted twice. `ScarlettPlayer.play()` / `.pause()` put their
  event on the bus before the provider touches the element, and a shared
  `PlaybackGate` swallows exactly one matching element event. Commands that
  have nothing to do (play on a playing element, pause on a paused one) return
  without arming the gate, since no element event follows them and a flag left
  standing would swallow the viewer's next real transition instead. The one
  exception is a pause command that arrives while a play command is still in
  flight: it cancels that play rather than passing over it, and clears its
  flag, so the play the viewer makes next is heard.
- A load that replaces the source clears both gate flags. They are armed
  before the element is touched and consumed by the element event that
  follows, and once the source is abandoned that event never arrives — the
  handlers are detached, and on the hls.js path the new ones wait behind the
  loader import. A `pause()` a playlist issues just before advancing therefore
  left the flag standing, and it swallowed the viewer's first real pause on the
  new item. A same-source pipeline switch (`switchToNative()` /
  `switchToHlsJs()`) deliberately keeps the flags, which is what the gate
  outliving a pipeline is for.
- **Behaviour note:** the watermark stays hidden until the first play, which is
  its documented lifecycle. What changes is that on an HLS source the first
  play now arrives. A consumer who had grown used to never seeing the mark on
  HLS will see it from the first play onwards.
