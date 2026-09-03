/**
 * Ambient declaration for the `hls.js/light` subpath.
 *
 * hls.js 1.6.15 declares `exports["./light"]` with `import` and `require`
 * conditions only, no `types`, and ships no `dist/hls.light.d.ts` beside the
 * `.mjs` and `.js` it does ship. Under `moduleResolution: "bundler"` that makes
 * the dynamic `import('hls.js/light')` in `hls-loader-light.ts` an implicit
 * `any` (TS7016). It went unnoticed until 2026-09-02 because the package had no
 * `typecheck` script, so the light entry had never been type-checked at all.
 *
 * The light build is the same library with subtitle, ID3 and EME support
 * compiled out; its public type surface is a subset of the full build's and
 * hls.js publishes no separate declarations for it, so re-exporting the full
 * build's types is the closest contract available. The runtime difference is a
 * capability difference, not a shape difference: the classes and options that
 * survive keep their full-build signatures.
 */
declare module 'hls.js/light' {
  export * from 'hls.js';
  export { default } from 'hls.js';
}
