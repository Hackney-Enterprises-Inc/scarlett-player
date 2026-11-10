/**
 * Unified embed creator factory
 *
 * This module creates the embed API with configurable plugin availability.
 * Each build (full, video, audio) uses this with different plugin sets.
 */

import { ScarlettPlayer, createPlayer, injectSharedStyles, type Plugin } from '@scarlett-player/core';
import type { EmbedConfig, EmbedPlayerOptions, PlayerType, ScarlettPlayerGlobal } from './types';
import { parseDataAttributes, applyContainerStyles } from './parser';
import { buildControlLayout } from './control-layout';
import {
  ADDON_NAMES,
  ADDON_VIDEO_ONLY,
  addonFile,
  type AddonCreator,
  type AddonName,
  type AddonRuntime,
  type RegisterControl,
  type UnregisterControl,
} from './addons/runtime';
import { PKG_VERSION } from './version';

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
  /**
   * Chapter markers and the chapter list control. No build ships it; the
   * `embed.addon.chapters` bundle registers it through `ScarlettPlayer.use()`.
   * Video players only.
   */
  chapters?: AddonCreator;
  /**
   * Viewer-created clips. No build ships it; the `embed.addon.clips` bundle
   * registers it through `ScarlettPlayer.use()`. Video players only, and only
   * with the `data-clips-csrf="meta"` opt-in.
   */
  clips?: AddonCreator;
  /**
   * `accentTextTone` from `@scarlett-player/ui`, supplied by the builds that
   * ship the video UI.
   *
   * It rides on the creators rather than being imported here so the audio-only
   * bundle does not pull the whole UI package in for one function; the audio
   * UIs colour their own glyphs and never read the accent-text token.
   */
  accentTextTone?: (color: string) => string;
}

/**
 * The UI functions an entry hands `createScarlettPlayerAPI()` for the addon
 * runtime. The video-capable builds pass `@scarlett-player/ui`'s own exports;
 * the audio build ships no UI package and passes none.
 */
export interface AddonUIFunctions {
  registerControl: RegisterControl;
  unregisterControl: UnregisterControl;
}

/**
 * Build-level options for `createScarlettPlayerAPI()`.
 */
export interface ScarlettPlayerAPIOptions {
  /**
   * Names this build still bundles but deprecates in 1.28.
   *
   * The full build passes analytics, playlist, media session, watermark and
   * share; the video build passes watermark and share; the audio build passes
   * none, because O2 keeps playlist and media session there past 2.0.0. A name
   * listed here is left out of `builtIn`, so `use()` of it replaces the
   * bundled creator silently instead of being refused, and the bundled copy
   * warns once per page until an addon takes over. Deleted in 2.0.0, together
   * with the bundled copies themselves.
   */
  deprecatedBundled?: readonly AddonName[];
}

/**
 * Count of pending plus created players per creators map, so `use()` can
 * tell the host that a late registration misses the players already built.
 * A rejected create decrements it, so a map whose only create failed is not
 * reported as consumed, while a concurrent create still in flight keeps it so.
 */
const livePlayerCounts = new WeakMap<PluginCreators, number>();

/**
 * Whether any player built from this creators map is pending or created.
 *
 * @param creators - The creators map that identifies the page
 * @returns True while at least one player is in flight or exists
 */
function hasLivePlayers(creators: PluginCreators): boolean {
  return (livePlayerCounts.get(creators) ?? 0) > 0;
}

/**
 * Adjust the pending-plus-created player count for a creators map.
 *
 * @param creators - The creators map that identifies the page
 * @param delta - +1 when a create starts, -1 when it rejects
 */
function adjustLivePlayers(creators: PluginCreators, delta: 1 | -1): void {
  livePlayerCounts.set(creators, Math.max(0, (livePlayerCounts.get(creators) ?? 0) + delta));
}

/**
 * Names each build bundles but deprecates, per creators map.
 *
 * Written once by `createScarlettPlayerAPI()` from the entry's
 * `deprecatedBundled` option, and read by `createEmbedPlayer()`, which sees
 * only the map. A map that never went through an entry (a test passing real
 * creators straight to `createEmbedPlayer`) has no entry here and therefore
 * deprecates nothing.
 */
const deprecatedBundledCreators = new WeakMap<PluginCreators, Set<AddonName>>();

/**
 * Names an addon has replaced through `use()`, per creators map.
 *
 * The other half of the deprecation rule: a host that has migrated to the
 * addon must not also be told the bundled copy it no longer uses is
 * deprecated.
 */
const addonProvidedCreators = new WeakMap<PluginCreators, Set<AddonName>>();

/**
 * Addon notices a page has already been warned about, per creators map. The
 * key is the addon name for the common "load the addon" message, and
 * `addon:reason` for the build or player-type messages, so each distinct
 * message is said once and one reason never hides another.
 *
 * Keyed by the map rather than by a module-level set so that every test map
 * starts clean with no reset, and so two entries on one page (a full build
 * and a video build) warn independently. This is what makes the warnings
 * once per page rather than once per player: a page with ten players says
 * each thing once. Chapters and clips move from once per player to once per
 * page here as well (DC1).
 */
const warnedAddons = new WeakMap<PluginCreators, Set<string>>();

/**
 * Read one of the per-creators-map addon sets, creating it on first use.
 *
 * @param map - The WeakMap the set lives in
 * @param creators - The creators map that identifies the page
 * @returns The set for that map, empty on first use
 */
function addonNamesIn(
  map: WeakMap<PluginCreators, Set<AddonName>>,
  creators: PluginCreators
): Set<AddonName> {
  let names = map.get(creators);
  if (!names) {
    names = new Set<AddonName>();
    map.set(creators, names);
  }
  return names;
}

/**
 * Whether an addon notice still has to be logged for this page.
 *
 * Records the name on the first call, so the second player built from the
 * same map says nothing.
 *
 * @param creators - The creators map this player is being built from
 * @param addon - The addon the notice is about
 * @param reason - Which message is being said, when an addon has several
 * @returns True the first time this addon and reason are noticed on this page
 */
function firstAddonNotice(creators: PluginCreators, addon: AddonName, reason?: string): boolean {
  let noticed = warnedAddons.get(creators);
  if (!noticed) {
    noticed = new Set<string>();
    warnedAddons.set(creators, noticed);
  }
  const key = reason ? `${addon}:${reason}` : addon;
  if (noticed.has(key)) return false;
  noticed.add(key);
  return true;
}

/**
 * The sentence every missing-addon warning ends with: which file to load.
 *
 * @param addon - The addon that would provide the feature
 * @param enables - What loading it turns on, for an addon whose benefit is
 *   worth naming (playlist navigation, lock-screen metadata)
 * @returns The "load …" sentence
 */
function loadAddonSentence(addon: AddonName, enables = 'it'): string {
  const file = addonFile(addon);
  return `load ${file}.js (or ${file}.umd.cjs) after the embed to enable ${enables}.`;
}

/**
 * Warn, at most once per page, that an addon-backed attribute cannot take
 * effect, and say why.
 *
 * Generalised over all seven addons. A `videoOnly` one (chapters, clips,
 * share) also names the build or the player type it needs; the rest work
 * beside every build and on every player type, so they only name the file to
 * load.
 *
 * @param creators - The creators map this player is being built from, which
 *   identifies the page for the once-per-page rule
 * @param attribute - The attribute (or config key) that was ignored
 * @param addon - The addon that would provide it
 * @param availableTypes - The player types this build supports
 * @param type - The type of the player being created
 * @param notice - Optional tailoring: `consequence` is prepended to the load
 *   sentence and `enables` replaces its trailing "it"
 */
function warnAddonUnavailable(
  creators: PluginCreators,
  attribute: string,
  addon: AddonName,
  availableTypes: PlayerType[],
  type: PlayerType,
  notice?: { consequence?: string; enables?: string }
): void {
  const audioBuild = ADDON_VIDEO_ONLY.has(addon) && !availableTypes.includes('video');
  const notVideo = !audioBuild && ADDON_VIDEO_ONLY.has(addon) && type !== 'video';
  const reason = audioBuild ? 'audio-build' : notVideo ? 'video-only' : undefined;
  if (!firstAddonNotice(creators, addon, reason)) return;

  const load = loadAddonSentence(addon, notice?.enables);
  const tail = notice?.consequence ? `${notice.consequence} ${load}` : load;

  if (audioBuild) {
    console.warn(
      `[ScarlettPlayer] ${attribute} ignored: the ${addon} addon needs a video build ` +
      '(embed.js or embed.video.js); this is the audio build.'
    );
  } else if (notVideo) {
    console.warn(`[ScarlettPlayer] ${attribute} ignored: ${addon} applies to video players only.`);
  } else {
    console.warn(`[ScarlettPlayer] ${attribute} ignored: ${tail}`);
  }
}

/**
 * Notice, at most once per page, that a creator this build bundles but
 * deprecates in 1.28 was used as the bundled copy.
 *
 * Silent for a map whose entry never deprecated the name, and silent once
 * `use()` has replaced it with the addon: that host has already migrated.
 *
 * @param creators - The creators map this player is being built from
 * @param addon - The deprecated-bundled name that was used
 */
function noticeDeprecatedBundled(creators: PluginCreators, addon: AddonName): void {
  if (!deprecatedBundledCreators.get(creators)?.has(addon)) return;
  if (addonProvidedCreators.get(creators)?.has(addon)) return;
  if (!firstAddonNotice(creators, addon)) return;

  const file = addonFile(addon);
  console.warn(
    `[ScarlettPlayer] ${addon} is bundled in this build until 2.0.0; load ${file}.js ` +
    `(or ${file}.umd.cjs) from the same version to keep it.`
  );
}

/**
 * Read the host page's CSRF token for the clips endpoint.
 *
 * Only called for an embed whose host opted in with `data-clips-csrf="meta"`.
 * A missing tag sends an empty header, and the server's 419 reaches the
 * viewer through the clips overlay.
 *
 * @returns The `X-CSRF-TOKEN` header
 */
function csrfMetaHeaders(): Record<string, string> {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  return { 'X-CSRF-TOKEN': meta?.content ?? '' };
}

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

    // Accent TEXT - the LIVE label, the active menu rows - answers to 4.5:1
    // where the same colour answers to 3:1 as a fill, and unset it follows the
    // brand colour. An iframe host cannot reach the token with CSS of its own,
    // so a dark brand colour is derived up to a readable tone here rather than
    // rendering sub-AA labels nobody can fix from the outside.
    // `data-brand-text-color` overrides, for a host that wants its own.
    if (config.brandTextColor) {
      theme.accentTextColor = config.brandTextColor;
    } else if (config.brandColor && pluginCreators.accentTextTone) {
      theme.accentTextColor = pluginCreators.accentTextTone(config.brandColor);
    }

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
          // Analytics reports this for the item's view; `id` is positional
          ...(typeof item.videoId === 'string' && item.videoId !== '' ? { videoId: item.videoId } : {}),
          title: item.title,
          artist: item.artist,
          poster: item.poster || item.artwork,
          duration: item.duration,
        })),
      }));
      noticeDeprecatedBundled(pluginCreators, 'playlist');
    } else if (config.playlist?.length) {
      // The player still plays: `src` below falls back to playlist[0].src, so
      // what is lost is navigation and advance, not playback (F6).
      warnAddonUnavailable(pluginCreators, 'data-playlist', 'playlist', availableTypes, type, {
        consequence: 'only the first item plays;',
        enables: 'playlist navigation',
      });
    }

    // Add media session plugin if available (for audio types or if metadata provided)
    if (pluginCreators.mediaSession && (type !== 'video' || config.title)) {
      plugins.push(pluginCreators.mediaSession({
        title: config.title || config.playlist?.[0]?.title,
        artist: config.artist || config.playlist?.[0]?.artist,
        album: config.album,
        artwork: config.artwork || config.poster || config.playlist?.[0]?.artwork,
      }));
      // Audio players only: a titled video player gets no notice either way,
      // because `data-title` is on every Laravel embed and also feeds share,
      // so warning there would be noise on pages that never asked for media
      // session (DC3).
      if (type !== 'video') noticeDeprecatedBundled(pluginCreators, 'mediaSession');
    } else if (type !== 'video') {
      warnAddonUnavailable(pluginCreators, 'media session', 'mediaSession', availableTypes, type, {
        enables: 'lock-screen metadata',
      });
    }

    // Add watermark plugin if available and configured
    if (pluginCreators.watermark && config.watermark) {
      plugins.push(pluginCreators.watermark(config.watermark));
      noticeDeprecatedBundled(pluginCreators, 'watermark');
    } else if (config.watermark) {
      // DC4: a missing anti-piracy overlay is a content-protection loss, so
      // this one is an error rather than a warning.
      if (firstAddonNotice(pluginCreators, 'watermark')) {
        console.error(`[ScarlettPlayer] watermark ignored: ${loadAddonSentence('watermark')}`);
      }
    }

    // Add captions plugin if available
    if (pluginCreators.captions) {
      plugins.push(pluginCreators.captions(config.captions || {}));
    } else if (config.captions?.sources?.length) {
      console.warn(
        '[ScarlettPlayer] data-captions ignored: captions need a video build (embed.js or embed.video.js).'
      );
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
      noticeDeprecatedBundled(pluginCreators, 'share');
    } else if (shareEnabled) {
      // The layout stays the UI default below, because nothing registered the
      // control the slot would hold.
      warnAddonUnavailable(pluginCreators, 'data-share-url', 'share', availableTypes, type);
    }

    // Chapters and clips arrive as addons (`embed.addon.<name>`) through
    // `ScarlettPlayer.use()`; no build carries them. Each attribute that
    // cannot take effect warns once and installs nothing.
    let chaptersEnabled = false;
    if (config.chapters) {
      if (type === 'video' && pluginCreators.chapters) {
        plugins.push(pluginCreators.chapters({ ...config.chapters }));
        chaptersEnabled = true;
      } else {
        warnAddonUnavailable(pluginCreators, 'data-chapters', 'chapters', availableTypes, type);
      }
    }

    let clipsEnabled = false;
    if (config.clips) {
      if (type !== 'video' || !pluginCreators.clips) {
        warnAddonUnavailable(pluginCreators, 'data-clips-endpoint', 'clips', availableTypes, type);
      } else if (config.clips.csrf !== 'meta') {
        // A third-party bundle reading the host page's CSRF token is
        // behaviour the host has to ask for; without it the endpoint could
        // only be called unauthenticated, which a Laravel route answers 419.
        console.warn(
          '[ScarlettPlayer] data-clips-endpoint ignored: set data-clips-csrf="meta" to allow ' +
          "the embed to read your page's csrf-token meta tag."
        );
      } else {
        const clipsConfig: Record<string, unknown> = {
          endpoint: { url: config.clips.endpoint, headers: csrfMetaHeaders },
          mediaId: config.clips.mediaId || config.analytics?.videoId || config.src,
        };
        if (config.clips.maxDuration !== undefined) clipsConfig.maxDuration = config.clips.maxDuration;
        if (config.clips.minDuration !== undefined) clipsConfig.minDuration = config.clips.minDuration;
        plugins.push(pluginCreators.clips(clipsConfig));
        clipsEnabled = true;
      }
    }

    // Add analytics plugin if available and configured
    if (pluginCreators.analytics && config.analytics?.beaconUrl) {
      const analytics = pluginCreators.analytics({
        beaconUrl: config.analytics.beaconUrl,
        apiKey: config.analytics.apiKey,
        videoId: config.analytics.videoId || config.src || 'unknown',
        ...(config.analytics.anonymous !== undefined && { anonymous: config.analytics.anonymous }),
        ...(config.analytics.respectDoNotTrack !== undefined && { respectDoNotTrack: config.analytics.respectDoNotTrack }),
        ...(config.analytics.batch !== undefined && { batch: config.analytics.batch }),
        ...(config.analytics.beforeSend !== undefined && { beforeSend: config.analytics.beforeSend }),
        ...(config.analytics.playerInitTime !== undefined && { playerInitTime: config.analytics.playerInitTime }),
      });

      // The first playlist item is loaded as the player's src below, not
      // through the playlist, so no playlist:change ever carries its videoId.
      // Name it before init; the configured videoId stays the fallback for
      // later items without one.
      const first = config.playlist?.[0];
      const firstIsInitialSource = first !== undefined && (!config.src || config.src === first.src);
      if (
        firstIsInitialSource &&
        typeof first.videoId === 'string' &&
        first.videoId !== '' &&
        typeof (analytics as { setVideo?: unknown }).setVideo === 'function'
      ) {
        (analytics as unknown as { setVideo(video: { videoId: string; videoTitle?: string }): void })
          .setVideo({ videoId: first.videoId, videoTitle: first.title });
      }

      plugins.push(analytics);
      noticeDeprecatedBundled(pluginCreators, 'analytics');
    } else if (config.analytics?.beaconUrl) {
      // No beacons at all: the plugin is what sends them.
      warnAddonUnavailable(
        pluginCreators,
        'data-analytics-beacon-url',
        'analytics',
        availableTypes,
        type
      );
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
        // Same rule: the ui plugin owns the default (shortcuts on). The audio
        // UIs have no global shortcuts, so this stays in the video branch too.
        if (config.keyboard !== undefined) uiConfig.keyboard = config.keyboard;
        // A registered control has to be in the layout to be built at all,
        // and neither share, chapters nor clip is in the UI plugin's default.
        // With none of them installed, leave `controls` unset so the UI
        // plugin keeps its own default layout.
        const controls = buildControlLayout({
          share: shareEnabled && Boolean(pluginCreators.share),
          chapters: chaptersEnabled,
          clip: clipsEnabled,
        });
        if (controls) uiConfig.controls = controls;
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

    // Mark the map consumed BEFORE the await, not after it. A `use()` that
    // lands while this createPlayer() is still pending has to be told it is
    // late, and the player already in flight must not be retroactively
    // changed (SCAR-EMBED-4 review F2). Marking after the await left that
    // window silent.
    adjustLivePlayers(pluginCreators, 1);

    // Create player. Only a rejection here releases the count: once it
    // resolves, the player exists whatever the steps below do.
    let player: ScarlettPlayer;
    try {
      player = await createPlayer({
        container,
        src: config.src || config.playlist?.[0]?.src || '',
        autoplay: config.autoplay || false,
        muted: config.muted || false,
        poster: config.poster || config.artwork || config.playlist?.[0]?.poster,
        loop: config.loop || false,
        plugins,
      });
    } catch (error) {
      adjustLivePlayers(pluginCreators, -1);
      throw error;
    }

    // Apply post-initialization settings
    const video = container.querySelector('video');
    if (video) {
      if (config.playbackRate) video.playbackRate = config.playbackRate;
    }

    // startTime has to wait for metadata: seeking an element that has not
    // parsed its duration yet is silently dropped, so the viewer started at
    // zero whenever the manifest had not landed by the time createPlayer()
    // resolved - which is most of the time on a cold load.
    if (config.startTime) {
      seekWhenReady(player, video, config.startTime);
    }

    return player;
  } catch (error) {
    console.error('[ScarlettPlayer] Failed to create player:', error);
    throw error;
  }
}

/**
 * Seek to `startTime` as soon as the media knows its duration.
 *
 * Applied immediately when metadata is already parsed (a cached source can
 * beat us here), otherwise on the first `media:loadedmetadata`.
 *
 * @param player - The player to seek
 * @param video - The media element, when one exists yet
 * @param startTime - Position in seconds
 */
function seekWhenReady(
  player: ScarlettPlayer,
  video: HTMLVideoElement | null,
  startTime: number
): void {
  // HAVE_METADATA
  if (video && video.readyState >= 1) {
    player.seek(startTime);
    return;
  }

  player.once('media:loadedmetadata', () => {
    player.seek(startTime);
  });
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

  // Concurrent, not sequential: each player's setup is mostly network wait
  // (plugin chunks, then the manifest), and running them one after another
  // made the last player on a page wait out every player before it.
  // allSettled, so one bad embed cannot stop the rest from initialising.
  const results = await Promise.allSettled(
    Array.from(elements).map((element) => initElement(element, pluginCreators, availableTypes))
  );

  let initialized = 0;
  let errors = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value) initialized++;
      continue;
    }

    errors++;
    console.error('[ScarlettPlayer] Failed to initialize element:', result.reason);
  }

  if (initialized > 0) {
    console.log(`[ScarlettPlayer] Initialized ${initialized} player(s)`);
  }
  if (errors > 0) {
    console.warn(`[ScarlettPlayer] ${errors} player(s) failed to initialize`);
  }
}

/**
 * Create the global ScarlettPlayer API.
 *
 * @param pluginCreators - The creators this build ships, mutated in place by `use()`
 * @param availableTypes - The player types this build supports
 * @param version - The build's reported version, `-video` / `-audio` suffix included
 * @param ui - The UI package's control-registry functions, for the addon runtime
 * @param options - Build-level options; `deprecatedBundled` carries the 1.28 deprecation
 * @returns The `window.ScarlettPlayer` API object
 */
export function createScarlettPlayerAPI(
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[],
  version: string,
  ui?: AddonUIFunctions,
  options?: ScarlettPlayerAPIOptions
): ScarlettPlayerGlobal {
  // Names this build ships itself, fixed at creation so a later `use()` that
  // replaces an addon is told apart from one that would shadow the build. The
  // 1.28 deprecated-bundled names are left out on purpose: an addon loaded
  // beside a build that still carries that plugin replaces the bundled copy
  // instead of being refused, which is what lets a host migrate before 2.0.0
  // (§4.2).
  const deprecated = new Set<AddonName>(options?.deprecatedBundled ?? []);
  const builtIn = new Set<AddonName>(
    ADDON_NAMES.filter((name) => pluginCreators[name] && !deprecated.has(name))
  );

  // createEmbedPlayer() sees only the map, so the deprecation list travels
  // beside it rather than through a new parameter on every caller.
  if (deprecated.size > 0) {
    deprecatedBundledCreators.set(pluginCreators, deprecated);
  }

  const noVideoUI = (): never => {
    throw new Error('[ScarlettPlayer] this embed build has no video UI; addons need embed.js or embed.video.js');
  };

  const addonRuntime: AddonRuntime = Object.freeze({
    // Bare package version: the addon compares it with its own, and the
    // '-video' / '-audio' suffix on `version` names the build, not the release.
    version: PKG_VERSION,
    injectSharedStyles,
    registerControl: ui?.registerControl ?? noVideoUI,
    unregisterControl: ui?.unregisterControl ?? noVideoUI,
  });

  return {
    version,
    availableTypes,
    addonRuntime,

    use(name: AddonName, creator: AddonCreator): void {
      if (!(ADDON_NAMES as readonly string[]).includes(name)) {
        console.warn(
          `[ScarlettPlayer] use("${String(name)}") refused: unknown addon. ` +
          `Accepted names: ${ADDON_NAMES.join(', ')}.`
        );
        return;
      }
      if (typeof creator !== 'function') {
        console.warn(`[ScarlettPlayer] use("${name}") refused: the creator is not a function.`);
        return;
      }
      if (builtIn.has(name)) {
        console.warn(`[ScarlettPlayer] use("${name}") refused: ${name} is already provided by this build.`);
        return;
      }
      if (pluginCreators[name]) {
        // 1.28: the first use() of a name this build bundles but deprecates
        // replaces the bundled copy silently and is recorded as addon-provided,
        // so the bundled copy's deprecation notice stays quiet for a host that
        // has migrated. A second use() of the same name still warns, as it
        // always did.
        const provided = addonNamesIn(addonProvidedCreators, pluginCreators);
        if (deprecated.has(name) && !provided.has(name)) {
          provided.add(name);
        } else {
          console.warn(`[ScarlettPlayer] use("${name}") replaces an earlier registration.`);
        }
      }
      if (hasLivePlayers(pluginCreators)) {
        console.warn(
          `[ScarlettPlayer] use("${name}") after players were created: it applies only to ` +
          'players created from now on. Load the addon before DOMContentLoaded, or register ' +
          'it before calling initAll() / create().'
        );
      }
      // The map setupAutoInit() and this API share by reference, so the next
      // initAll() or create() sees the creator with no other plumbing.
      pluginCreators[name] = creator;
    },

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
 * Setup auto-initialization.
 *
 * Scans once the document's scripts have all run, not merely once parsing has
 * finished. A `defer` or `type="module"` embed script executes when
 * `readyState` is already `'interactive'` but BEFORE the deferred scripts
 * after it, and the addon bundles (`embed.addon.<name>`) are exactly such
 * scripts: scanning at that moment builds every player before the addons
 * register, so none of them gets its chapters or clip control. Waiting for
 * `DOMContentLoaded`, which fires after every deferred and module script in
 * document order, keeps the documented load order working for all three
 * script styles. `load` is the fallback for a script injected after
 * `DOMContentLoaded` has already fired (`readyState` stays `'interactive'`
 * until subresources finish); a script that runs at `'complete'` scans at
 * once, as before.
 */
export function setupAutoInit(
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): void {
  if (typeof document === 'undefined') return;

  if (document.readyState === 'complete') {
    initAll(pluginCreators, availableTypes);
    return;
  }

  let scanned = false;
  const scan = (): void => {
    if (scanned) return;
    scanned = true;
    initAll(pluginCreators, availableTypes);
  };
  document.addEventListener('DOMContentLoaded', scan, { once: true });
  window.addEventListener('load', scan, { once: true });
}
