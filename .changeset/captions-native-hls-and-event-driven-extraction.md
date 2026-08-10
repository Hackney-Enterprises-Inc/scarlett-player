---
'@scarlett-player/captions': minor
---

Captions now work on native HLS and no longer race the manifest.

Subtitle renditions are picked up from hls.js via its `hlsSubtitleTracksUpdated` event instead of a blind 500ms `setTimeout`, so slow manifests no longer lose their tracks. The previous unsubscribe path referenced a handler that was never assigned and used the enum key `SUBTITLE_TRACKS_UPDATED` rather than the value hls.js emits, so it could never have matched; both are fixed, and repeated events now replace the derived `<track>` elements instead of appending duplicates.

On the native HLS path (Safari and iOS), extraction previously returned early and nothing synced the track list, leaving `textTracks` empty and the captions button hidden even though the browser had parsed the renditions itself. The plugin now observes the video's `TextTrackList` and syncs once on load, so browser-created tracks reach player state and become selectable. Selection made outside the player — Safari's own subtitle menu — is reflected back into state too.

Auto-select is now applied at most once per media item, so a re-sync can't override an explicit choice with the default language.
