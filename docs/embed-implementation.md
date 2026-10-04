# Embed Package Implementation Guide

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
BUILD_AUDIO=true vite build && BUILD_ADDON=chapters vite build &&
BUILD_ADDON=clips vite build`: `tsc` emits the declarations, then Vite writes
the three builds and the two addons into the same `dist`. `emptyOutDir` is
pinned to `false` because the runs share that directory and the declarations
are already in it.

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
│   ├── create-embed.ts    # Player creation, global API (incl. use()), auto-init scan
│   ├── control-layout.ts  # Video control-bar layout when share, clip or chapters is on
│   ├── parser.ts          # Data attribute parsing
│   ├── types.ts           # EmbedConfig, ScarlettPlayerGlobal, PlayerType
│   ├── version.ts         # __PKG_VERSION__, replaced at build time
│   └── addons/            # Addon entries (chapters.ts, clips.ts), the runtime
│                          # lookup and the core/ui shims they build against
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
├── embed.addon.chapters.js / .umd.cjs          # Chapters addon
├── embed.addon.clips.js / .umd.cjs             # Clips addon
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
| Addons (`embed.addon.chapters`, `embed.addon.clips`) | `src/addons/chapters.ts`, `src/addons/clips.ts` | chapters, clips; each registers into the embed already on the page |

Chapters and clips are not in any embed build; they ship as addons, separate
files a page loads after a Full or Video build. An addon registers its plugin
through `ScarlettPlayer.use()` and reaches core and the UI only through the
embed's frozen `ScarlettPlayer.addonRuntime`, so its control lands in the
embed's own control bar (the UI control registry is per module copy). The
builds stay as they are; new features are addons. Load order, the version rule
and the clips CSRF opt-in are in the
[embed README's Addons section](../packages/embed/README.md#addons).

All three builds assign the same `window.ScarlettPlayer` global, so a page
loads exactly one of them, plus any addons.

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
| `use(name, creator)` | `void` | Register an addon's plugin creator (`chapters` or `clips`); the addon files call it themselves |
| `addonRuntime` | `AddonRuntime` | Frozen: the embed's version and its own `injectSharedStyles`, `registerControl`, `unregisterControl`, for addon bundles only |

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

Laravel hosts can use the Composer package's embed page instead of building a
player page themselves - see the Laravel integration below.

---

## Laravel integration

For Laravel 12/13 on PHP 8.3+, install
[`hei/laravel-scarlett-player` v0.3.0](https://github.com/Hackney-Enterprises-Inc/laravel-scarlett-player/tree/v0.3.0)
instead of copying a controller and Blade template:

```bash
composer require hei/laravel-scarlett-player:^0.3.0
php artisan vendor:publish --tag=scarlett-config
php artisan scarlett:doctor
```

Configure `media.model` and `media.key` (and either a `ScarlettMedia` model,
complete `media.attributes` mapping, or `media.resolver`) so the package can
resolve an id to a playback URL and its live/protected flags. Set
`SCARLETT_CDN_URL=https://assets.thestreamplatform.com/scarlett-player` for
embed mode: the package fills in its pinned version and `embed.js`. See
[Player and embed](https://github.com/Hackney-Enterprises-Inc/laravel-scarlett-player/blob/v0.3.0/README.md#player-and-embed)
for the media contract, feature matrix and config options.

The [Blade component](https://github.com/Hackney-Enterprises-Inc/laravel-scarlett-player/blob/v0.3.0/README.md#blade-component)
uses `module` mode by default: publish `scarlett-js`, install the player npm
packages and import the initialiser in your Vite entry point. Choose `embed`
mode to render data attributes and load the CDN bundle instead:

```blade
<x-scarlett-player :media="$video" autoplay muted />
<x-scarlett-player :media="$video" mode="embed" brand-color="#e50914" />
```

`player.mode` changes the default; `mode="embed"` overrides it per component.
The package's default `player.player_version` is **1.19.1**, including the
embed bundle it loads. Player-side attributes added in a later 1.20 bundle
are **not available** through that pinned embed until the Laravel package is
repinned in its own repo (or the host explicitly configures a compatible
bundle). Do not assume a newer installed module package changes the embed pin.
The authoritative attributes for a chosen bundle are in the
[embed README](../packages/embed/README.md#available-data-attributes).

The package's [embed page](https://github.com/Hackney-Enterprises-Inc/laravel-scarlett-player/blob/v0.3.0/README.md#embed-page)
registers `GET /v/{uuid}` as `scarlett.embed.show` by default (outside the
`api/scarlett` route prefix); no host controller or route is needed. Use
`ScarlettPlayer::embedUrl($video)` for the page URL or
`ScarlettPlayer::embedCode($video)` for an iframe snippet. Protected media,
`embed.always_sign`, or an explicit expiry produces a signed URL; the default
signature TTL is one day. Configure `embed.allowed_domains` with embedding
hosts to restrict `frame-ancestors` (empty allows all); it also constrains
the `shareUrl` query parameter. Plan around expiring links in copied snippets.
See the package's [oEmbed](https://github.com/Hackney-Enterprises-Inc/laravel-scarlett-player/blob/v0.3.0/README.md#oembed)
endpoint, `GET {prefix}/oembed?url=<embed page URL>` (`scarlett.oembed.show`),
for discovery; protected media still requires a valid signed URL.

---

## Multi-tenant branding

Each TSP client gets their own branded player. In Laravel, supply the tenant's
colour through the Blade component's `brand-color` attribute or a
`MediaSource`'s `meta['brand_color']` for the embed page (see the package's
[embed page](https://github.com/Hackney-Enterprises-Inc/laravel-scarlett-player/blob/v0.3.0/README.md#embed-page)):

```html
<!-- Client A: Red -->
<div data-sp src="https://example.com/client-a.m3u8" color="#e50914"></div>

<!-- Client B: Blue -->
<div data-sp src="https://example.com/client-b.m3u8" color="#1e90ff"></div>
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

The script ends by checking the CDN against the origin: the versioned file
must carry the version, and a cache-busted `latest/` must have the same ETag.
The edge's own copy of `latest/` is reported but never failed on, because it
is written with a one-hour `max-age` and turns over on its own. The same
check runs on its own, without credentials, for any published version:

```bash
VERIFY_ONLY=1 ./scripts/upload-cdn.sh 1.16.1
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
pnpm --filter @scarlett-player/embed build      # all three builds and both addons
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
group, so it ships the same version number as the other eighteen packages.
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
