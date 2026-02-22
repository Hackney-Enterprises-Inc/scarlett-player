---
'@scarlett-player/core': minor
'@scarlett-player/ui': minor
'@scarlett-player/chromecast': minor
---

End-user experience polish sprint

- Enhanced live stream controls: LiveIndicator shows "GO LIVE" when behind live edge, ProgressBar supports DVR seeking with live time tooltip, SkipButton respects seekable range bounds
- Added touch event support to ProgressBar and VolumeControl for mobile devices
- Fixed keyboard shortcuts not being intercepted when typing in input fields
- Fixed ErrorOverlay memory leaks (anonymous listeners, retry button debounce)
- Wrapped CSS hover states in @media (hover: hover) for touch devices
- Fixed Chromecast SESSION_RESUMED handling to avoid reloading media on reconnect
- Fixed Chromecast destroy crash when Cast SDK not loaded (optional chaining)
- Replaced SVG text-based icons (forward10/replay10) with path-only versions for reliable rendering
- Added ThumbnailPreview error handling for failed sprite sheet loads
- Improved ErrorOverlay user-facing messages (separated manifest vs network errors)
- Fixed VolumeControl and LiveIndicator missing event listener cleanup in destroy
- Added ThumbnailConfig and error:retry/error:dismiss to core type definitions
