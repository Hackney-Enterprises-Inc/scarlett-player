/**
 * Native provider Picture-in-Picture state tracking tests
 * (Phase 4 of fix/scarlett-error-absorption).
 *
 * Before this work the native provider registered no PiP listeners at
 * all, so `state.pip` never updated on the native path and the UI's PiP
 * button reported a stale state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNativePlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';

// Mock canPlayType since jsdom doesn't support it
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  const element = originalCreateElement(tagName);
  if (tagName === 'video') {
    (element as HTMLVideoElement).canPlayType = (mimeType: string) =>
      mimeType === 'video/mp4' ? 'probably' : '';
  }
  return element;
});

describe('native provider PiP state tracking', () => {
  let api: IPluginAPI;
  let container: HTMLElement;
  let state: Record<string, unknown>;
  let plugin: ReturnType<typeof createNativePlugin>;

  beforeEach(async () => {
    state = { playing: false, muted: false, volume: 1, poster: '' };
    container = document.createElement('div');
    document.body.appendChild(container);

    api = {
      pluginId: 'native-provider',
      container,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      getState: vi.fn((key: string) => state[key]),
      setState: vi.fn((key: string, value: unknown) => {
        state[key] = value;
      }),
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      emit: vi.fn(),
      getPlugin: vi.fn(),
      onDestroy: vi.fn(),
      subscribeToState: vi.fn(() => vi.fn()),
    } as unknown as IPluginAPI;

    // jsdom media element stubs: load resolves via loadedmetadata
    HTMLVideoElement.prototype.load = vi.fn().mockImplementation(function (
      this: HTMLVideoElement
    ) {
      setTimeout(() => {
        this.dispatchEvent(new Event('loadedmetadata'));
      }, 0);
    });
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLVideoElement.prototype.pause = vi.fn();

    // Safari's webkit presentation API, so the plugin wires its handler.
    // jsdom has none; the backing field is per element.
    Object.defineProperty(HTMLVideoElement.prototype, 'webkitPresentationMode', {
      get(this: { _presentationMode?: string }) {
        return this._presentationMode ?? 'inline';
      },
      set(this: { _presentationMode?: string }, mode: string) {
        this._presentationMode = mode;
      },
      configurable: true,
    });

    plugin = createNativePlugin();
    await plugin.init(api);
    await plugin.loadSource('http://example.com/video.mp4');
  });

  afterEach(async () => {
    await plugin.destroy?.();
    container.remove();
    delete (HTMLVideoElement.prototype as { webkitPresentationMode?: string }).webkitPresentationMode;
  });

  it('sets pip state on enterpictureinpicture', () => {
    const video = container.querySelector('video') as HTMLVideoElement;

    video.dispatchEvent(new Event('enterpictureinpicture'));

    expect(api.setState).toHaveBeenCalledWith('pip', true);
  });

  it('clears pip state and resumes playback on leavepictureinpicture', () => {
    const video = container.querySelector('video') as HTMLVideoElement;
    state.playing = true;

    video.dispatchEvent(new Event('leavepictureinpicture'));

    expect(api.setState).toHaveBeenCalledWith('pip', false);
    expect(HTMLVideoElement.prototype.play).toHaveBeenCalled();
  });

  it('does not resume playback when the viewer had paused', () => {
    const video = container.querySelector('video') as HTMLVideoElement;
    state.playing = false;

    video.dispatchEvent(new Event('leavepictureinpicture'));

    expect(api.setState).toHaveBeenCalledWith('pip', false);
    expect(HTMLVideoElement.prototype.play).not.toHaveBeenCalled();
  });

  /**
   * HEI-SCARLETT-25 D6: only leaving picture-in-picture resumes. Leaving AVKit
   * fullscreen also lands on `inline`, and used to restart a video the viewer
   * had paused.
   */
  describe('webkit presentation mode resume', () => {
    /**
     * Move the element to a presentation mode and fire the change event.
     *
     * @param mode - The new `webkitPresentationMode`
     */
    const changeMode = (mode: string): void => {
      const video = container.querySelector('video') as HTMLVideoElement & {
        webkitPresentationMode?: string;
      };
      video.webkitPresentationMode = mode;
      video.dispatchEvent(new Event('webkitpresentationmodechanged'));
    };

    beforeEach(() => {
      (HTMLVideoElement.prototype.play as ReturnType<typeof vi.fn>).mockClear();
    });

    it('resumes a paused element on picture-in-picture -> inline', () => {
      changeMode('picture-in-picture');
      expect(HTMLVideoElement.prototype.play).not.toHaveBeenCalled();

      changeMode('inline');

      expect(HTMLVideoElement.prototype.play).toHaveBeenCalledTimes(1);
      expect(api.setState).toHaveBeenLastCalledWith('pip', false);
    });

    it('keeps a paused element paused on fullscreen -> inline', () => {
      changeMode('fullscreen');
      changeMode('inline');

      expect(HTMLVideoElement.prototype.play).not.toHaveBeenCalled();
    });

    it('does nothing on inline -> inline', () => {
      changeMode('inline');

      expect(HTMLVideoElement.prototype.play).not.toHaveBeenCalled();
    });
  });
});
