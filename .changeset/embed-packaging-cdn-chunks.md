---
'@scarlett-player/embed': minor
---

Embed: bundled workspace packages are no longer runtime dependencies, the
iframe error path escapes its message, and shared CDN chunks are
version-stamped so a cached bundle cannot pair with a newer chunk.

- The package declared 12 `@scarlett-player/*` packages plus `hls.js` as
  runtime `dependencies` while `vite.config.ts` bundles every one of them, so
  consumers installed 13 packages they never load. Eleven of them and `hls.js`
  moved to `devDependencies`. `@scarlett-player/core` stays a dependency: the
  emitted declarations import from it, so a TypeScript consumer needs it
  resolvable.
- `iframe.html` interpolated `${error.message}` into `document.body.innerHTML`.
  The message can carry the `src` from the query string and the page is served
  from the CDN origin, so the error node is now built with `textContent`.
- The shared hls.js chunks are emitted as `hls.<version>.js` and
  `hls.light.<version>.js`. `latest/` is mutable and cached for an hour while
  `v<version>/` is immutable, so a browser holding a cached `latest/hls.js`
  could pair it with a freshly fetched `latest/embed.js` from the next release.
  A cached bundle now keeps importing the exact chunk it was built against.
