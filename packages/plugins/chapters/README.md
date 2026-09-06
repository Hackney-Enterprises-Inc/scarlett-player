# @scarlett-player/chapters

Chapter markers, a chapter list and seek-to-chapter for [Scarlett Player](https://scarlettplayer.com). Chapters come from an inline list or a WebVTT chapters file, and the plugin keeps the `chapters` and `currentChapter` state keys and the `chapter:*` events that core already defines, so anything reading those keys (the progress bar markers in the UI package, for example) works with no extra wiring.

## Installation

```bash
pnpm add @scarlett-player/core @scarlett-player/chapters
```

`@scarlett-player/core` is a peer dependency. `@scarlett-player/ui` is an optional peer: when it is installed the plugin registers a `chapters` control, and a host places it by naming that id in the control layout. Everything else works without the UI package.

## Usage

```ts
import { createPlayer } from '@scarlett-player/core';
import { uiPlugin } from '@scarlett-player/ui';
import { createChaptersPlugin } from '@scarlett-player/chapters';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/event.m3u8',
  plugins: [
    uiPlugin({ controls: ['play', 'chapters', 'time', 'spacer', 'fullscreen'] }),
    createChaptersPlugin({
      chapters: [
        { time: 0, label: 'Preshow' },
        { time: 480, label: 'Alvarez vs Reyes', subtitle: 'Lightweight' },
        { time: 2400, endTime: 2850, label: 'Main event' },
      ],
    }),
  ],
});
```

The control hides itself while the list is empty, so it is safe to leave `chapters` in the layout for media that has none.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `chapters` | `Chapter[]` | - | Chapter list already in memory. Wins over `src` when both are given |
| `src` | `string` | - | URL of a WebVTT chapters file, loaded through a hidden `<track kind="chapters">` so the browser parses it. Cross-origin URLs need CORS |
| `previousThreshold` | `number` | `3` | Seconds from a chapter's start within which `previous()` steps back a chapter instead of restarting the current one |

### Chapter

`Chapter` is defined by `@scarlett-player/core`.

| Field | Type | Description |
|---|---|---|
| `time` | `number` | Start in seconds. Required |
| `label` | `string` | Title shown in the list. Required |
| `endTime` | `number` | Optional exclusive end. Omit to run until the next chapter starts; set it for sparse chapters with dead air between them |
| `subtitle` | `string` | Optional second line under the label |
| `thumbnail`, `metadata` | | Carried through untouched. This plugin does not render them |

Lists are normalised before use: entries without a finite, non-negative `time` are dropped, the rest are sorted, an `endTime` past the next chapter's start is clamped to it, and the last chapter runs to `Infinity` so it stays correct on live media. `getChapters()` returns this resolved form.

### WebVTT files

Each cue becomes a chapter: cue start is `time`, cue text is `label`, and a finite cue end is `endTime`. A file with no cues loads nothing; a failed fetch is logged as a warning and playback continues.

## Imperative API

```ts
const chapters = createChaptersPlugin({ src: '/chapters.vtt' });

chapters.setChapters(list);   // replace the list, for example after a source change
chapters.getChapters();       // ResolvedChapter[], end times filled in
chapters.seekToChapter(2);    // out of range indexes are ignored
chapters.next();              // no-op inside or past the last chapter
chapters.previous();          // restart the chapter, or step back if it just started
```

Seeks are clamped to the seekable range on live DVR and to the duration on VOD. The pure lookup helpers `normaliseChapters`, `chapterIndexAt`, `nextChapterIndex` and `previousChapterIndex` are exported too.

## State and events

State keys written: `chapters` (the resolved list) and `currentChapter` (the chapter under the playhead, or `null` in a gap or before the first chapter).

| Event | Payload | When |
|---|---|---|
| `chapter:loaded` | `{ chapters }` | A list was published, from config, from the VTT file, or from `setChapters()` |
| `chapter:change` | `{ chapter, previous }` | The playhead crossed a chapter boundary. Either side can be `null` |
| `chapter:select` | `{ chapter }` | A chapter was chosen, through the list or `seekToChapter()`, `next()` or `previous()` |

## CSS

Styles are injected once per document in a `<style id="sp-chapters-styles">`. There are no CSS custom properties; override the classes.

| Class | Element |
|---|---|
| `.sp-chapters` | Control root. Gains `.sp-chapters--open` while the panel is open |
| `.sp-chapters__button` | Control bar button, also carries the UI package's `.sp-control` |
| `.sp-chapters__panel` | The popover list, `role="menu"` |
| `.sp-chapters__item` | One chapter button. `.sp-chapters__item--active` marks the current chapter |
| `.sp-chapters__time`, `__text`, `__label`, `__subtitle` | Item contents |

The panel closes on any document click and on Escape, which returns focus to the button.

## License

MIT
