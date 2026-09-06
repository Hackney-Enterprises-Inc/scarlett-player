---
"@scarlett-player/embed": patch
"@scarlett-player/share": patch
---

The embed can share the page it is on.

`@scarlett-player/share` now ships in the Full and Video embed builds, and a new
`data-share-url` attribute, `shareUrl` option and `share-url` iframe parameter
carry the page URL through to it. The share plugin's `embed` target has been
writing `shareUrl` into the snippets it generates since it landed, but
`iframe.html` never read the parameter and no embed build contained the plugin,
so a snippet copied out of one player produced an iframe with no share button
and a URL nobody looked at.

Opt in, and video only. With no share URL the control bar is unchanged, because
the button has nothing to offer: the plugin will not fall back to the media
`src`, which is frequently signed. The audio builds are unaffected, since the
audio UIs have no control registry to register a button into. Inside
`iframe.html` the page also passes its own URL as `embedBaseUrl`, so the
sheet's embed code is a working copy of the player the viewer is watching.
