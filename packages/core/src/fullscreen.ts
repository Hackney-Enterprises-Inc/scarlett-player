/**
 * Fullscreen helpers.
 *
 * One implementation of "go fullscreen", shared by everything that offers it.
 * Before this there were three: the player's own `requestFullscreen()`, the UI
 * package's fullscreen button and its `f` keyboard shortcut, and they did not
 * agree. Only the button carried the iPhone fallback, so a host calling
 * `player.requestFullscreen()` (which is what the Vue wrapper and the
 * `useScarlettPlayer` composable both do) got nothing at all on an iPhone,
 * where `Element.requestFullscreen` does not exist and only the video element
 * can be presented full screen.
 *
 * @packageDocumentation
 */

/** The webkit fullscreen surface, which no lib.dom typing covers. */
interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/** The iPhone's native player entry points, which live on the video element. */
interface WebkitFullscreenVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
}

/** The webkit half of the document fullscreen API. */
interface WebkitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

/**
 * The video element inside a player container, if there is one yet.
 *
 * Looked up on every call rather than cached: the element is created by
 * whichever provider plugin wins the source, which happens after the player is
 * constructed and again on every `load()`.
 *
 * @param container - Player container element
 * @returns The container's video element, or null
 */
function videoIn(container: HTMLElement): WebkitFullscreenVideo | null {
  return container.querySelector('video');
}

/**
 * Is this player currently presented full screen?
 *
 * Reads the browser rather than the player's own state, so a stale state key
 * can never invert a toggle. The third branch is the iPhone: its native player
 * is not a fullscreen element at all, and the only way to ask is the video
 * element's own `webkitDisplayingFullscreen`.
 *
 * @param container - Player container element
 * @returns True while the container or its video is full screen
 */
export function isFullscreen(container: HTMLElement): boolean {
  const doc = document as WebkitFullscreenDocument;
  const active = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

  if (active && container.contains(active)) {
    return true;
  }

  return !!videoIn(container)?.webkitDisplayingFullscreen;
}

/**
 * Present the player full screen.
 *
 * Tries the standard API, then the webkit one, then the iPhone's native player.
 * The last is synchronous and returns no promise, which is why the fallback
 * chain is written out rather than expressed as a list of promises.
 *
 * Exhausting all three throws rather than resolving, and that matters to the
 * caller: `ScarlettPlayer.requestFullscreen()` writes `fullscreen: true` and
 * emits `fullscreen:change` when this settles without the browser having
 * announced anything, because jsdom and the iPhone's native player both stay
 * silent. A silent no-op here therefore told every listener the player had
 * gone full screen when nothing had happened at all, which is what an iPhone
 * before the provider created the video element, and any browser with no
 * fullscreen API, actually hit.
 *
 * @param container - Player container element
 * @returns Promise that settles when the browser has accepted or refused
 * @throws Whatever the browser rejects the request with (denied by permission
 *   policy, not triggered by a user gesture, already exiting), or an Error when
 *   this environment offers no fullscreen API at all
 */
export async function enterFullscreen(container: HTMLElement): Promise<void> {
  const el = container as WebkitFullscreenElement;

  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }

  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
    return;
  }

  // iPhone: Element.requestFullscreen does not exist, and the only full screen
  // available is the video element's own native player.
  const video = videoIn(container);

  if (video?.webkitEnterFullscreen) {
    video.webkitEnterFullscreen();
    return;
  }

  throw new Error('Fullscreen is not supported');
}

/**
 * Leave fullscreen.
 *
 * The iPhone branch is checked FIRST, and the order is load-bearing. A WebKit
 * that exposes `document.exitFullscreen` while the thing actually open is the
 * video element's native player has no fullscreen element, so
 * `document.exitFullscreen()` rejects, the caller swallows the rejection the
 * way every caller here does, and `webkitExitFullscreen()` never runs: the
 * viewer is left in a fullscreen player that the button cannot close. Asking
 * the video first costs nothing anywhere else, because
 * `webkitDisplayingFullscreen` is only ever true while that native player is up.
 *
 * @param container - Player container element
 * @returns Promise that settles when the browser has accepted or refused
 * @throws Whatever the browser rejects the request with
 */
export async function exitFullscreen(container: HTMLElement): Promise<void> {
  const video = videoIn(container);

  if (video?.webkitDisplayingFullscreen) {
    video.webkitExitFullscreen?.();
    return;
  }

  const doc = document as WebkitFullscreenDocument;

  if (doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }

  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}
