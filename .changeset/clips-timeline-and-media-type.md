---
'@scarlett-player/ui': minor
'@scarlett-player/clips': minor
'@scarlett-player/hls': patch
'@scarlett-player/core': patch
'@scarlett-player/embed': patch
'@scarlett-player/vue': patch
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
---

Clips on the playback timeline, and an end to video being mislabelled as audio.

**Video is no longer classified as audio because nobody measured it yet.**
`@scarlett-player/hls` derived `mediaType` from one expression in its
`loadedmetadata` handler - `video.videoWidth > 0 ? 'video' : 'audio'` - which
reads a *missing* measurement as positive evidence of audio. Intrinsic
dimensions are simply not available at that point on several mobile browsers, so
an ordinary phone playing an ordinary video was labelled `audio`, and everything
gated on that quietly refused to work. Classification now needs evidence:
positive dimensions or a present native video track establish video and stay
sticky for the source; hls.js's `MANIFEST_PARSED` flags establish it before a
frame decodes; native track lists (feature-detected, consulted only from
`HAVE_METADATA`) establish audio. Anything else stays `unknown`, which is a
third answer and not a synonym for audio. Evidence survives retries, native
error-recovery reloads and AirPlay handoffs, and resets on a new source.

**The clip IN/OUT handles now live on the playback timeline.**
`@scarlett-player/ui` gains `registerTimelineExtension(owner, factory)`, a
second extension seam beside the control registry: it offers a positioned layer
over the rail, the rail's measured geometry, and leases for holding the control
bar visible and suppressing ordinary seeking while an extension owns a pointer.
One extension per player, keyed by container, registerable before or after the
UI plugin initialises. The UI package reads no plugin-specific state and gains
no `IPluginAPI` surface for it.

`@scarlett-player/clips` mounts its handles there in two 44px lanes, IN above
the rail and OUT below, each labelled with its own timestamp. Two lanes because
a 30-second selection on a two-hour source is about a pixel wide, and two
targets on one line cannot both be hit. Presses that miss a handle fall through
and seek as usual. Without the seam - no UI package, or one too old to have it -
the same selector instance renders on its own rail, and it moves between the two
without losing the selection, the title or the request id.

**Editing and preview stopped fighting the viewer.** Drags preserve the grab
offset, lock one pointer, survive a failed pointer capture, apply the release
position once, and treat a cancelled gesture as a cancellation (range kept,
playback not resumed). Endpoints can also be placed at the playhead, stepped
with the keyboard against their own reachable limits, or typed exactly
(`93`, `1:33.5`, `0:01:33.250`). An ordinary seek takes the preview loop's
ownership of the playhead and keeps it, so scrubbing past the out point no
longer snaps back; "Preview clip" is how it is asked for again.

**The editor fits on a phone.** Layout is measured on the player, never the
device. Below 600x360 range editing and naming become two steps so neither is
cut off; below 220px tall the control bar is given up for the duration of the
edit with Play/Pause moved into the toolbar; below 160px the editor becomes a
bounded scrollable sheet. Range editing is a nonmodal labelled region (no
document-wide focus trap), the details step is a labelled `aria-modal="false"`
dialog, and Escape is scoped to focus inside its own player so two players never
answer each other.

New clip error codes: `media-type-unknown` ("Video information is not available
yet. Press Play and try again.") and `native-fullscreen-active`, for the iPhone's
own fullscreen player where no custom DOM control can exist. The gate is
re-checked at commit, so a selection is never submitted against a source that
has changed under it.
