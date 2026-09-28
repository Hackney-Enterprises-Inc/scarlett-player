---
'@scarlett-player/analytics': minor
---

`isLive` is `null`, not `false`, on any beacon sent before live-ness is known
(decision #159). Without `config.isLive`, every `viewStart` now carries `null`:
it leaves before any manifest is read, and a live view used to start with
`false`. Consumers should treat `null` as absent and merge true-wins.

The value is the view's last known classification: set at each
`media:loadedmetadata`, and to `true` as soon as the player's `live` state turns
true. Core's `live: false` reset on `load()` is ignored, so after a playlist
advance a view keeps the previous item's value until the new item's metadata.
`config.isLive`, when set, still wins.

`BeaconPayload.isLive` is typed `boolean | null`, and `ViewSession` (returned
by `getMetrics()`) gains `lastKnownIsLive`.
