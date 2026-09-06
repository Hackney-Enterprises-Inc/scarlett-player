---
"@scarlett-player/vue": patch
---

`ScarlettPlayer.vue` now types its `timeupdate` event as `{ currentTime }`,
which is what it has always emitted: the handler forwards core's
`playback:timeupdate` payload unchanged, and that payload carries no
`duration`. The old typing promised one, so a TypeScript consumer reading
`payload.duration` got `undefined` at runtime with no compiler complaint. Read
the duration off the exposed `player` (`playerRef.value.player.duration`), as
the README examples do.
