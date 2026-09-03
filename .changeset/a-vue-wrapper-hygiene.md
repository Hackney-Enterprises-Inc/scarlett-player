---
'@scarlett-player/vue': patch
---

Vue wrapper hygiene: no more spurious warnings, and honest `options` docs.

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
