/**
 * Audio UI Plugin for Scarlett Player
 *
 * Provides a compact, beautiful audio player interface:
 * - Album artwork display
 * - Track title and artist
 * - Progress bar with seek
 * - Play/pause, next/previous controls
 * - Volume control
 * - Shuffle/repeat (when playlist plugin present)
 * - Multiple layout modes (full, compact, mini)
 */

import type { IPluginAPI, PluginType } from '@scarlett-player/core';
import type {
  AudioUIPluginConfig,
  AudioUILayout,
  AudioUITheme,
  IAudioUIPlugin,
} from './types';

// Re-export types
export type {
  AudioUIPluginConfig,
  AudioUILayout,
  AudioUITheme,
  IAudioUIPlugin,
} from './types';

/** Default theme */
const DEFAULT_THEME: AudioUITheme = {
  primary: '#6366f1',
  background: '#18181b',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  progressBackground: '#3f3f46',
  progressFill: '#6366f1',
  borderRadius: '12px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

/** Default configuration */
const DEFAULT_CONFIG: AudioUIPluginConfig = {
  layout: 'full',
  showArtwork: true,
  showTitle: true,
  showArtist: true,
  showTime: true,
  showVolume: true,
  showShuffle: true,
  showRepeat: true,
  showNavigation: true,
  classPrefix: 'scarlett-audio',
  autoHide: 0,
  theme: DEFAULT_THEME,
};

/**
 * Format time in MM:SS or HH:MM:SS
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Create styles for the audio UI
 */
function createStyles(prefix: string, theme: AudioUITheme): string {
  return `
    .${prefix} {
      font-family: ${theme.fontFamily};
      background: ${theme.background};
      color: ${theme.text};
      border-radius: ${theme.borderRadius};
      overflow: hidden;
      user-select: none;
    }

    .${prefix}--full {
      display: flex;
      flex-direction: column;
      padding: 20px;
      gap: 16px;
      max-width: 400px;
    }

    .${prefix}--compact {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
    }

    .${prefix}--mini {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      gap: 8px;
    }

    .${prefix}__artwork {
      flex-shrink: 0;
      background: ${theme.progressBackground};
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .${prefix}--full .${prefix}__artwork {
      width: 100%;
      aspect-ratio: 1;
      border-radius: ${theme.borderRadius};
    }

    .${prefix}--compact .${prefix}__artwork {
      width: 56px;
      height: 56px;
    }

    .${prefix}--mini .${prefix}__artwork {
      width: 40px;
      height: 40px;
      border-radius: 6px;
    }

    .${prefix}__artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .${prefix}__artwork-placeholder {
      width: 50%;
      height: 50%;
      opacity: 0.3;
    }

    .${prefix}__info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .${prefix}__title {
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${prefix}--mini .${prefix}__title {
      font-size: 14px;
      display: inline-block;
      animation: none;
    }

    .${prefix}__title-wrapper {
      overflow: hidden;
      width: 100%;
    }

    .${prefix}--mini .${prefix}__title-wrapper .${prefix}__title.scrolling {
      animation: marquee 8s linear infinite;
    }

    @keyframes marquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .${prefix}--mini .${prefix}__progress {
      margin-top: 4px;
    }

    .${prefix}--mini .${prefix}__progress-bar {
      height: 4px;
    }

    .${prefix}__artist {
      font-size: 14px;
      color: ${theme.textSecondary};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${prefix}--mini .${prefix}__artist {
      font-size: 12px;
    }

    .${prefix}__progress {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .${prefix}__progress-bar {
      flex: 1;
      height: 6px;
      background: ${theme.progressBackground};
      border-radius: 3px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .${prefix}__progress-bar:hover {
      height: 8px;
    }

    .${prefix}__progress-fill {
      height: 100%;
      background: ${theme.progressFill};
      border-radius: 3px;
      transition: width 0.1s linear;
    }

    .${prefix}__progress-buffered {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: ${theme.progressBackground};
      opacity: 0.5;
      border-radius: 3px;
    }

    .${prefix}__time {
      font-size: 12px;
      color: ${theme.textSecondary};
      min-width: 40px;
      text-align: center;
    }

    .${prefix}__controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .${prefix}__btn {
      background: transparent;
      border: none;
      color: ${theme.text};
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.1s;
    }

    .${prefix}__btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .${prefix}__btn:active {
      transform: scale(0.95);
    }

    .${prefix}__btn--primary {
      background: ${theme.primary};
      width: 48px;
      height: 48px;
    }

    .${prefix}__btn--primary:hover {
      background: ${theme.primary};
      opacity: 0.9;
    }

    .${prefix}--mini .${prefix}__btn--primary {
      width: 36px;
      height: 36px;
    }

    .${prefix}__btn--active {
      color: ${theme.primary};
    }

    .${prefix}__btn svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .${prefix}__btn--primary svg {
      width: 24px;
      height: 24px;
    }

    .${prefix}__volume {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .${prefix}__volume-slider {
      width: 80px;
      height: 4px;
      background: ${theme.progressBackground};
      border-radius: 2px;
      cursor: pointer;
      position: relative;
    }

    .${prefix}__volume-fill {
      height: 100%;
      background: ${theme.text};
      border-radius: 2px;
    }

    .${prefix}__secondary-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .${prefix}--hidden {
      display: none;
    }
  `;
}

/**
 * SVG Icons
 */
const ICONS = {
  play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  previous: `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
  next: `<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`,
  shuffle: `<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`,
  repeatOff: `<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>`,
  repeatAll: `<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>`,
  repeatOne: `<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/></svg>`,
  volumeHigh: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
  volumeMuted: `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
  music: `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
};

/**
 * Create an Audio UI Plugin instance.
 */
export function createAudioUIPlugin(config?: Partial<AudioUIPluginConfig>): IAudioUIPlugin {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const theme = { ...DEFAULT_THEME, ...mergedConfig.theme };
  const prefix = mergedConfig.classPrefix!;

  // Plugin state
  let api: IPluginAPI | null = null;
  let container: HTMLElement | null = null;
  let styleElement: HTMLStyleElement | null = null;
  let layout: AudioUILayout = mergedConfig.layout!;
  let isVisible = true;

  // UI Elements
  let artworkImg: HTMLImageElement | null = null;
  let titleEl: HTMLElement | null = null;
  let artistEl: HTMLElement | null = null;
  let progressFill: HTMLElement | null = null;
  let currentTimeEl: HTMLElement | null = null;
  let durationEl: HTMLElement | null = null;
  let playPauseBtn: HTMLButtonElement | null = null;
  let shuffleBtn: HTMLButtonElement | null = null;
  let repeatBtn: HTMLButtonElement | null = null;
  let volumeBtn: HTMLButtonElement | null = null;
  let volumeFill: HTMLElement | null = null;

  /**
   * Create the UI elements
   */
  const createUI = (): void => {
    if (!api) return;

    // Inject styles
    styleElement = document.createElement('style');
    styleElement.textContent = createStyles(prefix, theme);
    document.head.appendChild(styleElement);

    // Create container
    container = document.createElement('div');
    container.className = `${prefix} ${prefix}--${layout}`;

    // Build UI based on layout
    if (layout === 'full') {
      container.innerHTML = buildFullLayout();
    } else if (layout === 'compact') {
      container.innerHTML = buildCompactLayout();
    } else {
      container.innerHTML = buildMiniLayout();
    }

    // Cache element references
    artworkImg = container.querySelector(`.${prefix}__artwork img`);
    titleEl = container.querySelector(`.${prefix}__title`);
    artistEl = container.querySelector(`.${prefix}__artist`);
    progressFill = container.querySelector(`.${prefix}__progress-fill`);
    currentTimeEl = container.querySelector(`.${prefix}__time--current`);
    durationEl = container.querySelector(`.${prefix}__time--duration`);
    playPauseBtn = container.querySelector(`.${prefix}__btn--play`);
    shuffleBtn = container.querySelector(`.${prefix}__btn--shuffle`);
    repeatBtn = container.querySelector(`.${prefix}__btn--repeat`);
    volumeBtn = container.querySelector(`.${prefix}__btn--volume`);
    volumeFill = container.querySelector(`.${prefix}__volume-fill`);

    // Attach event listeners
    attachEventListeners();

    // Append to player container
    api.container.appendChild(container);
  };

  /**
   * Build full layout HTML
   */
  const buildFullLayout = (): string => {
    return `
      ${mergedConfig.showArtwork ? `
        <div class="${prefix}__artwork">
          <img src="${mergedConfig.defaultArtwork || ''}" alt="Album art" />
          ${!mergedConfig.defaultArtwork ? `<div class="${prefix}__artwork-placeholder">${ICONS.music}</div>` : ''}
        </div>
      ` : ''}
      <div class="${prefix}__info">
        ${mergedConfig.showTitle ? `<div class="${prefix}__title">-</div>` : ''}
        ${mergedConfig.showArtist ? `<div class="${prefix}__artist">-</div>` : ''}
      </div>
      <div class="${prefix}__progress">
        ${mergedConfig.showTime ? `<span class="${prefix}__time ${prefix}__time--current">0:00</span>` : ''}
        <div class="${prefix}__progress-bar">
          <div class="${prefix}__progress-fill" style="width: 0%"></div>
        </div>
        ${mergedConfig.showTime ? `<span class="${prefix}__time ${prefix}__time--duration">0:00</span>` : ''}
      </div>
      <div class="${prefix}__controls">
        ${mergedConfig.showShuffle ? `<button class="${prefix}__btn ${prefix}__btn--shuffle" title="Shuffle">${ICONS.shuffle}</button>` : ''}
        ${mergedConfig.showNavigation ? `<button class="${prefix}__btn ${prefix}__btn--prev" title="Previous">${ICONS.previous}</button>` : ''}
        <button class="${prefix}__btn ${prefix}__btn--primary ${prefix}__btn--play" title="Play">${ICONS.play}</button>
        ${mergedConfig.showNavigation ? `<button class="${prefix}__btn ${prefix}__btn--next" title="Next">${ICONS.next}</button>` : ''}
        ${mergedConfig.showRepeat ? `<button class="${prefix}__btn ${prefix}__btn--repeat" title="Repeat">${ICONS.repeatOff}</button>` : ''}
      </div>
      ${mergedConfig.showVolume ? `
        <div class="${prefix}__secondary-controls">
          <div class="${prefix}__volume">
            <button class="${prefix}__btn ${prefix}__btn--volume" title="Volume">${ICONS.volumeHigh}</button>
            <div class="${prefix}__volume-slider">
              <div class="${prefix}__volume-fill" style="width: 100%"></div>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  };

  /**
   * Build compact layout HTML
   */
  const buildCompactLayout = (): string => {
    return `
      ${mergedConfig.showArtwork ? `
        <div class="${prefix}__artwork">
          <img src="${mergedConfig.defaultArtwork || ''}" alt="Album art" />
        </div>
      ` : ''}
      <div class="${prefix}__info">
        ${mergedConfig.showTitle ? `<div class="${prefix}__title">-</div>` : ''}
        ${mergedConfig.showArtist ? `<div class="${prefix}__artist">-</div>` : ''}
        <div class="${prefix}__progress">
          <div class="${prefix}__progress-bar">
            <div class="${prefix}__progress-fill" style="width: 0%"></div>
          </div>
        </div>
      </div>
      <div class="${prefix}__controls">
        ${mergedConfig.showNavigation ? `<button class="${prefix}__btn ${prefix}__btn--prev" title="Previous">${ICONS.previous}</button>` : ''}
        <button class="${prefix}__btn ${prefix}__btn--primary ${prefix}__btn--play" title="Play">${ICONS.play}</button>
        ${mergedConfig.showNavigation ? `<button class="${prefix}__btn ${prefix}__btn--next" title="Next">${ICONS.next}</button>` : ''}
      </div>
    `;
  };

  /**
   * Build mini layout HTML
   */
  const buildMiniLayout = (): string => {
    return `
      <button class="${prefix}__btn ${prefix}__btn--primary ${prefix}__btn--play" title="Play">${ICONS.play}</button>
      ${mergedConfig.showArtwork ? `
        <div class="${prefix}__artwork">
          <img src="${mergedConfig.defaultArtwork || ''}" alt="Album art" />
        </div>
      ` : ''}
      <div class="${prefix}__info">
        ${mergedConfig.showTitle ? `<div class="${prefix}__title-wrapper"><div class="${prefix}__title">-</div></div>` : ''}
        <div class="${prefix}__progress">
          <div class="${prefix}__progress-bar">
            <div class="${prefix}__progress-fill" style="width: 0%"></div>
          </div>
        </div>
      </div>
    `;
  };

  /**
   * Attach event listeners to UI elements
   */
  const attachEventListeners = (): void => {
    if (!container || !api) return;

    // Play/Pause button
    playPauseBtn?.addEventListener('click', () => {
      const playing = api?.getState('playing');
      if (playing) {
        api?.emit('playback:pause', undefined as any);
      } else {
        api?.emit('playback:play', undefined as any);
      }
    });

    // Previous button
    container.querySelector(`.${prefix}__btn--prev`)?.addEventListener('click', () => {
      const playlist = api?.getPlugin<{ previous: () => Promise<void> }>('playlist');
      if (playlist) {
        playlist.previous();
      } else {
        api?.emit('playback:seeking', { time: 0 });
      }
    });

    // Next button
    container.querySelector(`.${prefix}__btn--next`)?.addEventListener('click', () => {
      const playlist = api?.getPlugin<{ next: () => Promise<void> }>('playlist');
      playlist?.next();
    });

    // Shuffle button
    shuffleBtn?.addEventListener('click', () => {
      const playlist = api?.getPlugin<{ toggleShuffle: () => void; getState: () => { shuffle: boolean } }>('playlist');
      playlist?.toggleShuffle();
    });

    // Repeat button
    repeatBtn?.addEventListener('click', () => {
      const playlist = api?.getPlugin<{ cycleRepeat: () => void }>('playlist');
      playlist?.cycleRepeat();
    });

    // Volume button
    volumeBtn?.addEventListener('click', () => {
      const muted = api?.getState('muted');
      api?.emit('volume:mute', { muted: !muted });
    });

    // Progress bar seek
    const progressBar = container.querySelector(`.${prefix}__progress-bar`);
    progressBar?.addEventListener('click', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const rect = (mouseEvent.currentTarget as HTMLElement).getBoundingClientRect();
      const percent = (mouseEvent.clientX - rect.left) / rect.width;
      const duration = api?.getState('duration') || 0;
      const time = percent * duration;
      api?.emit('playback:seeking', { time });
    });

    // Volume slider
    const volumeSlider = container.querySelector(`.${prefix}__volume-slider`);
    volumeSlider?.addEventListener('click', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const rect = (mouseEvent.currentTarget as HTMLElement).getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (mouseEvent.clientX - rect.left) / rect.width));
      api?.emit('volume:change', { volume: percent, muted: false });
    });
  };

  /**
   * Update UI based on state
   */
  const updateUI = (): void => {
    if (!api || !container) return;

    // Update play/pause button
    const playing = api.getState('playing');
    if (playPauseBtn) {
      playPauseBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
      playPauseBtn.title = playing ? 'Pause' : 'Play';
    }

    // Update progress
    const currentTime = api.getState('currentTime') || 0;
    const duration = api.getState('duration') || 0;
    const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }

    if (currentTimeEl) {
      currentTimeEl.textContent = formatTime(currentTime);
    }

    if (durationEl) {
      durationEl.textContent = formatTime(duration);
    }

    // Update title/artist
    const title = api.getState('title');
    const poster = api.getState('poster');

    if (titleEl && title) {
      titleEl.textContent = title;

      // Check if title needs scrolling in mini mode
      if (layout === 'mini') {
        const wrapper = titleEl.parentElement;
        if (wrapper && titleEl.scrollWidth > wrapper.clientWidth) {
          // Duplicate text for seamless scroll
          titleEl.textContent = `${title}     •     ${title}     •     `;
          titleEl.classList.add('scrolling');
        } else {
          titleEl.classList.remove('scrolling');
        }
      }
    }

    if (artworkImg && poster) {
      artworkImg.src = poster;
    }

    // Update volume
    const volume = api.getState('volume') || 1;
    const muted = api.getState('muted');

    if (volumeFill) {
      volumeFill.style.width = `${(muted ? 0 : volume) * 100}%`;
    }

    if (volumeBtn) {
      volumeBtn.innerHTML = muted || volume === 0 ? ICONS.volumeMuted : ICONS.volumeHigh;
    }

    // Update shuffle/repeat from playlist
    const playlist = api.getPlugin<{ getState: () => { shuffle: boolean; repeat: string } }>('playlist');
    if (playlist) {
      const state = playlist.getState();

      if (shuffleBtn) {
        shuffleBtn.classList.toggle(`${prefix}__btn--active`, state.shuffle);
      }

      if (repeatBtn) {
        repeatBtn.classList.toggle(`${prefix}__btn--active`, state.repeat !== 'none');
        if (state.repeat === 'one') {
          repeatBtn.innerHTML = ICONS.repeatOne;
        } else if (state.repeat === 'all') {
          repeatBtn.innerHTML = ICONS.repeatAll;
        } else {
          repeatBtn.innerHTML = ICONS.repeatOff;
        }
      }
    }
  };

  // Plugin implementation
  const plugin: IAudioUIPlugin = {
    id: 'audio-ui',
    name: 'Audio UI',
    version: '1.0.0',
    type: 'ui' as PluginType,
    description: 'Compact audio player interface',

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      api.logger.info('Audio UI plugin initialized');

      // Create UI
      createUI();

      // Listen for state changes
      const unsubState = api.subscribeToState(() => {
        updateUI();
      });

      // Listen for time updates
      const unsubTime = api.on('playback:timeupdate', () => {
        updateUI();
      });

      // Listen for playlist changes
      const unsubPlaylist = api.on('playlist:change' as any, (payload: any) => {
        if (payload?.track) {
          if (titleEl) titleEl.textContent = payload.track.title || '-';
          if (artistEl) artistEl.textContent = payload.track.artist || '-';
          if (artworkImg && payload.track.artwork) {
            artworkImg.src = payload.track.artwork;
          }
        }
      });

      const unsubShuffle = api.on('playlist:shuffle' as any, () => {
        updateUI();
      });

      const unsubRepeat = api.on('playlist:repeat' as any, () => {
        updateUI();
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubState();
        unsubTime();
        unsubPlaylist();
        unsubShuffle();
        unsubRepeat();
      });

      // Initial UI update
      updateUI();
    },

    async destroy(): Promise<void> {
      api?.logger.info('Audio UI plugin destroying');

      if (container?.parentNode) {
        container.parentNode.removeChild(container);
      }

      if (styleElement?.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }

      container = null;
      styleElement = null;
      api = null;
    },

    getElement(): HTMLElement | null {
      return container;
    },

    setLayout(newLayout: AudioUILayout): void {
      if (!container) return;

      layout = newLayout;
      container.className = `${prefix} ${prefix}--${layout}`;

      // Rebuild UI
      if (layout === 'full') {
        container.innerHTML = buildFullLayout();
      } else if (layout === 'compact') {
        container.innerHTML = buildCompactLayout();
      } else {
        container.innerHTML = buildMiniLayout();
      }

      // Re-cache elements and attach listeners
      artworkImg = container.querySelector(`.${prefix}__artwork img`);
      titleEl = container.querySelector(`.${prefix}__title`);
      artistEl = container.querySelector(`.${prefix}__artist`);
      progressFill = container.querySelector(`.${prefix}__progress-fill`);
      currentTimeEl = container.querySelector(`.${prefix}__time--current`);
      durationEl = container.querySelector(`.${prefix}__time--duration`);
      playPauseBtn = container.querySelector(`.${prefix}__btn--play`);
      shuffleBtn = container.querySelector(`.${prefix}__btn--shuffle`);
      repeatBtn = container.querySelector(`.${prefix}__btn--repeat`);
      volumeBtn = container.querySelector(`.${prefix}__btn--volume`);
      volumeFill = container.querySelector(`.${prefix}__volume-fill`);

      attachEventListeners();
      updateUI();
    },

    setTheme(newTheme: Partial<AudioUITheme>): void {
      Object.assign(theme, newTheme);

      if (styleElement) {
        styleElement.textContent = createStyles(prefix, theme);
      }
    },

    show(): void {
      isVisible = true;
      container?.classList.remove(`${prefix}--hidden`);
    },

    hide(): void {
      isVisible = false;
      container?.classList.add(`${prefix}--hidden`);
    },

    toggle(): void {
      if (isVisible) {
        this.hide();
      } else {
        this.show();
      }
    },
  };

  return plugin;
}

// Default export
export default createAudioUIPlugin;
