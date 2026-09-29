---
"@scarlett-player/analytics": patch
---

Add `beaconSeq` to every beacon, starting at 1 per view and incrementing only
after development and error-sampling filters, including custom events and
unload beacons. Custom dimensions cannot override it. Order each view by
`timestamp, beaconSeq`, not arrival order; ingests that drop heartbeats will
see sequence gaps. Add `seekSource: 'player' | 'element'` to `seeking` beacons
to distinguish bus requests from element-driven seeks.

Release prerequisite: install `hei/laravel-scarlett-player` 0.3.0 and publish/run
its new migration before or together with player 1.19.3 in tsp-web. That ingest
recognises both keys and has the `seq` column; older ingests accept them but
store them as host custom dimensions. Recapture and repin the Laravel wire
fixtures after the player release.
