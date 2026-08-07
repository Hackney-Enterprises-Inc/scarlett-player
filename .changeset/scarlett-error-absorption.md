---
'@scarlett-player/hls': minor
'@scarlett-player/core': minor
---

Playback fault absorption for the watch-page cutover. The HLS plugin now has a unified pipeline teardown with a load-session guard, so a superseded load, watchdog, retry timer, or reconnect attempt can never fire into the current session or leave a load promise hanging. MSE append and quota failures are classified as their own recoverable error codes (MEDIA_APPEND_ERROR, MEDIA_BUFFER_FULL) and still ride the media-recovery and auto-reconnect path. Live playlist refreshes are validated before parsing: an error page, master-only response, or empty document becomes a normal bounded network retry (PLAYLIST_INVALID when exhausted) instead of being indexed blindly, and playback continues on the previous playlist during retries. The light build now shares the full build's machinery (auto-reconnect, load watchdog, structured error codes, playlist validation) through one factory instead of drifting behind it. Core gains ErrorHandler.record() for advisory errors and records media element errors in history without flipping the player's error state.
