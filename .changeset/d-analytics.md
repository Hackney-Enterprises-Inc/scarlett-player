---
'@scarlett-player/analytics': patch
---

Every beacon now carries the real player version, and the plugin requires
`@scarlett-player/core@^1.7.0`.

`PLUGIN_VERSION` was the hand-written literal '0.1.0' while the package
published at 1.7.0 (measured 2026-09-02). It is not only the descriptor's
`version`: it is the `playerVersion` field stamped on every beacon, so every row
collected so far records a player version that never matched a release, and no
analytics query can tell one player build from another. It comes from the
package's own package.json now: `src/version.ts` reads a `__PKG_VERSION__`
define set by the new `tsup.config.ts`, with a '0.0.0-dev' fallback for test
runs. The `build` and `dev` scripts call plain `tsup`, so the entry point,
formats and `--dts` flag are written down once in the config instead of twice in
package.json. The move does not change what tsup emits: the md5 of
`dist/index.d.ts` and `dist/index.d.cts` is unchanged across it (compared
2026-09-02).

The `@scarlett-player/core` peer range moves from `^1.0.3` to `^1.7.0`.
The old ranges were wrong across the workspace, not merely inconsistent: three
of the packages declaring `^1.0.3` (audio-ui, media-session, ui) call
`defineState`, which core gained in 1.4.0. Changesets is configured with
`onlyUpdatePeerDependentsWhenOutOfRange`, so future minors of core will not
cascade this into a major.
