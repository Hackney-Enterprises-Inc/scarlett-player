---
'@scarlett-player/core': patch
'@scarlett-player/ui': patch
'@scarlett-player/chromecast': patch
---

Lint and type safety fixes

- Fixed all 31 ESLint warnings across the codebase (unused imports, variables, args)
- Added ThumbnailConfig type and thumbnails state to core StateStore
- Added error:retry and error:dismiss events to core PlayerEventMap
- Fixed VolumeControl missing event listener cleanup in destroy
- Fixed LiveIndicator inline handlers converted to proper named methods with cleanup
- Updated README with analytics plugin and completed roadmap items
