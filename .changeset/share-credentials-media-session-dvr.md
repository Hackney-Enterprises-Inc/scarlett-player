---
'@scarlett-player/share': minor
'@scarlett-player/media-session': minor
---

Share: the default share URL drops credential query params and the fragment.
Media Session: seek and stop clamp to the DVR window on live streams.

**Share**

`resolveBaseUrl` fell back to `window.location.href` whole, so a host page
carrying `?token=`, an HMAC signature or a fragment credential leaked it to
whoever received the link. Named credential parameters and the fragment are now
removed. Deliberately a denylist rather than an `origin + pathname` strip: page
identity often lives in the query (`/watch?v=abc123`), and dropping it would
share the wrong page. An explicitly supplied `config.url` is returned verbatim.

**Media Session**

`stop` seeked to `0`, `seekbackward` clamped at `0`, `seekforward` clamped to
`duration` and `seekto` did not clamp at all. On a live DVR stream the window
starts at `seekableRange.start` and `duration` is `Infinity` or arbitrary, so
every one of those could seek outside the buffer. All four now clamp to the
live window, falling back to `[0, duration]` off live and leaving the upper
bound open while the duration is still unknown.
