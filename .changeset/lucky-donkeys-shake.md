---
'@scarlett-player/playlist': minor
'@scarlett-player/captions': minor
'@scarlett-player/audio-ui': minor
'@scarlett-player/analytics': minor
'@scarlett-player/ui': minor
'@scarlett-player/embed': minor
'@scarlett-player/whep': patch
'@scarlett-player/hls': patch
---

Config options that were declared but never read are now wired up or gone, the
accent-text token reaches hosts that cannot write CSS, and a WHEP endpoint that
does not speak WHEP fails in seconds instead of five minutes.

**Playlist: `preloadNext` does something.** It was declared and defaulted to
`true` while no code path read it. When a track starts, the next one is now
warmed through a detached media element with `preload="metadata"` - DNS, TLS
and the container header done before the viewer gets there, without pulling the
next file down while the current one still needs the bandwidth. Nothing is
warmed at the end of a playlist that does not repeat, or when `repeat` is
`'one'`, and the element is released as soon as there is no next track left -
on `clear()` and on destroy too - rather than left fetching one the viewer has
moved past.

**Captions: `CaptionSource.default` does something.** A source marked `default`
is now selected when the media loads. It beats `defaultLanguage` and applies
even with `autoSelect` off - the flag is the host naming a track, not a
preference to weigh - while a track the browser is already showing still
stands, so a viewer's own pick is never overridden. The marked source is found
through the TextTrack of the `<track>` element added for it, not by language
and label: a native rendition carrying the same pair - which is what the
manifest offers on the native HLS path - would otherwise answer for it.
`<track default>` is still never set on the element itself:
the browser would show it before the plugin has synced any state.

**Audio UI: `autoHide` is removed** from `AudioUIPluginConfig`. It was declared,
defaulted to `0` and read nowhere, and there is no hide path to hang it off.
Nothing breaks if you still pass it - the config carries an index signature for
`PluginConfig` compatibility, so the key still compiles and is still ignored -
but it is no longer documented or suggested, and deleting the line is the whole
migration.

**Analytics: `headers` on `AnalyticsConfig`**, mirroring `ClipEndpointConfig`:
an object, or a function resolved per beacon for a rotating CSRF or Bearer
token, merged over `Content-Type` and `X-API-Key` case-insensitively, so a
host's `content-type` replaces ours instead of being comma-joined onto it. A
function that rejects, or throws where it stands, costs the headers and not the
beacon. The unload beacon is the exception, as it is
for the API key: it travels by `navigator.sendBeacon`, which carries no headers
at all, and its fetch fallback merges a static object but never calls a
function, because a promise awaited in a pagehide handler may never settle.

**UI: `theme.accentTextColor`, and an exported `accentTextTone()`.** The
`--sp-accent-text` token that shipped in 1.15.4 was reachable only from CSS, so
an iframe embed - whose host has no CSS inside the player - could not set it at
all. `setTheme({ accentTextColor })` writes it, and `accentTextTone(color)`
returns a colour unchanged when it already clears 4.5:1 on the menus, or the
nearest lighter tone of the same hue that does. A theme that sets only
`accentColor` behaves exactly as before. The LIVE label - the one place accent
text sits on the control bar rather than on a menu - now carries its own opaque
`#202020` chip, since the bar is a gradient over the picture and reached about
`#333` over a bright frame, lighter than any surface a tone is measured
against.

**Embed: `data-brand-text-color`, and a readable default.** The embed now
derives the accent-text tone from `data-brand-color` unless the new attribute
overrides it, so a dark brand colour no longer renders sub-AA labels that the
host cannot reach. Audio-only bundles are unaffected: the helper rides on the
plugin creators, so nothing pulls the UI package into a build that has no video
UI.

**WHEP: 501 and 505 are permanent failures.** Every `status >= 500` was treated
as recoverable, so a URL that is not a WHEP endpoint at all - a plain HTTP
server answers a WHEP POST with 501 - entered the reconnect scheduler and held
`load()` pending for the whole `reconnectWindowMs`, five minutes by default.
500, 502, 503 and 504 still reconnect.

**Docs: what `load()` promises.** The whep and hls READMEs and
`docs/architecture.md` now say that `load()` stays pending while a provider's
reconnect scheduler is working, that a stream which is not live yet is a wait
rather than a failure, and that hosts needing progress listen to
`error:reconnecting` / `error:recovered` / fatal `error` instead of awaiting
the promise.
