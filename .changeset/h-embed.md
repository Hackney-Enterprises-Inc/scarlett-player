---
'@scarlett-player/embed': patch
---

The iframe embed loads, the big play button is configurable, and the shared hls chunk is guarded.

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
