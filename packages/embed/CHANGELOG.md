# Changelog

## 1.7.1

### Patch Changes

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - The embed plays what it advertises, ships every chunk, and ships its types again.

  **Native provider.** No embed build registered one, so `selectProvider()` had
  only the HLS provider to choose from and its `canPlay()` accepts nothing but
  `.m3u8`. Every `.mp3` and `.mp4` source failed with `PROVIDER_NOT_FOUND`, in all
  three builds, including the audio one. `PluginCreators` gains a `native` slot,
  all three entries pass `createNativePlugin`, and it is registered after the HLS
  provider so HLS keeps `.m3u8` (the native provider's extension list has no
  `m3u8` entry, so it never competes for a manifest, not even in Safari).

  **Light hls.js in the audio build.** `index-audio.ts` now imports from
  `@scarlett-player/hls/light`. The light build drops in-stream subtitles, ID3 and
  EME; the audio build ships no captions plugin and audio embeds are not DRM
  sources, so ID3 timed metadata is the one capability lost, and the README says
  so. `embed.audio.umd.cjs` went from 606,592 bytes (181,604 gzip) at 1.7.0 to
  about 433,000 (130,000 gzip), a 29 percent drop, and the audio build's lazy ES
  chunk from 1,115,611 bytes to 734,717. The native provider costs the video and
  full builds about 6 kB each, which is why `embed.umd.cjs` grew slightly.

  **Chunk naming.** `chunkFileNames` was the fixed string `'hls.js'`, which
  assumed one chunk per build. The playlist plugin pulls its controls in through
  `void import('@scarlett-player/ui')`, so the audio build produced a second
  chunk that Rollup deduplicated to `hls2.js`, a name `scripts/upload-cdn.sh`
  never uploaded: `embed.audio.js` on the CDN imported `./hls2.js` and got a 404,
  and the playlist plugin swallowed the failed import with a log line, so the CDN
  audio build had no prev/next controls and nothing went red. That shipped from
  the v1.6.0 release on 2026-08-11, the first release containing the dynamic
  import, and was still reproducible on 2026-09-02 against the v1.6.0, v1.7.0 and
  latest CDN copies. Chunks are now named per build: `hls.js` for the full and
  video builds (byte-identical, so one copy serves both), `hls.light.js` for the
  audio build's light hls.js, and `<build>.<chunk>.js` for anything else, so two
  builds sharing one `dist` cannot overwrite each other. The upload script takes
  dist by glob instead of a hand list, and
  `scripts/check-embed-chunks.mjs` fails the build if any bundle imports a chunk
  that is not there.

  **Declarations.** `package.json` promised `dist/index.d.ts`,
  `dist/index-video.d.ts` and `dist/index-audio.d.ts`, and the 1.7.0 tarball
  contained no `.d.ts` at all: the build runs `tsc` and then three Vite builds
  into one directory, and the first Vite build had `emptyOutDir: true`, which
  deleted the declarations `tsc` had just emitted. A consumer with
  `noImplicitAny` on (the `strict` default) could not compile an import of the
  package at all, error TS7016; with it off the module was typed `any` in
  silence. `emptyOutDir` is now `false`
  for all three builds, the package's `build` script does the cleaning with
  `rimraf dist tsconfig.tsbuildinfo` (the buildinfo because a stale one makes a
  composite project emit nothing), `tsc` emits declarations only so the raw
  compiler output no longer lands in the tarball or on the CDN, and `types` comes
  first in every `exports` condition. `scripts/check-package-artifacts.mjs` fails
  the build if any workspace manifest points at a file that is not on disk.

  **Mixed exports.** `output.exports: 'named'` silences Rollup's "named and
  default exports together" warning for all three entries.
  `scripts/verify-browser.mjs` now loads the built UMD in a real browser and
  asserts `window.ScarlettPlayer.create` is a function, `availableTypes` is
  present, and nothing moved behind `.default`.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - `window.ScarlettPlayer.version` is the version the embed was actually built
  from.

  The three entries carried the hand-written literals '0.5.3', '0.5.3-video' and
  '0.5.3-audio' while the package published at 1.7.0, and the CDN's
  `latest/embed.umd.cjs` still answered `window.ScarlettPlayer.version === '0.5.3'`
  when loaded in Chrome (both measured 2026-09-02). That string is the only thing
  support can read off a live page to tell which build a viewer is running, so it
  was worse than useless: it named a release that never shipped.

  The value comes from the package's own package.json now, through a
  `__PKG_VERSION__` define in `vite.config.ts` read by `src/version.ts`, with a
  '0.0.0-dev' fallback for test runs. The `-video` and `-audio` suffixes stay, as
  `1.7.0-video` and `1.7.0-audio`. `scripts/verify-browser.mjs` loads the built
  UMD in a real browser and asserts the global's `version` equals
  `packages/embed/package.json`, because nothing short of a browser load can prove
  the define survived the bundle.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - The iframe embed loads, the big play button is configurable, and the shared hls chunk is guarded.

  **iframe embed.** `iframe.html` never worked, on two counts, both dating to the
  initial release (2b8fd69, 2025-12-14). It called `module.create(config)` on the
  imported bundle, but the ES build exports the API object as its default
  (`ScarlettPlayerAPI as default`) alongside three named helpers, so
  `module.create` was `undefined` and the page rendered its own "Error Loading
  Player" screen; it now calls `module.default.create(config)` and awaits the
  promise that returns. It also imported `./dist/embed.js`, which only matches the
  npm tarball layout. `scripts/upload-cdn.sh` uploads the page BESIDE the bundles,
  so on the CDN it is `latest/iframe.html` next to `latest/embed.js` and
  `latest/dist/embed.js` is a 404: the hosted iframe embed has never loaded a
  player. The import now tries `./embed.js` first and falls back to
  `./dist/embed.js`, so both layouts work.

  **`bigPlayButton`.** `@scarlett-player/ui` has had a `bigPlayButton` option
  since the control landed, but nothing reached it from an embed: a page that
  draws its own play affordance over the player had no way to turn the centred
  one off short of dropping the whole UI plugin with `data-controls="false"`.
  `EmbedConfig` gains the field, the parser reads `data-big-play-button` with
  the same convention as the other booleans (only the exact string `"false"`
  turns it off), `iframe.html` reads a `big-play-button` query parameter, and
  the video branch forwards it to the UI plugin only when it is set, so an
  embed that says nothing keeps the plugin's own default rather than pinning a
  second copy of it. The audio UIs have no such control and are untouched.

  **Shared chunk guard.** The three builds write into one `dist` with
  `emptyOutDir: false`, and `chunkFileNames` leaves two names unprefixed,
  `hls.js` and `hls.light.js`, on the strength of the full and video builds
  emitting the same file. Nothing enforced that:
  `scripts/check-embed-chunks.mjs` asserts only that a chunk a bundle imports
  exists, and after a silent overwrite it still would. A Rollup hook in
  `vite.config.ts` now reads whatever sits at a shared chunk's path before the
  write and fails the build if the bytes differ, which is exactly the moment
  the video build would overwrite the full build's copy. The check script also
  asserts that the unprefixed names in `dist` are exactly those two, so a
  `chunkFileNames` regression that drops a build prefix is caught before it can
  collide.

  **Dead `data-share-url` docs.** The README attribute row and the iframe
  `shareUrl` / `share-url` parameter landed with the share plugin on 2026-08-10
  (044114c) and were never wired up: no embed build registers
  `@scarlett-player/share`, `EmbedConfig` has no `shareUrl`, and
  `parseDataAttributes()` never read the attribute, so the value went nowhere.
  Both are removed rather than left documenting a feature that does not exist.
  Registering the share plugin in the embed builds is a tracked follow-up.

- Updated dependencies [[`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8)]:
  - @scarlett-player/core@1.7.1
  - @scarlett-player/analytics@1.7.1
  - @scarlett-player/audio-ui@1.7.1
  - @scarlett-player/captions@1.7.1
  - @scarlett-player/hls@1.7.1
  - @scarlett-player/media-session@1.7.1
  - @scarlett-player/native@1.7.1
  - @scarlett-player/playlist@1.7.1
  - @scarlett-player/ui@1.7.1
  - @scarlett-player/watermark@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [[`2194db7`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2194db7037aec7456475d7f9da0fc4a0fb1facb0)]:
  - @scarlett-player/core@1.7.0
  - @scarlett-player/hls@1.7.0
  - @scarlett-player/ui@1.7.0
  - @scarlett-player/analytics@1.7.0
  - @scarlett-player/audio-ui@1.7.0
  - @scarlett-player/captions@1.7.0
  - @scarlett-player/media-session@1.7.0
  - @scarlett-player/playlist@1.7.0
  - @scarlett-player/watermark@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies [[`55cf252`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/55cf2525bf5e92200a121cd0a0796f8786835e4d)]:
  - @scarlett-player/core@1.6.0
  - @scarlett-player/analytics@1.6.0
  - @scarlett-player/audio-ui@1.6.0
  - @scarlett-player/captions@1.6.0
  - @scarlett-player/hls@1.6.0
  - @scarlett-player/media-session@1.6.0
  - @scarlett-player/playlist@1.6.0
  - @scarlett-player/ui@1.6.0
  - @scarlett-player/watermark@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies [[`8c2eca3`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/8c2eca3d3d53895fa99ae53efac802cf58be81d5)]:
  - @scarlett-player/core@1.5.1
  - @scarlett-player/analytics@1.5.1
  - @scarlett-player/audio-ui@1.5.1
  - @scarlett-player/captions@1.5.1
  - @scarlett-player/hls@1.5.1
  - @scarlett-player/media-session@1.5.1
  - @scarlett-player/playlist@1.5.1
  - @scarlett-player/ui@1.5.1
  - @scarlett-player/watermark@1.5.1

## 1.5.0

### Patch Changes

- [#62](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/62) [`044114c`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/044114ca29c675c4dea643882b966a27bb1b6afa) Thanks [@alexhackney](https://github.com/alexhackney)! - New package: `@scarlett-player/share`.

  A share control for the player - the OS share sheet on mobile, copy link, social targets, embed codes, and playback timestamps. Zero configuration shares the current page URL with the position appended; the host adds `'share'` to its control layout to place the button.

  **Mobile is the primary path.** Where `navigator.share` exists and no custom target list is configured, tapping the button opens the native sheet directly rather than putting an in-player menu in front of it. When the in-player sheet is used it is a bottom sheet within thumb reach, with a grab handle and `env(safe-area-inset-bottom)` honoured, promoting to a popover at 640px and up. Targets are 72px tall with press rather than hover states, the manual-copy fallback uses 16px text so iOS Safari does not zoom the viewport, and `prefers-reduced-motion` is respected. The sheet renders inside the player container so it survives fullscreen, traps focus, closes on Escape, and restores focus to the button.

  **What gets shared is the page, never the media `src`.** Playback URLs are frequently signed, so sharing one would leak a credential and produce a link that expires. There is no configuration or code path that falls back to `src`, and a test asserts it. The URL defaults to `window.location.href` and is overridable - which matters most inside `iframe.html`, where `window.location.href` is the player page and cross-origin rules block reading the parent. `@scarlett-player/embed` now accepts a `shareUrl` parameter for exactly that, and the `embed` target generates snippets with it already set.

  Timestamps are applied through the URL API, so an existing query string or fragment survives and re-sharing replaces the previous timestamp instead of appending a second. Live media never gets one, since an offset into a sliding DVR window is meaningless to the recipient. A dismissed native sheet rejects with `AbortError` and is treated as a choice rather than an error, and the clipboard falls back through `execCommand` to showing the link for manual copying.

- Updated dependencies [[`044114c`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/044114ca29c675c4dea643882b966a27bb1b6afa)]:
  - @scarlett-player/captions@1.5.0
  - @scarlett-player/core@1.5.0
  - @scarlett-player/hls@1.5.0
  - @scarlett-player/ui@1.5.0
  - @scarlett-player/analytics@1.5.0
  - @scarlett-player/playlist@1.5.0
  - @scarlett-player/media-session@1.5.0
  - @scarlett-player/audio-ui@1.5.0
  - @scarlett-player/watermark@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies [[`61230aa`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/61230aaca8bc8dcbbeb48d662a4f53f8d2c2a46c)]:
  - @scarlett-player/core@1.4.0
  - @scarlett-player/ui@1.4.0
  - @scarlett-player/analytics@1.4.0
  - @scarlett-player/audio-ui@1.4.0
  - @scarlett-player/captions@1.4.0
  - @scarlett-player/hls@1.4.0
  - @scarlett-player/media-session@1.4.0
  - @scarlett-player/playlist@1.4.0
  - @scarlett-player/watermark@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies [[`0796a44`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0796a4477bdfd804d2e76468d42a0046a8da3a4f)]:
  - @scarlett-player/captions@1.3.0
  - @scarlett-player/core@1.3.0
  - @scarlett-player/hls@1.3.0
  - @scarlett-player/ui@1.3.0
  - @scarlett-player/analytics@1.3.0
  - @scarlett-player/playlist@1.3.0
  - @scarlett-player/media-session@1.3.0
  - @scarlett-player/audio-ui@1.3.0
  - @scarlett-player/watermark@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies [[`2828556`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2828556b09bd2cc2e9c62d7f8e74ce325984c34c), [`2828556`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2828556b09bd2cc2e9c62d7f8e74ce325984c34c)]:
  - @scarlett-player/ui@1.2.0
  - @scarlett-player/hls@1.2.0
  - @scarlett-player/core@1.2.0
  - @scarlett-player/analytics@1.2.0
  - @scarlett-player/audio-ui@1.2.0
  - @scarlett-player/captions@1.2.0
  - @scarlett-player/media-session@1.2.0
  - @scarlett-player/playlist@1.2.0
  - @scarlett-player/watermark@1.2.0

## 1.1.1

### Patch Changes

- Updated dependencies [[`db2d670`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/db2d670cdaf2feb287702e4cfe536e5a07d24b54)]:
  - @scarlett-player/playlist@1.1.1
  - @scarlett-player/core@1.1.1
  - @scarlett-player/hls@1.1.1
  - @scarlett-player/ui@1.1.1
  - @scarlett-player/analytics@1.1.1
  - @scarlett-player/media-session@1.1.1
  - @scarlett-player/audio-ui@1.1.1
  - @scarlett-player/captions@1.1.1
  - @scarlett-player/watermark@1.1.1

## 1.1.0

### Patch Changes

- Updated dependencies [[`29c560d`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/29c560d3a199acb598f99ff1226b7c602775839f), [`d3259c4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/d3259c4e33760e59ce038acb2fff6fdc5c1a7d80), [`29c560d`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/29c560d3a199acb598f99ff1226b7c602775839f)]:
  - @scarlett-player/core@1.1.0
  - @scarlett-player/hls@1.1.0
  - @scarlett-player/ui@1.1.0
  - @scarlett-player/playlist@1.1.0
  - @scarlett-player/analytics@1.1.0
  - @scarlett-player/audio-ui@1.1.0
  - @scarlett-player/captions@1.1.0
  - @scarlett-player/media-session@1.1.0
  - @scarlett-player/watermark@1.1.0

## 1.0.3

### Patch Changes

- Updated dependencies [[`5125447`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/5125447248d1c6579db18f5d64585016e02a26a9)]:
  - @scarlett-player/hls@1.0.3
  - @scarlett-player/core@1.0.3
  - @scarlett-player/ui@1.0.3
  - @scarlett-player/analytics@1.0.3
  - @scarlett-player/playlist@1.0.3
  - @scarlett-player/media-session@1.0.3
  - @scarlett-player/audio-ui@1.0.3
  - @scarlett-player/captions@1.0.3
  - @scarlett-player/watermark@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [[`e2d5469`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/e2d54691f9b5297ce564c4089bb7c05482a3269d)]:
  - @scarlett-player/watermark@1.0.2
  - @scarlett-player/core@1.0.2
  - @scarlett-player/hls@1.0.2
  - @scarlett-player/ui@1.0.2
  - @scarlett-player/analytics@1.0.2
  - @scarlett-player/playlist@1.0.2
  - @scarlett-player/media-session@1.0.2
  - @scarlett-player/audio-ui@1.0.2
  - @scarlett-player/captions@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [[`8a36597`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/8a365974bb67fa7ea945a3f2594112ac27cd75f4)]:
  - @scarlett-player/playlist@1.0.1
  - @scarlett-player/core@1.0.1
  - @scarlett-player/hls@1.0.1
  - @scarlett-player/ui@1.0.1
  - @scarlett-player/analytics@1.0.1
  - @scarlett-player/media-session@1.0.1
  - @scarlett-player/audio-ui@1.0.1
  - @scarlett-player/captions@1.0.0
  - @scarlett-player/watermark@1.0.0

## 1.0.0

### Minor Changes

- [#35](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/35) [`96bbb45`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/96bbb45881c45f2a183d1a56337bab1e47648ba7) Thanks [@alexhackney](https://github.com/alexhackney)! - Automatic playlist loading, Chromecast playlist support, AirPlay improvements, watermark and captions plugins

  **Core:**
  - Added `media:load-request` event for plugins to request media loading without direct `player.load()` access
  - Promoted playlist events (`playlist:change`, `playlist:add`, `playlist:remove`, `playlist:clear`, `playlist:shuffle`, `playlist:repeat`, `playlist:reorder`, `playlist:ended`) to core `PlayerEventMap`
  - Added minimal `PlaylistTrack` interface to core types
  - Core player listens for `media:load-request` and routes load to local player (skips when Chromecast is active)

  **Playlist:**
  - New `autoLoad` config option (default: `true`) - automatically emits `media:load-request` on track change, eliminating the need for manual `player.load()` wiring
  - New `advanceDelay` config option - milliseconds to wait before auto-advancing to next track
  - Removed all `as any` casts from event emissions (events now typed in core)

  **Chromecast:**
  - Detects media-ended on Cast device via `isMediaLoaded` state transition (true → false), emitting `playback:ended` so playlists auto-advance during casting
  - Listens for `media:load-request` to load new media on Cast device when Chromecast is active
  - Registered `IS_MEDIA_LOADED_CHANGED` event listener for reliable detection

  **HLS:**
  - Forces native HLS when AirPlay is active during `loadSource()`, preventing hls.js from interfering with wireless playback

  **AirPlay:**
  - Automatically switches back to hls.js when AirPlay disconnects, restoring quality control

  **Watermark (NEW):**
  - Anti-piracy watermark overlay plugin with text or image rendering
  - Configurable position, opacity, font size
  - Dynamic repositioning mode (moves to random position periodically)
  - Configurable show delay
  - Per-track watermark updates via playlist metadata (`watermarkUrl`, `watermarkText`)

  **Captions (NEW):**
  - WebVTT subtitle/caption plugin using browser-native `<track>` element rendering
  - External WebVTT source loading
  - HLS.js subtitle track extraction
  - Track selection via existing `track:text` event (works with CaptionsButton and SettingsMenu)
  - Auto-select with configurable default language
  - Automatic cleanup on source change

  **Embed:**
  - Added watermark and captions plugins to full and video embed builds

  **Breaking Change Note:**
  Existing consumers that manually wire `playlist:change` to `player.load()` will get double-loads when `autoLoad` is `true` (the new default). Set `autoLoad: false` to preserve the previous manual behavior, or remove the manual wiring.

### Patch Changes

- Updated dependencies [[`96bbb45`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/96bbb45881c45f2a183d1a56337bab1e47648ba7)]:
  - @scarlett-player/core@1.0.0
  - @scarlett-player/playlist@1.0.0
  - @scarlett-player/hls@1.0.0
  - @scarlett-player/watermark@1.0.0
  - @scarlett-player/captions@1.0.0
  - @scarlett-player/analytics@1.0.0
  - @scarlett-player/audio-ui@1.0.0
  - @scarlett-player/media-session@1.0.0
  - @scarlett-player/ui@1.0.0

## 0.5.3

### Patch Changes

- Bug fixes, stability improvements, and live DVR wiring

  **Bug Fixes:**
  - Fix MIME type detection for URLs with query params/fragments (e.g., `video.m3u8?token=abc`)
  - Fix spinner stuck on screen - `playing` event handler now clears `waiting` and `buffering` states
  - Fix `setPlaybackRate()` accepting invalid values - now clamped to 0.0625-16 range
  - Fix `setQuality()` accepting out-of-bounds indices - now validates against available quality levels
  - Fix analytics memory leak - cap `errors` array at 100 and `bitrateHistory` at 500 entries for long sessions
  - Fix HLS error test expecting `logger.warn` for fatal errors (should be `logger.error`)
  - Fix demo page crash when `getState` called before player initialization

  **Live DVR:**
  - Wire up `seekableRange`, `liveEdge`, and `liveLatency` state in HLS plugin - existing UI controls (LiveIndicator, ProgressBar DVR, TimeDisplay, SkipButton) now receive live stream data

  **Dependencies:**
  - Remove unused `hls.js` dependency from `@scarlett-player/core`
  - Align `hls.js` versions: embed and HLS plugin dev dep updated to `^1.6.0`, peer dep to `^1.5.0`

  **Docs:**
  - Update README roadmap - mark captions and mobile gestures as planned (Sprint 1), add Sprint 2/3 items
  - Update CHANGELOG with entries for versions 0.3.0 through 0.5.2
  - Update package version table to 0.5.2

- Updated dependencies []:
  - @scarlett-player/core@0.5.3
  - @scarlett-player/hls@0.5.3
  - @scarlett-player/analytics@0.5.3
  - @scarlett-player/audio-ui@0.5.3
  - @scarlett-player/media-session@0.5.3
  - @scarlett-player/playlist@0.5.3
  - @scarlett-player/ui@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [[`42b224b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/42b224b65270277e28097af5d31f69a3c24ab471)]:
  - @scarlett-player/core@0.5.2
  - @scarlett-player/ui@0.5.2
  - @scarlett-player/analytics@0.5.2
  - @scarlett-player/audio-ui@0.5.2
  - @scarlett-player/hls@0.5.2
  - @scarlett-player/media-session@0.5.2
  - @scarlett-player/playlist@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [[`4ddc188`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/4ddc18809b81f98133cfe816a857d6f2b5916c59)]:
  - @scarlett-player/core@0.5.1
  - @scarlett-player/ui@0.5.1
  - @scarlett-player/analytics@0.5.1
  - @scarlett-player/audio-ui@0.5.1
  - @scarlett-player/hls@0.5.1
  - @scarlett-player/media-session@0.5.1
  - @scarlett-player/playlist@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [[`0eeb5c1`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0eeb5c19777298371490cfad60bca4ef9b4c8734)]:
  - @scarlett-player/core@0.5.0
  - @scarlett-player/ui@0.5.0
  - @scarlett-player/hls@0.5.0
  - @scarlett-player/analytics@0.5.0
  - @scarlett-player/playlist@0.5.0
  - @scarlett-player/media-session@0.5.0
  - @scarlett-player/audio-ui@0.5.0

All notable changes to the @scarlett-player/embed package will be documented in this file.

## [0.1.0] - 2025-12-14

### Added

- Initial release of the embed package
- Auto-initialization via data attributes (`data-scarlett-player`)
- Global API (`window.ScarlettPlayer`) for programmatic control
- Support for all common configuration options via data attributes:
  - `data-src` - Video source URL
  - `data-autoplay` - Auto-play on load
  - `data-muted` - Start muted
  - `data-poster` - Poster image
  - `data-controls` - Show/hide UI
  - `data-brand-color` - Custom branding
  - `data-aspect-ratio` - Responsive sizing
  - And many more...
- UMD bundle for CDN/script tag usage
- ES module bundle for modern bundlers
- iframe embed helper page with URL parameter support
- TypeScript type definitions
- Comprehensive demo page with 5+ examples
- Full documentation and setup guide

### Features

- **Self-contained Bundle**: Includes core, HLS, and UI plugins
- **Multi-tenant Support**: Easy branding via color attributes
- **Auto-initialization**: Finds and initializes all players on page load
- **Programmatic API**: Create and control players with JavaScript
- **iframe Support**: Helper page for secure iframe embeds
- **Keyboard Shortcuts**: Built-in keyboard navigation
- **Responsive**: Aspect ratio support for responsive layouts
- **TypeScript**: Full type definitions included

### Bundle Output

- `embed.js` - ES module (~260KB minified, ~85KB gzipped)
- `embed.umd.cjs` - UMD bundle for script tags
- `embed.d.ts` - TypeScript definitions
- Source maps for both bundles

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

### Dependencies

- @scarlett-player/core ^0.1.0
- @scarlett-player/hls ^0.1.0
- @scarlett-player/ui ^0.1.0
- hls.js ^1.5.0

### Notes

This is the first release designed for The Stream Platform's multi-tenant live streaming service. The package provides both declarative and programmatic APIs for maximum flexibility in different embedding scenarios.
