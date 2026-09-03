# @scarlett-player/share

Share plugin for [Scarlett Player](https://scarlettplayer.com). Native share sheet on mobile, copy link, social targets, embed codes, and timestamps.

```bash
npm install @scarlett-player/share
```

## Usage

```ts
import { createPlayer } from '@scarlett-player/core';
import { uiPlugin } from '@scarlett-player/ui';
import { createSharePlugin } from '@scarlett-player/share';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/video.m3u8',
  plugins: [
    uiPlugin({
      // The plugin registers the control; the layout is what places it.
      controls: ['play', 'volume', 'time', 'spacer', 'share', 'fullscreen'],
    }),
    createSharePlugin(),
  ],
});
```

That is the whole setup. With no configuration the plugin shares the current page URL with the playback position appended.

## Which URL gets shared

**The page URL - never the media `src`.**

Playback URLs are frequently signed or tokenised. Sharing one would leak a credential and hand the recipient a link that expires, so there is no configuration and no code path that causes it. The URL comes from `config.url`, defaulting to `window.location.href`.

That default is correct on an ordinary watch page. Override it when the player is not the page:

```ts
createSharePlugin({
  url: () => `https://example.com/watch/${currentSlug}`,
})
```

### Inside an iframe embed

This is the case the override exists for. Inside `iframe.html`, `window.location.href` is the *player* page, and cross-origin rules prevent reading the parent - so the plugin cannot work out the real page on its own. Pass it in:

```html
<iframe src="https://assets.thestreamplatform.com/scarlett-player/latest/iframe.html?src=...&shareUrl=https%3A%2F%2Fexample.com%2Fwatch%2Fabc"></iframe>
```

The `embed` target generates snippets with `shareUrl` already set.

## Mobile behaviour

Mobile is the primary path, not an adaptation of the desktop one.

- **The OS share sheet comes first.** Where `navigator.share` exists and you have not configured a custom target list, tapping the button opens the native sheet directly. No in-player menu in front of it, and every app the viewer already has is available.
- **Bottom sheet, not a popover.** When the in-player sheet is used it slides up from the bottom, within thumb reach, with a grab handle and `env(safe-area-inset-bottom)` respected. It becomes a popover at 640px and above.
- **Targets are 72px tall and at least 44px wide**, comfortably past the WCAG 2.5.5 minimum, with a press state instead of a hover state.
- **The manual-copy fallback uses 16px text**, which stops iOS Safari zooming the viewport on focus.
- Honours `prefers-reduced-motion`.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string \| () => string` | `window.location.href` | Canonical page URL. Never falls back to `src` |
| `title` | `string \| () => string` | `document.title` | Passed to the native sheet |
| `withTimestamp` | `boolean` | `true` | Append the playback position. Ignored on live |
| `timestampParam` | `string` | `'t'` | Query parameter name |
| `roundTimestamp` | `boolean` | `true` | Round to whole seconds |
| `targets` | `Array<string \| ShareTarget>` | `['native', 'copy', 'embed']` | Targets, in order |
| `embedBaseUrl` | `string` | - | Enables the `embed` target |
| `embedSnippet` | `(ctx) => string` | - | Override the generated snippet |
| `onShare` | `(targetId, url) => void` | - | Analytics hook |
| `onError` | `(error) => void` | - | Never fires for a dismissed native sheet |

Built-in targets: `native`, `copy`, `embed`, `x`, `facebook`, `linkedin`, `whatsapp`, `telegram`, `reddit`, `email`.

Targets that cannot work are removed rather than shown broken - `native` without `navigator.share`, `embed` without `embedBaseUrl`.

### Custom targets

```ts
createSharePlugin({
  targets: [
    'native',
    'copy',
    {
      id: 'signal',
      label: 'Signal',
      icon: '<svg viewBox="0 0 24 24">...</svg>',
      href: (ctx) => `https://signal.me/#p/${encodeURIComponent(ctx.url)}`,
    },
  ],
})
```

## Timestamps

The position is applied with the URL API, so an existing query string or fragment survives and re-sharing replaces the previous timestamp rather than appending a second one.

Live streams never get one - an offset into a sliding DVR window means nothing to whoever opens the link.

## Imperative API

```ts
const share = createSharePlugin();

await share.share();          // native sheet on mobile, otherwise open the sheet
await share.share('copy');    // straight to one target
share.getShareUrl();          // what would be shared right now
share.close();
```

## Events

| Event | Payload |
|---|---|
| `share:opened` | `void` |
| `share:closed` | `void` |
| `share:completed` | `{ targetId, url }` |

## Without the UI package

`@scarlett-player/ui` is an optional peer. The control registers only if it is present, and everything else - including the sheet and the imperative API - works without it.

## License

MIT
