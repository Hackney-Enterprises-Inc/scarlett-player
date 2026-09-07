/**
 * Unified embed creator factory
 *
 * This module creates the embed API with configurable plugin availability.
 * Each build (full, video, audio) uses this with different plugin sets.
 */

import { ScarlettPlayer, createPlayer, type Plugin } from '@scarlett-player/core';
import type { EmbedConfig, EmbedPlayerOptions, PlayerType, ScarlettPlayerGlobal } from './types';
import { parseDataAttributes, applyContainerStyles } from './parser';

/**
 * Plugin creators that builds can provide.
 *
 * `hls` and `native` are the two provider plugins. They are not
 * interchangeable and they are not alternatives: `PluginManager.selectProvider`
 * walks the registered providers in registration order and takes the first
 * whose `canPlay()` accepts the source, so a build that omits `native` answers
 * `PROVIDER_NOT_FOUND` for every progressive file. That was the shipped
 * behaviour up to 1.7.0: an `.mp3` or `.mp4` `data-src` failed in every embed
 * build, including the audio one.
 */
export interface PluginCreators {
  hls: () => Plugin;
  /**
   * Native media element provider (progressive MP4/WebM/MOV/MKV/OGV/M4V and
   * MP3/WAV/OGG/FLAC/AAC/M4A/Opus/WebA). Optional so a build can still be
   * assembled without it, but every shipped embed build passes it.
   */
  native?: () => Plugin;
  videoUI?: (config: any) => Plugin;
  audioUI?: (config: any) => Plugin;
  analytics?: (config: any) => Plugin;
  playlist?: (config: any) => Plugin;
  mediaSession?: (config: any) => Plugin;
  watermark?: (config: any) => Plugin;
  captions?: (config: any) => Plugin;
  /**
   * Touch gestures: double-tap the sides to seek, tap to toggle the controls.
   *
   * Video builds only. The embed passes no config at all, because the plugin
   * decides for itself whether to arm: its `enabled` default is `'auto'`,
   * gated on `matchMedia('(any-pointer: coarse)')`, so it installs wherever a
   * coarse pointer exists (a touchscreen laptop included) and a mouse still
   * never triggers any of it. Forcing `enabled: true` here would instead put a
   * gesture surface on a pure-mouse desktop with no touch to serve.
   */
  gestures?: (config: any) => Plugin;
  /**
   * Share sheet, copy link and embed codes.
   *
   * Video builds only, and only when the embed was given a share URL. The
   * plugin contributes a control through `registerControl('share')` in
   * `@scarlett-player/ui`, and the audio UIs render a fixed template with no
   * control registry, so an audio player has nowhere to put the button.
   */
  share?: (config: any) => Plugin;
}

/**
 * Control bar layout used when the embed adds the share button.
 *
 * `registerControl` never places anything on its own: a registered control
 * appears only in players whose layout lists its id, and `uiPlugin`'s own
 * default layout has no `share` slot. So the embed has to hand the UI plugin a
 * layout, and this is that default with `share` inserted at the head of the
 * right-hand group.
 *
 * It is a copy of `DEFAULT_LAYOUT` in `@scarlett-player/ui`, which that package
 * does not export. Keep the two in step: a slot added there and missed here
 * would silently go missing from every embed that turns sharing on. The embed
 * only uses this layout when `shareUrl` is set, so an embed without sharing
 * still gets the UI plugin's own default and cannot drift at all.
 */
const SHARE_CONTROL_LAYOUT = [
  'play',
  'skip-backward',
  'skip-forward',
  'volume',
  'time',
  'live-indicator',
  'bandwidth-indicator',
  'spacer',
  'share',
  'settings',
  'captions',
  'chromecast',
  'airplay',
  'pip',
  'fullscreen',
];

/**
 * Create an embed player with the given plugins
 */
export async function createEmbedPlayer(
  container: HTMLElement,
  config: Partial<EmbedConfig>,
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): Promise<ScarlettPlayer | null> {
  const type = config.type || 'video';

  // Validate type is available in this build
  if (!availableTypes.includes(type)) {
    const buildSuggestion = type === 'video'
      ? 'Use embed.js or embed.video.js'
      : 'Use embed.js or embed.audio.js';
    throw new Error(
      `[ScarlettPlayer] Player type "${type}" is not available in this build. ${buildSuggestion}`
    );
  }

  if (!config.src && !config.playlist?.length) {
    console.error('[ScarlettPlayer] No source URL or playlist provided');
    return null;
  }

  try {
    // Apply container styles based on type
    applyContainerStyles(container, config);

    // Build theme config
    const theme: Record<string, string> = {};
    if (config.brandColor) theme.accentColor = config.brandColor;
    if (config.primaryColor) theme.primaryColor = config.primaryColor;
    if (config.backgroundColor) theme.backgroundColor = config.backgroundColor;

    // Build plugins array.
    //
    // Provider order is load-bearing: selectProvider() takes the FIRST
    // provider whose canPlay() accepts the source. HLS goes first because it
    // is the only one that claims .m3u8 (the native provider's supported
    // extension list has no m3u8 entry, so it never competes for a manifest,
    // not even in Safari where the media element could play one natively).
    // The native provider then picks up everything HLS refuses.
    const plugins: Plugin[] = [pluginCreators.hls()];

    if (pluginCreators.native) {
      plugins.push(pluginCreators.native());
    }

    // Add playlist plugin if available and playlist provided
    if (pluginCreators.playlist && config.playlist?.length) {
      plugins.push(pluginCreators.playlist({
        tracks: config.playlist.map((item, index) => ({
          id: `item-${index}`,
          src: item.src,
          title: item.title,
          artist: item.artist,
          poster: item.poster || item.artwork,
          duration: item.duration,
        })),
      }));
    }

    // Add media session plugin if available (for audio types or if metadata provided)
    if (pluginCreators.mediaSession && (type !== 'video' || config.title)) {
      plugins.push(pluginCreators.mediaSession({
        title: config.title || config.playlist?.[0]?.title,
        artist: config.artist || config.playlist?.[0]?.artist,
        album: config.album,
        artwork: config.artwork || config.poster || config.playlist?.[0]?.artwork,
      }));
    }

    // Add watermark plugin if available and configured
    if (pluginCreators.watermark && config.watermark) {
      plugins.push(pluginCreators.watermark(config.watermark));
    }

    // Add captions plugin if available
    if (pluginCreators.captions) {
      plugins.push(pluginCreators.captions(config.captions || {}));
    }

    // Add gestures on video, where the bar is narrowest and the skip buttons
    // are the first controls the fit moves into the overflow tray. The plugin
    // self-disables for audio, but the audio builds do not ship it at all.
    if (type === 'video' && pluginCreators.gestures && config.gestures !== false) {
      plugins.push(pluginCreators.gestures({}));
    }

    // Add sharing, but only when the embed was given a page URL to share.
    //
    // Opt-in on purpose: the button is a visible change to the control bar, so
    // an embed that has never heard of `shareUrl` must look exactly as it did.
    // The plugin also has nothing to offer without one - it refuses to fall
    // back to the media `src`, because playback URLs are frequently signed.
    // Video only (the audio UIs have no control registry to register into) and
    // pointless with the controls off, since the button is the only way in.
    const shareEnabled =
      type === 'video' && Boolean(config.shareUrl) && config.controls !== false;

    if (shareEnabled && pluginCreators.share) {
      const shareConfig: Record<string, unknown> = { url: config.shareUrl };
      // Otherwise the native sheet is offered `document.title`, which inside
      // iframe.html is the embed page's own title rather than the media's.
      if (config.title) shareConfig.title = config.title;
      // Absent is meaningful: the `embed` target removes itself rather than
      // copying a snippet that points nowhere.
      if (config.embedBaseUrl) shareConfig.embedBaseUrl = config.embedBaseUrl;
      plugins.push(pluginCreators.share(shareConfig));
    }

    // Add analytics plugin if available and configured
    if (pluginCreators.analytics && config.analytics?.beaconUrl) {
      plugins.push(pluginCreators.analytics({
        beaconUrl: config.analytics.beaconUrl,
        apiKey: config.analytics.apiKey,
        videoId: config.analytics.videoId || config.src || 'unknown',
      }));
    }

    // Add UI plugin based on type
    if (config.controls !== false) {
      if (type === 'video' && pluginCreators.videoUI) {
        const uiConfig: Record<string, unknown> = {};
        if (Object.keys(theme).length > 0) uiConfig.theme = theme;
        if (config.hideDelay !== undefined) uiConfig.hideDelay = config.hideDelay;
        // Only forwarded when the embed was actually told. The ui plugin owns
        // the default (`config.bigPlayButton !== false`), so an absent key
        // there and an absent attribute here mean the same thing, and the
        // default is not duplicated in two packages. The audio UIs below have
        // no big play button, which is why this sits in the video branch.
        if (config.bigPlayButton !== undefined) uiConfig.bigPlayButton = config.bigPlayButton;
        // The share control has to be in the layout to be built at all, and
        // only a build that ships the plugin can build it. Without both, leave
        // `controls` unset so the UI plugin keeps its own default layout.
        if (shareEnabled && pluginCreators.share) uiConfig.controls = SHARE_CONTROL_LAYOUT;
        plugins.push(pluginCreators.videoUI(uiConfig));
      } else if ((type === 'audio' || type === 'audio-mini') && pluginCreators.audioUI) {
        plugins.push(pluginCreators.audioUI({
          layout: type === 'audio-mini' ? 'compact' : 'full',
          theme: {
            primary: config.brandColor,
            text: config.primaryColor,
            background: config.backgroundColor,
          },
        }));
      }
    }

    // Create player
    const player = await createPlayer({
      container,
      src: config.src || config.playlist?.[0]?.src || '',
      autoplay: config.autoplay || false,
      muted: config.muted || false,
      poster: config.poster || config.artwork || config.playlist?.[0]?.poster,
      loop: config.loop || false,
      plugins,
    });

    // Apply post-initialization settings
    const video = container.querySelector('video');
    if (video) {
      if (config.playbackRate) video.playbackRate = config.playbackRate;
      if (config.startTime) video.currentTime = config.startTime;
    }

    return player;
  } catch (error) {
    console.error('[ScarlettPlayer] Failed to create player:', error);
    throw error;
  }
}

/**
 * Initialize a player from a DOM element with data attributes
 */
export async function initElement(
  element: HTMLElement,
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): Promise<ScarlettPlayer | null> {
  if (element.hasAttribute('data-scarlett-initialized')) {
    return null;
  }

  const config = parseDataAttributes(element);
  element.setAttribute('data-scarlett-initialized', 'true');

  try {
    const player = await createEmbedPlayer(element, config, pluginCreators, availableTypes);
    return player;
  } catch (error) {
    element.removeAttribute('data-scarlett-initialized');
    throw error;
  }
}

/**
 * Player selectors for auto-initialization
 */
const PLAYER_SELECTORS = [
  '[data-scarlett-player]',
  '[data-sp]',
  '.scarlett-player',
];

/**
 * Initialize all players on the page
 */
export async function initAll(
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): Promise<void> {
  const selector = PLAYER_SELECTORS.join(', ');
  const elements = document.querySelectorAll<HTMLElement>(selector);

  let initialized = 0;
  let errors = 0;

  for (const element of Array.from(elements)) {
    try {
      const player = await initElement(element, pluginCreators, availableTypes);
      if (player) initialized++;
    } catch (error) {
      errors++;
      console.error('[ScarlettPlayer] Failed to initialize element:', error);
    }
  }

  if (initialized > 0) {
    console.log(`[ScarlettPlayer] Initialized ${initialized} player(s)`);
  }
  if (errors > 0) {
    console.warn(`[ScarlettPlayer] ${errors} player(s) failed to initialize`);
  }
}

/**
 * Create the global ScarlettPlayer API
 */
export function createScarlettPlayerAPI(
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[],
  version: string
): ScarlettPlayerGlobal {
  return {
    version,
    availableTypes,

    async create(options: EmbedPlayerOptions): Promise<ScarlettPlayer | null> {
      let container: HTMLElement | null = null;

      if (typeof options.container === 'string') {
        container = document.querySelector<HTMLElement>(options.container);
        if (!container) {
          console.error(`[ScarlettPlayer] Container not found: ${options.container}`);
          return null;
        }
      } else {
        container = options.container;
      }

      return createEmbedPlayer(container, options, pluginCreators, availableTypes);
    },

    async initAll(): Promise<void> {
      return initAll(pluginCreators, availableTypes);
    },
  };
}

/**
 * Setup auto-initialization on DOMContentLoaded
 */
export function setupAutoInit(
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): void {
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initAll(pluginCreators, availableTypes);
      });
    } else {
      initAll(pluginCreators, availableTypes);
    }
  }
}
