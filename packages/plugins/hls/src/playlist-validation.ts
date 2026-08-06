/**
 * Playlist refresh validation (pLoader wrapper).
 *
 * hls.js does no content sniffing on live media-playlist refreshes: an
 * error page, a master-only response, or an empty document parses into a
 * LevelDetails with zero fragments, silently (the Sentry 2D8 class under
 * Video.js/VHS). This wrapper validates every playlist response and
 * converts garbage into a loader error, so a malformed refresh flows
 * through hls.js's normal network-error path and from there into the
 * plugin's bounded retry -> auto-reconnect -> retry-UI chain, while
 * hls.js naturally keeps the previous playlist during retries.
 */

import type { HlsConstructor } from './types';

/**
 * Loader error text for a malformed playlist document. Carried in the
 * hls.js error's response object so the plugin can classify the terminal
 * failure as PLAYLIST_INVALID instead of a generic network error.
 */
export const PLAYLIST_INVALID_TEXT = 'Invalid playlist document';

/** Playlist loader context types that must be MEDIA playlists. */
const MEDIA_PLAYLIST_CONTEXTS = ['level', 'audioTrack', 'subtitleTrack'];

/**
 * Validate that a playlist response is a usable M3U8 document.
 *
 * Manifest-phase loads accept any well-formed M3U8 (master or media).
 * Level/track refreshes additionally require media-playlist markers
 * (EXTINF or EXT-X-TARGETDURATION), so a master-only response or an HTML
 * error page during a live refresh is rejected.
 *
 * @param data - Raw response body from the playlist loader
 * @param contextType - hls.js loader context type ('manifest', 'level', ...)
 * @returns True when the document is safe to hand to the parser
 */
export function isValidPlaylistDocument(data: unknown, contextType?: string): boolean {
  if (typeof data !== 'string' || data.length === 0) return false;

  const text = data.trimStart();
  if (!text.startsWith('#EXTM3U')) return false;

  if (contextType && MEDIA_PLAYLIST_CONTEXTS.includes(contextType)) {
    return /^#EXT(?:INF|-X-TARGETDURATION):/m.test(text);
  }

  return true;
}

/**
 * Create a pLoader class wrapping the given hls.js default loader.
 *
 * On load success the response document is validated; garbage is rerouted
 * to the onError callback as a synthetic loader error (code 0, text
 * {@link PLAYLIST_INVALID_TEXT}) that hls.js treats like any other
 * playlist network failure.
 *
 * @param Hls - Loaded hls.js constructor (provides DefaultConfig.loader)
 * @returns Loader class suitable for the hls.js `pLoader` config option
 */
export function createValidatingPlaylistLoader(Hls: HlsConstructor): unknown {
  const BaseLoader = (Hls as any).DefaultConfig.loader;

  return class ValidatingPlaylistLoader extends BaseLoader {
    /**
     * Load a playlist, validating the response document before it reaches
     * the M3U8 parser.
     *
     * @param context - hls.js loader context
     * @param config - hls.js loader config
     * @param callbacks - hls.js loader callbacks
     */
    load(context: any, config: any, callbacks: any): void {
      const wrapped = {
        ...callbacks,
        onSuccess: (response: any, stats: any, ctx: any, networkDetails: any) => {
          if (!isValidPlaylistDocument(response?.data, ctx?.type)) {
            callbacks.onError(
              { code: 0, text: PLAYLIST_INVALID_TEXT },
              ctx,
              networkDetails,
              stats
            );
            return;
          }
          callbacks.onSuccess(response, stats, ctx, networkDetails);
        },
      };
      super.load(context, config, wrapped);
    }
  };
}
