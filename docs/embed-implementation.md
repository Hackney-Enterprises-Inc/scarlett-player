# Embed Package Implementation Guide

**Last Updated**: September 7, 2026 (player 1.11.1)

How `@scarlett-player/embed` is built and how a host integrates it. The
authoritative reference for every supported data attribute is
[`packages/embed/README.md`](../packages/embed/README.md) - this document links
to it rather than repeating the table, so the two cannot drift.

## Quick Start

### Build

```bash
pnpm --filter @scarlett-player/embed build   # from the repo root
pnpm --filter @scarlett-player/embed dev     # Vite dev server over demo.html
```

The build is `rimraf dist && tsc && vite build && BUILD_VIDEO=true vite build &&
BUILD_AUDIO=true vite build`: `tsc` emits the declarations, then Vite writes
three bundles into the same `dist`. `emptyOutDir` is pinned to `false` because
the three builds share that directory and the declarations are already in it.

### Simplest integration

```html
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>
<div data-sp src="https://example.com/video.m3u8"></div>
```

The player auto-initialises on `DOMContentLoaded`.

---

## Package structure

```
packages/embed/
├── src/
│   ├── index.ts           # Full build entry: global API + auto-init
│   ├── index-video.ts     # Video-only build entry
│   ├── index-audio.ts     # Audio-only build entry
│   ├── create-embed.ts    # Player creation, global API, auto-init scan
│   ├── parser.ts          # Data attribute parsing
│   ├── types.ts           # EmbedConfig, ScarlettPlayerGlobal, PlayerType
│   └── version.ts         # __PKG_VERSION__, replaced at build time
├── templates/
│   ├── laravel-embed.blade.php  # Laravel Blade template for /v/{id}
│   └── EmbedController.php      # Example Laravel controller
├── tests/                 # embed, parser, iframe-error, version
├── demo.html              # Interactive demo page
├── iframe.html            # iframe embed helper (published alongside dist)
├── package.json
├── tsconfig.json
├── tsconfig.typecheck.json
├── vite.config.ts
└── vitest.config.ts

dist/ (generated)
├── embed.js / embed.umd.cjs                    # Full build (ESM / UMD)
├── embed.video.js / embed.video.umd.cjs        # Video-only build
├── embed.audio.js / embed.audio.umd.cjs        # Audio-only build
├── hls.<version>.js                            # Shared hls.js chunk (ESM only)
├── hls.light.<version>.js                      # Shared hls.js/light chunk
├── *.d.ts                                      # Declarations, emitted by tsc
└── *.map                                       # Source maps
```

### The three builds

| Build | Entry | Plugins |
|---|---|---|
| Full (`embed`) | `src/index.ts` | hls, native, ui, audio-ui, analytics, playlist, media-session, watermark, captions, gestures, share |
| Video (`embed.video`) | `src/index-video.ts` | hls, native, ui, watermark, captions, gestures, share |
| Audio (`embed.audio`) | `src/index-audio.ts` | hls/light, native, audio-ui, playlist, media-session |

Chapters and clips are not in any embed build; a host that wants them installs
the packages and builds its own bundle.

All three assign the same `window.ScarlettPlayer` global, so a page loads
exactly one of them.

### Why the hls.js chunks carry the version

`latest/` is mutable and cached for an hour while `v<version>/` is immutable, so
an unstamped `latest/hls.js` let a browser pair yesterday's cached chunk with a
freshly fetched `latest/embed.js`. Stamping the name means a cached bundle keeps
importing the exact chunk it was built against.

The full and video builds emit a byte-identical `hls.<version>.js`, and
`guardSharedChunks()` in `vite.config.ts` compares the bytes on every build so a
divergence fails the build instead of shipping whichever copy was written last.
`scripts/check-embed-chunks.mjs` then asserts in CI that every chunk a bundle
imports was actually emitted.

---

## Three ways to embed

### 1. Drop-in script (simplest)

Auto-init scans for three selectors (`PLAYER_SELECTORS` in `create-embed.ts`):

- `[data-scarlett-player]`
- `[data-sp]`
- `.scarlett-player`

Attributes are accepted in both a short and a prefixed form - `src` or
`data-src`, `color` or `data-brand-color`. See
[`packages/embed/README.md`](../packages/embed/README.md) for the full list.

```html
<!-- Simplest possible -->
<div data-sp src="video.m3u8"></div>

<!-- With branding -->
<div data-sp src="video.m3u8" color="#e50914"></div>

<!-- Full attribute names also work -->
<div data-scarlett-player data-src="video.m3u8" data-brand-color="#e50914"></div>

<!-- Audio player -->
<div data-sp data-type="audio" data-src="track.mp3" data-title="Track" data-artist="Artist"></div>
```

### 2. JavaScript API (more control)

`create()` is **async** - it resolves once the plugins are initialised and the
source is loaded. Await it before calling anything on the player.

```javascript
const player = await ScarlettPlayer.create({
  container: '#player',
  src: 'video.m3u8',
  brandColor: '#e50914',
  autoplay: true,
  muted: true,
});

player.play();
player.pause();
player.setVolume(0.5);
player.destroy();
```

The global surface is `ScarlettPlayerGlobal` in `src/types.ts`:

| Member | Type | Purpose |
|---|---|---|
| `create(options)` | `Promise<ScarlettPlayer>` | Build one player programmatically |
| `initAll()` | `Promise<void>` | Re-scan the DOM for player elements |
| `version` | `string` | The embed package version |
| `availableTypes` | `PlayerType[]` | Which of `video` / `audio` this build ships |

### 3. iframe embed (isolated)

`iframe.html` reads its configuration from the query string: `src`, `poster`,
`autoplay`, `muted`, `loop`, `controls`, `start-time`, `playback-rate`,
`hide-delay`, `big-play-button`, `brand-color`, `primary-color`,
`background-color`, `share-url` and `embed-base-url`.

```html
<iframe
  src="https://assets.thestreamplatform.com/scarlett-player/latest/iframe.html?src=VIDEO_URL&brand-color=%23e50914"
  allow="autoplay; fullscreen; picture-in-picture"
  allowfullscreen
></iframe>
```

Host applications can also route their own URLs to a page that renders the
player - see the Laravel integration below.

---

## Laravel integration for `/v/{id}` URLs

Working examples live in `packages/embed/templates/`
(`EmbedController.php`, `laravel-embed.blade.php`).

### How it works

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

### Controller example

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

### Blade template (resources/views/embed/player.blade.php)

```blade
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

## Multi-tenant branding

Each TSP client gets their own branded player:

```html
<!-- Client A: Red -->
<div data-sp src="{{ $clientA->stream }}" color="{{ $clientA->brand_color }}"></div>

<!-- Client B: Blue -->
<div data-sp src="{{ $clientB->stream }}" color="{{ $clientB->brand_color }}"></div>
```

### Embed code generator (Laravel)

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

## CDN deployment

Uploading is automated: `release.yml` hands `packages/embed/dist/` and
`iframe.html` to a separate `cdn` job as a build artifact, which runs
`scripts/upload-cdn.sh <version>`. Uploading the artifact rather than rebuilding
keeps the two jobs publishing byte-identical files and lets a failed upload be
retried with "Re-run failed jobs". A local publish is the same script:

```bash
doppler run -- ./scripts/upload-cdn.sh 1.11.1
```

### Layout

```
assets.thestreamplatform.com/scarlett-player/
├── v<version>/          # immutable, max-age=31536000
│   ├── embed.js, embed.umd.cjs
│   ├── embed.video.js, embed.video.umd.cjs
│   ├── embed.audio.js, embed.audio.umd.cjs
│   ├── hls.<version>.js, hls.light.<version>.js
│   └── iframe.html
└── latest/              # mutable, max-age=3600
```

### Usage

```html
<!-- Pin a version (recommended) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/v1.11.1/embed.umd.cjs"></script>

<!-- Or track latest -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>
```

---

## Bundle size

Measured from a `pnpm --filter @scarlett-player/embed build` at 1.11.0. Gzip is
what a browser actually transfers.

| Entry | Raw | Gzip | Notes |
|---|---|---|---|
| `embed.umd.cjs` | 737 KB | 215 KB | hls.js inlined - UMD cannot code-split |
| `embed.video.umd.cjs` | 692 KB | 204 KB | hls.js inlined |
| `embed.audio.umd.cjs` | 432 KB | 130 KB | hls.js/light inlined |
| `embed.js` | 414 KB | 90 KB | + `hls.<version>.js` on first HLS source |
| `embed.video.js` | 336 KB | 75 KB | + `hls.<version>.js` on first HLS source |
| `embed.audio.js` + its chunk | 209 KB | 45 KB | + `hls.light.<version>.js` on first HLS source |
| `hls.<version>.js` | 1089 KB | 228 KB | lazy, ESM builds only |
| `hls.light.<version>.js` | 717 KB | 152 KB | lazy, audio build only |

Two things the table is showing rather than hiding:

- **The ESM builds are not minified.** Vite's library mode skips terser for the
  `es` format (`if (config.build.lib && outputOptions.format === 'es') return
  null` in `vite:terser`), regardless of `build.minify`. That is harmless for an
  npm consumer whose bundler minifies anyway, but these files are also served
  straight to browsers from the CDN, where the raw column is what leaves the
  origin. The UMD numbers are minified and are the fair comparison.
- **hls.js dominates.** A page that never plays an `.m3u8` never fetches the
  chunk in the ESM builds; a UMD page pays for it up front. Prefer the audio or
  video build over the full one when the page only needs one of them.

Sizes move with every dependency bump - re-measure rather than trusting this
table, and watch what Vite prints during `pnpm build`.

### Optimisation tips

1. **CDN caching**: `max-age=31536000` on versioned paths (already set by `upload-cdn.sh`)
2. **Preload**: `<link rel="preload" href="embed.umd.cjs" as="script">`
3. **Lazy load**: load the script only when the player scrolls into view

---

## Troubleshooting

### Player not showing?
- Check browser console for errors
- Verify `src` URL is accessible
- Ensure the element matches one of the three auto-init selectors

### Colors not applying?
- Use valid CSS colors: `#ff0000`, `rgb(255,0,0)`
- Check attribute names (kebab-case)

### Video not playing?
- Verify the HLS stream is valid (.m3u8)
- Check CORS headers on the stream
- Add `muted` for autoplay (mobile requirement)

### Audio player renders as video (or vice versa)?
- Set `data-type="audio"`; the default is `video`
- Confirm the build ships that type - `ScarlettPlayer.availableTypes`

### iframe not loading?
- Check CORS headers allow embedding
- URL-encode the `src` parameter
- Verify `allow="autoplay; fullscreen"` is set

---

## Development

```bash
pnpm install
pnpm --filter @scarlett-player/embed dev        # Vite dev server
pnpm --filter @scarlett-player/embed build      # all three builds
pnpm --filter @scarlett-player/embed test       # vitest
pnpm --filter @scarlett-player/embed typecheck
```

### Adding a new data attribute

1. Add it to `EmbedConfig` in `src/types.ts`
2. Parse it in `src/parser.ts` (both the short and `data-` prefixed forms)
3. Consume it in `src/create-embed.ts`
4. Cover it in `tests/parser.test.ts`
5. Document it in `packages/embed/README.md` - the authoritative table
6. Add it to `iframe.html` if it should be settable from the query string
7. Update `demo.html`

---

## Releasing

The embed package releases with everything else: it is in the fixed Changesets
group, so it ships the same version number as the other seventeen packages.
Merging a changeset to `main` opens a `chore: release packages` PR; merging that
publishes to npm through trusted publishing (OIDC, no token), tags the release,
and runs the CDN upload described above. Versions are never bumped by hand and
`npm publish` is never run manually - see `docs/contributing.md`.

Before opening the PR:

- [ ] `pnpm validate` (package-script guard, lint, build, package-type guard, typecheck, test)
- [ ] `node scripts/check-package-artifacts.mjs` and `node scripts/check-embed-chunks.mjs`
      after a build, if you touched the manifest or the embed build
- [ ] Test `demo.html` and `iframe.html` locally
- [ ] Verify the UMD global still exposes `create`, `initAll`, `version` and
      `availableTypes` (`scripts/verify-browser.mjs` scenario 6 pins this)
- [ ] A changeset
