---
'@scarlett-player/vue': minor
'@scarlett-player/core': patch
---

Vue hosts can pass load options. The component's exposed `load(src, options)`
and `useScarlettPlayer().load(src, options)` now forward `options` to core's
`load()`, so `load(src, { autoplay: false })` (added to core in 1.16.3) is
reachable from Vue. The `src` prop watcher is unchanged and still follows the
`autoplay` prop.

Core exports the `LoadOptions` type (`{ autoplay?: boolean }`) and uses it in
`load()`'s signature. Types only; no runtime change.

The vue package's peer dependency on `@scarlett-player/core` is now `^1.18.0`
(was `^1.8.0`): vue's declarations import `LoadOptions`, which no core before
1.18.0 exports. `scripts/check-package-types.mjs` compiles vue against the
local workspace core, so it cannot catch a peer range that admits an older
core; the range was raised by hand. The guard now also compiles a consumer
snippet for core and vue that imports `LoadOptions` and calls both Vue `load()`
APIs with options.
