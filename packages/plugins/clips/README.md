# @scarlett-player/clips

**The player captures a range; it does not produce a clip.** Rendering, storage, moderation and playback of the result are the server's problem. This plugin gives viewers a two-handle in/out selector on the timeline, loops the selection as a preview, and hands the committed range to your host code or posts it to an endpoint you configure. What happens after that is up to you.

## Installation

```bash
pnpm add @scarlett-player/core @scarlett-player/clips
```

`@scarlett-player/core` is a required peer. `@scarlett-player/ui` is an optional peer: when it is installed the plugin registers a `clip` control for the control bar, and a host places it by naming that id in the control layout. Everything else - the whole imperative API, the events and the state keys - works without the UI package.

## Usage

```ts
import { createPlayer } from '@scarlett-player/core';
import { uiPlugin } from '@scarlett-player/ui';
import { createClipsPlugin } from '@scarlett-player/clips';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/event.m3u8',
  plugins: [
    uiPlugin({
      // The plugin registers the control; the layout is what places it.
      controls: ['play', 'volume', 'time', 'spacer', 'clip', 'fullscreen'],
    }),
    createClipsPlugin({
      mediaId: 'event-42',
      onCreate: (range) => myApi.createClip(range),
    }),
  ],
});
```

The control hides itself on live media, on audio, and while `mediaId` resolves to nothing, so it is safe to leave `'clip'` in the layout for media that cannot be clipped. Opening the selector pre-rolls a `defaultDuration` window behind the playhead; the viewer drags the two handles (mouse, touch or keyboard), names the clip if the title field is on, and confirms.

## Submitting a clip

There are two mutually exclusive submission paths. Configure exactly one; a host that sets both or neither fails at plugin construction, not on the viewer's first click.

**`onCreate`** - your own HTTP client. Called once with the validated `ClipRange`; whatever it resolves to becomes `result` on `clip:created`. A rejection is reported through `onError` and `clip:error` and leaves the selector open so the viewer can retry.

```ts
createClipsPlugin({
  mediaId: () => currentPlaybackToken,
  onCreate: async (range) => {
    const res = await axios.post('/api/clips', range);
    return res.data;               // -> clip:created result
  },
});
```

**`endpoint`** - built-in transport for a host running the server-side package with no glue code. It POSTs the range as JSON, defaulting to `credentials: 'same-origin'` so the session cookie rides along.

```ts
createClipsPlugin({
  mediaId: 'event-42',
  endpoint: { url: '/api/clips' },
});
```

A 2xx closes the selector and emits `clip:created` with the parsed body (a non-JSON or empty 2xx body is a success with `result: null`). Anything else surfaces as a `ClipSubmitError` with the HTTP `status` and the parsed body, the selector stays open, and a server-supplied `message` is shown to the viewer as plain text. The player never polls for render status - the 2xx's body is handed to you and the flow stops.

The payload carries **no media `src`**: playback URLs are frequently signed, the server resolves the source from `mediaId`, and the `clientRequestId` minted when the selector opens is your idempotency key, so a retried POST cannot make two clips.

## Headless mode

Set `ui: 'none'` to skip the styles, the overlay panel and the control registration entirely. `open()`, `setRange()`, `setTitle()`, `getRange()`, `commit()`, `close()` and every event and state key still work, so a host can drive its own UI:

```ts
const clips = createClipsPlugin({ mediaId: 'event-42', ui: 'none', onCreate: handleSubmit });
player.addPlugin(clips);

clips.open();
player.on('clip:changed', ({ start, end }) => myRangeSlider.set(start, end));
myButton.addEventListener('click', () => clips.commit());
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `minDuration` | `number` | `5` | Shortest clip the host will accept, seconds |
| `maxDuration` | `number` | `60` | Longest clip the host will accept; must be at or below the server's own maximum |
| `defaultDuration` | `number` | `30` | Pre-roll behind the playhead when the selector opens; clamped to `[minDuration, maxDuration]` |
| `step` | `number` | `1` | Handle snapping granularity, seconds; labels format at this granularity. `<= 0` falls back to `1` |
| `title` | `false \| { maxLength, required, placeholder, label }` | `{ maxLength: 80, required: false, placeholder: 'Name this clip' }` | Title field. `false` hides it and the payload always carries `title: null` |
| `mediaId` | `string \| (() => string \| null)` | - | Host identifier for the current media - an id, slug or playback token, opaque to the plugin. Required for the control to render |
| `ui` | `'overlay' \| 'none'` | `'overlay'` | `'none'` is fully headless |
| `loopPreview` | `boolean` | `true` | Loop playback of the selection while the selector is open |
| `buttonIcon` | `string` | clip glyph | Inline SVG for the control-bar button |
| `buttonLabel` | `string` | `'Create clip'` | Accessible label for the control-bar button |
| `onCreate` | `(range) => unknown \| Promise<unknown>` | - | Host-owned submission. Mutually exclusive with `endpoint` |
| `endpoint` | `ClipEndpointConfig` | - | Built-in transport. Mutually exclusive with `onCreate` |
| `onCancel` | `() => void` | - | Viewer cancelled (Cancel button, Escape, source change) |
| `onError` | `(error) => void` | - | Any clip error: invalid `open()`, `mediaId` failures, submission failures |

### `endpoint` options

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | - | POST target, e.g. `'/api/clips'` |
| `method` | `'POST' \| 'PUT'` | `'POST'` | HTTP method |
| `headers` | `Record \| () => Record \| Promise<Record>` | - | Static headers, or a function resolved per request (CSRF, Bearer). Merged over `Content-Type: application/json` |
| `credentials` | `RequestCredentials` | `'same-origin'` | Carries the session cookie |
| `body` | `(range) => unknown` | verbatim `ClipRange` | Reshape the request body for an API that wants another shape |
| `timeoutMs` | `number` | `15000` | Enforced with an `AbortController`; a hung `onCreate` is the host's timeout to own |
| `fetch` | `typeof fetch` | global | Injectable, for tests and instrumented clients |

## Imperative API

```ts
const clips = createClipsPlugin({ mediaId: 'event-42', endpoint: { url: '/api/clips' } });

clips.open();                      // resolve mediaId, mint clientRequestId, pre-roll, show
clips.setRange(12, 47);            // clamps + snaps both handles, emits clip:changed
clips.setTitle('Best moment');     // trimmed and truncated to maxLength
clips.getRange();                  // ClipRange | null when closed or mediaId unresolved
await clips.commit();              // re-validate, submit, close on success
clips.isOpen();                    // boolean
clips.configure({ maxDuration: 90 }); // change limits at runtime; re-clamps an open selection
clips.close();                     // cancel; idempotent
```

## What gets submitted

The `ClipRange` object is the wire contract, sent verbatim (camelCase) to `onCreate` or `endpoint`.

| Field | Type | Description |
|---|---|---|
| `startTime` / `endTime` | `number` | In / out points, in media seconds |
| `duration` | `number` | `endTime - startTime` |
| `mediaId` | `string` | Host identifier; never null on a committed range |
| `clientRequestId` | `string` | Idempotency key, minted on `open()` |
| `title` | `string \| null` | Viewer-entered name, trimmed; null when the field is disabled or left empty |
| `isLive` | `boolean` | `false` on all v1 (VOD) ranges |
| `seekableStart` / `seekableEnd` | `number \| null` | DVR window at commit; null for VOD |
| `startDate` / `endDate` | `string \| null` | Wall-clock time of the in/out points (ISO 8601); live only, null on VOD |
| `capturedAt` | `string` | When the range was captured (ISO 8601) |

## Events

| Event | Payload | When |
|---|---|---|
| `clip:opened` | `{ start, end }` | The selector opened |
| `clip:changed` | `{ start, end, reason: 'user' \| 'clamp' }` | The selection moved |
| `clip:created` | `{ range, result }` | Submission succeeded; `result` is `onCreate`'s value or the endpoint's parsed JSON |
| `clip:cancelled` | `{ reason: 'user' \| 'source-change' \| 'destroy' }` | The viewer cancelled or the source changed |
| `clip:error` | `{ error }` | An invalid `open()`, a `mediaId` failure, or a submission failure |

## State keys

Written through `api.defineState()` and available via declaration merging: `clipSelection` (`{ start, end } | null`, the single source of truth for the selection), `clipOpen` (`boolean`), and `clipTitle` (`string`, `''` when empty so headless hosts and the overlay agree).

## VOD only

v1 clips on-demand media. On live the control hides and `open()` errors, because the server side cannot yet cut a live recording. Live is designed (DVR reconciliation, wall-clock mapping) and deferred to a later phase; the payload keeps its live fields (`isLive`, `seekableStart`/`seekableEnd`, `startDate`/`endDate`, all false/null on VOD) so the wire contract will not change when live lands.

## License

MIT
