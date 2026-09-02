---
'@scarlett-player/vue': patch
---

Ships the type declarations its `types` field has pointed at, and requires
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
