# @scarlett-player/share

## 1.5.0

### Minor Changes

- [#62](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/62) [`044114c`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/044114ca29c675c4dea643882b966a27bb1b6afa) Thanks [@alexhackney](https://github.com/alexhackney)! - New package: `@scarlett-player/share`.

  A share control for the player - the OS share sheet on mobile, copy link, social targets, embed codes, and playback timestamps. Zero configuration shares the current page URL with the position appended; the host adds `'share'` to its control layout to place the button.

  **Mobile is the primary path.** Where `navigator.share` exists and no custom target list is configured, tapping the button opens the native sheet directly rather than putting an in-player menu in front of it. When the in-player sheet is used it is a bottom sheet within thumb reach, with a grab handle and `env(safe-area-inset-bottom)` honoured, promoting to a popover at 640px and up. Targets are 72px tall with press rather than hover states, the manual-copy fallback uses 16px text so iOS Safari does not zoom the viewport, and `prefers-reduced-motion` is respected. The sheet renders inside the player container so it survives fullscreen, traps focus, closes on Escape, and restores focus to the button.

  **What gets shared is the page, never the media `src`.** Playback URLs are frequently signed, so sharing one would leak a credential and produce a link that expires. There is no configuration or code path that falls back to `src`, and a test asserts it. The URL defaults to `window.location.href` and is overridable - which matters most inside `iframe.html`, where `window.location.href` is the player page and cross-origin rules block reading the parent. `@scarlett-player/embed` now accepts a `shareUrl` parameter for exactly that, and the `embed` target generates snippets with it already set.

  Timestamps are applied through the URL API, so an existing query string or fragment survives and re-sharing replaces the previous timestamp instead of appending a second. Live media never gets one, since an offset into a sliding DVR window is meaningless to the recipient. A dismissed native sheet rejects with `AbortError` and is treated as a choice rather than an error, and the clipboard falls back through `execCommand` to showing the link for manual copying.
