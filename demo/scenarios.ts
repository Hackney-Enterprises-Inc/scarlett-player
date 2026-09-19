/**
 * Scenario registry for the playground.
 *
 * The URL hash is the canonical selection: every scenario below has exactly
 * one hash, the scenario nav links point at those hashes, and
 * {@link parseLocation} is the only place a hash is interpreted. The mockup's
 * four scenarios (Cinema, Audio, Live monitor, Your stream) are the groups;
 * Cinema and Audio each carry two subtypes that the Customize panel switches
 * between (Playback format, Layout).
 */

/** Canonical scenario ids. Each one is a hash the page answers to. */
export type ScenarioId = 'hls' | 'mp4' | 'audio' | 'audio-mini' | 'whep' | 'custom';

/** The four entries in the scenario nav. */
export type ScenarioGroup = 'cinema' | 'audio' | 'live' | 'custom';

/** The three player instances the page creates. */
export type PlayerRole = 'video' | 'audio' | 'mini';

/** Which stage element a scenario renders into. */
export type StageId = 'video' | 'audio' | 'whep' | 'custom';

/**
 * What a scenario can do, which decides which settings, feature actions and
 * diagnostics panels are shown. Everything here mirrors a real plugin on the
 * player that scenario uses.
 */
export interface ScenarioCapabilities {
  /** Accent control applies (every scenario with a player) */
  accent: boolean;
  /** Watermark plugin is on the player and the picture is video */
  watermark: boolean;
  /** Demo caption tracks are attached */
  captions: boolean;
  /** Chapter list is attached */
  chapters: boolean;
  /** Clip selector is available (VOD video only) */
  clips: boolean;
  /** Playback format select (HLS / MP4) */
  format: boolean;
  /** Layout select (full / mini audio) */
  layout: boolean;
  /** Analytics plugin is on the player */
  analytics: boolean;
}

/**
 * One scenario: where it lives in the nav, which player it uses, and what
 * it loads.
 */
export interface Scenario {
  id: ScenarioId;
  group: ScenarioGroup;
  /** Player the scenario drives once it has a source */
  player: PlayerRole;
  /** Stage shown before (or instead of) the player */
  stage: StageId;
  /** Sample source, or null when the visitor supplies one */
  src: string | null;
  /** Sample title shown under the stage */
  title: string;
  /** One-line description shown under the title */
  detail: string;
  /** Poster-layer badge, video samples only */
  badge?: string;
  capabilities: ScenarioCapabilities;
}

/**
 * The sample media. Timings in demo.ts are cut against these files.
 *
 * Media stays on the VOD host; the images are the site's own key art,
 * mirrored beside every page by demo/build.cjs from docs/assets/, so a
 * first paint never waits on that host.
 */
export const SAMPLE = {
  hls: 'https://vod.thestreamplatform.com/demo/bbb-2160p-stereo/playlist.m3u8',
  mp4: 'https://vod.thestreamplatform.com/demo/bbb-2160p-stereo.mp4',
  audio: 'https://vod.thestreamplatform.com/demo/winamp-it-really-whips-the-llamas-ass.mp3',
  poster: 'assets/key-art-169.jpg',
  artwork: 'assets/key-art-square.jpg',
  videoTitle: 'Big Buck Bunny',
  audioTitle: "Winamp - It Really Whips the Llama's Ass",
  audioArtist: 'Winamp',
} as const;

const VIDEO_CAPABILITIES: ScenarioCapabilities = {
  accent: true,
  watermark: true,
  captions: true,
  chapters: true,
  clips: true,
  format: true,
  layout: false,
  analytics: true,
};

const AUDIO_CAPABILITIES: ScenarioCapabilities = {
  accent: true,
  watermark: false,
  captions: false,
  chapters: false,
  clips: false,
  format: false,
  layout: true,
  analytics: false,
};

/** Every scenario, keyed by its hash. */
export const SCENARIOS: Record<ScenarioId, Scenario> = {
  hls: {
    id: 'hls',
    group: 'cinema',
    player: 'video',
    stage: 'video',
    src: SAMPLE.hls,
    title: SAMPLE.videoTitle,
    detail: 'Cinematic sample · HLS adaptive · 4K',
    badge: '4K · HLS ADAPTIVE',
    capabilities: VIDEO_CAPABILITIES,
  },
  mp4: {
    id: 'mp4',
    group: 'cinema',
    player: 'video',
    stage: 'video',
    src: SAMPLE.mp4,
    title: SAMPLE.videoTitle,
    detail: 'Cinematic sample · MP4 progressive · 4K',
    badge: '4K · MP4 PROGRESSIVE',
    capabilities: VIDEO_CAPABILITIES,
  },
  audio: {
    id: 'audio',
    group: 'audio',
    player: 'audio',
    stage: 'audio',
    src: SAMPLE.audio,
    title: SAMPLE.audioTitle,
    detail: 'Audio sample · full layout · artwork, playlist, media keys',
    capabilities: AUDIO_CAPABILITIES,
  },
  'audio-mini': {
    id: 'audio-mini',
    group: 'audio',
    player: 'mini',
    stage: 'audio',
    src: SAMPLE.audio,
    title: SAMPLE.audioTitle,
    detail: 'Audio sample · mini layout · one compact bar',
    capabilities: AUDIO_CAPABILITIES,
  },
  whep: {
    id: 'whep',
    group: 'live',
    player: 'video',
    stage: 'whep',
    src: null,
    title: 'Live monitor',
    detail: 'Your endpoint · WebRTC over WHEP · no sample connection',
    capabilities: {
      accent: true,
      watermark: false,
      captions: false,
      chapters: false,
      clips: false,
      format: false,
      layout: false,
      analytics: true,
    },
  },
  custom: {
    id: 'custom',
    group: 'custom',
    player: 'video',
    stage: 'custom',
    src: null,
    title: 'Your stream',
    detail: 'Video or audio · bring your own source',
    capabilities: {
      accent: true,
      // Decided per load: video sources get the watermark, audio does not.
      watermark: false,
      captions: false,
      chapters: false,
      clips: false,
      format: false,
      layout: false,
      analytics: true,
    },
  },
};

/** The scenario an empty or unknown hash lands on. */
export const DEFAULT_SCENARIO: ScenarioId = 'hls';

/** Aliases the page keeps answering to. `#clips` also opens the clip panel. */
const ALIASES: Record<string, ScenarioId> = {
  playground: 'hls',
  clips: 'hls',
  video: 'hls',
  'audio-full': 'audio',
  live: 'whep',
};

/** Result of reading the page URL. */
export interface ParsedLocation {
  id: ScenarioId;
  /** A feature the URL asked to open alongside the scenario */
  feature: 'clips' | null;
  /**
   * False when the hash named nothing this page knows, so the controller
   * can rewrite it to the default without adding a history entry.
   */
  known: boolean;
}

/**
 * Interpret the page URL as a scenario.
 *
 * Accepts the canonical hashes, the aliases, `#hls?feature=clips` and a
 * `?feature=clips` query string (the homepage's Create card links
 * `/demo/?feature=clips#hls`). Anything else is the default scenario and
 * reported as unknown.
 *
 * @param hash - `location.hash`, with or without the leading `#`
 * @param search - `location.search`, with or without the leading `?`
 * @returns The scenario, any requested feature, and whether the hash was recognised
 */
export function parseLocation(hash: string, search = ''): ParsedLocation {
  const raw = hash.replace(/^#/, '');
  const [name = '', hashQuery = ''] = raw.split('?');

  const params = new URLSearchParams(search.replace(/^\?/, ''));
  const hashParams = new URLSearchParams(hashQuery);
  const requested = hashParams.get('feature') ?? params.get('feature');
  let feature: ParsedLocation['feature'] = requested === 'clips' ? 'clips' : null;

  if (name === '') {
    return { id: DEFAULT_SCENARIO, feature, known: true };
  }

  const lower = name.toLowerCase();
  if (lower in SCENARIOS) {
    return { id: lower as ScenarioId, feature, known: true };
  }

  const alias = ALIASES[lower];
  if (alias) {
    if (lower === 'clips') feature = 'clips';
    return { id: alias, feature, known: true };
  }

  return { id: DEFAULT_SCENARIO, feature, known: false };
}

/**
 * Human label for a scenario group, as the nav shows it.
 *
 * @param group - Scenario group
 * @returns The nav label
 */
export function groupLabel(group: ScenarioGroup): string {
  switch (group) {
    case 'cinema': return 'Cinema';
    case 'audio': return 'Audio';
    case 'live': return 'Live monitor';
    case 'custom': return 'Your stream';
  }
}
