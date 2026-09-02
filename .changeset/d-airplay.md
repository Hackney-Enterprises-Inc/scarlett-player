---
'@scarlett-player/airplay': patch
---

Reports its real version, and requires `@scarlett-player/core@^1.7.0`.

The descriptor's `version` was the hand-written literal '1.0.0' while the
package published at 1.7.0, so anything that read a version off the plugin
reported a number that had not been true since the descriptor was written
(measured 2026-09-02). It comes from the package's own package.json now:
`src/version.ts` reads a `__PKG_VERSION__` define set by the new
`tsup.config.ts`, with a '0.0.0-dev' fallback for test runs. The `build` and
`dev` scripts call plain `tsup`, so the entry points, formats and `--dts` flag
are written down once in the config instead of twice in package.json. The
move does not change what tsup emits: the md5 of `dist/index.d.ts` and
`dist/index.d.cts` is unchanged across it (compared 2026-09-02).

The `@scarlett-player/core` peer range moves from `^1.0.3` to `^1.7.0`.
The old ranges were
wrong across the workspace, not merely inconsistent: three of the packages
declaring `^1.0.3` (audio-ui, media-session, ui) call `defineState`, which core
gained in 1.4.0. Changesets is configured with
`onlyUpdatePeerDependentsWhenOutOfRange`, so future minors of core will not
cascade this into a major.

The `@example` docblock shows `createPlayer()`. The `new ScarlettPlayer(...)`
shape it used to show left the player with a provider and nothing else before
core 1.7.1, so anyone copying the example got no controls and no working
"Try Again".
