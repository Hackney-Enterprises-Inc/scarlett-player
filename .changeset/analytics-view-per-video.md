---
"@scarlett-player/analytics": minor
---

Analytics: a new video is a new view. A playlist track change (`playlist:change`, committed when that track's source loads) or the new `setVideo({ videoId, videoTitle?, isLive? })` with a different `videoId` ends the current view and starts one with a new view ID, the new video ID and a running heartbeat. The same `videoId` (a token refresh re-loading the same video) keeps the view. Playing again after a view ended, such as a replay after `ended`, starts a new view of the same video, keeping its live classification. Previously the view was bound to `config.videoId` for the plugin's lifetime, so after a pre-roll ended the main video sent no heartbeat, no watch time and no final `viewEnd`, and a replay was not measured.
