# @scarlett-player/vue

## 1.7.1

### Patch Changes

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Vue wrapper hygiene: no more spurious warnings, and honest `options` docs.

  `useScarlettPlayer()` registers `onMounted`/`onBeforeUnmount` only when it
  runs inside a component `setup()`. Outside one, Vue has no instance to
  attach them to, so it warned "onMounted is called when there is no active
  component instance" and dropped them; the caller owns `init()` and
  `destroy()` there, which the TSDoc and the README now say.

  `ScarlettPlayer.vue` no longer imports `defineExpose` (a compiler macro, and
  the source of a `@vue/compiler-sfc` warning on every build), and no longer
  subscribes to `player:ready`: core emits that event during the first
  initialisation, which has already completed by the time the component wires
  its listeners. The explicit `emit('ready', player)` is unchanged, so the
  `ready` event still fires exactly as before.

  The `options` prop is documented as construction-time only: it cannot be
  re-applied to a live player because plugins cannot be re-registered.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Ships the type declarations its `types` field has pointed at, and requires
  `@scarlett-player/core@^1.7.0`.

  `package.json` promised `./dist/index.d.ts` and the 1.7.0 tarball contained no
  `.d.ts` at all: `npm pack --dry-run @scarlett-player/vue@1.7.0` lists 8 files
  (measured 2026-09-02). The build is `tsc && vite build`, `outDir` sits inside the
  project root, so Vite's default emptied the directory and deleted the
  declarations tsc had just emitted. A consumer with `noImplicitAny` on (what
  `strict` gives you) could not compile an import of the package at all, error
  TS7016; with it off the whole module was typed `any` in silence. This is the
  same defect that shipped in `@scarlett-player/embed@1.7.0`.

  `build.emptyOutDir` is now `false`, the `build` script does the cleaning itself
  with `rimraf dist tsconfig.tsbuildinfo` (the buildinfo because a stale one makes
  a composite project emit nothing), tsc emits declarations only so its compiled
  JS no longer lands beside the Vite bundles, and `types` comes first in
  `exports["."]` because TypeScript matches export conditions in order. The
  tarball now lists 11 files including `dist/index.d.ts` and
  `dist/composables/useScarlettPlayer.d.ts`, and
  `scripts/check-package-artifacts.mjs` fails the build if any manifest points at
  a file that is not on disk.

  `useScarlettPlayer` and `ScarlettPlayerPlugin` are fully typed for consumers
  again. The component export is still `any`: `dist/index.d.ts` imports
  `./ScarlettPlayer.vue`, and plain `tsc` cannot emit a declaration for a single
  file component, so nothing in the tarball describes it. Typing the component
  needs `vue-tsc` in the build and is a follow-up.

  The `@scarlett-player/core` peer range moves from `^1.0.3` to `^1.7.0`.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - The `poster` prop is reactive, and the composable exposes `setPoster`.

  `poster` was read once, at construction: a page that swapped the artwork left
  the old image on the element with nothing to say why. It is watched now and
  calls `setPoster()` on the running player, writing `''` when the prop is
  unset, because clearing the prop means "take the image away". `setPoster` is
  also on the component's ref surface and in `useScarlettPlayer()`'s return.

  Adds the package's first component test: mounted with plain `createApp`,
  since this package does not depend on @vue/test-utils.

## 1.7.0

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.0

## 1.3.0

## 1.2.0

## 1.1.1

## 1.1.0

## 1.0.3

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@1.0.1

## 1.0.0

### Patch Changes

- Updated dependencies [[`96bbb45`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/96bbb45881c45f2a183d1a56337bab1e47648ba7)]:
  - @scarlett-player/core@1.0.0

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [[`42b224b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/42b224b65270277e28097af5d31f69a3c24ab471)]:
  - @scarlett-player/core@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [[`4ddc188`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/4ddc18809b81f98133cfe816a857d6f2b5916c59)]:
  - @scarlett-player/core@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [[`0eeb5c1`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0eeb5c19777298371490cfad60bca4ef9b4c8734)]:
  - @scarlett-player/core@0.5.0
