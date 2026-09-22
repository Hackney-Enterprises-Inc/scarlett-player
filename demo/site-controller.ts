/**
 * Playground controller.
 *
 * One object owns everything the page shows around the players: which
 * scenario is selected (the URL hash is canonical), which stage and panels
 * are visible, which player is "active" for the diagnostics, the accent and
 * watermark settings, the feature actions, the code panel and the bounded
 * per-player event logs. demo.ts builds the players and hands them in; this
 * module never creates or destroys a player.
 *
 * Rules it enforces (plan section 6):
 * - Refresh, direct links and Back/Forward restore the scenario from the
 *   hash; unknown hashes are rewritten to the default without a loop.
 * - Selecting the active scenario again does nothing, no reload included.
 * - Cinema and Audio remember their last subtype for the session.
 * - Inactive players are paused before another is activated; a source that
 *   is still loaded keeps its position when its scenario comes back.
 * - Every load is guarded by a generation counter, so a response that
 *   arrives after the visitor moved on cannot touch the new scenario.
 * - WHEP and Your stream pause prior playback and show their own empty
 *   state until a source of their own has loaded.
 * - Pasted URLs stay in memory: never in the page URL, analytics or storage.
 * - Logs are bounded per player and rendered for the active player only;
 *   collapsing Diagnostics stops rendering, not capture. No console
 *   interception.
 */

import type { ScarlettPlayer, Chapter, StateStore } from '../packages/core/src/index';
import { accentTextTone, type IUIPlugin } from '../packages/plugins/ui/src/index';
import type { IAudioUIPlugin } from '../packages/plugins/audio-ui/src/index';
import type { IWatermarkPlugin, WatermarkPosition } from '../packages/plugins/watermark/src/index';
import type { ClipsPlugin, ClipRange } from '../packages/plugins/clips/src/index';
import type { ChaptersPlugin } from '../packages/plugins/chapters/src/index';
import type { IWHEPPlugin } from '../packages/plugins/whep/src/index';
import type { BeaconPayload } from '../packages/plugins/analytics/src/index';
import {
  SCENARIOS,
  SAMPLE,
  parseLocation,
  type PlayerRole,
  type Scenario,
  type ScenarioId,
} from './scenarios';
import {
  generateSnippet,
  type PlaygroundConfig,
  type Snippet,
  type SnippetCaption,
  type SnippetKind,
} from './snippets';

/** A track handed to the full audio player's playlist. */
export interface AudioTrackSpec {
  id: string;
  src: string;
  title: string;
  artist: string;
  artwork?: string;
}

/** Everything demo.ts builds that the controller drives. */
export interface ControllerDeps {
  version: string;
  players: Record<PlayerRole, ScarlettPlayer>;
  ui: IUIPlugin;
  audioUI: IAudioUIPlugin;
  miniUI: IAudioUIPlugin;
  clips: ClipsPlugin;
  watermark: IWatermarkPlugin;
  whep: IWHEPPlugin;
  chapters: ChaptersPlugin;
  /** The demo caption tracks, as the code panel should describe them */
  captions: SnippetCaption[];
  /** The demo chapter list */
  chapterList: Chapter[];
  /** Source the video player was constructed with, if any */
  initialVideoSrc: string | null;
  /**
   * Each player's `init()` promise. A load that goes through a plugin (the
   * playlist) needs the plugin initialised, and a page opened directly on
   * #audio routes before that has happened.
   */
  ready: Record<PlayerRole, Promise<void>>;
  /**
   * Load a track into the full audio player through its playlist, so the
   * audio UI picks up the title and artwork. Resolves when the source has
   * loaded, rejects when it could not.
   */
  loadAudioTrack(track: AudioTrackSpec): Promise<void>;
}

/** What demo.ts gets back. */
export interface SiteController {
  /** Route the current URL and start the diagnostics tick. */
  start(): void;
  /** Record a beacon in the analytics log (the analytics plugin's transport). */
  logBeacon(payload: BeaconPayload): void;
  /** Record a clip event or a simulated server status line. */
  logClip(event: string, detail: string, json?: unknown): void;
  /** Show a short status message. */
  notify(message: string): void;
}

/** Default accent, the Scarlett red both UI plugins ship with. */
const DEFAULT_ACCENT = '#e50914';

/** Rows kept per player before the oldest are dropped. */
const LOG_LIMIT = 200;

/** Rows kept in the analytics and clip logs. */
const ANALYTICS_LOG_LIMIT = 50;
const CLIP_LOG_LIMIT = 30;

/** The Signal mark, the image watermark's default: our own asset, mirrored beside the page. */
const DEFAULT_WATERMARK_IMAGE = 'assets/brand/signal-icon-on-dark.svg';

/**
 * Beacon fields worth showing in the analytics log, in render order. A
 * beacon carries roughly twenty environment fields that never change
 * between rows, so only the handful that do are shown.
 */
const ANALYTICS_DETAIL_KEYS = [
  'startupTime', 'currentTime', 'seekTo', 'duration', 'bitrate', 'height',
  'watchTime', 'playTime', 'qoeScore', 'rebufferCount', 'errorMessage',
  'exitType', 'completionRate',
];

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  at: number;
  level: LogLevel;
  event: string;
  detail: string;
  json?: unknown;
}

interface WatermarkSettings {
  enabled: boolean;
  kind: 'text' | 'image';
  text: string;
  imageUrl: string;
  position: WatermarkPosition;
  opacity: number;
  imageHeight: number;
  padding: number;
}

type LiveStatus = 'idle' | 'connecting' | 'connected' | 'error';
type CustomStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** The HLS provider's live readout, the one figure core does not hold. */
interface LiveInfoProvider {
  getLiveInfo?: () => { targetLatency: number } | null;
}

/**
 * Look up a required element by id.
 *
 * @param id - Element id
 * @returns The element
 * @throws When the page does not carry it, which means index.html and this
 *   module have drifted apart
 */
function req<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Playground: missing #${id}`);
  return el as T;
}

/**
 * Format seconds as m:ss.
 *
 * @param seconds - Time in seconds
 * @returns `0:00` for anything non-finite
 */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * A readable title for a URL the visitor typed: the file name, decoded.
 *
 * @param url - The pasted URL
 * @returns The last path segment without its extension, or `Your stream`
 */
function titleFromUrl(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    const bare = decodeURIComponent(name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')).trim();
    return bare || 'Your stream';
  } catch {
    return 'Your stream';
  }
}

/**
 * The interesting part of a beacon as a short `key=value` string.
 *
 * @param payload - Beacon the analytics plugin was about to transmit
 * @returns Up to three formatted fields
 */
function formatBeaconDetail(payload: BeaconPayload): string {
  const parts: string[] = [];
  for (const key of ANALYTICS_DETAIL_KEYS) {
    if (parts.length >= 3) break;
    const value = payload[key];
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${typeof value === 'number' ? Math.round(value * 10) / 10 : String(value)}`);
  }
  return parts.join('  ');
}

/**
 * Message for a failed load, from whatever the player rejected with.
 *
 * @param error - The rejection
 * @returns A sentence for the inline error
 */
function loadErrorMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return message || 'The player could not load that source.';
}

/**
 * Whether a URL is a local development origin the browser treats as
 * potentially trustworthy even from an HTTPS page.
 *
 * @param url - Parsed URL
 * @returns True for localhost and loopback hosts
 */
function isLoopback(url: URL): boolean {
  const host = url.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
}

/**
 * Validate a pasted URL before it goes anywhere near a player.
 *
 * @param raw - What the visitor typed
 * @param kind - `whep` for the live monitor, `media` for Your stream
 * @param whep - The WHEP plugin, whose public `canPlay` decides claims
 * @returns The trimmed URL, or a message to show inline
 */
function validateUrl(
  raw: string,
  kind: 'whep' | 'media',
  whep: IWHEPPlugin
): { ok: true; url: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) return { ok: false, message: kind === 'whep' ? 'Enter a WHEP endpoint.' : 'Enter a media URL.' };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: 'That does not look like a URL. Include the scheme, for example https://.' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, message: 'Only http:// and https:// sources are supported here.' };
  }

  if (url.protocol === 'http:' && window.location.protocol === 'https:' && !isLoopback(url)) {
    return {
      ok: false,
      message:
        'This page is served over HTTPS, so the browser will block an http:// source as mixed content. ' +
        'Use https://, or an http://localhost endpoint, which browsers allow.',
    };
  }

  if (kind === 'whep' && !whep.canPlay(value)) {
    return {
      ok: false,
      message:
        'The WHEP provider claims a URL by a "whep" path segment or a trailing "whep.stream" (Tmesis /whep/v1/streams/<id>, MediaMTX /<path>/whep, Nimble /<app>/<stream>/whep.stream). This one has neither.',
    };
  }

  return { ok: true, url: value };
}

/**
 * Select an element's text so a blocked clipboard still leaves the visitor
 * one keystroke from a copy.
 *
 * @param el - Element whose contents to select
 */
function selectContents(el: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Wire a `role="tablist"` for mouse and keyboard.
 *
 * Roving tabindex: arrows move focus and selection, Home/End jump. Only the
 * selected tab is in the tab order.
 *
 * @param list - The tablist element
 * @param onSelect - Called with the tab that became selected
 */
function wireTabs(list: HTMLElement, onSelect: (tab: HTMLButtonElement) => void): void {
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const select = (tab: HTMLButtonElement, focus: boolean): void => {
    if (tab.disabled) return;
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
    }
    if (focus) tab.focus();
    onSelect(tab);
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (event) => {
      const enabled = tabs.filter((t) => !t.disabled);
      const index = enabled.indexOf(tab);
      if (index === -1) return;
      let next: HTMLButtonElement | undefined;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = enabled[(index + 1) % enabled.length];
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = enabled[(index - 1 + enabled.length) % enabled.length];
      else if (event.key === 'Home') next = enabled[0];
      else if (event.key === 'End') next = enabled[enabled.length - 1];
      if (!next) return;
      event.preventDefault();
      select(next, true);
    });
  }
}

/**
 * Build the playground controller around the players demo.ts created.
 *
 * @param deps - Players, plugins and the demo's fixed content
 * @returns The controller; call `start()` once the DOM is ready
 */
export function createSiteController(deps: ControllerDeps): SiteController {
  // ----- DOM --------------------------------------------------------------
  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('#scenario-nav a[data-scenario]'));
  const stageVideo = req('stage-video');
  const posterLayer = req('poster-layer');
  const qualityBadge = req('quality-badge');
  const stageAudio = req('stage-audio');
  const audioFrameFull = req('audio-frame-full');
  const audioFrameMini = req('audio-frame-mini');
  const stageWhep = req('stage-whep');
  const whepForm = req<HTMLFormElement>('whep-form');
  const whepUrl = req<HTMLInputElement>('whep-url');
  const whepConnect = req<HTMLButtonElement>('whep-connect');
  const whepError = req('whep-error');
  const stageCustom = req('stage-custom');
  const customForm = req<HTMLFormElement>('custom-form');
  const customUrl = req<HTMLInputElement>('custom-url');
  const customLoad = req<HTMLButtonElement>('custom-load');
  const customError = req('custom-error');
  const sampleTitle = req('sample-title');
  const sampleDetail = req('sample-detail');
  const stageStatus = req('stage-status');
  const featureButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#feature-actions button[data-feature]'));
  const chapterPanel = req('chapter-panel');
  const chapterCurrent = req('chapter-current');
  const chapterList = req('chapter-list');
  const clipPanel = req('clip-panel');
  const clipRangeEl = req('clip-range');
  const clipOpenBtn = req<HTMLButtonElement>('clip-open-btn');
  const clipCloseBtn = req<HTMLButtonElement>('clip-close-btn');
  const clipError = req('clip-error');
  const diagnostics = req<HTMLDetailsElement>('diagnostics');
  const diagnosticsSummary = req('diagnostics-summary');
  const diagLive = req('diag-live');
  const diagWhep = req('diag-whep');
  const diagAnalytics = req('diag-analytics');
  const diagClips = req('diag-clips');
  const analyticsLog = req('analytics-log');
  const clipLog = req('clip-log');
  const consoleLog = req('console');
  const customizePanel = req('customize-panel');
  const codePanel = req('code-panel');
  const settingGroups = Array.from(customizePanel.querySelectorAll<HTMLElement>('.setting-group[data-for]'));
  const swatches = Array.from(document.querySelectorAll<HTMLButtonElement>('.swatches [data-color]'));
  const accentInput = req<HTMLInputElement>('accent');
  const accentHex = req('accent-hex');
  const formatSelect = req<HTMLSelectElement>('format');
  const layoutSelect = req<HTMLSelectElement>('audio-layout');
  const watermarkToggle = req<HTMLInputElement>('watermark-toggle');
  const watermarkFields = req('watermark-fields');
  const watermarkKinds = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="watermark-kind"]'));
  const watermarkText = req<HTMLInputElement>('watermark-text');
  const watermarkTextLabel = req('watermark-text-label');
  const watermarkImage = req<HTMLInputElement>('watermark-image');
  const watermarkImageLabel = req('watermark-image-label');
  const watermarkPosition = req<HTMLSelectElement>('watermark-position');
  const watermarkOpacity = req<HTMLInputElement>('watermark-opacity');
  const watermarkSizeRow = req('watermark-size-row');
  const watermarkHeight = req<HTMLInputElement>('watermark-imageheight');
  const watermarkPadding = req<HTMLInputElement>('watermark-padding');
  const captionToggle = req<HTMLInputElement>('caption-toggle');
  const captionLanguage = req<HTMLSelectElement>('caption-language');
  const whepStateBadge = req('whep-state-badge');
  const whepStateList = req('whep-state-list');
  const whepStateUrl = req('whep-state-url');
  const whepStateValue = req('whep-state-value');
  const whepDisconnect = req<HTMLButtonElement>('whep-disconnect');
  const customStateBadge = req('custom-state-badge');
  const customStateList = req('custom-state-list');
  const customStateUrl = req('custom-state-url');
  const customStateKind = req('custom-state-kind');
  const customChange = req<HTMLButtonElement>('custom-change');
  const codeDescription = req('code-description');
  const codeInstall = req('code-install');
  const codeEl = req('playground-code');
  const codeOmitted = req('code-omitted');
  const copyButton = req<HTMLButtonElement>('copy-example');
  const toast = req('toast');

  // ----- State --------------------------------------------------------------
  let current: ScenarioId | null = null;
  let generation = 0;
  const memory: { cinema: ScenarioId; audio: ScenarioId } = { cinema: 'hls', audio: 'audio' };
  const alive: Record<PlayerRole, boolean> = { video: true, audio: true, mini: true };
  /** Source the controller last asked each player for, until state says otherwise. */
  const expected: Record<PlayerRole, string | null> = { video: deps.initialVideoSrc, audio: null, mini: null };
  const logs: Record<PlayerRole, LogEntry[]> = { video: [], audio: [], mini: [] };
  let accent = DEFAULT_ACCENT;
  const watermark: WatermarkSettings = {
    enabled: false,
    kind: 'text',
    text: 'YOUR BRAND',
    imageUrl: DEFAULT_WATERMARK_IMAGE,
    position: 'bottom-right',
    opacity: 0.5,
    imageHeight: 64,
    padding: 10,
  };
  const clipLimits = { minDuration: 5, maxDuration: 60, defaultDuration: 30, step: 1 };
  const live: { url: string | null; status: LiveStatus; error: string; reconnecting: boolean; reconnect: string } = {
    url: null,
    status: 'idle',
    error: '',
    reconnecting: false,
    reconnect: '—',
  };
  const custom: { url: string | null; kind: 'video' | 'audio'; status: CustomStatus; error: string } = {
    url: null,
    kind: 'video',
    status: 'idle',
    error: '',
  };
  let snippetKind: SnippetKind = 'typescript';
  let posterDismissed = false;
  let toastTimer = 0;

  // ----- Helpers ------------------------------------------------------------
  const scenario = (): Scenario => SCENARIOS[current ?? 'hls'];

  /** Player state, or null once the player has been destroyed. */
  const stateOf = (role: PlayerRole): Readonly<StateStore> | null => {
    if (!alive[role]) return null;
    try {
      return deps.players[role].getState();
    } catch {
      return null;
    }
  };

  /** The source a player has, or is about to have. */
  const sourceOf = (role: PlayerRole): string | null => stateOf(role)?.source?.src ?? expected[role];

  const safePause = (role: PlayerRole): void => {
    const state = stateOf(role);
    if (!state || !state.playing) return;
    try {
      deps.players[role].pause();
    } catch {
      // A player mid-teardown; nothing to pause.
    }
  };

  /**
   * Whether a player is in a failed state. `playbackState` says so for the
   * HLS and WHEP providers; the native provider leaves it at `loading` and
   * only fills `error`, so both are read.
   */
  const hasFailed = (state: Readonly<StateStore> | null): boolean =>
    state !== null && (state.playbackState === 'error' || state.error !== null);

  /** The player the current scenario is showing, or null on an empty stage. */
  const activeRole = (): PlayerRole | null => {
    const s = scenario();
    if (s.group === 'live') return live.status === 'connected' ? 'video' : null;
    if (s.group === 'custom') return custom.status === 'loaded' ? (custom.kind === 'audio' ? 'audio' : 'video') : null;
    return s.player;
  };

  const videoElement = (): HTMLVideoElement | null => req('player').querySelector('video');

  const notify = (message: string): void => {
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3500);
  };

  const setStatus = (text: string, tone: 'live' | 'error' | '' = ''): void => {
    stageStatus.textContent = text;
    if (tone) stageStatus.dataset.tone = tone;
    else delete stageStatus.dataset.tone;
  };

  // ----- Logs ----------------------------------------------------------------
  const renderLogRow = (entry: LogEntry): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'diag-row';
    row.dataset.level = entry.level;
    const time = document.createElement('time');
    time.textContent = new Date(entry.at).toLocaleTimeString();
    const event = document.createElement('span');
    event.className = 'diag-event';
    event.textContent = entry.event;
    const detail = document.createElement('span');
    detail.className = 'diag-detail';
    detail.textContent = entry.detail;
    row.append(time, event, detail);
    if (entry.json !== undefined) {
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(entry.json, null, 2);
      row.append(pre);
    }
    return row;
  };

  const renderConsole = (): void => {
    consoleLog.replaceChildren();
    const role = activeRole();
    if (!role) return;
    for (const entry of logs[role]) consoleLog.append(renderLogRow(entry));
  };

  const renderSummary = (): void => {
    const role = activeRole();
    const errors = role ? logs[role].filter((e) => e.level === 'error').length : 0;
    diagnosticsSummary.textContent = errors ? `${errors} error${errors === 1 ? '' : 's'}` : '';
    diagnosticsSummary.classList.toggle('diag-count', errors > 0);
  };

  const log = (role: PlayerRole, level: LogLevel, event: string, detail = '', json?: unknown): void => {
    const entries = logs[role];
    entries.unshift({ at: Date.now(), level, event, detail, json });
    while (entries.length > LOG_LIMIT) entries.pop();
    if (role === activeRole()) {
      if (diagnostics.open) {
        consoleLog.prepend(renderLogRow(entries[0] as LogEntry));
        while (consoleLog.childElementCount > LOG_LIMIT) consoleLog.lastElementChild?.remove();
      }
      renderSummary();
    }
  };

  const logBeacon = (payload: BeaconPayload): void => {
    const row = document.createElement('div');
    row.className = 'diag-row';
    const time = document.createElement('time');
    time.textContent = new Date(payload.timestamp).toLocaleTimeString();
    const event = document.createElement('span');
    event.className = 'diag-event';
    event.textContent = String(payload.event);
    const detail = document.createElement('span');
    detail.className = 'diag-detail';
    detail.textContent = formatBeaconDetail(payload);
    row.append(time, event, detail);
    analyticsLog.prepend(row);
    while (analyticsLog.childElementCount > ANALYTICS_LOG_LIMIT) analyticsLog.lastElementChild?.remove();
  };

  const logClip = (event: string, detail: string, json?: unknown): void => {
    clipLog.prepend(renderLogRow({ at: Date.now(), level: 'info', event, detail, json }));
    while (clipLog.childElementCount > CLIP_LOG_LIMIT) clipLog.lastElementChild?.remove();
  };

  // ----- Player wiring ----------------------------------------------------
  const wirePlayer = (role: PlayerRole): void => {
    const player = deps.players[role];
    player.on('player:destroy', () => {
      alive[role] = false;
      log(role, 'warn', 'player:destroy');
    });
    player.on('playback:play', () => {
      log(role, 'info', 'play');
      if (role === 'video' && !posterDismissed) {
        posterDismissed = true;
        renderPoster();
      }
    });
    player.on('playback:pause', () => log(role, 'info', 'pause'));
    player.on('playback:seeking', ({ time }) => {
      if (role === 'video' && !posterDismissed) {
        posterDismissed = true;
        renderPoster();
      }
      log(role, 'info', 'seek', `${time.toFixed(1)}s`);
    });
    player.on('media:loaded', ({ src, type }) => {
      log(role, 'info', 'media:loaded', `${type}  ${src}`);
      if (role === activeRole()) setStatus('');
      renderMeta();
      renderSnippet();
    });
    player.on('media:loadedmetadata', ({ duration }) => log(role, 'info', 'metadata', `duration ${formatTime(duration)}`));
    player.on('quality:levels', ({ levels }) => log(role, 'info', 'quality:levels', levels.map((l) => l.label).join(', ')));
    player.on('quality:change', ({ quality, auto }) => log(role, 'info', 'quality:change', `${quality}${auto ? ' (auto)' : ''}`));
    player.on('track:text', ({ trackId }) => log(role, 'info', 'captions', trackId ?? 'off'));
    player.on('error', (error) => {
      const code = 'code' in error ? String(error.code) : 'Error';
      log(role, 'error', code, error.message);
      if (role === activeRole()) setStatus('Playback error', 'error');
      onSourceError(role, error.message);
    });
    player.on('error:reconnecting', ({ attempt, delayMs }) => {
      log(role, 'warn', 'reconnecting', `attempt ${attempt} in ${(delayMs / 1000).toFixed(1)}s`);
      if (role === 'video' && stateOf('video')?.source?.type === 'application/sdp') {
        live.reconnecting = true;
        live.reconnect = `attempt ${attempt} in ${(delayMs / 1000).toFixed(1)}s`;
      }
    });
    player.on('error:recovered', (detail) => {
      log(role, 'info', 'recovered', detail ? `on attempt ${detail.attempt}` : '');
      live.reconnecting = false;
      if (role === 'video') live.reconnect = detail ? `recovered on attempt ${detail.attempt}` : 'recovered';
    });
    player.on('error:reconnect-exhausted', ({ attempts }) => {
      log(role, 'error', 'reconnect exhausted', `gave up after ${attempts} attempts`);
      live.reconnecting = false;
      if (role === 'video') live.reconnect = `gave up after ${attempts} attempts`;
    });
    if (role === 'video') {
      player.on('chapter:change', ({ chapter }) => {
        log(role, 'info', 'chapter', chapter?.label ?? 'none');
        renderChapters();
      });
      player.on('chapter:loaded', () => renderChapters());
      player.on('clip:opened', ({ start, end }) => {
        log(role, 'info', 'clip:opened', `${start.toFixed(1)}s – ${end.toFixed(1)}s`);
        renderClip();
      });
      player.on('clip:changed', ({ start, end, reason }) => {
        log(role, 'info', 'clip:changed', `${start.toFixed(1)}s – ${end.toFixed(1)}s (${reason})`);
        renderClip();
      });
      player.on('clip:created', ({ range }) => {
        log(role, 'info', 'clip:created', `${range.startTime.toFixed(1)}s – ${range.endTime.toFixed(1)}s`);
        renderClip();
      });
      player.on('clip:cancelled', ({ reason }) => {
        log(role, 'info', 'clip:cancelled', reason);
        renderClip();
      });
      player.on('clip:error', ({ error }) => {
        log(role, 'warn', 'clip:error', error.message);
        clipError.textContent = error.message;
      });
    }
    if (role === 'audio') {
      player.on('playlist:change', ({ track }) => log(role, 'info', 'playlist:change', track ? String(track.title ?? track.src) : 'none'));
    }
  };

  /**
   * A player error while one of the visitor's own sources is still loading.
   *
   * The providers keep retrying inside their reconnect window and the load
   * promise stays pending meanwhile, so without this the form would say
   * "Connecting…" for as long as that window lasts. Instead the stage shows
   * the player - its own overlay carries the error and the reconnect state -
   * and the form and settings say what failed, with a retry.
   */
  const onSourceError = (role: PlayerRole, message: string): void => {
    const s = scenario();
    if (s.group === 'live' && role === 'video' && live.status === 'connecting') {
      live.status = 'error';
      live.error = message;
      whepError.textContent = `${message} The player keeps retrying; use Retry to start over or change the endpoint.`;
      whepConnect.disabled = false;
      whepConnect.textContent = 'Retry';
      showStage('video');
      renderAll();
      return;
    }
    const customRole: PlayerRole = custom.kind === 'audio' ? 'audio' : 'video';
    if (s.group === 'custom' && role === customRole && custom.status === 'loading') {
      custom.status = 'error';
      custom.error = message;
      customError.textContent = `${message} Check the URL and try again.`;
      customLoad.disabled = false;
      customLoad.textContent = 'Retry';
      showStage(role === 'audio' ? 'audio-full' : 'video');
      renderAll();
      return;
    }
    if (s.group === 'custom' || s.group === 'live') renderSettings();
  };

  // ----- Rendering: nav, stage, meta --------------------------------------
  const renderNav = (): void => {
    const group = scenario().group;
    for (const link of navLinks) {
      const linkGroup = link.dataset.scenario;
      if (linkGroup === 'cinema') link.hash = `#${memory.cinema}`;
      if (linkGroup === 'audio') link.hash = `#${memory.audio}`;
      if (linkGroup === group) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };

  type StageChoice = 'video' | 'audio-full' | 'audio-mini' | 'whep' | 'custom';
  const showStage = (choice: StageChoice): void => {
    stageVideo.hidden = choice !== 'video';
    stageAudio.hidden = choice !== 'audio-full' && choice !== 'audio-mini';
    audioFrameFull.hidden = choice !== 'audio-full';
    audioFrameMini.hidden = choice !== 'audio-mini';
    stageWhep.hidden = choice !== 'whep';
    stageCustom.hidden = choice !== 'custom';
    renderPoster();
  };

  const renderPoster = (): void => {
    posterLayer.hidden = posterDismissed || scenario().group !== 'cinema';
  };

  const renderMeta = (): void => {
    const s = scenario();
    let title = s.title;
    let detail = s.detail;
    if (s.group === 'live') {
      if (live.status === 'connected' && live.url) {
        title = 'Live monitor';
        const isLive = stateOf('video')?.live;
        detail = isLive ? 'Your endpoint · WebRTC over WHEP · live' : 'Your endpoint · WebRTC over WHEP';
      }
    } else if (s.group === 'custom') {
      if (custom.status === 'loaded' && custom.url) {
        title = titleFromUrl(custom.url);
        const role = custom.kind === 'audio' ? 'audio' : 'video';
        const state = stateOf(role);
        const kind = custom.kind === 'audio' ? 'Audio' : 'Video';
        const type = state?.source?.type ? ` · ${state.source.type}` : '';
        const liveNote = state?.live ? ' · live' : '';
        detail = `Your source · ${kind}${type}${liveNote}`;
      }
    }
    sampleTitle.textContent = title;
    sampleDetail.textContent = detail;
    if (s.badge) {
      qualityBadge.replaceChildren();
      const [quality, format] = s.badge.split(' · ');
      qualityBadge.append(document.createTextNode(`${quality} `));
      const dot = document.createElement('span');
      dot.textContent = '·';
      qualityBadge.append(dot, document.createTextNode(` ${format}`));
    }
  };

  // ----- Settings panel visibility -----------------------------------------
  const settingsContext = (): Set<string> => {
    const s = scenario();
    const keys = new Set<string>([s.group]);
    if (s.group === 'custom' && custom.status === 'loaded' && custom.kind === 'video') keys.add('custom-video');
    return keys;
  };

  const renderSettings = (): void => {
    const keys = settingsContext();
    for (const group of settingGroups) {
      const wanted = (group.dataset.for ?? '').split(/\s+/).filter(Boolean);
      group.hidden = !wanted.some((k) => keys.has(k));
    }
    if (current === 'hls' || current === 'mp4') formatSelect.value = current;
    if (current === 'audio' || current === 'audio-mini') layoutSelect.value = current;

    whepStateList.hidden = live.status === 'idle';
    whepDisconnect.hidden = live.status !== 'connected' && live.status !== 'error';
    whepStateUrl.textContent = live.url ?? '—';
    const liveLabel: Record<LiveStatus, string> = {
      idle: 'Not connected',
      connecting: 'Connecting',
      connected: 'Connected',
      error: 'Failed',
    };
    const liveFailed = live.status === 'connected' && hasFailed(stateOf('video'));
    whepStateBadge.textContent = liveFailed ? 'Playback error' : liveLabel[live.status];
    whepStateBadge.dataset.on = String(live.status === 'connected' && !liveFailed);
    whepStateValue.textContent = live.status === 'error' ? `${live.error || 'failed'} (retrying)` : liveLabel[live.status].toLowerCase();

    customStateList.hidden = custom.status === 'idle';
    customChange.hidden = custom.status !== 'loaded';
    customStateUrl.textContent = custom.url ?? '—';
    customStateKind.textContent = custom.kind === 'audio' ? 'audio' : 'video';
    const customLabel: Record<CustomStatus, string> = {
      idle: 'No source',
      loading: 'Loading',
      loaded: 'Loaded',
      error: 'Failed',
    };
    // A source the provider accepted can still fail once the browser
    // fetches it; the player's state is the truth the badge follows.
    const customPlayer = stateOf(custom.kind === 'audio' ? 'audio' : 'video');
    const customFailed = custom.status === 'loaded' && hasFailed(customPlayer);
    customStateBadge.textContent = customFailed ? 'Playback error' : customLabel[custom.status];
    customStateBadge.dataset.on = String(custom.status === 'loaded' && !customFailed);
  };

  const renderFeatureActions = (): void => {
    const caps = scenario().capabilities;
    const videoCustom = scenario().group === 'custom' && custom.status === 'loaded' && custom.kind === 'video';
    for (const button of featureButtons) {
      const feature = button.dataset.feature ?? '';
      const available =
        feature === 'watermark' ? caps.watermark || videoCustom : Boolean(caps[feature as keyof typeof caps]);
      button.hidden = !available;
    }
    const anyVisible = featureButtons.some((b) => !b.hidden);
    req('feature-actions').hidden = !anyVisible;
    if (!caps.chapters) closePanel(chapterPanel, 'chapters');
    if (!caps.clips) closePanel(clipPanel, 'clips');
  };

  const renderDiagnosticsSections = (): void => {
    const role = activeRole();
    const s = scenario();
    const videoState = stateOf('video');
    const isWhep = videoState?.source?.type === 'application/sdp';
    diagLive.hidden = !(role && stateOf(role)?.live);
    diagWhep.hidden = !(s.group === 'live' || (role === 'video' && isWhep));
    diagAnalytics.hidden = role !== 'video';
    diagClips.hidden = !(role === 'video' && s.capabilities.clips);
  };

  // ----- Feature panels -------------------------------------------------------
  const featureButton = (feature: string): HTMLButtonElement | undefined =>
    featureButtons.find((b) => b.dataset.feature === feature);

  const closePanel = (panel: HTMLElement, feature: string): void => {
    panel.hidden = true;
    featureButton(feature)?.setAttribute('aria-expanded', 'false');
  };

  const openPanel = (panel: HTMLElement, feature: string): void => {
    panel.hidden = false;
    featureButton(feature)?.setAttribute('aria-expanded', 'true');
  };

  const renderChapters = (): void => {
    if (chapterPanel.hidden) return;
    const chapters = deps.chapters.getChapters();
    const state = stateOf('video');
    const active = state?.currentChapter ?? null;
    chapterCurrent.textContent = active ? active.label : '—';
    chapterList.replaceChildren();
    chapters.forEach((chapter, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const isActive = active !== null && active.time === chapter.time;
      if (isActive) button.setAttribute('aria-current', 'true');
      const label = document.createElement('b');
      label.textContent = chapter.label;
      if (chapter.subtitle) {
        const sub = document.createElement('span');
        sub.textContent = String(chapter.subtitle);
        label.append(sub);
      }
      const time = document.createElement('small');
      time.textContent = formatTime(chapter.time);
      button.append(label, time);
      button.addEventListener('click', () => {
        deps.chapters.seekToChapter(index);
        log('video', 'info', 'chapter:select', chapter.label);
      });
      item.append(button);
      chapterList.append(item);
    });
  };

  const renderClip = (): void => {
    let range: ClipRange | null = null;
    let open = false;
    try {
      range = deps.clips.getRange();
      open = deps.clips.isOpen();
    } catch {
      // Not initialised yet.
    }
    clipRangeEl.textContent = range ? `${formatTime(range.startTime)} — ${formatTime(range.endTime)}` : 'no selection';
    clipOpenBtn.hidden = open;
    clipCloseBtn.hidden = !open;
    if (open) clipError.textContent = '';
  };

  const applyClipLimits = (): void => {
    const raw = {
      minDuration: Number(req<HTMLInputElement>('clip-min').value),
      maxDuration: Number(req<HTMLInputElement>('clip-max').value),
      defaultDuration: Number(req<HTMLInputElement>('clip-preroll').value),
      step: Number(req<HTMLInputElement>('clip-step').value),
    };
    // The sliders have independent ranges, so they can ask for min > max or
    // a pre-roll outside [min, max]. configure() resolves both (min drops to
    // max; defaultDuration clamps into the pair), so normalise first and
    // show THOSE numbers rather than a label the plugin is not running.
    const maxDuration = raw.maxDuration;
    const minDuration = Math.min(raw.minDuration, maxDuration);
    clipLimits.minDuration = minDuration;
    clipLimits.maxDuration = maxDuration;
    clipLimits.defaultDuration = Math.min(Math.max(raw.defaultDuration, minDuration), maxDuration);
    clipLimits.step = raw.step;
    req('clip-min-value').textContent = `${clipLimits.minDuration}s`;
    req('clip-max-value').textContent = `${clipLimits.maxDuration}s`;
    req('clip-preroll-value').textContent = `${clipLimits.defaultDuration}s`;
    req('clip-step-value').textContent = `${clipLimits.step}s`;
    deps.clips.configure({ ...clipLimits });
    renderSnippet();
  };

  const openClipPanel = (): void => {
    openPanel(clipPanel, 'clips');
    renderClip();
  };

  // ----- Captions -----------------------------------------------------------
  /**
   * Turn the demo subtitles on or off through the browser's own TextTrack
   * API, which the captions plugin watches (it re-syncs on the
   * TextTrackList's `change` event, the same path Safari's native menu
   * takes). No control in the player is clicked for the visitor.
   */
  const applyCaptions = (on: boolean): void => {
    const video = videoElement();
    if (!video) return;
    const wanted = captionLanguage.value;
    const tracks = Array.from(video.textTracks).filter((t) => t.kind === 'subtitles' || t.kind === 'captions');
    if (tracks.length === 0) {
      notify('Captions arrive with the media; press Play first.');
      return;
    }
    const target = tracks.find((t) => t.language === wanted) ?? tracks[0] ?? null;
    for (const track of tracks) track.mode = on && track === target ? 'showing' : 'disabled';
    captionToggle.checked = on;
    featureButton('captions')?.setAttribute('aria-pressed', String(on));
    if (on) {
      const state = stateOf('video');
      // The first demo cue starts at 3s; jump to the one that explains
      // itself when nothing is on screen yet.
      if (state && state.currentTime < 3 && state.duration > 14) {
        try {
          deps.players.video.seek(14);
        } catch {
          // A player mid-teardown.
        }
      }
      notify(`Captions on (${target?.label ?? wanted})`);
    }
  };

  const syncCaptionControls = (): void => {
    const state = stateOf('video');
    const active = state?.currentTextTrack ?? null;
    const on = active !== null;
    captionToggle.checked = on;
    featureButton('captions')?.setAttribute('aria-pressed', String(on));
    if (active?.language && captionLanguage.value !== active.language) {
      const option = Array.from(captionLanguage.options).find((o) => o.value === active.language);
      if (option) captionLanguage.value = active.language;
    }
  };

  // ----- Watermark ----------------------------------------------------------
  const applyWatermark = (): void => {
    const w = deps.watermark;
    if (!watermark.enabled) {
      w.setText('');
    } else if (watermark.kind === 'image') {
      w.setImage(watermark.imageUrl);
    } else {
      w.setText(watermark.text);
    }
    w.setPosition(watermark.position);
    w.setOpacity(watermark.opacity);
    w.setImageHeight(watermark.imageHeight);
    w.setPadding(watermark.padding);
  };

  const renderWatermark = (): void => {
    watermarkToggle.checked = watermark.enabled;
    watermarkFields.hidden = !watermark.enabled;
    featureButton('watermark')?.setAttribute('aria-pressed', String(watermark.enabled));
    for (const radio of watermarkKinds) radio.checked = radio.value === watermark.kind;
    const image = watermark.kind === 'image';
    watermarkText.hidden = image;
    watermarkTextLabel.hidden = image;
    watermarkImage.hidden = !image;
    watermarkImageLabel.hidden = !image;
    watermarkSizeRow.hidden = !image;
    req('opacity-value').textContent = watermark.opacity.toFixed(1);
    req('imageheight-value').textContent = `${watermark.imageHeight}px`;
    req('padding-value').textContent = `${watermark.padding}px`;
  };

  const setWatermarkEnabled = (enabled: boolean): void => {
    watermark.enabled = enabled;
    applyWatermark();
    renderWatermark();
    renderSnippet();
    if (enabled) {
      // The plugin shows the mark on the first play and keeps it up while
      // paused, so "visible now" is read off the element rather than guessed.
      const mark = req('player').querySelector<HTMLElement>('.sp-watermark');
      const visible = mark ? getComputedStyle(mark).visibility === 'visible' : false;
      notify(visible ? 'Watermark on.' : 'Watermark on. It shows once playback starts.');
    }
  };

  // ----- Accent -------------------------------------------------------------
  const applyAccent = (color: string): void => {
    accent = color;
    document.documentElement.style.setProperty('--player-accent', color);
    // The picker offers colours too dark to read at 13px, so the accent goes
    // in with its readable tone: --sp-accent for fills, --sp-accent-text for
    // the LIVE label and the active menu rows.
    deps.ui.setTheme({ accentColor: color, accentTextColor: accentTextTone(color) });
    deps.audioUI.setTheme({ primary: color, progressFill: color });
    deps.miniUI.setTheme({ primary: color, progressFill: color });
    accentHex.textContent = color.toUpperCase();
    accentInput.value = color;
    for (const swatch of swatches) swatch.setAttribute('aria-pressed', String(swatch.dataset.color === color));
    renderSnippet();
  };

  // ----- Code panel ---------------------------------------------------------
  const buildConfig = (): PlaygroundConfig => {
    const s = scenario();
    const watermarkConfig = watermark.enabled
      ? {
          kind: watermark.kind,
          text: watermark.text,
          imageUrl: watermark.imageUrl,
          position: watermark.position,
          opacity: watermark.opacity,
          imageHeight: watermark.imageHeight,
          padding: watermark.padding,
        }
      : null;

    if (s.group === 'cinema') {
      return {
        media: 'video',
        src: s.src,
        srcPlaceholder: SAMPLE.hls,
        userSupplied: false,
        poster: SAMPLE.poster,
        accent,
        watermark: watermarkConfig,
        captions: deps.captions,
        chapters: deps.chapterList,
        clips: { ...clipLimits },
        audio: null,
      };
    }
    if (s.group === 'audio') {
      return {
        media: s.id === 'audio' ? 'audio' : 'audio-mini',
        src: SAMPLE.audio,
        srcPlaceholder: SAMPLE.audio,
        userSupplied: false,
        poster: null,
        accent,
        watermark: null,
        captions: null,
        chapters: null,
        clips: null,
        audio: { title: SAMPLE.audioTitle, artist: SAMPLE.audioArtist, artwork: SAMPLE.artwork },
      };
    }
    if (s.group === 'live') {
      return {
        media: 'whep',
        src: live.status === 'connected' ? live.url : null,
        srcPlaceholder: 'https://your-domain.com/live/whep',
        userSupplied: true,
        poster: null,
        accent,
        watermark: null,
        captions: null,
        chapters: null,
        clips: null,
        audio: null,
      };
    }
    const loaded = custom.status === 'loaded' && custom.url ? custom.url : null;
    if (custom.kind === 'audio') {
      return {
        media: 'audio',
        src: loaded,
        srcPlaceholder: 'https://your-domain.com/episode.mp3',
        userSupplied: true,
        poster: null,
        accent,
        watermark: null,
        captions: null,
        chapters: null,
        clips: null,
        audio: { title: loaded ? titleFromUrl(loaded) : 'Your track', artist: 'Your stream', artwork: null },
      };
    }
    return {
      media: 'video',
      src: loaded,
      srcPlaceholder: 'https://your-domain.com/film.m3u8',
      userSupplied: true,
      poster: null,
      accent,
      watermark: watermarkConfig,
      captions: null,
      chapters: null,
      clips: null,
      audio: null,
    };
  };

  const snippetTabs = Array.from(codePanel.querySelectorAll<HTMLButtonElement>('.code-tabs [role="tab"]'));

  const renderSnippet = (): void => {
    if (current === null) return;
    const config = buildConfig();
    // A tab that cannot represent this configuration is disabled, and the
    // selection moves off it rather than showing an empty panel.
    for (const tab of snippetTabs) {
      const kind = tab.dataset.snippet as SnippetKind;
      const preview = generateSnippet(kind, config);
      tab.disabled = preview.disabled !== null;
      tab.title = preview.disabled ?? '';
    }
    const active = snippetTabs.find((t) => t.dataset.snippet === snippetKind);
    if (active?.disabled) {
      const fallback = snippetTabs.find((t) => !t.disabled);
      if (fallback) {
        snippetKind = fallback.dataset.snippet as SnippetKind;
        for (const tab of snippetTabs) {
          const selected = tab === fallback;
          tab.setAttribute('aria-selected', String(selected));
          tab.tabIndex = selected ? 0 : -1;
        }
      }
    }
    const snippet: Snippet = generateSnippet(snippetKind, config);
    codeEl.setAttribute('aria-labelledby', `snippet-${snippetKind}`);
    codeDescription.textContent = snippet.description;
    codeInstall.textContent = snippet.install;
    codeEl.textContent = snippet.code;
    const notes = [...snippet.omitted];
    const disabledTabs = snippetTabs.filter((t) => t.disabled).map((t) => `${t.textContent?.trim()}: ${t.title}`);
    codeOmitted.textContent = [...notes, ...disabledTabs].join(' ');
    copyButton.disabled = snippet.code.length === 0;
  };

  const copyExample = async (): Promise<void> => {
    const text = codeEl.textContent ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify('Example copied.');
    } catch {
      selectContents(codeEl);
      codeEl.focus();
      notify('Copy was blocked here. The example is selected: press Ctrl+C or ⌘C.');
    }
  };

  // ----- Loading ------------------------------------------------------------
  /** Load `src` into a player unless it is already there. */
  const ensureSource = async (role: PlayerRole, src: string, gen: number): Promise<void> => {
    if (sourceOf(role) === src) return;
    expected[role] = src;
    setStatus('Loading…');
    await deps.ready[role];
    if (gen !== generation) return;
    try {
      if (role === 'audio') {
        await deps.loadAudioTrack({
          id: 'sample',
          src,
          title: SAMPLE.audioTitle,
          artist: SAMPLE.audioArtist,
          artwork: SAMPLE.artwork,
        });
      } else {
        await deps.players[role].load(src);
      }
    } catch (error) {
      if (gen !== generation) return;
      setStatus('Could not load', 'error');
      log(role, 'error', 'load failed', loadErrorMessage(error));
      return;
    }
    if (gen !== generation) return;
    setStatus('');
  };

  const pauseAllBut = (keep: PlayerRole | null): void => {
    for (const role of ['video', 'audio', 'mini'] as PlayerRole[]) {
      if (role !== keep) safePause(role);
    }
  };

  /** Bring the stage in line with the scenario, loading the sample if needed. */
  const settle = async (gen: number): Promise<void> => {
    const s = scenario();
    if (s.group === 'cinema') {
      showStage('video');
      if (stateOf('video')?.poster !== SAMPLE.poster) {
        try {
          deps.players.video.setPoster(SAMPLE.poster);
        } catch {
          // Destroyed.
        }
      }
      deps.chapters.setChapters(deps.chapterList);
      await ensureSource('video', s.src as string, gen);
      return;
    }
    if (s.group === 'audio') {
      showStage(s.id === 'audio' ? 'audio-full' : 'audio-mini');
      await ensureSource(s.player, s.src as string, gen);
      return;
    }
    if (s.group === 'live') {
      if (live.status === 'connected' && live.url && sourceOf('video') === live.url) showStage('video');
      else {
        if (live.status === 'connected') live.status = 'idle';
        showStage('whep');
      }
      return;
    }
    // custom
    const role: PlayerRole = custom.kind === 'audio' ? 'audio' : 'video';
    if (custom.status === 'loaded' && custom.url && sourceOf(role) === custom.url) {
      showStage(role === 'audio' ? 'audio-full' : 'video');
    } else {
      if (custom.status === 'loaded') custom.status = 'idle';
      showStage('custom');
    }
  };

  const renderAll = (): void => {
    renderNav();
    renderMeta();
    renderSettings();
    renderFeatureActions();
    renderDiagnosticsSections();
    renderConsole();
    renderSummary();
    renderSnippet();
  };

  /**
   * Make a scenario the active one.
   *
   * Re-selecting the active scenario is a no-op apart from honouring a
   * requested feature, so a repeated hash never reloads anything.
   */
  const activate = async (id: ScenarioId, feature: 'clips' | null): Promise<void> => {
    const s = SCENARIOS[id];
    if (id !== current) {
      current = id;
      if (s.group === 'cinema' || s.group === 'audio') memory[s.group] = id;
      const gen = ++generation;
      // The empty states pause everything; a sample scenario keeps its own
      // player and pauses the rest.
      pauseAllBut(s.src ? s.player : null);
      closePanel(chapterPanel, 'chapters');
      closePanel(clipPanel, 'clips');
      // A request left pending by the previous scenario is abandoned: its
      // generation is stale, so its button must not stay disabled.
      if (live.status === 'connecting') live.status = 'error';
      if (custom.status === 'loading') custom.status = 'error';
      whepConnect.disabled = false;
      whepConnect.textContent = live.status === 'error' ? 'Retry' : 'Connect';
      customLoad.disabled = false;
      customLoad.textContent = custom.status === 'error' ? 'Retry' : 'Load';
      renderAll();
      setStatus('');
      await settle(gen);
      if (gen !== generation) return;
      renderAll();
    }
    if (feature === 'clips' && s.capabilities.clips) openClipPanel();
  };

  const route = (): void => {
    const parsed = parseLocation(window.location.hash, window.location.search);
    if (!parsed.known) {
      // Rewrite, never assign location.hash: replaceState fires no
      // hashchange, so an unknown hash cannot loop.
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#hls`);
    }
    void activate(parsed.id, parsed.feature);
  };

  // ----- WHEP and custom sources --------------------------------------------
  const connectWhep = async (): Promise<void> => {
    const check = validateUrl(whepUrl.value, 'whep', deps.whep);
    if (!check.ok) {
      whepError.textContent = check.message;
      whepUrl.focus();
      return;
    }
    whepError.textContent = '';
    const gen = ++generation;
    live.url = check.url;
    live.status = 'connecting';
    live.error = '';
    live.reconnecting = false;
    live.reconnect = '—';
    whepConnect.disabled = true;
    whepConnect.textContent = 'Connecting…';
    pauseAllBut(null);
    expected.video = check.url;
    renderSettings();
    try {
      await deps.ready.video;
      if (gen !== generation) return;
      deps.players.video.setPoster('');
      await deps.players.video.load(check.url);
    } catch (error) {
      if (gen === generation) {
        live.status = 'error';
        live.error = loadErrorMessage(error);
        whepError.textContent = `${live.error} Check the endpoint and try again.`;
        whepConnect.disabled = false;
        whepConnect.textContent = 'Retry';
        renderAll();
      }
      return;
    }
    if (gen !== generation) return;
    whepConnect.disabled = false;
    whepConnect.textContent = 'Connect';
    whepError.textContent = '';
    live.status = 'connected';
    posterDismissed = true;
    showStage('video');
    renderAll();
    log('video', 'info', 'whep', 'connected');
    notify('Connected. Press Play to watch your stream.');
  };

  const disconnectWhep = (): void => {
    safePause('video');
    live.status = 'idle';
    showStage('whep');
    renderAll();
    whepUrl.focus();
  };

  const loadCustom = async (): Promise<void> => {
    const check = validateUrl(customUrl.value, 'media', deps.whep);
    if (!check.ok) {
      customError.textContent = check.message;
      customUrl.focus();
      return;
    }
    customError.textContent = '';
    const kindInput = customForm.querySelector<HTMLInputElement>('input[name="custom-kind"]:checked');
    const kind: 'video' | 'audio' = kindInput?.value === 'audio' ? 'audio' : 'video';
    const role: PlayerRole = kind === 'audio' ? 'audio' : 'video';
    const gen = ++generation;
    custom.url = check.url;
    custom.kind = kind;
    custom.status = 'loading';
    custom.error = '';
    customLoad.disabled = true;
    customLoad.textContent = 'Loading…';
    pauseAllBut(null);
    expected[role] = check.url;
    renderSettings();
    try {
      await deps.ready[role];
      if (gen !== generation) return;
      if (role === 'audio') {
        await deps.loadAudioTrack({ id: 'custom', src: check.url, title: titleFromUrl(check.url), artist: 'Your stream' });
      } else {
        deps.players.video.setPoster('');
        // The demo chapter list belongs to the sample, not to this source.
        deps.chapters.setChapters([]);
        await deps.players.video.load(check.url);
      }
    } catch (error) {
      if (gen === generation) {
        custom.status = 'error';
        custom.error = loadErrorMessage(error);
        customError.textContent = `${custom.error} Check the URL and try again.`;
        customLoad.disabled = false;
        customLoad.textContent = 'Retry';
        renderAll();
      }
      return;
    }
    if (gen !== generation) return;
    customLoad.disabled = false;
    customLoad.textContent = 'Load';
    customError.textContent = '';
    custom.status = 'loaded';
    posterDismissed = true;
    showStage(role === 'audio' ? 'audio-full' : 'video');
    renderAll();
    log(role, 'info', 'custom source', 'loaded');
  };

  const changeCustom = (): void => {
    pauseAllBut(null);
    custom.status = 'idle';
    showStage('custom');
    renderAll();
    customUrl.focus();
  };

  // ----- Diagnostics tick -------------------------------------------------------
  const renderStats = (): void => {
    const role = activeRole();
    const state = role ? stateOf(role) : null;
    const stateEl = req('state');
    if (!state) {
      stateEl.textContent = role ? 'Unavailable' : 'No source';
      req('time').textContent = '0:00 / 0:00';
      req('quality').textContent = '—';
      req('buffered').textContent = '—';
      req('diag-source').textContent = '—';
      diagLive.hidden = true;
      return;
    }
    stateEl.textContent = state.playing
      ? 'Playing'
      : state.buffering
        ? 'Buffering'
        : state.playbackState === 'error'
          ? 'Error'
          : state.paused
            ? 'Paused'
            : state.playbackState;
    req('time').textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
    req('quality').textContent = state.currentQuality?.label ?? (role === 'video' ? 'Auto' : 'Audio');
    req('buffered').textContent = `${Math.round((state.bufferedAmount || 0) * 10) / 10}s ahead`;
    req('diag-source').textContent = state.source ? `${state.source.type ?? '?'} · ${state.source.src.replace(/^https?:\/\//, '')}` : '—';

    // Live: only while the state says so.
    diagLive.hidden = !state.live;
    if (state.live) {
      const isWhep = state.source?.type === 'application/sdp';
      const lowLatency = Boolean(state.lowLatencyMode);
      let target: number | null = null;
      if (!isWhep && role) {
        try {
          const provider = deps.players[role].getPlugin<LiveInfoProvider & { id: string; name: string; version: string; type: 'provider'; init: () => void; destroy: () => void }>('hls-provider');
          target = provider?.getLiveInfo?.()?.targetLatency ?? null;
        } catch {
          target = null;
        }
      }
      const badge = req('live-ll-badge');
      badge.textContent = isWhep ? 'WebRTC (WHEP)' : lowLatency ? 'LL-HLS active' : 'LL-HLS off';
      badge.dataset.on = String(lowLatency || isWhep);
      req('live-kind').textContent = isWhep ? 'Live (WebRTC)' : lowLatency ? 'Live (low latency)' : 'Live';
      req('live-latency').textContent = `${state.liveLatency.toFixed(2)}s`;
      req('live-target').textContent = target !== null ? `${target.toFixed(2)}s` : '—';
      req('live-edge').textContent = state.liveEdge ? 'At edge' : 'Behind';
      req<HTMLButtonElement>('live-golive').disabled = isWhep;
    }

    // WHEP session readout, from the plugin: the session URL is not in state.
    if (!diagWhep.hidden) {
      const isWhep = state.source?.type === 'application/sdp';
      const session = isWhep ? deps.whep.getSessionUrl() : null;
      const sessionEl = req('whep-session');
      sessionEl.textContent = session ? session.replace(/^https?:\/\/[^/]+/, '') : '—';
      sessionEl.title = session ?? '';
      req('whep-latency').textContent = isWhep && state.live ? `${state.liveLatency.toFixed(3)}s` : '—';
      req('whep-reconnect').textContent = live.reconnect;
      const badge = req('whep-badge');
      let text = 'Not joined';
      let on = false;
      if (isWhep && live.reconnecting) text = 'Reconnecting';
      else if (isWhep && state.playbackState === 'playing') {
        text = 'Playing';
        on = true;
      } else if (isWhep && state.playbackState === 'ready') {
        text = 'Joined';
        on = true;
      } else if (isWhep && state.playbackState === 'error') text = 'Error';
      badge.textContent = text;
      badge.dataset.on = String(on);
    }

    req('cast-airplay').textContent = state.airplayAvailable ? (state.airplayActive ? 'Casting' : 'Device available') : 'Not offered by this browser';
    req('cast-chromecast').textContent = state.chromecastAvailable ? (state.chromecastActive ? 'Casting' : 'Device available') : 'Not offered by this browser';
    req('cast-pip').textContent = state.pip ? 'Active' : document.pictureInPictureEnabled ? 'Supported' : 'Not supported here';
  };

  let lastPlaybackState: string | null = null;
  const tick = (): void => {
    const s = scenario();
    const role = activeRole();
    const state = role ? stateOf(role) : null;
    // The badges in the Customize panel follow the player's state; refresh
    // them on a transition rather than every tick.
    const playbackState = state ? `${state.playbackState}/${state.error ? 'error' : 'ok'}` : null;
    if (playbackState !== lastPlaybackState) {
      lastPlaybackState = playbackState;
      if (s.group === 'custom' || s.group === 'live') renderSettings();
    }
    // Status beside the title: live state and errors, without a spinner.
    if (state) {
      if (hasFailed(state)) setStatus('Playback error', 'error');
      else if (state.live) setStatus('LIVE', 'live');
      else if (stageStatus.dataset.tone) setStatus('');
    }
    if (s.group === 'cinema') syncCaptionControls();
    if (diagnostics.open) renderStats();
  };

  // ----- Wiring -------------------------------------------------------------
  const wireUi = (): void => {
    window.addEventListener('hashchange', route);

    formatSelect.addEventListener('change', () => {
      window.location.hash = `#${formatSelect.value}`;
    });
    layoutSelect.addEventListener('change', () => {
      window.location.hash = `#${layoutSelect.value}`;
    });

    wireTabs(req('tab-customize').parentElement as HTMLElement, (tab) => {
      const showCode = tab.id === 'tab-code';
      customizePanel.hidden = showCode;
      codePanel.hidden = !showCode;
      if (showCode) renderSnippet();
    });
    wireTabs(codePanel.querySelector('.code-tabs') as HTMLElement, (tab) => {
      snippetKind = tab.dataset.snippet as SnippetKind;
      renderSnippet();
    });
    copyButton.addEventListener('click', () => void copyExample());

    for (const swatch of swatches) {
      swatch.addEventListener('click', () => applyAccent(swatch.dataset.color ?? DEFAULT_ACCENT));
    }
    accentInput.addEventListener('input', () => applyAccent(accentInput.value));
    req('accent-reset').addEventListener('click', () => applyAccent(DEFAULT_ACCENT));

    watermarkToggle.addEventListener('change', () => setWatermarkEnabled(watermarkToggle.checked));
    for (const radio of watermarkKinds) {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        watermark.kind = radio.value === 'image' ? 'image' : 'text';
        applyWatermark();
        renderWatermark();
        renderSnippet();
      });
    }
    watermarkText.addEventListener('input', () => {
      watermark.text = watermarkText.value;
      applyWatermark();
      renderSnippet();
    });
    watermarkImage.addEventListener('change', () => {
      const value = watermarkImage.value.trim();
      if (!value) return;
      watermark.imageUrl = value;
      applyWatermark();
      renderSnippet();
    });
    watermarkPosition.addEventListener('change', () => {
      watermark.position = watermarkPosition.value as WatermarkPosition;
      applyWatermark();
      renderSnippet();
    });
    watermarkOpacity.addEventListener('input', () => {
      watermark.opacity = Number(watermarkOpacity.value);
      applyWatermark();
      renderWatermark();
      renderSnippet();
    });
    watermarkHeight.addEventListener('input', () => {
      watermark.imageHeight = Number(watermarkHeight.value);
      applyWatermark();
      renderWatermark();
      renderSnippet();
    });
    watermarkPadding.addEventListener('input', () => {
      watermark.padding = Number(watermarkPadding.value);
      applyWatermark();
      renderWatermark();
      renderSnippet();
    });

    captionToggle.addEventListener('change', () => applyCaptions(captionToggle.checked));
    captionLanguage.addEventListener('change', () => {
      if (captionToggle.checked) applyCaptions(true);
    });

    for (const button of featureButtons) {
      button.addEventListener('click', () => {
        const feature = button.dataset.feature;
        if (feature === 'captions') {
          applyCaptions(button.getAttribute('aria-pressed') !== 'true');
        } else if (feature === 'chapters') {
          if (chapterPanel.hidden) {
            openPanel(chapterPanel, 'chapters');
            renderChapters();
          } else closePanel(chapterPanel, 'chapters');
        } else if (feature === 'clips') {
          if (clipPanel.hidden) openClipPanel();
          else closePanel(clipPanel, 'clips');
        } else if (feature === 'watermark') {
          setWatermarkEnabled(!watermark.enabled);
          if (watermark.enabled) req('tab-customize').click();
        }
      });
    }

    clipOpenBtn.addEventListener('click', () => {
      clipError.textContent = '';
      deps.clips.open();
      renderClip();
    });
    clipCloseBtn.addEventListener('click', () => {
      deps.clips.close();
      renderClip();
    });
    for (const id of ['clip-min', 'clip-max', 'clip-preroll', 'clip-step']) {
      req(id).addEventListener('input', applyClipLimits);
    }

    whepForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!whepConnect.disabled) void connectWhep();
    });
    whepUrl.addEventListener('input', () => {
      whepError.textContent = '';
    });
    whepDisconnect.addEventListener('click', disconnectWhep);

    customForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!customLoad.disabled) void loadCustom();
    });
    customUrl.addEventListener('input', () => {
      customError.textContent = '';
    });
    customChange.addEventListener('click', changeCustom);

    diagnostics.addEventListener('toggle', () => {
      if (diagnostics.open) {
        renderDiagnosticsSections();
        renderConsole();
        renderStats();
      }
    });
    req('live-golive').addEventListener('click', () => {
      const role = activeRole();
      if (!role || !alive[role]) return;
      try {
        deps.players[role].seekToLive();
      } catch {
        // Not live any more.
      }
    });
    req('analytics-clear').addEventListener('click', () => analyticsLog.replaceChildren());
    req('clip-clear').addEventListener('click', () => clipLog.replaceChildren());
    req('console-clear').addEventListener('click', () => {
      const role = activeRole();
      if (role) logs[role].length = 0;
      consoleLog.replaceChildren();
      renderSummary();
    });
  };

  const start = (): void => {
    req('version').textContent = `v${deps.version}`;
    for (const role of ['video', 'audio', 'mini'] as PlayerRole[]) wirePlayer(role);
    wireUi();
    renderWatermark();
    applyAccent(DEFAULT_ACCENT);
    applyClipLimits();
    if (expected.video && !stateOf('video')?.source) setStatus('Loading…');
    route();
    window.setInterval(tick, 250);
  };

  return { start, logBeacon, logClip, notify };
}
