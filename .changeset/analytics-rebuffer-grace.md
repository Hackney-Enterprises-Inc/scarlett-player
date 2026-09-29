---
"@scarlett-player/analytics": patch
---

Filter short post-seek waiting blips with a 250 ms rebuffer grace, reducing
Safari `rebufferStart`/`rebufferEnd` rows and `rebufferCount`. A confirmed
`rebufferStart` is sent about 250 ms after waiting began; its timestamp is not
backdated, while the measured stall duration includes the full grace.

Set `rebufferGraceMs: 0` to restore synchronous, immediate counting. Negative
or non-finite values fall back to 250 ms. Pending waiting counts as watch time
but never play time, even when cancelled before it becomes a rebuffer. No
embed data attribute is added.
