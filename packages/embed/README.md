# @scarlett-player/embed

Standalone, CDN-ready embed package for Scarlett Player. Drop in a single `<script>` tag and start streaming.

> **Docs:** [scarlettplayer.com/documentation](https://scarlettplayer.com/documentation/) · **For AI coding agents:** [llms.txt](https://scarlettplayer.com/llms.txt) (index) and [llms-full.txt](https://scarlettplayer.com/llms-full.txt) (every guide as one Markdown file)

## Features

- **Zero Dependencies** - Self-contained bundle with everything included
- **Auto-initialization** - Finds and initializes players automatically
- **Data Attributes** - Configure players via HTML attributes
- **Global API** - Programmatic control via `window.ScarlettPlayer`
- **Multi-tenant Ready** - Brand customization via data attributes
- **Unified API** - Single API for video, audio, and compact audio players
- **iframe Support** - Helper page for URL-based iframe embeds
- **Sharing** - Opt-in share button on video: OS share sheet, copy link, embed code
- **Addons** - Chapters, clips, analytics, playlist, media session, watermark and share as separate CDN files, loaded only by the pages that use them, see [Addons](#addons)

## Installation

### CDN Usage (Recommended for Embeds)

```html
<!-- Option A: Full build (video + audio + all plugins) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>

<!-- Option B: Video-only build (lightweight) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.video.umd.cjs"></script>

<!-- Option C: Audio-only build (audio + playlist + media-session) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.audio.umd.cjs"></script>

<!-- Load one of the three builds above, not several: each sets window.ScarlettPlayer,
     and the Audio build replaces it. -->

<!-- Optional addons, only after the Full or Video build and from the same
     version directory (see Addons) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.chapters.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.clips.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.analytics.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.playlist.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.media-session.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.watermark.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.share.umd.cjs"></script>
```

### NPM Installation

```bash
npm install @scarlett-player/embed
# or
pnpm add @scarlett-player/embed
```

## Supported sources

Every build registers two providers and picks the first one that accepts the
source URL, by file extension:

| Source | Provider | Extensions |
|--------|----------|------------|
| HLS | hls.js, or the browser's own HLS in Safari | `.m3u8` |
| Progressive video | native `<video>` element | `.mp4`, `.m4v`, `.webm`, `.mov`, `.mkv`, `.ogv` |
| Progressive audio | native media element | `.mp3`, `.m4a`, `.aac`, `.wav`, `.ogg`, `.opus`, `.flac`, `.weba` |

HLS always wins for `.m3u8`. The native provider also asks the browser whether
it can play the format before claiming a source, so an `.mkv` in a browser
without Matroska support is declined rather than played into a black frame.

Before 1.7.1 no embed build registered the native provider at all, and any
non-HLS source failed with `PROVIDER_NOT_FOUND`. If you are on an older build,
upgrade rather than working around it.

### Audio build: hls.js/light

`embed.audio.js` / `embed.audio.umd.cjs` build on `hls.js/light`, which drops
in-stream subtitle parsing, ID3 tag parsing and EME/DRM in exchange for a much
smaller bundle. The audio build ships no captions plugin and audio embeds are
not DRM sources, so **ID3 timed metadata is the one capability an audio embed
gives up**. If you need ID3 (in-stream "now playing" updates on a live audio
stream, typically), use the Full build.

## Usage

### 1. Declarative (Data Attributes)

The simplest way to embed a player. Just add the script and use data attributes:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>
</head>
<body>
  <!-- Video player (default) -->
  <div
    data-scarlett-player
    data-src="https://example.com/stream.m3u8"
  ></div>

  <!-- Audio player (HLS) -->
  <div
    data-scarlett-player
    data-src="https://example.com/podcast.m3u8"
    data-type="audio"
    data-title="Episode 1: Introduction"
    data-artist="My Podcast"
  ></div>

  <!-- Audio player (progressive MP3 file) -->
  <div
    data-scarlett-player
    data-src="https://example.com/episode-42.mp3"
    data-type="audio"
    data-title="Episode 42: Deep Dive"
    data-artist="My Podcast"
    data-artwork="https://example.com/podcast-cover.jpg"
  ></div>

  <!-- Compact audio player -->
  <div
    data-scarlett-player
    data-src="https://example.com/music.m3u8"
    data-type="audio-mini"
    data-title="Song Title"
    data-artist="Artist Name"
  ></div>

  <!-- Customized video player -->
  <div
    data-scarlett-player
    data-src="https://example.com/stream.m3u8"
    data-autoplay
    data-muted
    data-poster="https://example.com/poster.jpg"
    data-brand-color="#e50914"
    data-aspect-ratio="16:9"
  ></div>
</body>
</html>
```

#### Available Data Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-src` | string | **required** | Media source URL. HLS (`.m3u8`) or a progressive file, see [Supported sources](#supported-sources) |
| `data-type` | string | `video` | Player type: `video`, `audio`, or `audio-mini` |
| `data-autoplay` | boolean | `false` | Auto-play on load |
| `data-muted` | boolean | `false` | Start muted |
| `data-poster` | string | - | Poster/artwork image URL |
| `data-controls` | boolean | `true` | Show/hide UI controls |
| `data-big-play-button` | boolean | `true` | Centred play button over the poster (video only). Set `false` when your page draws its own play affordance |
| `data-gestures` | boolean | `true` | Touch gestures on the picture (video only): double-tap the sides to seek, tap to toggle the controls. Touch only, by input type, so a mouse never triggers them. Set `false` if your page owns those gestures |
| `data-brand-color` | string | - | Accent color, any CSS color value (e.g., `#e50914`, `rgb(229 9 20)`, `crimson`). Hex, `rgb()`/`rgba()` and named colors also get a readable text tone derived for them, see `data-brand-text-color`. `data-color` is accepted as an alias |
| `data-brand-text-color` | string | derived | Accent for TEXT and active-state glyphs: the LIVE label, the active rows in the settings and quality menus. Defaults to a readable tone derived from `data-brand-color` in any hex, `rgb()` or named form (any other form, such as `hsl()` or `var()`, is used as given), because text answers to 4.5:1 where a fill answers to 3:1 and your CSS cannot reach inside the player. Set it to take that over |
| `data-primary-color` | string | - | Primary UI color |
| `data-background-color` | string | - | Control bar background |
| `data-hide-delay` | number | `3000` | Auto-hide delay (ms) |
| `data-width` | string | - | Player width (e.g., `100%`, `640px`) |
| `data-height` | string | - | Player height |
| `data-aspect-ratio` | string | - | Aspect ratio (e.g., `16:9`, `4:3`) |
| `data-keyboard` | boolean | `true` | Keyboard shortcuts (video only). Set `false` to turn all of the player's shortcuts off |
| `data-loop` | boolean | `false` | Loop playback |
| `data-playback-rate` | number | `1.0` | Playback speed; reset to `1` on a live stream without a DVR window |
| `data-start-time` | number | `0` | Start position (seconds) |
| `data-class` | string | - | Custom CSS class(es) |
| `data-share-url` | string | - | Page URL to share. Setting it adds a share button to the video control bar; leaving it out changes nothing. Never the media `src`, see [Sharing](#sharing) |
| `data-embed-base-url` | string | - | URL of your `iframe.html` deployment. Only read alongside `data-share-url`, and only to enable the `embed` target in the share sheet |

#### Audio-specific Attributes

| Attribute | Type | Builds | Description |
|-----------|------|--------|-------------|
| `data-title` | string | Full, Audio, with the [media-session addon](#addons) for Video | Track/episode title. On a video player the media-session addon installs only when this attribute is present |
| `data-artist` | string | Full, Audio, with the [media-session addon](#addons) for Video | Artist/creator name. On a video player it does not enable the addon on its own: `data-title` is required |
| `data-album` | string | Full, Audio, with the [media-session addon](#addons) for Video | Album name. On a video player it does not enable the addon on its own: `data-title` is required |
| `data-artwork` | string | Full, Audio, with the [media-session addon](#addons) for Video | Album art / cover image URL. On a video player it does not enable the addon on its own: `data-title` is required |
| `data-playlist` | JSON | Full, Audio (or Video with the [playlist addon](#addons)) | Array of `{ src, videoId?, title?, artist?, poster?, artwork?, duration? }`. Each item that loads is its own analytics view, reported under its `videoId`, or under `data-analytics-video-id` when it has none. The first item's `videoId` applies from the first view unless `data-src` names a different source |

#### Analytics Attributes (Full build, or any build with the analytics addon)

| Attribute | Type | Builds | Description |
|-----------|------|--------|-------------|
| `data-analytics-beacon-url` | string | Full, or any build with the [analytics addon](#addons) | Beacon endpoint. Setting it enables the analytics plugin |
| `data-analytics-video-id` | string | as above | Video identifier sent with every beacon |
| `data-analytics-api-key` | string | as above | Optional API key |
| `data-analytics-anonymous` | boolean | as above | Use per-view anonymous identifiers without persistent storage; default `false` |
| `data-analytics-respect-dnt` | boolean | as above | Respect browser Do Not Track / Global Privacy Control and suppress beacons; default `false` |
| `data-analytics-batch` | boolean | as above | Opt in to batch requests; default `false`. Requires an endpoint that accepts `{ batch: 1, sentAt, events: [...] }` rather than single-beacon bodies |

These options apply to the **Full** build, or to any build with the [analytics addon](#addons), and **none enables analytics by
itself**: supply a nonempty `data-analytics-beacon-url` to install the plugin.
Boolean attributes are `true` when present (including an empty value); only
the exact value `false` disables one. Batch tuning (`intervalMs`, `maxEvents`),
`beforeSend` and `playerInitTime` are available only through
`ScarlettPlayer.create({ analytics: { ... } })`, not HTML attributes. For example:

```js
await ScarlettPlayer.create({
  container: '#player', src: 'video.m3u8',
  analytics: {
    beaconUrl: 'https://example.com/beacons', videoId: 'video-1',
    anonymous: true, respectDoNotTrack: true,
    batch: { intervalMs: 10000, maxEvents: 20 },
    playerInitTime: Date.now(),
    beforeSend: (payload) => payload, // return null to drop a beacon
  },
});
```

Batching needs a compatible ingest: `hei/laravel-scarlett-player` v0.3.0
rejects batch envelopes (422). Its currently pinned 1.19.1 embed bundle does
not expose these new embed attributes until that package updates its bundle
in its own repository. Keep batching off for that release or use a compatible
custom endpoint.

#### Captions, Chapters and Clips Attributes

| Attribute | Type | Builds | Description |
|-----------|------|--------|-------------|
| `data-captions` | JSON | Full, Video | Array of `{ language, label, src, kind?, default? }`: WebVTT subtitle or caption tracks. `kind` is `subtitles` (default) or `captions`; `default: true` selects that track on load. Invalid JSON, or JSON that is not an array, logs a warning and is ignored. The audio build warns that captions need a video build |
| `data-chapters` | JSON or URL | Full, Video, with the [chapters addon](#addons) | A value starting with `[` is a JSON array of `{ time, label, endTime?, subtitle?, thumbnail? }` (seconds); anything else is the URL of a WebVTT chapters file (cross-origin needs CORS). Invalid JSON logs a warning and is ignored. Without the addon: one warning naming the addon file, nothing installed |
| `data-clips-endpoint` | string | Full, Video, with the [clips addon](#addons) | URL the viewer's clip is POSTed to. **Inert without `data-clips-csrf="meta"`**: the player warns once and installs nothing, see [Clips and your CSRF token](#clips-and-your-csrf-token). Without the addon: the addon warning instead |
| `data-clips-csrf` | string | as above | `meta`, the only accepted value: send your page's `<meta name="csrf-token">` as `X-CSRF-TOKEN` with each submission. Any other value logs a warning and counts as absent |
| `data-clips-media-id` | string | as above | Id of the media being clipped, sent with each clip. Falls back to `data-analytics-video-id`, then `data-src` |
| `data-clips-max-duration` | number | as above | Longest clip a viewer can select (seconds). Optional; your server should enforce its own limit regardless |
| `data-clips-min-duration` | number | as above | Shortest clip a viewer can select (seconds). Optional |

```html
<div data-scarlett-player
  data-src="https://example.com/event.m3u8"
  data-captions='[{"language":"en","label":"English","src":"/subs/en.vtt","default":true}]'
  data-chapters="https://example.com/event/chapters.vtt"
  data-clips-endpoint="/api/scarlett/clips"
  data-clips-csrf="meta"
  data-clips-media-id="abc123"
></div>
```

The auto-initializer also accepts `data-sp` in place of `data-scarlett-player`.

### 2. Programmatic API

For dynamic player creation:

```html
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>

<div id="my-player"></div>

<script>
  // Create video player
  const videoPlayer = await ScarlettPlayer.create({
    container: '#my-player',
    src: 'https://example.com/stream.m3u8',
    autoplay: true,
    muted: true,
    brandColor: '#e50914',
    aspectRatio: '16:9',
    // Video only, and optional: omit it to keep the centred play button.
    // false hides it, for a page that draws its own play affordance.
    bigPlayButton: false,
  });

  // Create audio player
  const audioPlayer = await ScarlettPlayer.create({
    container: '#audio-player',
    src: 'https://example.com/podcast.m3u8',
    type: 'audio',
    title: 'Episode Title',
    artist: 'Podcast Name',
    artwork: 'https://example.com/artwork.jpg',
  });

  // Create audio player from a progressive MP3 file
  const mp3Player = await ScarlettPlayer.create({
    container: '#mp3-player',
    src: 'https://example.com/episode-42.mp3',
    type: 'audio',
    title: 'Episode 42: Deep Dive',
    artist: 'Tech Podcast',
    artwork: 'https://example.com/podcast-cover.jpg',
  });

  // Create compact audio player
  const miniPlayer = await ScarlettPlayer.create({
    container: '#mini-player',
    src: 'https://example.com/music.m3u8',
    type: 'audio-mini',
    title: 'Song Title',
    artist: 'Artist Name',
  });

  // With playlist
  const playlistPlayer = await ScarlettPlayer.create({
    container: '#playlist-player',
    src: 'track1.m3u8',
    type: 'audio',
    playlist: [
      { src: 'track1.m3u8', title: 'Track 1', artist: 'Artist' },
      { src: 'track2.m3u8', title: 'Track 2', artist: 'Artist' },
    ],
  });
</script>
```

#### Global API

```typescript
// Initialize all players on page
ScarlettPlayer.initAll();

// Create single player
ScarlettPlayer.create(options);

// Check version
console.log(ScarlettPlayer.version);

// Check available player types in this build
console.log(ScarlettPlayer.availableTypes); // ['video', 'audio', 'audio-mini']

// Register an addon's plugin. The addon files call this themselves;
// host code does not need to. See Addons.
ScarlettPlayer.use('chapters', createChaptersPlugin);
```

`ScarlettPlayer.addonRuntime` is also on the global. It is the embed's own copy of the few functions the addon files share with it, frozen, and not an API for host code.

When `create()` returns a player, it is a core `ScarlettPlayer`, with the full [core API](../core/README.md#api). `await player.unload()` leaves the current source and keeps the player (the provider is destroyed, so a WHEP session closes and HLS stops loading) for a later `player.load(src)`; `player.destroy()` discards it. `create()` returns null if the container is not found or no source URL or playlist is supplied.

To drive clips from script (`player.getPlugin('clips').open()`), call `player.play()` first: the clips plugin refuses to open until the media duration is known, and the HLS provider fetches nothing before the first play.

### 3. iframe Embed

For secure, sandboxed embeds:

```html
<!-- Basic iframe embed -->
<iframe
  src="https://assets.thestreamplatform.com/scarlett-player/latest/iframe.html?src=https://example.com/stream.m3u8"
  width="640"
  height="360"
  frameborder="0"
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture"
></iframe>

<!-- With customization -->
<iframe
  src="https://assets.thestreamplatform.com/scarlett-player/latest/iframe.html?src=https://example.com/stream.m3u8&autoplay=true&muted=true&brand-color=%23e50914"
  width="100%"
  height="100%"
  frameborder="0"
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture"
></iframe>
```

#### iframe URL Parameters

`iframe.html` loads the Full build and reads these URL parameters (kebab-case
or camelCase):
- `src` (required)
- `autoplay`, `muted`, `loop` - `true` or `1` to enable
- `controls` - `false` or `0` to hide the control bar
- `poster`
- `brand-color`, `brand-text-color`, `primary-color`, `background-color`
- `big-play-button` - omit to keep the centred play button, `false` or `0` to hide it
- `keyboard` - omit to keep the player's keyboard shortcuts, `false` or `0` to turn them all off
- `hide-delay`, `playback-rate`, `start-time`
- `share-url` - the page the viewer should be sent to. Setting it adds the share button; omitting it leaves the control bar unchanged. See [Sharing](#sharing)
- `embed-base-url` - optional canonical embed URL. Enables the **Embed** snippet target in the share sheet without leaking signed playback parameters

`share-url` is the one parameter the player cannot work out for itself. Inside
the iframe, `window.location.href` is the player page rather than your page, and
cross-origin rules stop anything reading the parent, so a share would otherwise
offer a link to the bare embed. Pass `embed-base-url` if you wish to offer an
`<iframe>` snippet option in the share sheet; omitting it excludes the embed
target to avoid leaking query parameters (such as signed media URLs) from
the running iframe.

The iframe page always creates a video player: it does not read a `type`
parameter in this version. For an audio or compact audio embed use the data
attributes or the programmatic API on your own page.

## Player Types

### Video Player (default)

Standard video player with full controls, fullscreen, picture-in-picture support.
Takes an HLS manifest or a progressive video file.

```html
<div data-scarlett-player data-src="video.m3u8"></div>
<div data-scarlett-player data-src="bout-13.mp4"></div>
```

### Audio Player

Full-sized audio player with album artwork, track info, and media session integration.
Takes an HLS manifest or a progressive audio file.

```html
<div data-scarlett-player data-src="audio.m3u8" data-type="audio"></div>
<div data-scarlett-player data-src="episode-42.mp3" data-type="audio"></div>
```

### Compact Audio Player

Minimal audio player for space-constrained layouts (64px height).

```html
<div data-scarlett-player data-src="audio.m3u8" data-type="audio-mini"></div>
```

## Sharing

Off unless you ask for it. Give the embed the page URL and a share button
appears in the video control bar; leave it out and the control bar is exactly
what it has always been.

```html
<div
  data-scarlett-player
  data-src="https://example.com/stream.m3u8"
  data-share-url="https://example.com/watch/abc"
></div>
```

```html
<iframe
  src="https://assets.thestreamplatform.com/scarlett-player/latest/iframe.html?src=https%3A%2F%2Fexample.com%2Fstream.m3u8&share-url=https%3A%2F%2Fexample.com%2Fwatch%2Fabc"
  width="640" height="360" frameborder="0" allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture"
></iframe>
```

The button opens the OS share sheet on a phone and an in-player sheet
everywhere else, offering copy link and, where a base URL is known, an embed
code. Everything it shares carries the current playback position.

**What gets shared is `data-share-url`, never `data-src`.** There is no
fallback, because playback URLs are frequently signed: sharing one would leak a
credential and hand the recipient a link that expires. That is also why the
embed cannot supply a default and the button stays off until you pass one.

A few limits worth knowing:

- **Video only.** The button is a registered control in the video control bar,
  and the audio UIs render a fixed template with no control registry, so
  `data-type="audio"` and `audio-mini` ignore `data-share-url`. The Audio build
  ships no share plugin at all.
- **Needs the controls.** `data-controls="false"` removes the only way in, so
  sharing is skipped along with the rest of the UI.
- **The embed code is opt-in separately.** The sheet's **Embed** option needs to
  know where your `iframe.html` lives: pass `data-embed-base-url` (or `embed-base-url`
  in `iframe.html`). Without it the option is left out rather than shown broken.

Full configuration (custom targets, icon, analytics hooks) lives in
[`@scarlett-player/share`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/tree/main/packages/plugins/share).

## Multi-Tenant Branding

Perfect for The Stream Platform's white-label needs:

```html
<!-- Client A: Red branding -->
<div
  data-scarlett-player
  data-src="https://example.com/client-a/stream.m3u8"
  data-brand-color="#e50914"
  data-primary-color="#ffffff"
></div>

<!-- Client B: Blue branding -->
<div
  data-scarlett-player
  data-src="https://example.com/client-b/stream.m3u8"
  data-brand-color="#1e90ff"
  data-primary-color="#f0f0f0"
></div>
```

## CDN Builds

All builds are available at `https://assets.thestreamplatform.com/scarlett-player/latest/`

| Build | Files | Features |
|-------|-------|----------|
| **Full** | `embed.js` / `embed.umd.cjs` | Video + Audio + Analytics + Playlist + Media Session + Sharing + Captions + Watermark |
| **Video** | `embed.video.js` / `embed.video.umd.cjs` | Video player only (lightweight), Sharing, Captions, Watermark |
| **Audio** | `embed.audio.js` / `embed.audio.umd.cjs` | Audio + Playlist + Media Session, on `hls.js/light` (no ID3, no sharing) |
| **Addons** | `embed.addon.chapters.*` / `embed.addon.clips.*` / `embed.addon.analytics.*` / `embed.addon.playlist.*` / `embed.addon.media-session.*` / `embed.addon.watermark.*` / `embed.addon.share.*` | Chapters, Clips, Analytics, Playlist, Media Session, Watermark, Share; loaded after a build, see [Addons](#addons) |

**Which build should I use?**

- Use **Full** (`embed.umd.cjs`) if you need both video and audio, or want analytics, playlist, media session or watermark
- Use **Video** (`embed.video.umd.cjs`) for video-only sites to reduce bundle size; add the share, watermark or analytics addon when you need them
- Use **Audio** (`embed.audio.umd.cjs`) for audio-only sites (podcasts, music streaming). It is built on `hls.js/light`, so it cannot read ID3 timed metadata: see [Audio build: hls.js/light](#audio-build-hlsjslight)
- Add an **addon** (`embed.addon.<name>.umd.cjs`) after the build when a page needs a feature not bundled there. The Full build bundles every plugin that is now an addon, except chapters and clips, which no build has carried; in 2.0.0 the bundled ones move to addons, so loading the addons beside the Full build is what keeps today's behaviour through the upgrade

**Note:** Using a build without support for a player type will throw an error. For example, using the Video build and setting `data-type="audio"` will fail with a helpful error message.

## Addons

The embed builds stay as they are in 1.28: every bundled copy is still in the
builds. Each bundled copy that is deprecated (analytics, playlist, media session,
watermark and share in Full; watermark and share in Video) logs a one-time deprecation
notice when a page relies on it. The Audio build's playlist and media session are
not deprecated: they stay bundled in 2.0.0, and their addons are refused beside
Audio. Media session on a titled video player in Full logs no notice. In 2.0.0
the Full and Video builds stop carrying the deprecated plugins, so a page that
loads the matching addon beside its build keeps the feature. An addon registers its
plugin with the embed already on the page through `ScarlettPlayer.use()`, and
uses that embed's own UI, so its control appears in the embed's control bar.

| Addon | Files | Builds | Adds | Enables |
|-------|-------|--------|------|---------|
| Chapters | `embed.addon.chapters.js` / `embed.addon.chapters.umd.cjs` | Full, Video | Chapter markers on the progress bar, a chapter list control, seek to chapter | `data-chapters` |
| Clips | `embed.addon.clips.js` / `embed.addon.clips.umd.cjs` | Full, Video | A clip control: the viewer picks a range with two handles, previews it and submits it to your endpoint | `data-clips-*` |
| Analytics | `embed.addon.analytics.js` / `embed.addon.analytics.umd.cjs` | Full, Video, Audio | Beacon sending, QoE metrics, structured errors, privacy controls | `data-analytics-beacon-url`, `create({ analytics })` |
| Playlist | `embed.addon.playlist.js` / `embed.addon.playlist.umd.cjs` | Full, Video (Audio: built in, addon refused) | Queue management, shuffle, repeat modes, auto-advance | `data-playlist`, `create({ playlist })` |
| Media Session | `embed.addon.media-session.js` / `embed.addon.media-session.umd.cjs` | Full, Video (Audio: built in, addon refused) | Lock-screen controls, media keys, album art, seek bar | audio `data-title`/`data-artist`/`data-album`/`data-artwork`, `create({ title?, artist?, album?, artwork? })` |
| Watermark | `embed.addon.watermark.js` / `embed.addon.watermark.umd.cjs` | Full, Video | Anti-piracy text or image overlay with dynamic repositioning | `create({ watermark })` (no data attribute) |
| Share | `embed.addon.share.js` / `embed.addon.share.umd.cjs` | Full, Video | OS share sheet on mobile, copy link, embed code, playback timestamps | `data-share-url`, `data-embed-base-url`, `iframe.html?share-url=` |

**Deprecated in 1.28, removed in 2.0.0.** The five new addons above replace plugins that are still bundled in the 1.28 builds. In the Full and Video builds, when a page uses a deprecated bundled plugin without loading its addon, the build logs a one-time deprecation warning (Audio's playlist and media session are not deprecated and log none). Load the addon beside the build to silence the warning and keep the feature when the build stops bundling it in 2.0.0.

```html
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.chapters.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.clips.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.analytics.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.playlist.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.media-session.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.watermark.umd.cjs"></script>
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.addon.share.umd.cjs"></script>

<div data-scarlett-player data-src="https://example.com/event.m3u8"
  data-chapters="https://example.com/event/chapters.vtt"
  data-clips-endpoint="/api/scarlett/clips" data-clips-csrf="meta" data-clips-media-id="abc123"
  data-analytics-beacon-url="https://example.com/beacons" data-analytics-video-id="event-1"
  data-playlist='[{"src":"https://example.com/track1.m3u8","title":"Track 1"}]'
  data-share-url="https://example.com/watch/abc"></div>
```

- **Builds.** Chapters and clips work beside the Full and Video builds, on video players. Analytics works beside all three builds. Playlist and media session work beside Full and Video; the Audio build already bundles both and refuses their addons ("already provided by this build"). Watermark works beside Full and Video. Share is video only (the `shareEnabled` gate: `type === 'video' && shareUrl && controls !== false`). Beside a build that never had the plugin, the attribute is ignored with a warning - exactly one per page, per addon. `data-share-url` on an audio player is silent, because the share gate requires a video player.
- **Load order.** The embed first, then the addons. Plain, `defer` or `type="module"` `<script>` tags in that order all run before the embed auto-initialises players (it scans at `DOMContentLoaded`, after every deferred and module script), so nothing else is needed. An addon loaded before the embed logs an error and does nothing; an addon registered after players were created applies only to players created afterwards (`ScarlettPlayer.create()` or a later `initAll()`), and the embed warns about it. Pages using `type="module"` import the ESM files (`embed.js`, then `embed.addon.<name>.js`) in the same order.
- **Analytics load order.** Analytics depends on a second file loading before the first player is created. If the addon loads after `create()` has already run for a player, that player never sends beacons. Load `embed.addon.analytics.umd.cjs` (or `.js` for module pages) before any player on the page is created, the same as every other addon, to keep coverage. The DOM-ready scan already covers plain, `defer` and module scripts in document order, so the usual `<script>` ordering is enough.
- **Versions.** Pin both files to the same `v<version>/` directory, or load both from `latest/`; never mix. An addon refuses to register with an embed of a different version and logs both versions, because a cached `latest/` file beside a newer one is exactly how a mismatched pair happens.
- **Without the addon**, an attribute that needs it logs one warning naming the addon file and installs nothing; the rest of the player is unaffected. Two exceptions: a missing watermark logs a `console.error`, and in 1.28 a build that bundles the plugin (Full, and Video for watermark and share) installs the bundled copy instead. A titled video player without media session logs nothing. The full migration table below maps each attribute or option to the addon file and the builds it works beside.

### Migration table (attribute or option → addon file → builds)

| Trigger | Addon file | Builds | What happens without the addon |
|---------|-----------|--------|-------------------------------|
| `data-analytics-beacon-url`, `data-analytics-video-id`, `data-analytics-api-key`, `data-analytics-anonymous`, `data-analytics-respect-dnt`, `data-analytics-batch`, or `create({ analytics })` | `embed.addon.analytics` | Full, Video, Audio | No beacons. One warning: "data-analytics-beacon-url ignored: load embed.addon.analytics…" (the Full build bundles analytics, so it logs only a deprecation notice instead, and only when the bundled copy is used) |
| `data-playlist`, or `create({ playlist })` | `embed.addon.playlist` | Full, Video (Audio: built in, addon refused) | No playlist navigation. When `data-src` is set the player plays that source, and the first playlist item is the fallback only when `data-src` is absent. One warning: "data-playlist ignored: only the first item plays; load embed.addon.playlist.js (or …umd.cjs) after the embed to enable playlist navigation." |
| audio `data-title`/`data-artist`/`data-album`/`data-artwork`, or `create({ title?, artist?, album?, artwork? })` | `embed.addon.media-session` | Full, Video (Audio: built in, addon refused) | No lock-screen or media-key metadata for audio players (one warning). Titled video players: no warning, but they lose lock-screen metadata in 2.0; load the addon to keep it |
| `create({ watermark })` | `embed.addon.watermark` | Full, Video | No anti-piracy overlay. One `console.error` (missing watermark is a content-protection loss) |
| `data-share-url`, `data-embed-base-url`, or `iframe.html?share-url=` | `embed.addon.share` | Full, Video | No share button. One warning: "data-share-url ignored: load embed.addon.share…". `iframe.html` loads the addon itself in 2.0; until then, add it beside the embed when `share-url` is set |

### Clips and your CSRF token

A clip is a POST to your server on the viewer's behalf, sent with the page's cookies (`credentials: 'same-origin'`), so a Laravel-style backend expects a CSRF token with it. The embed can read one from your page's `<meta name="csrf-token">`, but a third-party script reading your page's token is behaviour you should ask for rather than get by default. So `data-clips-endpoint` does nothing on its own: add `data-clips-csrf="meta"` to allow it, and every submission then carries `X-CSRF-TOKEN` with the meta tag's current content. A page without the tag sends an empty header, and your server's rejection (for example a 419) is shown to the viewer in the clips overlay.

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run in dev mode
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## TypeScript Support

Full TypeScript support when using as a module:

```typescript
import type { EmbedPlayerOptions, PlayerType } from '@scarlett-player/embed';

const options: EmbedPlayerOptions = {
  container: '#player',
  src: 'https://example.com/stream.m3u8',
  type: 'video' as PlayerType,
  autoplay: true,
  brandColor: '#e50914',
};
```

## Browser Support

- Chrome / Edge 80+
- Firefox 78+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

All three bundles are built for ES2020.

## Keyboard Shortcuts

Video players only. When `data-keyboard` is enabled (default); `data-keyboard="false"` turns all of these off:

- `Space` / `K` - Play/Pause
- `M` - Mute/Unmute
- `F` - Fullscreen
- `?` - Open the keyboard shortcut dialog
- `C` - Toggle captions (needs caption tracks)
- `0`-`9` - Seek to 0-90% of the video (of the DVR window on live; nothing on live without DVR)
- `<-` / `->` - Seek -5s / +5s
- `↑` / `↓` - Volume +10% / -10%

## Examples

### Responsive Video Player

```html
<div
  data-scarlett-player
  data-src="https://example.com/stream.m3u8"
  data-width="100%"
  data-aspect-ratio="16:9"
></div>
```

### Auto-play with Muted (Mobile-friendly)

```html
<div
  data-scarlett-player
  data-src="https://example.com/stream.m3u8"
  data-autoplay
  data-muted
></div>
```

### Custom Branding

```html
<div
  data-scarlett-player
  data-src="https://example.com/stream.m3u8"
  data-brand-color="#ff6b6b"
  data-primary-color="#ffffff"
  data-background-color="rgba(0, 0, 0, 0.8)"
  data-hide-delay="5000"
></div>
```

### Podcast Player

```html
<div
  data-scarlett-player
  data-src="https://example.com/podcast.m3u8"
  data-type="audio"
  data-title="Episode 42: Deep Dive"
  data-artist="Tech Podcast"
  data-artwork="https://example.com/podcast-cover.jpg"
></div>
```

### Music Player (Compact)

```html
<div
  data-scarlett-player
  data-src="https://example.com/track.m3u8"
  data-type="audio-mini"
  data-title="Great Song"
  data-artist="Awesome Artist"
  data-brand-color="#1DB954"
></div>
```

## License

MIT

## Documentation

- [Architecture](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/docs/architecture.md)
- [Plugin authoring](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/docs/plugin-authoring.md)
- Live demo: https://scarlettplayer.com

## Support

For issues and questions, visit: https://github.com/Hackney-Enterprises-Inc/scarlett-player
