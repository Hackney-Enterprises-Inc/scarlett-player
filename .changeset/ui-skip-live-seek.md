---
"@scarlett-player/ui": patch
---

The skip-forward and skip-backward buttons now send their seek through the player, so on a live stream a forward skip stops at live instead of jumping to the very end of the stream and stalling, and does nothing when the viewer is already at live. VOD skipping lands where it always did; analytics now counts skips as player seeks.
