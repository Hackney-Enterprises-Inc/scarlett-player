/**
 * BigPlayButton Control Tests
 *
 * The button is the only play affordance on the picture itself, so the rules
 * about when it is on screen are the whole feature: it must be there over a
 * poster before playback, gone the moment playback starts, out of the way of
 * the spinner and the error overlay, and back as Replay when the video ends.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BigPlayButton } from '../../src/controls/BigPlayButton';
import type { IPluginAPI } from '@scarlett-player/core';

type MockApi = IPluginAPI & { __state: Record<string, unknown> };

function createMockApi(overrides: Record<string, unknown> = {}): MockApi {
  const state: Record<string, unknown> = {
    playing: false,
    paused: true,
    ended: false,
    currentTime: 0,
    playbackState: 'idle',
    error: null,
    ...overrides,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  video.play = vi.fn(() => Promise.resolve());
  video.pause = vi.fn();
  container.appendChild(video);

  return {
    pluginId: 'test',
    container,
    __state: state,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    defineState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as MockApi;
}

describe('BigPlayButton', () => {
  let api: MockApi;
  let button: BigPlayButton;

  const isVisible = (): boolean =>
    button.render().classList.contains('sp-big-play--visible');

  /**
   * Put the media element into (or out of) the ended state.
   *
   * The control reads `video.ended`, not the `ended` state key: neither
   * provider clears that key on a replay, so it stays true for the rest of
   * the session and would leave this button over playing video.
   */
  const setElementEnded = (value: boolean): void => {
    const video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'ended', { value, configurable: true });
  };

  beforeEach(() => {
    api = createMockApi();
    button = new BigPlayButton(api);
  });

  afterEach(() => {
    button.destroy();
  });

  it('renders a real button with an accessible label', () => {
    const el = button.render();

    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.getAttribute('aria-label')).toBe('Play');
    expect(el.classList.contains('sp-big-play')).toBe(true);
  });

  it('is visible before playback starts', () => {
    button.update();

    expect(isVisible()).toBe(true);
  });

  it('is visible once the source is ready', () => {
    api.__state.playbackState = 'ready';
    button.update();

    expect(isVisible()).toBe(true);
  });

  it('is hidden while the source is loading (the spinner owns that state)', () => {
    api.__state.playbackState = 'loading';
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('is hidden once playback is under way', () => {
    api.__state.playing = true;
    api.__state.playbackState = 'playing';
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('stays hidden after a pause mid-playback', () => {
    api.__state.playing = true;
    api.__state.playbackState = 'playing';
    button.update();

    // A viewer who pauses in the first fraction of a second still has
    // currentTime 0, so the latch is what keeps the button off the picture.
    api.__state.playing = false;
    api.__state.paused = true;
    api.__state.playbackState = 'paused';
    api.__state.currentTime = 0;
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('is hidden when an error is set', () => {
    api.__state.error = { code: 'MEDIA_NETWORK_ERROR', message: 'gone' };
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('is hidden while the error overlay is on screen', () => {
    // A dismissed overlay leaves `error` populated, so the overlay's own
    // visibility is the authority on whether it owns the picture.
    let overlayVisible = true;
    const guarded = new BigPlayButton(api, () => overlayVisible);

    guarded.update();
    expect(guarded.render().classList.contains('sp-big-play--visible')).toBe(false);

    overlayVisible = false;
    guarded.update();
    expect(guarded.render().classList.contains('sp-big-play--visible')).toBe(true);

    guarded.destroy();
  });

  it('comes back as Replay when playback ends', () => {
    api.__state.playing = true;
    button.update();

    api.__state.playing = false;
    api.__state.currentTime = 120;
    api.__state.playbackState = 'ended';
    setElementEnded(true);
    button.update();

    expect(isVisible()).toBe(true);
    expect(button.render().getAttribute('aria-label')).toBe('Replay');
  });

  it('hides again once a replay is under way', () => {
    // The `ended` state key survives a replay (only load() clears it), so a
    // control that trusted it would sit over the picture for the rest of the
    // session. Verified in Chrome on 2026-09-02.
    api.__state.playing = true;
    button.update();
    api.__state.playing = false;
    api.__state.currentTime = 120;
    setElementEnded(true);
    button.update();
    expect(isVisible()).toBe(true);

    api.__state.ended = true; // stale, never cleared by either provider
    setElementEnded(false);
    api.__state.playing = true;
    api.__state.currentTime = 2;
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('stays hidden when a replay is paused', () => {
    api.__state.playing = true;
    button.update();
    api.__state.ended = true; // stale
    api.__state.playing = false;
    api.__state.paused = true;
    api.__state.currentTime = 5;
    setElementEnded(false);
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('falls back to the ended state key before an element exists', () => {
    // A provider has not created the media element yet, so there is nothing
    // to read; the state key is all there is.
    const bare = createMockApi({ ended: true, currentTime: 30 });
    bare.container.querySelector('video')?.remove();
    const orphan = new BigPlayButton(bare);

    orphan.update();

    expect(orphan.render().getAttribute('aria-label')).toBe('Replay');
    orphan.destroy();
  });

  it('calls video.play() when clicked', () => {
    const video = api.container.querySelector('video')!;

    button.render().click();

    expect(video.play).toHaveBeenCalled();
  });

  it('seeks to 0 and plays when clicked after ending', () => {
    setElementEnded(true);
    const video = api.container.querySelector('video')!;

    button.render().click();

    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalled();
  });

  it('swallows a rejected play() instead of leaking an unhandled rejection', () => {
    const video = api.container.querySelector('video')!;
    video.play = vi.fn(() => Promise.reject(new Error('NotAllowedError')));

    expect(() => button.render().click()).not.toThrow();
  });

  it('does not rebuild its icon across repeated no-op updates', () => {
    // Same reason as the control bar's play button: rebuilding the icon
    // between mousedown and mouseup removes the node that took the press, and
    // the browser never dispatches the click.
    const el = button.render();
    button.update();
    const iconBefore = el.firstElementChild;

    for (let i = 0; i < 20; i++) {
      button.update();
    }

    expect(el.firstElementChild).toBe(iconBefore);
  });

  it('removes its element on destroy', () => {
    const el = button.render();
    document.body.appendChild(el);

    button.destroy();

    expect(document.body.contains(el)).toBe(false);
  });
});
