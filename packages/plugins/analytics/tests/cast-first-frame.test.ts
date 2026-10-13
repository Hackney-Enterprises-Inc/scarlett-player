import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHarness } from './harness';

/**
 * Casting before the first local frame (code review 2026-10-13, HEI-SCARLETT-63).
 *
 * While `chromecastActive` is true the local element stays paused, so neither
 * rVFC nor its timeupdate ever fires. The Chromecast plugin mirrors the
 * receiver into state in this order on every update: currentTime, duration,
 * playing, paused (`chromecast/src/index.ts`, the remote player sync).
 */
let h: Awaited<ReturnType<typeof createHarness>>;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); });
afterEach(async () => { await h?.plugin.destroy(); vi.restoreAllMocks(); vi.useRealTimers(); });

/** One receiver update, written the way the Chromecast plugin writes it. */
const receiver = (time: number, isPaused = false) => {
  h.state.set('currentTime', time);
  h.state.set('playing', !isPaused);
  h.state.set('paused', isPaused);
};

const startCasting = async () => {
  h = await createHarness({ heartbeatInterval: 1000 });
  h.attachVideo();
  h.state.set('chromecastActive', true);
  h.state.set('currentTime', 0);
};

it('confirms the first frame from advancing receiver progress when casting starts before any local frame', async () => {
  await startCasting();
  h.bus.emit('playback:play', undefined);
  for (let t = 1; t <= 10; t++) { vi.advanceTimersByTime(1000); receiver(t); }
  expect(h.sent('videoStart')).toHaveLength(1);
  expect(h.sent('videoStart')[0]).toMatchObject({ firstFrameSource: 'progress', startupTime: 1000 });
  window.dispatchEvent(new Event('pagehide'));
  expect(h.sent('viewEnd')[0]).toMatchObject({ startupTime: 1000, playTime: 9000 });
});

it('measures receiver progress from the receiver position, not the paused local element', async () => {
  await startCasting();
  h.state.set('currentTime', 300);
  h.bus.emit('playback:play', undefined);
  vi.advanceTimersByTime(1000); receiver(300);
  expect(h.sent('videoStart')).toHaveLength(0);
  vi.advanceTimersByTime(1000); receiver(301);
  expect(h.sent('videoStart')[0]).toMatchObject({ firstFrameSource: 'progress', startupTime: 2000 });
});

it('sends no videoStart while the receiver reports playing without advancing', async () => {
  await startCasting();
  h.bus.emit('playback:play', undefined);
  for (let t = 1; t <= 5; t++) { vi.advanceTimersByTime(1000); receiver(0); }
  window.dispatchEvent(new Event('pagehide'));
  expect(h.sent('videoStart')).toHaveLength(0);
  expect(h.sent('viewEnd')[0]).toMatchObject({ startupTime: null, playTime: 0 });
});

it('ignores state-only position writes during local playback', async () => {
  h = await createHarness();
  h.attachVideo(false);
  h.play(false);
  h.state.set('currentTime', 5);
  expect(h.sent('videoStart')).toHaveLength(0);
});

it('re-arms when paused turns false after playing is already true', async () => {
  h = await createHarness();
  h.attachVideo(false);
  // The play request comes first; the provider then reports playing before paused.
  h.bus.emit('playback:play', undefined);
  h.state.set('playing', true);
  h.state.set('paused', false);
  h.advancePosition(0.5);
  expect(h.sent('videoStart')).toHaveLength(1);
  expect(h.sent('videoStart')[0]?.firstFrameSource).toBe('progress');
});
