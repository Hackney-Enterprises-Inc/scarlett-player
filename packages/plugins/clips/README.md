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

The control hides itself on live media, on audio, while the media type is not yet known, and while `mediaId` resolves to nothing, so it is safe to leave `'clip'` in the layout for media that cannot be clipped. Opening the selector pre-rolls a `defaultDuration` window behind the playhead; the viewer moves the two endpoints, names the clip if the title field is on, and confirms.

## Where the handles are

With `@scarlett-player/ui` installed, the IN and OUT handles are mounted **on the playback timeline itself** - the rail the viewer was already scrubbing - in two 44px lanes, IN above the rail and OUT below it, each labelled with its own timestamp and pointing at it with a stem.

Two lanes rather than one is what makes short selections editable: a 30-second clip on a two-hour source is about a pixel and a quarter wide on a 300px rail, and two targets stacked on one line cannot both be hit. Presses that miss a handle fall through to the rail and seek as usual, so the playhead never stops working while the editor is open.

Without the UI package - or with one too old to expose `registerTimelineExtension` - the same selector renders as a self-contained rail inside the panel. The plugin feature-detects; there is no version pin and no hard failure. If the UI package is torn down or rebuilds its control bar while the editor is open, the handles move between the two presentations without losing the selection, the title or the request id.

## Editing a range

Every route to an endpoint goes through the same clamping model, emits at most one `clip:changed`, and never moves the *other* endpoint to make room:

- **Drag** either handle. The grab offset is preserved, so the endpoint moves by the distance your finger moved rather than jumping to it.
- **Keyboard**: arrows step by `step`, Shift+arrow by five steps, Home/End jump to that endpoint's own reachable limits (the other endpoint and the duration limits, not the media edges).
- **"IN here" / "OUT here"** place that endpoint at the frame currently on screen.
- **Fine tune** opens labelled exact-time fields accepting seconds (`93`, `93.5`), `mm:ss[.fff]` or `hh:mm:ss[.fff]`. Values are normalised to `step`; anything malformed, negative or non-finite is refused and changes nothing. Enter or blur commits, Escape reverts the field.

To clip a part of the video far from the playhead, close the editor, seek there and open it again: the pre-roll starts the selection where you are. The editor never moves an endpoint you did not ask it to.

## Preview

Opening the editor starts the preview loop (unless `loopPreview: false`), which returns the playhead to the in point each time it passes the out point.

The loop never fights the viewer. An ordinary seek on the timeline takes the playhead away from the loop and **keeps** it, so scrubbing past the out point does not snap back; **Preview clip** is how you ask for the loop again, and it seeks, arms and plays inside your own press so autoplay policy allows it. If the browser still refuses, the editor says "Press Play to preview" and keeps the selection. Dragging a handle suspends the loop for the duration of the drag and gives back exactly what it found: a drag begun while suspended ends still suspended, and an interrupted drag (a cancelled gesture, a lost pointer capture) keeps the range it had reached and stays paused.

## Small players

The layout is measured on the **player**, never on the device, so a 320px player embedded in a wide article behaves like a phone and a full-bleed player on a phone does not.

| Player | What the viewer gets |
|---|---|
| 600px wide and 360px tall or more | Handles on the timeline, an at-playhead toolbar, and the details panel above it, all at once |
| Narrower or shorter than that | Two steps: **Range** (handles plus one 44px toolbar) and **Details** (Back, exact times, title, and a sticky Cancel / Create footer). Back keeps the selection and the typed title |
| Shorter than 220px | The ordinary control bar is hidden for the duration of the edit and Play/Pause moves into the toolbar, which keeps roughly 40px of picture visible in a 320x180 frame. It comes straight back on exit |
| Shorter than 160px | A bounded, scrollable editor over the whole player: being able to reach the controls beats being able to see the video |

Visible button labels shorten on a narrow player; the accessible names never do.

## Accessibility

Range editing is a nonmodal labelled region, so Tab moves through the handles, the toolbar and the rest of the page normally - there is no document-wide focus trap. The details step is a labelled dialog with `aria-modal="false"` (the page behind it really is still usable) and cycles Tab only while focus is inside it. Escape is scoped to focus inside **this** player, so two players on one page never answer each other; on the details step it means "back", not "throw the draft away".

Each handle is a `role="slider"` announcing IN or OUT, its own time, and the limits it can actually reach. Notices are written with `textContent` only and announced politely; a clamp during a drag flashes silently instead, because announcing it on every pixel of a pinned drag is noise. Focus returns to the clip button on close, or to the player when a control-bar rebuild has taken that button away.

### Full screen

DOM fullscreen keeps the editor with the player. **Native video fullscreen on iPhone cannot display custom DOM controls at all** - the OS replaces the page with its own player - so entering it suspends the preview and freezes the editor with the draft intact, and leaving it thaws everything unchanged. An `open()` during native fullscreen errors with `native-fullscreen-active` rather than silently doing nothing; the plugin never calls a fullscreen API the viewer did not ask for.

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

### Error codes

Errors reported through `onError` / `clip:error` outside submission carry a `code`. Submission failures are `ClipSubmitError` instead.

| Code | Meaning |
|---|---|
| `media-type-unknown` | The provider has not established what the media is yet. **Not** an audio verdict: intrinsic dimensions are frequently unavailable on mobile before playback starts, and the player says "not yet" rather than guessing. Pressing Play resolves it |
| `media-type-unsupported` | The media really is audio. Clips need video |
| `live-unsupported` | Live media; see [VOD only](#vod-only) |
| `duration-unknown` | The duration is missing, infinite or zero |
| `media-id-unresolved` | `mediaId` is unset, empty, or its resolver returned nothing |
| `native-fullscreen-active` | The media is in the platform's own fullscreen player, where no custom control can be drawn. Exit fullscreen first |
| `too-short`, `too-long`, `out-of-bounds`, `inverted` | The selection does not satisfy the configured limits |
| `title-required`, `title-too-long` | The title does not satisfy the `title` config |

These are also re-checked at commit against authoritative state: if the media turns out to be audio, goes live, or its duration stops covering the selection while the editor is open, Create is disabled with the precise reason and the selection is kept rather than submitted against a source it no longer describes.

## State keys

Written through `api.defineState()` and available via declaration merging: `clipSelection` (`{ start, end } | null`, the single source of truth for the selection), `clipOpen` (`boolean`), and `clipTitle` (`string`, `''` when empty so headless hosts and the overlay agree).

## VOD only

v1 clips on-demand media. On live the control hides and `open()` errors, because the server side cannot yet cut a live recording. Live is designed (DVR reconciliation, wall-clock mapping) and deferred to a later phase; the payload keeps its live fields (`isLive`, `seekableStart`/`seekableEnd`, `startDate`/`endDate`, all false/null on VOD) so the wire contract will not change when live lands.

## License

MIT
