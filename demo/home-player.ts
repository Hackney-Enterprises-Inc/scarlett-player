/**
 * The deferred half of the homepage: the real player, mounted on the first
 * Play click.
 *
 * Kept in its own module so esbuild's code splitting puts core, the two
 * providers and the UI plugin in a chunk that `demo/home.ts` only fetches
 * when someone actually plays the sample. Nothing here runs on page load,
 * so the homepage's initial paint fetches no HLS manifest and no player
 * code (plan Part B section 10 item 2).
 *
 * Imports by relative source path for the same reason `demo/demo.ts` does:
 * the build aliases every `@scarlett-player/*` name to its source entry so
 * a plugin reaching for a sibling by name resolves to the same instance.
 */

import { createPlayer } from '../packages/core/src/index';
import { createHLSPlugin } from '../packages/plugins/hls/src/index';
import { createNativePlugin } from '../packages/plugins/native/src/index';
import { uiPlugin, accentTextTone } from '../packages/plugins/ui/src/index';

/** What the homepage needs to know to mount its showcase player. */
export interface HomePlayerOptions {
  /** Sample source URL, HLS or a progressive file. */
  src: string;
  /** Poster shown by the player until the first frame renders. */
  poster?: string;
  /** Accent for the control bar; the site's Scarlett red by default. */
  accentColor?: string;
}

/** Handle the homepage keeps on the mounted player. */
export interface HomePlayerSession {
  /**
   * Start playback under the caller's user gesture.
   *
   * Calls the media element's own `play()` rather than `player.play()` so
   * the browser's autoplay verdict is observable: the providers swallow the
   * rejection and only log it, but the homepage has to know, because a
   * rejected first play means the poster's button must stay and become the
   * viewer's second, gesture-backed click.
   *
   * @throws The element's rejection, typically a `NotAllowedError` when the
   *   gesture that started the load expired before the manifest arrived.
   */
  play(): Promise<void>;
  /**
   * Run `callback` once, the first time the player reports `playing`.
   *
   * Fires immediately when playback is already running.
   */
  onFirstPlaying(callback: () => void): void;
  /** Tear the player down and release its media. */
  destroy(): Promise<void>;
}

/**
 * Mount the showcase player into `container` and load `options.src`.
 *
 * Resolves after the player is ready and the source has loaded, which for
 * HLS means the manifest has been parsed; playback has not started.
 *
 * @param container - Element the player takes over; it is emptied
 * @param options - Source, poster and accent
 * @returns The session handle
 * @throws When the player fails to initialise or the source fails to load
 */
export async function mountHomePlayer(
  container: HTMLElement,
  options: HomePlayerOptions,
): Promise<HomePlayerSession> {
  const accent = options.accentColor ?? '#e50914';

  const player = await createPlayer({
    container,
    src: options.src,
    poster: options.poster,
    plugins: [
      createHLSPlugin(),
      createNativePlugin(),
      uiPlugin({
        // The Scarlett red misses AA as 13px menu text, so the readable
        // tone goes in beside it rather than letting the label inherit it.
        theme: { accentColor: accent, accentTextColor: accentTextTone(accent) },
      }),
    ],
  });

  // A failed load surfaces as error state rather than a rejection, so the
  // homepage would otherwise sit on a poster with a player that cannot
  // start. Treat a load that ends in error the same as a thrown one.
  if (player.getState().error) {
    await player.destroy();
    throw new Error('The sample failed to load');
  }

  return {
    async play(): Promise<void> {
      const video = container.querySelector('video');
      if (!video) {
        throw new Error('The player has no media element');
      }
      await video.play();
    },

    onFirstPlaying(callback: () => void): void {
      if (player.playing) {
        callback();
        return;
      }
      const unsubscribe = player.subscribeToState((event) => {
        if (event.key === 'playing' && event.value === true) {
          unsubscribe();
          callback();
        }
      });
    },

    destroy(): Promise<void> {
      return player.destroy();
    },
  };
}
