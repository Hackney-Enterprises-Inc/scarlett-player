---
"@scarlett-player/analytics": minor
---

Scores of views that never showed a first frame change and `qoeVersion` moves from 2 to 3: a view that asked to play and got no frame now scores 0, one that never asked or is still waiting for a tap scores null, and heartbeats before the first frame carry a null score instead of reading near 100; views that played score as before.
