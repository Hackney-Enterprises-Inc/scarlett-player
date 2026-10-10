---
'@scarlett-player/analytics': patch
---

Player-requested `seeking` beacons are coalesced into a fixed one-second window per view: the first seek of a burst sends at once and continuous scrubbing sends its latest target once per second, instead of one beacon per request. `seekCount` and `elementSeekCount` still count every request (a trailing beacon carries the cumulative count at emission), and element-seek coalescing, echo suppression, live and rebuffer bookkeeping are unchanged. A held player seek is sent before a later element-seek beacon, so beacons keep seek order, and a trailing beacon's timestamp is its send time.
