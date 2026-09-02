---
'@scarlett-player/vue': patch
---

The `poster` prop is reactive, and the composable exposes `setPoster`.

`poster` was read once, at construction: a page that swapped the artwork left
the old image on the element with nothing to say why. It is watched now and
calls `setPoster()` on the running player, writing `''` when the prop is
unset, because clearing the prop means "take the image away". `setPoster` is
also on the component's ref surface and in `useScarlettPlayer()`'s return.

Adds the package's first component test: mounted with plain `createApp`,
since this package does not depend on @vue/test-utils.
