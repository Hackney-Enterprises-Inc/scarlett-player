# @scarlett-player/embed

Standalone, CDN-ready embed package for Scarlett Player. Drop in a single `<script>` tag and start streaming.

## Features

- **Zero Dependencies** - Self-contained bundle with everything included
- **Auto-initialization** - Finds and initializes players automatically
- **Data Attributes** - Configure players via HTML attributes
- **Global API** - Programmatic control via `window.ScarlettPlayer`
- **Multi-tenant Ready** - Brand customization via data attributes
- **Unified API** - Single API for video, audio, and compact audio players
- **iframe Support** - Helper page for URL-based iframe embeds

## Installation

### CDN Usage (Recommended for Embeds)

```html
<!-- Full build (video + audio + all plugins) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>

<!-- Video-only build (lightweight) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.video.umd.cjs"></script>

<!-- Audio-only build (audio + playlist + media-session) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.audio.umd.cjs"></script>
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
| `data-brand-color` | string | - | Accent color (e.g., `#e50914`) |
| `data-primary-color` | string | - | Primary UI color |
| `data-background-color` | string | - | Control bar background |
| `data-hide-delay` | number | `3000` | Auto-hide delay (ms) |
| `data-width` | string | - | Player width (e.g., `100%`, `640px`) |
| `data-height` | string | - | Player height |
| `data-aspect-ratio` | string | - | Aspect ratio (e.g., `16:9`, `4:3`) |
| `data-keyboard` | boolean | `true` | Enable keyboard shortcuts |
| `data-loop` | boolean | `false` | Loop playback |
| `data-playback-rate` | number | `1.0` | Playback speed |
| `data-start-time` | number | `0` | Start position (seconds) |
| `data-share-url` | string | - | Canonical page URL for the share plugin. Set this on iframe embeds, or sharing links to the player page instead of yours |
| `data-class` | string | - | Custom CSS class(es) |

#### Audio-specific Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `data-title` | string | Track/episode title |
| `data-artist` | string | Artist/creator name |
| `data-album` | string | Album name |
| `data-artwork` | string | Album art / cover image URL |

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
```

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

<!-- Audio player iframe -->
<iframe
  src="https://assets.thestreamplatform.com/scarlett-player/latest/iframe.html?src=https://example.com/audio.m3u8&type=audio"
  width="100%"
  height="120"
  frameborder="0"
  allow="autoplay"
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

All data attributes work as URL parameters (use kebab-case):
- `src` (required)
- `type` - `video`, `audio`, or `audio-mini`
- `autoplay`, `muted`, `loop`
- `poster`
- `brand-color`, `primary-color`, `background-color`

## Player Types

### Video Player (default)

Standard video player with full controls, fullscreen, picture-in-picture support.
Takes an HLS manifest or a progressive video file.

```html
<div data-scarlett-player data-src="video.m3u8"></div>
<div data-scarlett-player data-src="bout-13.mp4"></div>
```

### Audio Player

Full-sized audio player with waveform, track info, and media session integration.
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
| **Full** | `embed.js` / `embed.umd.cjs` | Video + Audio + Analytics + Playlist + Media Session |
| **Video** | `embed.video.js` / `embed.video.umd.cjs` | Video player only (lightweight) |
| **Audio** | `embed.audio.js` / `embed.audio.umd.cjs` | Audio + Playlist + Media Session, on `hls.js/light` (no ID3) |

**Which build should I use?**

- Use **Full** (`embed.umd.cjs`) if you need both video and audio, or want analytics
- Use **Video** (`embed.video.umd.cjs`) for video-only sites to reduce bundle size
- Use **Audio** (`embed.audio.umd.cjs`) for audio-only sites (podcasts, music streaming). It is built on `hls.js/light`, so it cannot read ID3 timed metadata: see [Audio build: hls.js/light](#audio-build-hlsjslight)

**Note:** Using a build without support for a player type will throw an error. For example, using the Video build and setting `data-type="audio"` will fail with a helpful error message.

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

- Modern browsers (ES2020+)
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

## Keyboard Shortcuts

When `data-keyboard` is enabled (default):

- `Space` / `K` - Play/Pause
- `M` - Mute/Unmute
- `F` - Fullscreen
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

For detailed implementation docs including Laravel integration, see:
- [Embed Implementation Guide](../../.claude/docs/embed-implementation.md)

## Support

For issues and questions, visit: https://github.com/Hackney-Enterprises-Inc/scarlett-player
