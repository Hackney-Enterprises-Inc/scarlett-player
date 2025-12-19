---
"@scarlett-player/embed": minor
"@scarlett-player/hls": patch
---

Refactor embed builds to unified ScarlettPlayer API

**Breaking Changes:**
- Removed separate `ScarlettAudio` global - now use `ScarlettPlayer` with `type` option
- Simplified from 5+ bundle variants to 3 clean builds
- Changed audio type configuration from separate API to `data-type="audio"` attribute

**New Build Structure:**
- **embed.js** / **embed.umd.cjs** - Full build with video + audio + analytics + playlist + media-session
- **embed.video.js** / **embed.video.umd.cjs** - Video player only (lightweight)
- **embed.audio.js** / **embed.audio.umd.cjs** - Audio player + playlist + media-session

**Usage:**
```html
<!-- Video player (default) -->
<div data-scarlett-player data-src="video.m3u8"></div>

<!-- Audio player -->
<div data-scarlett-player data-src="audio.m3u8" data-type="audio"></div>

<!-- Compact audio player -->
<div data-scarlett-player data-src="audio.m3u8" data-type="audio-mini"></div>
```

**JavaScript API:**
```javascript
ScarlettPlayer.create({
  container: '#player',
  src: 'video.m3u8',
  type: 'video' // 'video' | 'audio' | 'audio-mini'
});
```

HLS plugin still exports a light build via `@scarlett-player/hls/light` using hls.js/light.
