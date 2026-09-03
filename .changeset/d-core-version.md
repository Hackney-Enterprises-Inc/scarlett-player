---
'@scarlett-player/core': patch
---

Core exports the version it was built from, as `VERSION`.

Nothing in the workspace could read the running player version, so every
consumer that wanted one wrote its own constant and every one of them drifted:
the plugin descriptors said '1.0.0' and the embed builds said '0.5.3' while all
17 packages published at 1.7.0 (measured 2026-09-02). tsp-web tags Sentry with a
`__SCARLETT_VERSION__` define of its own for the same reason.

`VERSION` comes from core's own package.json through a `define` in
`vite.config.ts`, read by `src/version.ts` with a '0.0.0-dev' fallback for a
consumer that bundles core from source without it. The same `define` reaches
core's vitest run, so the test asserts the value against package.json rather
than against a literal that would have to be edited on every release.
