---
'@scarlett-player/hls': patch
'@scarlett-player/airplay': patch
---

Review fixes: AirPlay provider switches survive a disconnect mid-switch.

**HLS**

- `switchToNative()` and `switchToHlsJs()` restore the source identity after
  their `cleanup()`. Neither reload path re-sets `currentSrc`, so every provider
  switch left it null: the switch back that AirPlay asks for on disconnect
  bailed with 'No source loaded' and stranded the viewer on native HLS, and
  auto-reconnect stayed disabled for the rest of the session.
- Both switches now cancel a pending auto-reconnect before tearing the old
  pipeline down. `cleanup()` leaves the reconnect timer armed, so a reconnect
  scheduled by the failure that preceded an AirPlay switch fired into the
  pipeline that replaced it, destroying a healthy player and seeking it back
  to the position captured before the switch.

**AirPlay**

- Connect and disconnect now run through one `syncProviderToAirPlay()` that
  serialises provider switches and re-checks the connection state once the
  switch settles. A viewer who disconnected while the switch to native was
  still loading was dropped twice over: the provider had not flipped to native
  yet, so the disconnect branch saw hls.js and did nothing, and the switch then
  landed on native with no device attached.
