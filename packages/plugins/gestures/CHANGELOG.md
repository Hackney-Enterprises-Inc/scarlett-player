# @scarlett-player/gestures

## 1.8.1

### Patch Changes

- [#79](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/79) [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1) Thanks [@alexhackney](https://github.com/alexhackney)! - Peer dependency ranges now name the current major line: `@scarlett-player/core`
  and `@scarlett-player/ui` move from `^1.7.0` to `^1.8.0` in the Vue wrapper and
  in every plugin that had not already been bumped, leaving the whole fixed
  version group asking for one range. Nothing was resolving wrongly before, since
  `^1.7.0` already admits 1.8.0, but the declared floor now matches the version
  these packages are actually built and tested against rather than trailing a
  release behind it.

## 1.8.0

## 1.7.1

### Patch Changes

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Reports its real version, and requires `@scarlett-player/core@^1.7.0`.

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

  The `@scarlett-player/core` peer range moves from `^1.5.0` to `^1.7.0`.
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

## 1.7.0

## 1.6.0
