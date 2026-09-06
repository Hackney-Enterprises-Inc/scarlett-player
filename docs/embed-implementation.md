# Embed Package Implementation Guide

This document contains all implementation details for the `@scarlett-player/embed` package - a standalone, CDN-ready embed for Scarlett Player.

## Quick Start

### Build & Test

```bash
cd packages/embed
pnpm install
pnpm build
pnpm dev  # Opens demo.html
```

### Simplest Integration

```html
<script src="https://cdn.thestreamplatform.com/player/embed.umd.cjs"></script>
<div data-sp src="https://example.com/video.m3u8"></div>
```

That's it! The player auto-initializes on page load.

---

## Package Structure

```
packages/embed/
├── src/
│   ├── index.ts      # Main entry, global API, auto-init
│   ├── embed.ts      # Player creation logic
│   ├── parser.ts     # Data attribute parsing
│   └── types.ts      # TypeScript definitions
├── templates/
│   ├── laravel-embed.blade.php  # Laravel Blade template for /v/{id}
│   └── EmbedController.php      # Example Laravel controller
├── demo.html         # Interactive demo page
├── iframe.html       # iframe embed helper
├── package.json
├── tsconfig.json
└── vite.config.ts

dist/ (generated)
├── embed.js          # ES module
├── embed.umd.cjs     # UMD bundle (for script tags)
├── embed.d.ts        # TypeScript definitions
└── *.map             # Source maps
```

---

## Three Ways to Embed

### 1. Drop-in Script (Simplest)

**Supported selectors** (all work):
- `data-sp` - shortest
- `data-scarlett-player` - full name
- `data-video-player` - generic
- `.scarlett-player` - class-based

**Supported attribute formats** (all work):
- Short: `src`, `color`, `autoplay`, `muted`, `poster`
- Full: `data-src`, `data-brand-color`, `data-autoplay`, etc.

```html
<!-- Simplest possible -->
<div data-sp src="video.m3u8"></div>

<!-- With branding -->
<div data-sp src="video.m3u8" color="#e50914"></div>

<!-- Full attribute names also work -->
<div data-scarlett-player data-src="video.m3u8" data-brand-color="#e50914"></div>

<!-- Class-based -->
<div class="scarlett-player" src="video.m3u8"></div>
```

### 2. JavaScript API (More Control)

```javascript
const player = ScarlettPlayer.create({
  container: '#player',
  src: 'video.m3u8',
  brandColor: '#e50914',
  autoplay: true,
  muted: true,
});

// Control the player
player.play();
player.pause();
player.setVolume(0.5);
player.destroy();
```

### 3. iframe Embed (Secure/Isolated)

```html
<!-- URL parameters -->
<iframe
  src="https://embed.thestreamplatform.com/iframe.html?src=VIDEO_URL&brand-color=%23e50914"
  allow="autoplay; fullscreen"
  allowfullscreen
></iframe>

<!-- Video ID (requires Laravel backend) -->
<iframe src="https://embed.thestreamplatform.com/v/abc123"></iframe>

<!-- Event slug -->
<iframe src="https://embed.thestreamplatform.com/embed/fight-night-2025"></iframe>
```

---

## Laravel Integration for `/v/{id}` URLs

### How It Works

```
User loads: https://embed.thestreamplatform.com/v/abc123
                            ↓
Laravel route: Route::get('/v/{video:uuid}', [EmbedController::class, 'video'])
                            ↓
Controller looks up video in database
                            ↓
Returns Blade template with player pre-configured:
  - Stream URL from database
  - Brand colors from tenant settings
  - Poster, autoplay, etc.
```

### Routes (add to routes/web.php)

```php
Route::get('/v/{video:uuid}', [EmbedController::class, 'video']);
Route::get('/embed/{event:slug}', [EmbedController::class, 'event']);
Route::get('/live/{channel}', [EmbedController::class, 'live']);
```

### Controller Example

```php
<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Video;

class EmbedController extends Controller
{
    /**
     * Embed a video by UUID
     * URL: /v/abc123
     */
    public function video(Video $video)
    {
        if (!$video->embeddable) {
            abort(403, 'This video cannot be embedded');
        }

        return view('embed.player', [
            'src' => $video->stream_url,
            'title' => $video->title,
            'poster' => $video->thumbnail_url,
            'autoplay' => request()->boolean('autoplay'),
            'muted' => request()->boolean('muted', request()->boolean('autoplay')),
            'brandColor' => $video->tenant->brand_color,
            'tenant' => $video->tenant,
        ]);
    }

    /**
     * Embed a live event by slug
     * URL: /embed/fight-night-2025
     */
    public function event(Event $event)
    {
        if (!$event->is_public && !$event->isAccessibleBy(auth()->user())) {
            abort(403, 'Access denied');
        }

        return view('embed.player', [
            'src' => $event->live_stream_url ?? $event->replay_url,
            'title' => $event->title,
            'poster' => $event->poster_url,
            'autoplay' => $event->is_live,
            'muted' => $event->is_live,
            'brandColor' => $event->tenant->brand_color,
            'tenant' => $event->tenant,
        ]);
    }
}
```

### Blade Template (resources/views/embed/player.blade.php)

```blade
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>{{ $title ?? 'Video Player' }}</title>
  <meta name="robots" content="noindex, nofollow">
  @if(isset($poster))
  <meta property="og:image" content="{{ $poster }}">
  @endif
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #player { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script src="{{ config('services.scarlett.cdn_url') }}/embed.umd.cjs"></script>
  <script>
    ScarlettPlayer.create(@json([
      'container' => '#player',
      'src' => $src,
      'autoplay' => $autoplay ?? false,
      'muted' => $muted ?? false,
      'poster' => $poster ?? null,
      'brandColor' => $brandColor ?? null,
    ]));
  </script>
</body>
</html>
```

---

## All Data Attributes

| Attribute | Short Form | Type | Default | Description |
|-----------|------------|------|---------|-------------|
| `data-src` | `src` | string | **required** | Video source URL (.m3u8) |
| `data-autoplay` | `autoplay` | boolean | `false` | Auto-play on load |
| `data-muted` | `muted` | boolean | `false` | Start muted |
| `data-poster` | `poster` | string | - | Poster image URL |
| `data-controls` | `controls` | boolean | `true` | Show/hide UI controls |
| `data-brand-color` | `color` | string | - | Accent color (`#e50914`) |
| `data-primary-color` | - | string | - | Primary text color |
| `data-background-color` | - | string | - | Control bar background |
| `data-width` | - | string | - | Width (`100%`, `640px`) |
| `data-height` | - | string | - | Height |
| `data-aspect-ratio` | - | string | - | Aspect ratio (`16:9`) |
| `data-loop` | `loop` | boolean | `false` | Loop playback |
| `data-playback-rate` | - | number | `1.0` | Playback speed |
| `data-start-time` | - | number | `0` | Start position (seconds) |
| `data-hide-delay` | - | number | `3000` | Auto-hide delay (ms) |
| `data-keyboard` | `keyboard` | boolean | `true` | Enable keyboard shortcuts |

---

## Multi-Tenant Branding

Each TSP client gets their own branded player:

```html
<!-- Client A: Red -->
<div data-sp src="{{ $clientA->stream }}" color="{{ $clientA->brand_color }}"></div>

<!-- Client B: Blue -->
<div data-sp src="{{ $clientB->stream }}" color="{{ $clientB->brand_color }}"></div>
```

### Embed Code Generator (Laravel)

```php
public function generateEmbed(Event $event): string
{
    $params = http_build_query([
        'src' => $event->stream_url,
        'brand-color' => $event->client->brand_color,
        'autoplay' => 'true',
        'muted' => 'true',
    ]);

    $cdnUrl = config('services.scarlett.cdn_url');

    return <<<HTML
    <iframe
      src="{$cdnUrl}/iframe.html?{$params}"
      width="640" height="360"
      frameborder="0" allowfullscreen
      allow="autoplay; fullscreen; picture-in-picture"
    ></iframe>
    HTML;
}
```

---

## CDN Deployment

### Files to Upload

```
dist/embed.js          # ES module
dist/embed.umd.cjs     # UMD bundle (for script tags)
dist/embed.d.ts        # TypeScript support
dist/*.map             # Source maps (optional)
iframe.html            # iframe embed helper
```

### Recommended URL Structure

```
cdn.thestreamplatform.com/player/
├── v0.1.0/
│   ├── embed.js
│   ├── embed.umd.cjs
│   └── iframe.html
├── latest/ → v0.1.0/  # Symlink to current
└── embed.umd.cjs      # Always latest
```

### Usage

```html
<!-- Pin to version (recommended) -->
<script src="https://cdn.../player/v0.1.0/embed.umd.cjs"></script>

<!-- Always latest -->
<script src="https://cdn.../player/latest/embed.umd.cjs"></script>
```

---

## Bundle Size

| Component | Minified | Gzipped |
|-----------|----------|---------|
| Core | ~20 KB | ~8 KB |
| HLS Plugin | ~15 KB | ~6 KB |
| hls.js | ~200 KB | ~65 KB |
| UI Plugin | ~25 KB | ~10 KB |
| **Total** | **~260 KB** | **~85 KB** |

### Optimization Tips

1. **CDN Caching**: `max-age=31536000` (1 year) with versioned URLs
2. **Preload**: `<link rel="preload" href="embed.umd.cjs" as="script">`
3. **Lazy Load**: Load script only when player scrolls into view

---

## Troubleshooting

### Player not showing?
- Check browser console for errors
- Verify `src` URL is accessible
- Ensure script loads before DOM elements

### Colors not applying?
- Use valid CSS colors: `#ff0000`, `rgb(255,0,0)`
- Check attribute names (kebab-case)

### Video not playing?
- Verify HLS stream is valid (.m3u8)
- Check CORS headers on stream
- Add `muted` for autoplay (mobile requirement)

### iframe not loading?
- Check CORS headers allow embedding
- URL-encode the `src` parameter
- Verify `allow="autoplay; fullscreen"` is set

---

## Development

```bash
# Install
pnpm install

# Dev mode with hot reload
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm typecheck
```

### Adding New Data Attributes

1. Add to `EmbedConfig` in `src/types.ts`
2. Add parsing in `src/parser.ts`
3. Use in `src/embed.ts`
4. Update this doc and demo.html

---

## Deployment Checklist

- [ ] Build: `pnpm build`
- [ ] Test demo.html locally
- [ ] Test iframe.html with sample URL
- [ ] Verify UMD and ES builds work
- [ ] Upload to CDN with version path
- [ ] Update "latest" symlink
- [ ] Test CDN URLs in production
- [ ] Update TSP Laravel config with CDN URL
- [ ] Create embed code generator in admin

---

## TSP-Web Agent Implementation Prompt

Use this prompt with the `tsp-web` agent to implement the embed in TSP Laravel:

```
Implement Scarlett Player embed integration in TSP Laravel:

1. **Config** - Add to config/services.php:
   - 'scarlett' => ['cdn_url' => env('SCARLETT_CDN_URL', 'https://cdn.thestreamplatform.com/player')]

2. **Routes** - Add to routes/web.php:
   - GET /v/{video:uuid} -> EmbedController@video
   - GET /embed/{event:slug} -> EmbedController@event
   - GET /live/{channel} -> EmbedController@live

3. **Controller** - Create app/Http/Controllers/EmbedController.php:
   - video() method: Look up Video by UUID, check embeddable flag, return embed view with stream_url, brand colors from tenant
   - event() method: Look up Event by slug, check access, return embed view with live/replay URL
   - live() method: Look up LiveChannel, return embed view

4. **Blade Template** - Create resources/views/embed/player.blade.php:
   - Minimal HTML page that loads embed.umd.cjs from CDN
   - Initializes ScarlettPlayer.create() with passed config
   - Include OG meta tags for link previews

5. **Embed Code Generator** - Add to EventController or admin:
   - generateEmbedCode(Event $event) method that returns iframe HTML
   - Display in admin panel for copy/paste

6. **Environment** - Add SCARLETT_CDN_URL to .env.example

Reference: See packages/embed/templates/ for example controller and blade template.
```

---

## NPM Publishing

### Prerequisites

1. **npm account** - Create at https://www.npmjs.com/signup
2. **Organization** (optional) - For scoped packages like `@scarlett-player/*`
3. **2FA enabled** - Required for publishing

### Publishing Steps

```bash
# 1. Login to npm
npm login

# 2. Build all packages
cd /path/to/scarlett-player
pnpm build

# 3. Publish each package (from package directory)
cd packages/core && npm publish --access public
cd packages/plugins/hls && npm publish --access public
cd packages/plugins/ui && npm publish --access public
cd packages/vue && npm publish --access public
cd packages/embed && npm publish --access public
```

### Before Publishing Checklist

- [ ] Update version in all package.json files (use `pnpm version`)
- [ ] Set correct `repository` URL in package.json (currently "TBD")
- [ ] Add `LICENSE` file to root and packages
- [ ] Verify `files` field in package.json includes correct files
- [ ] Run `pnpm validate` (lint + typecheck + test + build)
- [ ] Create CHANGELOG entries
- [ ] Tag release in git

### Scoped vs Unscoped

**Scoped (recommended):** `@scarlett-player/core`
- Requires npm organization or user scope
- Better namespace protection
- Use `--access public` for public packages

**Unscoped:** `scarlett-player-core`
- Simpler but namespace collision risk
- Anyone can publish similar names

### Automated Publishing (CI/CD)

Add to GitHub Actions:

```yaml
name: Publish
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm publish -r --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Current Blockers for Publishing

1. **No tests** - Write tests before publishing
2. ~~**Repository URL is "TBD"**~~ - ✅ Set to https://github.com/Hackney-Enterprises-Inc/scarlett-player
3. **Empty stub packages** - Remove or implement react/, 19 stub plugins
4. **Version 0.1.0** - Consider 1.0.0 for stable release
5. ~~**No LICENSE file**~~ - ✅ MIT license added
