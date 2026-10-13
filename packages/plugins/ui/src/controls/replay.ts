/**
 * Replay on an ended stream.
 *
 * Shared by the big overlay button and the control-bar button so both take the
 * same path. The decision keys on the media element's duration, not on the
 * `live` state key: hls.js sets `live` false on ENDLIST and clears the seekable
 * range, while native leaves `live` true after the playlist ends. Only the
 * duration tells a finished recording apart from a live stream that stopped
 * without ending.
 */

import type { IPluginAPI } from '@scarlett-player/core';

/** The HLS provider's playlist-start reader, looked up by plugin id. */
interface PlaylistStartSource {
  getPlaylistStart?(): number | null;
}

/**
 * Restart an ended media element, choosing the target from its duration.
 *
 * - Finite duration (VOD, or a live stream that ended with ENDLIST on either
 *   provider): seek to the start of the playlist window, so a sliding-window
 *   playlist replays from its first segment, not from a position the window no
 *   longer covers. On hls.js that start comes from the HLS provider's
 *   `getPlaylistStart()`: under MSE the element's finite `seekable` range
 *   always starts at 0. Otherwise (native HLS, other providers, or no answer
 *   inside the duration) it is the start of the element's seekable window, or
 *   0 when there is none. The caller is expected to call `play()` after a seek.
 * - Infinite duration (the element ended without ENDLIST, e.g. the playlist
 *   stopped updating): the window is stale, so seeking would land on the same
 *   dead end. Emit `media:load-request` for the current `source` state with
 *   `autoplay: true` instead, so a fresh load rejoins the live edge. No seek is
 *   made, and the caller must not `play()` the old element.
 *
 * Never calls `seekToLive()`: on hls.js it is a no-op once ENDLIST has cleared
 * the live state, and it warns.
 *
 * @param api - Plugin API, for the `source` state, the load request and the
 *   HLS provider's playlist start
 * @param video - The ended media element
 * @returns The time the element was seeked to, or `null` when the replay
 *   reloads the source instead (or when there is no source to reload)
 */
export function replayFromEnd(api: IPluginAPI, video: HTMLVideoElement): number | null {
  if (video.duration === Infinity) {
    const source = api.getState('source');
    if (!source) return null;

    api.emit('media:load-request', { src: source.src, autoplay: true });
    return null;
  }

  const playlistStart = api
    .getPlugin<PlaylistStartSource>('hls-provider')
    ?.getPlaylistStart?.();
  const seekable = video.seekable;
  const target =
    typeof playlistStart === 'number' &&
    Number.isFinite(playlistStart) &&
    playlistStart >= 0 &&
    playlistStart < video.duration
      ? playlistStart
      : seekable && seekable.length > 0
        ? seekable.start(0)
        : 0;
  video.currentTime = target;
  return target;
}
