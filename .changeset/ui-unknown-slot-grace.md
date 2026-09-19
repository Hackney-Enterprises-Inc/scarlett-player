---
'@scarlett-player/ui': patch
---

Stop warning `Unknown control slot` for controls a plugin registers a moment
after the bar is built, and rebuild the bar once per tick instead of once per
registration.

The playlist and chapters plugins register their controls from inside
`import('@scarlett-player/ui').then(...)`, which lands after the UI plugin
has already built its bar, so every mount warned for `playlist-previous`,
`playlist-next` and `chapters` and each of those registrations tore the whole
bar down and built it again (three rebuilds per mount, six warnings). The
plugin now records a slot it cannot fill and judges the layout once, 1500ms
after the first build: a slot still unregistered then warns
`Control slot "chapters" has no registered control after 1500ms - is the
plugin installed?`, so a typo in `controls` is still reported. Registrations
are coalesced onto one microtask, so N registrations in one tick cause one
rebuild. Both the queued rebuild and the grace timer are cancelled by
`destroy()`.

For a test that registers a control after `plugin.init()`, the rebuilt bar is
visible after one microtask (`await Promise.resolve()`); the grace period is
exported as `UNRESOLVED_SLOT_GRACE_MS` (internal) for fake-timer tests.
