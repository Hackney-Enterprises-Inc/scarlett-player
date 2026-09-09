/**
 * Playback event parity for the HLS provider.
 *
 * The UI's play controls call `video.play()` / `video.pause()` on the element
 * directly, so whether the bus ever hears about playback starting is entirely
 * down to the provider's element-event bridge. This provider had none: it wrote
 * state on `playing` and `pause` and emitted nothing, so on an HLS source
 * `playback:play` never fired for the whole session and every consumer of it -
 * the watermark (which is hidden until the first play), analytics,
 * media-session, the clips preview - was dark. Measured on the live demo
 * 2026-09-09: video playing, `.sp-watermark` still `visibility: hidden`.
 *
 * The other half is not emitting twice. `ScarlettPlayer.play()` and `.pause()`
 * put their event on the bus BEFORE this plugin touches the element, so the
 * element event that follows must be swallowed exactly once - the dedupe the
 * native provider has always had, here shared by both pipelines through one
 * gate object.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { createHLSPlugin } from '../src/index';
import { setupVideoEventHandlers, type PlaybackGate } from '../src/event-map';
import * as hlsLoader from '../src/hls-loader';
import {
  createCapturedHls,
  createMockAPI,
  createMockHlsConstructor,
  installMediaStubs,
  flush,
  type MockPluginAPI,
} from './helpers';

/**
 * Shadow the element's read-only `paused` getter.
 *
 * jsdom answers true for every element it ever creates, and both the command
 * guards and the interleaving cases turn on the answer.
 *
 * @param video - The element to shadow
 * @param value - What `paused` should report
 */
const setPaused = (video: HTMLVideoElement, value: boolean): void => {
  Object.defineProperty(video, 'paused', { value, configurable: true });
};

describe('setupVideoEventHandlers playback emission', () => {
  let video: HTMLVideoElement;
  let api: MockPluginAPI;
  let gate: PlaybackGate;

  const emits = (event: string): number =>
    api.emit.mock.calls.filter(([name]) => name === event).length;

  beforeEach(() => {
    video = document.createElement('video');
    api = createMockAPI();
    gate = { corePlayRequested: false, corePauseRequested: false };
  });

  it('emits playback:play once for an element-driven start', () => {
    setupVideoEventHandlers(video, api, undefined, gate);

    video.dispatchEvent(new Event('playing'));

    expect(emits('playback:play')).toBe(1);
  });

  it('swallows exactly one playing for a core play command', () => {
    setupVideoEventHandlers(video, api, undefined, gate);
    gate.corePlayRequested = true;

    video.dispatchEvent(new Event('playing'));
    expect(emits('playback:play')).toBe(0);
    expect(gate.corePlayRequested).toBe(false);

    // The next start is the viewer's own, and must be heard.
    video.dispatchEvent(new Event('playing'));
    expect(emits('playback:play')).toBe(1);
  });

  it('emits playback:pause once for an element-driven pause', () => {
    setupVideoEventHandlers(video, api, undefined, gate);

    video.dispatchEvent(new Event('pause'));

    expect(emits('playback:pause')).toBe(1);
  });

  it('swallows exactly one pause for a core pause command', () => {
    setupVideoEventHandlers(video, api, undefined, gate);
    gate.corePauseRequested = true;

    video.dispatchEvent(new Event('pause'));
    expect(emits('playback:pause')).toBe(0);
    expect(gate.corePauseRequested).toBe(false);

    video.dispatchEvent(new Event('pause'));
    expect(emits('playback:pause')).toBe(1);
  });

  it('cancels a pending core play when a pause arrives first', () => {
    setupVideoEventHandlers(video, api, undefined, gate);
    gate.corePlayRequested = true;

    // The play never reached `playing` - autoplay refused it, or the viewer
    // pressed pause during the buffering. The flag must not survive to swallow
    // the NEXT start.
    video.dispatchEvent(new Event('pause'));
    expect(emits('playback:pause')).toBe(1);
    expect(gate.corePlayRequested).toBe(false);

    video.dispatchEvent(new Event('playing'));
    expect(emits('playback:play')).toBe(1);
  });

  it('cancels a pending core pause once playback is running', () => {
    setupVideoEventHandlers(video, api, undefined, gate);
    gate.corePauseRequested = true;

    video.dispatchEvent(new Event('playing'));
    expect(gate.corePauseRequested).toBe(false);

    video.dispatchEvent(new Event('pause'));
    expect(emits('playback:pause')).toBe(1);
  });

  it('treats every transition as element-driven when no gate is supplied', () => {
    setupVideoEventHandlers(video, api);

    video.dispatchEvent(new Event('playing'));
    video.dispatchEvent(new Event('pause'));

    expect(emits('playback:play')).toBe(1);
    expect(emits('playback:pause')).toBe(1);
  });
});

/**
 * The same contract through the plugin, on both pipelines.
 *
 * Both `loadHlsJs()` and `loadNative()` call `setupVideoEventHandlers`, and a
 * gate passed to only one of them would leave the other double-emitting. These
 * run the whole path: the bus subscription sets the flag, the element event
 * consumes it.
 */
describe.each([
  { pipeline: 'hls.js', native: false },
  { pipeline: 'native HLS', native: true },
])('$pipeline pipeline playback events', ({ native }) => {
  let plugin: ReturnType<typeof createHLSPlugin>;
  let api: IPluginAPI;
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/stream.m3u8';

  const emits = (event: string): number =>
    (api.emit as Mock).mock.calls.filter(([name]) => name === event).length;

  /** The bus handler the plugin registered for one event. */
  const busHandler = (event: string): ((payload?: unknown) => unknown) =>
    (api.on as Mock).mock.calls.find(([name]) => name === event)?.[1];

  const getVideo = (): HTMLVideoElement =>
    (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();

    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(native);
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(!native);
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as never);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as never);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(
      () => createCapturedHls().instance as never
    );

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    api = createMockAPI();
    plugin = createHLSPlugin({ autoReconnect: false });
    await plugin.init(api);
    plugin.loadSource(SRC).catch(() => {});
    await flush();
    // The native path resolves its load on loadedmetadata; the handlers are
    // attached before that either way.
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    (api.emit as Mock).mockClear();
  });

  afterEach(async () => {
    await plugin.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is actually running the pipeline under test', () => {
    // Cheap, but the whole point of the parameterisation: if the branch
    // selection ever stops honouring these loader stubs, both legs would run
    // hls.js and the native call site would go uncovered in silence.
    expect((hlsLoader.createHlsInstance as Mock).mock.calls.length > 0).toBe(!native);
  });

  it('emits playback:play when the element starts on its own', () => {
    getVideo().dispatchEvent(new Event('playing'));

    expect(emits('playback:play')).toBe(1);
  });

  it('emits playback:play exactly once for a core play command', async () => {
    const video = getVideo();
    setPaused(video, true);
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);

    await busHandler('playback:play')?.();
    expect(play).toHaveBeenCalled();

    video.dispatchEvent(new Event('playing'));

    // Core already put its own on the bus; this path must add nothing.
    expect(emits('playback:play')).toBe(0);
  });

  it('emits playback:pause when the element pauses on its own', () => {
    getVideo().dispatchEvent(new Event('pause'));

    expect(emits('playback:pause')).toBe(1);
  });

  it('emits playback:pause exactly once for a core pause command', () => {
    const video = getVideo();
    setPaused(video, false);
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});

    busHandler('playback:pause')?.();
    expect(pause).toHaveBeenCalled();

    video.dispatchEvent(new Event('pause'));

    expect(emits('playback:pause')).toBe(0);
  });

  it('leaves no flag behind when a play command has nothing to do', async () => {
    const video = getVideo();
    // Already playing: the command is a no-op, fires no element event, and so
    // must not arm the dedupe - or the viewer's next real start goes silent.
    setPaused(video, false);
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);

    await busHandler('playback:play')?.();
    expect(play).not.toHaveBeenCalled();

    video.dispatchEvent(new Event('playing'));
    expect(emits('playback:play')).toBe(1);
  });

  it('leaves no flag behind when a pause command has nothing to do', () => {
    const video = getVideo();
    setPaused(video, true);
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});

    busHandler('playback:pause')?.();
    expect(pause).not.toHaveBeenCalled();

    video.dispatchEvent(new Event('pause'));
    expect(emits('playback:pause')).toBe(1);
  });

  it('clears a pending core play when the element pauses first', async () => {
    const video = getVideo();
    setPaused(video, true);
    vi.spyOn(video, 'play').mockResolvedValue(undefined);

    await busHandler('playback:play')?.();
    video.dispatchEvent(new Event('pause'));
    video.dispatchEvent(new Event('playing'));

    expect(emits('playback:pause')).toBe(1);
    expect(emits('playback:play')).toBe(1);
  });

  it('clears the flag when the play command is rejected', async () => {
    const video = getVideo();
    setPaused(video, true);
    vi.spyOn(video, 'play').mockRejectedValue(new Error('NotAllowedError'));

    await busHandler('playback:play')?.();

    // Autoplay was refused, so no `playing` came of it. A later start - the
    // viewer tapping play - is element-driven and must be heard.
    video.dispatchEvent(new Event('playing'));
    expect(emits('playback:play')).toBe(1);
  });
});
