---
'@scarlett-player/embed': patch
---

The embed plays what it advertises, ships every chunk, and ships its types again.

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
