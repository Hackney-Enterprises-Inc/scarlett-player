/**
 * Media access helpers.
 *
 * `IPluginAPI` has no seek method and must not gain one, so seeking goes
 * through the DOM: find the provider's `<video>` element inside the player
 * container and write `currentTime`, clamped to what the media actually
 * allows. Copied from the chapters plugin's seek helper
 * (`packages/plugins/chapters/src/index.ts`), which already handles the
 * live DVR branch - the clips plugin is VOD-only in v1, but Phase 2 gets
 * correct clamping for free.
 */

import type { IPluginAPI } from '@scarlett-player/core';

/**
 * The provider's video element inside a player container, when present.
 *
 * @param container - The player container from `IPluginAPI.container`
 * @returns The first `<video>` descendant, or null
 */
export function getVideo(container: HTMLElement): HTMLVideoElement | null {
  return container.querySelector('video');
}

/**
 * Seek the player's video element, clamped to what the media allows.
 *
 * On live with a reported DVR window the seek is clamped to
 * `seekableRange`, because `duration` is Infinity there and an unclamped
 * seek would run off the edge. Otherwise the clamp is `[0, duration]` when
 * the duration is finite and positive, or `[0, Infinity)` when it is not.
 * A no-op when there is no api (yet) or no video element in the container.
 *
 * @param api - The plugin API, or null before init / after destroy
 * @param time - Requested seek target in media seconds
 */
export function seekClamped(api: IPluginAPI | null, time: number): void {
  if (!api) return;

  const video = getVideo(api.container);
  if (!video) return;

  const live = api.getState('live');
  const seekableRange = api.getState('seekableRange');

  if (live && seekableRange) {
    video.currentTime = Math.max(seekableRange.start, Math.min(seekableRange.end, time));
    return;
  }

  const duration = video.duration;
  const upperBound = Number.isFinite(duration) && duration > 0 ? duration : null;

  video.currentTime = upperBound === null ? Math.max(0, time) : Math.max(0, Math.min(upperBound, time));
}
