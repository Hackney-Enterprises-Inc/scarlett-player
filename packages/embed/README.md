# @scarlett-player/embed

Standalone, CDN-ready embed package for Scarlett Player. Drop in a single `<script>` tag and start streaming.

## Features

- **Zero Dependencies** - Self-contained bundle with everything included
- **Auto-initialization** - Finds and initializes players automatically
- **Data Attributes** - Configure players via HTML attributes
- **Global API** - Programmatic control via `window.ScarlettPlayer`
- **Multi-tenant Ready** - Brand customization via data attributes
- **iframe Support** - Helper page for URL-based iframe embeds

## Installation

### CDN Usage (Recommended for Embeds)

**Video Player:**
```html
<!-- Standard video player -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>

<!-- Light build (~30% smaller, no subtitles/DRM/ID3) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.light.umd.cjs"></script>

<!-- Full build (includes analytics, playlist, media-session) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.full.umd.cjs"></script>
```

**Audio Player:**
```html
<!-- Audio player (compact UI, lock screen controls, playlists) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.audio.umd.cjs"></script>

<!-- Light audio (~30% smaller) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.audio.light.umd.cjs"></script>
```

### NPM Installation

```bash
npm install @scarlett-player/embed
# or
pnpm add @scarlett-player/embed
```

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
  <!-- Basic player -->
  <div
    data-scarlett-player
    data-src="https://example.com/stream.m3u8"
  ></div>

  <!-- Customized player -->
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
| `data-src` | string | **required** | Video source URL (HLS .m3u8) |
| `data-autoplay` | boolean | `false` | Auto-play on load |
| `data-muted` | boolean | `false` | Start muted |
| `data-poster` | string | - | Poster image URL |
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
| `data-class` | string | - | Custom CSS class(es) |

### 2. Programmatic API

For dynamic player creation:

```html
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>

<div id="my-player"></div>

<script>
  // Create player programmatically
  const player = ScarlettPlayer.create({
    container: '#my-player',
    src: 'https://example.com/stream.m3u8',
    autoplay: true,
    muted: true,
    brandColor: '#e50914',
    aspectRatio: '16:9',
  });

  // Access player methods
  player.play();
  player.pause();
  player.setVolume(0.5);
</script>
```

#### Global API Methods

```typescript
// Initialize all players on page
ScarlettPlayer.initAll();

// Create single player
ScarlettPlayer.create(options);

// Check version
console.log(ScarlettPlayer.version);
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
- `autoplay`, `muted`, `loop`
- `poster`
- `brand-color`, `primary-color`, `background-color`

### 4. Audio Player

For audio streaming (podcasts, music, live audio):

```html
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.audio.umd.cjs"></script>

<!-- Basic audio player -->
<div
  data-scarlett-audio
  data-src="https://example.com/podcast.m3u8"
  data-title="Episode 1: Introduction"
  data-artist="My Podcast"
></div>

<!-- Compact audio player -->
<div
  data-scarlett-audio
  data-src="https://example.com/music.m3u8"
  data-compact
  data-title="Song Title"
  data-artist="Artist Name"
  data-artwork="https://example.com/album-art.jpg"
></div>
```

#### Audio Programmatic API

```javascript
// Audio uses ScarlettAudio global
const player = await ScarlettAudio.create({
  container: '#audio-player',
  src: 'https://example.com/stream.m3u8',
  title: 'Track Title',
  artist: 'Artist Name',
  artwork: 'https://example.com/artwork.jpg',
  compact: true,
  // Playlist support
  playlist: [
    { src: 'track1.m3u8', title: 'Track 1', artist: 'Artist' },
    { src: 'track2.m3u8', title: 'Track 2', artist: 'Artist' },
  ],
});
```

#### Audio Data Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `data-src` | string | Audio source URL (HLS .m3u8) |
| `data-title` | string | Track/episode title |
| `data-artist` | string | Artist/creator name |
| `data-album` | string | Album name |
| `data-artwork` | string | Album art / cover image URL |
| `data-compact` | boolean | Use compact layout |
| `data-brand-color` | string | Accent color |
| `data-playlist` | JSON | Playlist as JSON array |

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

## Build Output

After building, you'll get:

```
dist/
├── embed.js                  # ES module - standard video
├── embed.umd.cjs             # UMD - standard video (~177KB gzip)
├── embed.light.js            # ES module - light video
├── embed.light.umd.cjs       # UMD - light video (~124KB gzip)
├── embed.full.js             # ES module - all plugins
├── embed.full.umd.cjs        # UMD - all plugins (~183KB gzip)
├── embed.audio.js            # ES module - audio player
├── embed.audio.umd.cjs       # UMD - audio player (~175KB gzip)
├── embed.audio.light.js      # ES module - light audio
├── embed.audio.light.umd.cjs # UMD - light audio (~122KB gzip)
├── hls-*.js                  # HLS.js chunk (ESM only)
├── hls.light-*.js            # HLS.js light chunk (ESM only)
└── *.map                     # Source maps
```

### Bundle Variants

**Video Players:**
| Variant | Size (gzip) | Features |
|---------|-------------|----------|
| `embed.umd.cjs` | ~177KB | Standard: core + HLS + UI |
| `embed.light.umd.cjs` | ~124KB | Light: HLS light (no subtitles/DRM/ID3) |
| `embed.full.umd.cjs` | ~183KB | Full: + analytics, playlist, media-session |

**Audio Players:**
| Variant | Size (gzip) | Features |
|---------|-------------|----------|
| `embed.audio.umd.cjs` | ~175KB | Audio: core + HLS + audio-ui + media-session + playlist |
| `embed.audio.light.umd.cjs` | ~122KB | Light Audio: with HLS light |

Use light variants for most streaming use cases to reduce load time by ~30%.

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run in dev mode
pnpm dev

# Type checking
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## TypeScript Support

Full TypeScript support when using as a module:

```typescript
import { create, type EmbedPlayerOptions } from '@scarlett-player/embed';

const options: EmbedPlayerOptions = {
  container: '#player',
  src: 'https://example.com/stream.m3u8',
  autoplay: true,
  brandColor: '#e50914',
};

const player = create(options);
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
- `←` / `→` - Seek -5s / +5s
- `↑` / `↓` - Volume +10% / -10%

## Examples

### Responsive Player

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

### Controls Hidden (Audio-only)

```html
<div
  data-scarlett-player
  data-src="https://example.com/audio.m3u8"
  data-controls="false"
  data-autoplay
  data-height="50px"
></div>
```

## License

MIT

## Documentation

For detailed implementation docs including Laravel integration, see:
- [Embed Implementation Guide](../../.claude/docs/embed-implementation.md)

## Support

For issues and questions, visit: https://github.com/Hackney-Enterprises-Inc/scarlett-player
