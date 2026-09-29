---
"@scarlett-player/analytics": patch
---

Report iOS correctly in analytics beacons. `getOSInfo()` checked for "Mac OS X" before iOS, and iPhone, iPad and iPod user agents contain "like Mac OS X", so every iOS viewer was reported as `os: "macOS"`. iOS is now detected first, and iPadOS Safari in its default desktop mode (a Macintosh user agent on a touch device, `navigator.maxTouchPoints > 1`) is reported as `os: "iOS"` with `deviceType: "tablet"` instead of macOS on a desktop. Existing rows with `os: "macOS"` and `deviceType: "mobile"` were iOS devices.
