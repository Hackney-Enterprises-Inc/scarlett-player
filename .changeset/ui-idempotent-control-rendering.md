---
'@scarlett-player/ui': patch
---

Fix control clicks being silently dropped, most visibly the first click on the play button.

`update()` ran on every state change (`timeupdate` and `progress` alone fire several times a second) and unconditionally reassigned `innerHTML`, rebuilding each control's icon even when the markup was identical. When that happened between a user's `mousedown` and `mouseup`, the node that received the `mousedown` no longer existed and the browser never dispatched the `click`, so the press did nothing.

Control rendering is now idempotent — `innerHTML` and attributes are only written when the value actually changes — and state-driven renders are coalesced to one per animation frame instead of one per state key. In a browser harness clicking play on a freshly loaded HLS stream, dropped first clicks went from 12/12 to 0/12, and play-button DOM mutations over a 40-click run dropped from 644 to 160.
