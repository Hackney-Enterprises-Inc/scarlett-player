import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHarness } from './harness';
let h: Awaited<ReturnType<typeof createHarness>>;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); });
afterEach(async () => { await h?.plugin.destroy(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('waits for rVFC after play and playing in the same tick', async () => {
  h = await createHarness(); const v = h.attachVideo(); h.play(false);
  expect(h.sent('videoStart')).toHaveLength(0); vi.advanceTimersByTime(350);
  expect(h.plugin.getDiagnostics().metrics.playTime).toBe(0); v.frame();
  expect(h.sent('videoStart')[0]).toMatchObject({ firstFrameSource: 'rvfc', startupTime: 350 });
  vi.advanceTimersByTime(100); h.bus.emit('playback:ended', undefined);
  expect(h.plugin.getMetrics()).toMatchObject({ startupTime: 350, playTime: 100, watchTime: 450 });
});
it('confirms on an advancing timeupdate without rVFC and only once per view', async () => {
  h = await createHarness(); h.attachVideo(false); h.play(false); h.advancePosition(0); expect(h.sent('videoStart')).toHaveLength(0);
  vi.advanceTimersByTime(250); h.advancePosition(0.25); h.advancePosition(0.5);
  expect(h.sent('videoStart')).toHaveLength(1); expect(h.sent('videoStart')[0]).toMatchObject({ firstFrameSource: 'progress', startupTime: 250 });
});
it('uses progress if supported rVFC never fires, cancelling its handle', async () => {
  h = await createHarness(); const v = h.attachVideo(); h.play(false); h.advancePosition(1);
  expect(h.sent('videoStart')[0]?.firstFrameSource).toBe('progress'); expect(v.video.cancelVideoFrameCallback).toHaveBeenCalledOnce(); v.frame(); expect(h.sent('videoStart')).toHaveLength(1);
});
it('never sends videoStart or accrues playTime when the view never advances', async () => {
  h = await createHarness(); h.attachVideo(false); h.play(false); vi.advanceTimersByTime(5000); window.dispatchEvent(new Event('pagehide'));
  expect(h.sent('videoStart')).toHaveLength(0); expect(h.sent('viewEnd')[0]).toMatchObject({ startupTime: null, playTime: 0, rebufferCount: 0 });
});
it.each(['pause', 'player seek', 'element seek', 'viewEnd', 'new view', 'destroy'] as const)('cancels pending confirmation on %s and ignores stale callbacks', async action => {
  h = await createHarness(); const v = h.attachVideo(); h.play(false); const stale = [...v.callbacks.values()][0];
  switch (action) {
    case 'pause': h.state.set('paused', true); h.bus.emit('playback:pause', undefined); break;
    case 'player seek': h.bus.emit('playback:seeking', { time: 20 }); break;
    case 'element seek': h.elementSeek(20); break;
    case 'viewEnd': h.bus.emit('playback:ended', undefined); break;
    case 'new view': h.plugin.setVideo({ videoId: 'next' }); break;
    case 'destroy': await h.plugin.destroy(); break;
  }
  expect(v.video.cancelVideoFrameCallback).toHaveBeenCalledOnce(); stale(performance.now(), {} as VideoFrameCallbackMetadata);
  h.advancePosition(30); expect(h.sent('videoStart')).toHaveLength(0);
  // Providers flip `playing` on a pause but never on a seek: a seek re-arms when it ends.
  if (action === 'pause') { h.state.set('playing', false); h.play(false); v.frame(); expect(h.sent('videoStart')).toHaveLength(1); }
  if (action === 'element seek') { h.state.set('seeking', false); v.frame(); expect(h.sent('videoStart')).toHaveLength(1); }
  if (action === 'player seek') { h.bus.emit('playback:seeked', { time: 20 }); v.frame(); expect(h.sent('videoStart')).toHaveLength(1); }
  if (action.endsWith('seek')) expect(h.state.getValue('playing')).toBe(true);
});
it('records readyState and resume at the play request', async () => {
  h = await createHarness(); const v = h.attachVideo(); Object.defineProperty(v.video, 'readyState', { value: 3 }); v.video.currentTime = 45;
  h.state.set('currentTime', 45); h.play(false); expect(h.sent('playRequest')[0]).toMatchObject({ readyState: 3, resume: true });
});
it('a warm start confirms only after advancing past the request position', async () => {
  h = await createHarness(); const v = h.attachVideo(false); v.video.currentTime = 45; h.state.set('currentTime', 45); h.play(false);
  h.advancePosition(45); h.advancePosition(44); expect(h.sent('videoStart')).toHaveLength(0); h.advancePosition(45.1); expect(h.sent('videoStart')).toHaveLength(1);
});

// Analytics has no dependency on hls; load its event map from workspace source (see analytics.test.ts).
const hlsEventMap = '../../hls/src/event-map';
/** Mount the real HLS element handlers on the harness bus and state, with no rVFC. */
const mountHls = async () => {
  const { setupVideoEventHandlers } = await import(/* @vite-ignore */ hlsEventMap);
  const video = document.createElement('video'); h.api.container.append(video);
  setupVideoEventHandlers(video, h.api, undefined, { corePlayRequested: false, corePauseRequested: false });
  const fire = (type: string) => video.dispatchEvent(new Event(type));
  return { video, fire };
};
it('re-arms after an element seek that lands between playing and the first frame, without playing changing', async () => {
  h = await createHarness(); const { video, fire } = await mountHls(); video.currentTime = 45;
  fire('play'); fire('playing'); expect(h.state.getValue('playing')).toBe(true);
  vi.advanceTimersByTime(100); video.currentTime = 5; fire('seeking'); fire('seeked');
  vi.advanceTimersByTime(100); video.currentTime = 5.25; fire('timeupdate');
  expect(h.state.getValue('playing')).toBe(true);
  // Rebased to the post-seek position: 5.25 confirms though it is behind the 45 s request.
  expect(h.sent('videoStart')).toHaveLength(1); expect(h.sent('videoStart')[0]).toMatchObject({ firstFrameSource: 'progress', startupTime: 200 });
  vi.advanceTimersByTime(1000); h.bus.emit('playback:ended', undefined); expect(h.plugin.getMetrics().playTime).toBe(1000);
});
it('re-arms after a player seek ends while playing', async () => {
  h = await createHarness(); const v = h.attachVideo(); h.play(false);
  h.bus.emit('playback:seeking', { time: 20 }); h.elementSeek(20); h.state.set('seeking', false); h.bus.emit('playback:seeked', { time: 20 });
  v.frame(); expect(h.sent('videoStart')).toHaveLength(1); expect(h.sent('videoStart')[0]?.firstFrameSource).toBe('rvfc');
});
it('arms when a seek in flight at playing ends', async () => {
  h = await createHarness(); const v = h.attachVideo(); h.elementSeek(10); h.play(false); v.frame();
  expect(h.sent('videoStart')).toHaveLength(0); h.state.set('seeking', false); v.frame(); expect(h.sent('videoStart')).toHaveLength(1);
});
it('does not re-arm after a seek while paused, nor send a second start after the first frame', async () => {
  h = await createHarness(); const v = h.attachVideo(); h.play(false);
  h.state.set('paused', true); h.state.set('playing', false); h.bus.emit('playback:pause', undefined);
  h.elementSeek(30); h.state.set('seeking', false); h.bus.emit('playback:seeked', { time: 30 });
  expect(v.callbacks.size).toBe(0); h.advancePosition(31); expect(h.sent('videoStart')).toHaveLength(0);
  h.play(false); v.frame(); h.elementSeek(40); h.state.set('seeking', false); v.frame(); h.advancePosition(41);
  expect(h.sent('videoStart')).toHaveLength(1);
});
it('confirms a WHEP-shaped view from the element position when there is no rVFC and no bus timeupdate', async () => {
  h = await createHarness(); const v = h.attachVideo(false); h.play(false);
  vi.advanceTimersByTime(300); v.video.dispatchEvent(new Event('timeupdate')); expect(h.sent('videoStart')).toHaveLength(0);
  v.video.currentTime = 0.3; v.video.dispatchEvent(new Event('timeupdate'));
  expect(h.sent('videoStart')).toHaveLength(1); expect(h.sent('videoStart')[0]).toMatchObject({ firstFrameSource: 'progress', startupTime: 300 });
  v.video.currentTime = 0.6; v.video.dispatchEvent(new Event('timeupdate')); expect(h.sent('videoStart')).toHaveLength(1);
});
it('stops listening to the element once confirmation is cancelled', async () => {
  h = await createHarness(); const v = h.attachVideo(false); h.play(false); h.state.set('paused', true); h.bus.emit('playback:pause', undefined);
  v.video.currentTime = 1; v.video.dispatchEvent(new Event('timeupdate')); expect(h.sent('videoStart')).toHaveLength(0);
});
