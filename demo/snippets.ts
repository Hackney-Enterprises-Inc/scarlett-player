/**
 * Integration examples generated from the playground's live configuration.
 *
 * One normalized {@link PlaygroundConfig} feeds three generators. Each
 * generator maps only the settings its integration can really express and
 * lists the rest in `omitted`, so a visitor never copies an example that
 * silently drops a setting they just turned on:
 *
 * - TypeScript is the full reference: every plugin the playground runs.
 * - Embed uses the data attributes `packages/embed/README.md` documents and
 *   nothing else. The embed builds ship no WHEP provider, so a WHEP
 *   configuration disables that tab instead of inventing an attribute.
 * - Vue passes the same plugin list through the component's `plugins` prop.
 *
 * Output is plain text. Callers render it through `textContent`; nothing here
 * is ever interpolated into executable HTML. Values are escaped per output
 * language: TypeScript string literals for the TypeScript and Vue examples,
 * HTML attribute escaping for the Embed and Vue template examples.
 */

import type { Chapter } from '../packages/core/src/index';
import type { WatermarkPosition } from '../packages/plugins/watermark/src/index';

/** The three integrations the Code panel offers. */
export type SnippetKind = 'typescript' | 'embed' | 'vue';

/** A caption track as the example shows it (a hosted .vtt, not the demo's blob). */
export interface SnippetCaption {
  language: string;
  label: string;
  src: string;
}

/** Watermark settings when the switch is on. */
export interface SnippetWatermark {
  kind: 'text' | 'image';
  text: string;
  imageUrl: string;
  position: WatermarkPosition;
  opacity: number;
  imageHeight: number;
  padding: number;
}

/** Clip limits when the clip selector is part of the configuration. */
export interface SnippetClips {
  minDuration: number;
  maxDuration: number;
  defaultDuration: number;
  step: number;
}

/**
 * Everything the generators need, normalized from the controller's state.
 *
 * `src` is null while a scenario has no source yet (WHEP and Your stream
 * before a load); the generators then show `srcPlaceholder` and say so.
 */
export interface PlaygroundConfig {
  media: 'video' | 'audio' | 'audio-mini' | 'whep';
  src: string | null;
  srcPlaceholder: string;
  /** True when the visitor typed the source; the example labels it */
  userSupplied: boolean;
  poster: string | null;
  accent: string;
  watermark: SnippetWatermark | null;
  captions: SnippetCaption[] | null;
  chapters: Chapter[] | null;
  clips: SnippetClips | null;
  /** Audio metadata, audio layouts only */
  audio: { title: string; artist: string; artwork: string | null } | null;
}

/** A generated example plus what it could not say. */
export interface Snippet {
  kind: SnippetKind;
  label: string;
  description: string;
  /** Install line shown above the code */
  install: string;
  code: string;
  /** Settings this integration cannot express, in plain words */
  omitted: string[];
  /** Set when the integration cannot represent the configuration at all */
  disabled: string | null;
}

const CDN_BASE = 'https://assets.thestreamplatform.com/scarlett-player/latest';

/**
 * A TypeScript single-quoted string literal for any value.
 *
 * Covers the characters that would otherwise end the literal or the line:
 * backslash, the quote, CR/LF, tab, and the U+2028/U+2029 separators that
 * older engines treat as newlines.
 *
 * @param value - Text to quote
 * @returns The literal, quotes included
 */
export function tsString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `'${escaped}'`;
}

/**
 * An HTML attribute value, escaped for a double-quoted attribute.
 *
 * `&`, `"`, `<` and `>` are the characters that can change the markup; the
 * rest of the value is left alone so a URL query string survives verbatim.
 *
 * @param value - Text to place in an attribute
 * @returns The escaped text, quotes not included
 */
export function htmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format a number the way the source would be written by hand.
 *
 * @param value - Number to print
 * @returns Shortest round-trip form
 */
function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * Render a chapter list as TypeScript object literals, one per line.
 *
 * @param chapters - Chapters to print
 * @param indent - Leading spaces for each entry
 * @returns The entries, comma-separated
 */
function chapterLiterals(chapters: Chapter[], indent: string): string {
  return chapters
    .map((chapter) => {
      const fields = [`time: ${num(chapter.time)}`, `label: ${tsString(chapter.label)}`];
      if (chapter.subtitle) fields.push(`subtitle: ${tsString(String(chapter.subtitle))}`);
      if (chapter.endTime !== undefined) fields.push(`endTime: ${num(chapter.endTime)}`);
      return `${indent}{ ${fields.join(', ')} },`;
    })
    .join('\n');
}

/**
 * The plugin factory calls a configuration needs, shared by the TypeScript
 * and Vue examples.
 *
 * @param config - Normalized playground configuration
 * @param indent - Leading spaces for each plugin line
 * @returns Import lines and plugin call lines
 */
function pluginBlocks(config: PlaygroundConfig, indent: string): { imports: string[]; plugins: string[] } {
  const imports: string[] = [];
  const plugins: string[] = [];
  const inner = `${indent}  `;

  if (config.media === 'audio' || config.media === 'audio-mini') {
    imports.push("import { createNativePlugin } from '@scarlett-player/native';");
    imports.push("import { createAudioUIPlugin } from '@scarlett-player/audio-ui';");
    plugins.push(`${indent}createNativePlugin(),`);
    const layout = config.media === 'audio' ? 'full' : 'mini';
    const lines = [`${indent}createAudioUIPlugin({`, `${inner}layout: '${layout}',`];
    if (config.media === 'audio-mini') {
      lines.push(`${inner}showArtwork: false,`, `${inner}showNavigation: false,`);
    }
    lines.push(
      `${inner}theme: { primary: ${tsString(config.accent)}, progressFill: ${tsString(config.accent)} },`,
      `${indent}}),`
    );
    plugins.push(...lines);
    if (config.media === 'audio') {
      imports.push("import { createPlaylistPlugin } from '@scarlett-player/playlist';");
      imports.push("import { createMediaSessionPlugin } from '@scarlett-player/media-session';");
      plugins.push(`${indent}createPlaylistPlugin({ autoAdvance: true }),`);
      plugins.push(`${indent}createMediaSessionPlugin({ seekOffset: 10 }),`);
    }
    return { imports, plugins };
  }

  if (config.media === 'whep') {
    imports.push("import { createWHEPPlugin } from '@scarlett-player/whep';");
    plugins.push(`${indent}createWHEPPlugin(),`);
  } else {
    imports.push("import { createHLSPlugin } from '@scarlett-player/hls';");
    imports.push("import { createNativePlugin } from '@scarlett-player/native';");
    plugins.push(`${indent}createHLSPlugin(),`);
    plugins.push(`${indent}createNativePlugin(),`);
  }

  imports.push("import { uiPlugin } from '@scarlett-player/ui';");
  const uiLines = [`${indent}uiPlugin({`, `${inner}theme: { accentColor: ${tsString(config.accent)} },`];
  if (config.chapters || config.clips) {
    // Neither slot is in the default layout: a layout has to ask for them.
    const slots = [
      'play', 'skip-backward', 'skip-forward', 'volume', 'time', 'live-indicator',
      'bandwidth-indicator', 'spacer',
      ...(config.clips ? ['clip'] : []),
      ...(config.chapters ? ['chapters'] : []),
      'settings', 'captions', 'chromecast', 'airplay', 'pip', 'fullscreen',
    ];
    uiLines.push(`${inner}// The clip and chapter buttons are opt-in slots.`);
    uiLines.push(`${inner}controls: [${slots.map((s) => `'${s}'`).join(', ')}],`);
  }
  uiLines.push(`${indent}}),`);
  plugins.push(...uiLines);

  if (config.watermark) {
    imports.push("import { createWatermarkPlugin } from '@scarlett-player/watermark';");
    const w = config.watermark;
    const lines = [`${indent}createWatermarkPlugin({`];
    if (w.kind === 'image') {
      lines.push(`${inner}imageUrl: ${tsString(w.imageUrl)},`, `${inner}imageHeight: ${num(w.imageHeight)},`);
    } else {
      lines.push(`${inner}text: ${tsString(w.text)},`);
    }
    lines.push(
      `${inner}position: '${w.position}',`,
      `${inner}opacity: ${num(w.opacity)},`,
      `${inner}padding: ${num(w.padding)},`,
      `${indent}}),`
    );
    plugins.push(...lines);
  }

  if (config.captions && config.captions.length > 0) {
    imports.push("import { createCaptionsPlugin } from '@scarlett-player/captions';");
    const lines = [`${indent}createCaptionsPlugin({`, `${inner}sources: [`];
    for (const track of config.captions) {
      lines.push(
        `${inner}  { language: ${tsString(track.language)}, label: ${tsString(track.label)}, src: ${tsString(track.src)} },`
      );
    }
    lines.push(`${inner}],`, `${indent}}),`);
    plugins.push(...lines);
  }

  if (config.chapters && config.chapters.length > 0) {
    imports.push("import { createChaptersPlugin } from '@scarlett-player/chapters';");
    plugins.push(
      `${indent}createChaptersPlugin({`,
      `${inner}chapters: [`,
      chapterLiterals(config.chapters, `${inner}  `),
      `${inner}],`,
      `${indent}}),`
    );
  }

  if (config.clips) {
    imports.push("import { createClipsPlugin } from '@scarlett-player/clips';");
    const c = config.clips;
    plugins.push(
      `${indent}// The plugin POSTs the captured range as JSON to your server.`,
      `${indent}createClipsPlugin({`,
      `${inner}mediaId: 'video-42',`,
      `${inner}endpoint: { url: '/api/clips' },`,
      `${inner}minDuration: ${num(c.minDuration)},`,
      `${inner}maxDuration: ${num(c.maxDuration)},`,
      `${inner}defaultDuration: ${num(c.defaultDuration)},`,
      `${inner}step: ${num(c.step)},`,
      `${indent}}),`
    );
  }

  return { imports, plugins };
}

/**
 * Packages an example imports, for its install line.
 *
 * @param imports - The generated import lines
 * @returns Package names in import order
 */
function packagesOf(imports: string[]): string[] {
  const names: string[] = [];
  for (const line of imports) {
    const match = /from '(@scarlett-player\/[a-z-]+)'/.exec(line);
    if (match?.[1] && !names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

/**
 * The source line, with a comment when the visitor supplied the URL or when
 * none is loaded yet.
 *
 * @param config - Normalized configuration
 * @param indent - Leading spaces
 * @returns `src:` line(s)
 */
function srcLine(config: PlaygroundConfig, indent: string): string {
  if (config.src === null) {
    return `${indent}// No source is loaded yet; this is where yours goes.\n${indent}src: ${tsString(config.srcPlaceholder)},`;
  }
  if (config.userSupplied) {
    return `${indent}// Your URL, exactly as you entered it.\n${indent}src: ${tsString(config.src)},`;
  }
  return `${indent}src: ${tsString(config.src)},`;
}

/**
 * The TypeScript example: `createPlayer()` with every plugin the playground
 * runs for this configuration, and the cleanup call.
 *
 * @param config - Normalized configuration
 * @returns The snippet
 */
function typescriptSnippet(config: PlaygroundConfig): Snippet {
  const { imports, plugins } = pluginBlocks(config, '    ');
  const playlist = config.media === 'audio' ? config.audio : null;
  if (playlist) imports.push("import type { IPlaylistPlugin } from '@scarlett-player/playlist';");

  const lines = [
    "import { createPlayer } from '@scarlett-player/core';",
    ...imports,
    '',
    'const player = await createPlayer({',
    "  container: document.querySelector('#player'),",
    srcLine(config, '  '),
  ];
  if (config.poster) lines.push(`  poster: ${tsString(config.poster)},`);
  lines.push('  plugins: [', ...plugins, '  ],', '});');

  if (playlist) {
    lines.push(
      '',
      '// The playlist plugin loads the track and hands its title and artwork to the UI.',
      "const playlist = player.getPlugin<IPlaylistPlugin>('playlist');",
      'playlist?.add([',
      `  { id: 'track-1', src: ${tsString(config.src ?? config.srcPlaceholder)}, title: ${tsString(playlist.title)}, artist: ${tsString(playlist.artist)}${playlist.artwork ? `, artwork: ${tsString(playlist.artwork)}` : ''} },`,
      ']);',
      'playlist?.play(0);'
    );
  }

  lines.push('', '// When the player leaves the page:', 'await player.destroy();');

  const packages = packagesOf(["import { createPlayer } from '@scarlett-player/core';", ...imports]);
  return {
    kind: 'typescript',
    label: 'TypeScript',
    description:
      config.media === 'whep'
        ? 'The full configuration: the WHEP provider, the UI and your accent.'
        : 'The full configuration: every plugin this preview is running, with your settings.',
    install: `npm install ${packages.join(' ')}`,
    code: lines.join('\n'),
    omitted: [],
    disabled: null,
  };
}

/**
 * The Embed example: one element with documented data attributes and the
 * matching CDN build.
 *
 * @param config - Normalized configuration
 * @returns The snippet, disabled for WHEP
 */
function embedSnippet(config: PlaygroundConfig): Snippet {
  if (config.media === 'whep') {
    return {
      kind: 'embed',
      label: 'Embed',
      description: 'The embed builds register the HLS and native providers only.',
      install: '',
      code: '',
      omitted: [],
      disabled:
        'The embed builds do not ship the WHEP provider. Use the TypeScript or Vue integration for a live monitor.',
    };
  }

  const isAudio = config.media === 'audio' || config.media === 'audio-mini';
  const attrs: string[] = ['data-scarlett-player'];
  const src = config.src ?? config.srcPlaceholder;
  attrs.push(`data-src="${htmlAttr(src)}"`);
  if (config.media === 'audio') attrs.push('data-type="audio"');
  if (config.media === 'audio-mini') attrs.push('data-type="audio-mini"');
  if (isAudio && config.audio) {
    attrs.push(`data-title="${htmlAttr(config.audio.title)}"`);
    attrs.push(`data-artist="${htmlAttr(config.audio.artist)}"`);
    if (config.audio.artwork) attrs.push(`data-artwork="${htmlAttr(config.audio.artwork)}"`);
  }
  if (!isAudio && config.poster) attrs.push(`data-poster="${htmlAttr(config.poster)}"`);
  attrs.push(`data-brand-color="${htmlAttr(config.accent)}"`);
  if (!isAudio) attrs.push('data-aspect-ratio="16:9"');

  const build = isAudio ? 'embed.audio.umd.cjs' : 'embed.video.umd.cjs';
  const lines: string[] = [];
  if (config.src === null) lines.push('<!-- No source is loaded yet; data-src is where yours goes. -->');
  else if (config.userSupplied) lines.push('<!-- data-src is your URL, exactly as you entered it. -->');
  lines.push('<div', ...attrs.map((a) => `  ${a}`), '></div>', `<script src="${CDN_BASE}/${build}"></script>`);

  const omitted: string[] = [];
  if (config.watermark) omitted.push('the watermark');
  if (config.captions && config.captions.length > 0) omitted.push('the caption tracks');
  if (config.chapters && config.chapters.length > 0) omitted.push('the chapter list');
  if (config.clips) omitted.push('the clip selector');

  return {
    kind: 'embed',
    label: 'Embed',
    description: isAudio
      ? 'One element and one script from the CDN. The audio build carries the playlist and media-session plugins.'
      : 'One element and one script from the CDN. Attributes as documented in the embed README.',
    install: 'No install: the script tag loads the build from the CDN.',
    code: lines.join('\n'),
    omitted: omitted.length
      ? [`The embed attributes do not cover ${omitted.join(', ')}. Those settings need the TypeScript or Vue integration.`]
      : [],
    disabled: null,
  };
}

/**
 * The Vue example: the exported component with the same plugin list through
 * its `plugins` prop.
 *
 * @param config - Normalized configuration
 * @returns The snippet
 */
function vueSnippet(config: PlaygroundConfig): Snippet {
  const { imports, plugins } = pluginBlocks(config, '  ');
  const playlist = config.media === 'audio' ? config.audio : null;
  if (playlist) imports.push("import type { IPlaylistPlugin } from '@scarlett-player/playlist';");
  const src = config.src ?? config.srcPlaceholder;
  const templateAttrs = [':src="src"', ':plugins="plugins"'];
  if (config.poster && config.media !== 'audio' && config.media !== 'audio-mini') {
    templateAttrs.push(`poster="${htmlAttr(config.poster)}"`);
  }

  const lines = [
    '<template>',
    '  <ScarlettPlayer',
    ...templateAttrs.map((a) => `    ${a}`),
    '    @ready="onReady"',
    '  />',
    '</template>',
    '',
    '<script setup lang="ts">',
    "import { ref } from 'vue';",
    "import { ScarlettPlayerComponent as ScarlettPlayer } from '@scarlett-player/vue';",
    "import type { ScarlettPlayer as Player } from '@scarlett-player/core';",
    ...imports,
    '',
  ];
  if (config.src === null) lines.push('// No source is loaded yet; this is where yours goes.');
  else if (config.userSupplied) lines.push('// Your URL, exactly as you entered it.');
  lines.push(`const src = ref(${tsString(src)});`, '', 'const plugins = [', ...plugins, '];', '');

  if (playlist) {
    lines.push(
      'function onReady(player: Player) {',
      '  // The playlist plugin loads the track and hands its title and artwork to the UI.',
      "  const list = player.getPlugin<IPlaylistPlugin>('playlist');",
      '  list?.add([',
      `    { id: 'track-1', src: src.value, title: ${tsString(playlist.title)}, artist: ${tsString(playlist.artist)}${playlist.artwork ? `, artwork: ${tsString(playlist.artwork)}` : ''} },`,
      '  ]);',
      '  list?.play(0);',
      '}'
    );
  } else {
    lines.push('function onReady(player: Player) {', "  console.log('ready', player.getState().source);", '}');
  }
  lines.push('</script>');

  const packages = ['@scarlett-player/vue', '@scarlett-player/core', ...packagesOf(imports)];
  return {
    kind: 'vue',
    label: 'Vue',
    description: 'The ScarlettPlayerComponent from @scarlett-player/vue, with the same plugins through its plugins prop. The component destroys the player when it unmounts.',
    install: `npm install ${packages.join(' ')}`,
    code: lines.join('\n'),
    omitted: [],
    disabled: null,
  };
}

/**
 * Generate one integration example from the normalized configuration.
 *
 * @param kind - Which integration to show
 * @param config - Normalized playground configuration
 * @returns The example and its caveats
 */
export function generateSnippet(kind: SnippetKind, config: PlaygroundConfig): Snippet {
  switch (kind) {
    case 'typescript':
      return typescriptSnippet(config);
    case 'embed':
      return embedSnippet(config);
    case 'vue':
      return vueSnippet(config);
  }
}
