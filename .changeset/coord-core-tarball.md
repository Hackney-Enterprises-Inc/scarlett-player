---
'@scarlett-player/core': patch
---

Core's tarball carries only what its manifest points at.

`tsc` now emits declarations only (`emitDeclarationOnly`), so the compiled
per-module JavaScript that used to land in `dist` beside the Vite bundles
(`error-handler.js`, `plugin-api.js` and friends, 32 files nothing could
import because only `.` is exported) is gone: the tarball drops from 72 files
to 40. The build cleans `dist` and the composite buildinfo first, the same
guard embed and vue gained in this release, and `exports["."]` lists `types`
first, the order TypeScript documents for condition matching.
