import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHarness } from './harness';
let h: Awaited<ReturnType<typeof createHarness>>;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); });
afterEach(async () => { await h?.plugin.destroy(); vi.restoreAllMocks(); vi.useRealTimers(); });
const start = async () => { h = await createHarness({ heartbeatInterval: 1000 }); const v = h.attachVideo(false); h.play(false); h.advancePosition(1); return v; };
it('opens one progress rebuffer at two seconds and backdates duration and excludes frozen playTime', async () => {
  await start(); vi.advanceTimersByTime(1999); expect(h.sent('rebufferStart')).toHaveLength(0); vi.advanceTimersByTime(1);
  expect(h.sent('rebufferStart')).toHaveLength(1); expect(h.sent('rebufferStart')[0]).toMatchObject({ cause: 'progress', timestamp: 12000, rebufferCount: 1 });
  expect(h.plugin.getMetrics().playTime).toBe(0); vi.advanceTimersByTime(1000); h.advancePosition(2); vi.advanceTimersByTime(500);
  expect(h.sent('rebufferEnd')[0]).toMatchObject({ duration: 3500 }); expect(h.plugin.getMetrics().rebufferDuration).toBe(3500);
  // Playback keeps moving after the resume, as a real element's position does
  vi.advanceTimersByTime(250); h.advancePosition(2.5); vi.advanceTimersByTime(250); expect(h.sent('heartbeat').at(-1)?.playTime).toBe(500);
});
it('backdates to the latest actual advance rather than the initial frame', async () => {
  await start(); vi.advanceTimersByTime(500); h.advancePosition(2); vi.advanceTimersByTime(500); vi.advanceTimersByTime(2000);
  expect(h.sent('rebufferStart')).toHaveLength(1); h.advancePosition(3); vi.advanceTimersByTime(500);
  expect(h.sent('rebufferEnd')[0]?.duration).toBe(2500); expect(h.plugin.getMetrics().playTime).toBe(1000);
});
it.each(['paused', 'seeking', 'ended', 'hidden', 'before frame', 'viewEnd', 'zero rate'] as const)('does not monitor while %s', async gate => {
  h = await createHarness(); h.attachVideo(false); h.play(false); if (gate !== 'before frame') h.advancePosition(1);
  switch (gate) {
    case 'paused': h.state.set('paused', true); h.bus.emit('playback:pause', undefined); break;
    case 'seeking': h.elementSeek(20); break;
    case 'ended': h.state.set('ended', true); break;
    case 'hidden': vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange')); break;
    case 'viewEnd': window.dispatchEvent(new Event('pagehide')); break;
    case 'zero rate': h.state.set('playbackRate', 0); break;
  }
  vi.advanceTimersByTime(5000); expect(h.sent('rebufferStart')).toHaveLength(0);
});
it('waiting and reconnect take over without double-counting a progress rebuffer', async () => {
  await start(); vi.advanceTimersByTime(2000); h.bus.emit('media:waiting', undefined); h.bus.emit('error:reconnecting', { attempt: 1, delayMs: 1000, elapsedMs: 0 });
  vi.advanceTimersByTime(1000); expect(h.sent('rebufferStart')).toHaveLength(1); h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 1000 });
  expect(h.sent('rebufferEnd')).toHaveLength(1); expect(h.plugin.getMetrics()).toMatchObject({ rebufferCount: 1, rebufferDuration: 3000, reconnectCount: 1 });
});
it('does not close a progress rebuffer on playing without an advance', async () => {
  await start(); vi.advanceTimersByTime(2000); h.bus.emit('playback:play', undefined); vi.advanceTimersByTime(1000);
  expect(h.sent('rebufferEnd')).toHaveLength(0); expect(h.plugin.getMetrics().playTime).toBe(0);
});
it('resets the sampling baseline on visibility changes', async () => {
  await start(); vi.advanceTimersByTime(1500); vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(5000); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(1999); expect(h.sent('rebufferStart')).toHaveLength(0); vi.advanceTimersByTime(1); expect(h.sent('rebufferStart')).toHaveLength(1);
});
it('leaves no sampling timer after destroy', async () => {
  await start(); expect(vi.getTimerCount()).toBe(2); await h.plugin.destroy(); expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(5000); expect(h.sent('rebufferStart')).toHaveLength(0);
});
it('labels waiting and reconnect rebuffers by cause', async () => {
  h = await createHarness({ rebufferGraceMs: 0 }); h.play(); h.bus.emit('media:waiting', undefined); expect(h.sent('rebufferStart')[0]?.cause).toBe('waiting'); h.bus.emit('playback:play', undefined);
  h.bus.emit('error:reconnecting', { attempt: 1, delayMs: 1000, elapsedMs: 0 }); expect(h.sent('rebufferStart')[1]?.cause).toBe('reconnect');
});

import { createStallProgress } from '../src/stall-progress';
it('manual-clock detector opens once, closes on advance and resets across inactive periods', () => {
  let now = 0; let position: number | null = 1;
  const onStall = vi.fn(); const onResume = vi.fn();
  const detector = createStallProgress({ now: () => now, position: () => position, onStall, onResume });
  detector.sample(); now = 1999; detector.sample(); expect(onStall).not.toHaveBeenCalled();
  now = 2000; detector.sample(); now = 2500; detector.sample(); expect(onStall.mock.calls).toEqual([[0]]);
  position = 2; detector.sample(); expect(onResume).toHaveBeenCalledOnce();
  detector.reset(); now = 10000; detector.sample(); now = 11999; detector.sample(); expect(onStall).toHaveBeenCalledOnce();
  position = null; detector.sample(); position = 3; now = 20000; detector.sample(); expect(onStall).toHaveBeenCalledOnce();
});
it('manual-clock detector rebases backwards discontinuities without a resume signal', () => {
  let now = 0; let position = 10; const onResume = vi.fn(); const onStall = vi.fn();
  const detector = createStallProgress({ now: () => now, position: () => position, onStall, onResume });
  detector.sample(); now = 2000; detector.sample(); position = 9; detector.sample(); expect(onResume).not.toHaveBeenCalled();
  now = 3999; detector.sample(); expect(onStall).toHaveBeenCalledOnce();
});

it('retains one open progress episode across hidden and visible transitions', async () => {
  await start(); vi.advanceTimersByTime(2000);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(5000); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(2500); expect(h.sent('rebufferStart')).toHaveLength(1);
  h.advancePosition(2); vi.advanceTimersByTime(500); expect(h.sent('rebufferEnd')).toHaveLength(1);
  expect(h.plugin.getMetrics()).toMatchObject({ rebufferCount: 1, rebufferDuration: 10000, playTime: 0 });
});
it('does not reopen a progress episode on a backward position discontinuity', async () => {
  await start(); vi.advanceTimersByTime(2000); h.advancePosition(0.5); vi.advanceTimersByTime(2500);
  expect(h.sent('rebufferStart')).toHaveLength(1); h.advancePosition(1); vi.advanceTimersByTime(500); expect(h.sent('rebufferEnd')).toHaveLength(1);
});
it('rolls back DVR credit using the measured interval, including a mode change', async () => {
  h = await createHarness({ heartbeatInterval: 500, isLive: true }); h.attachVideo(false); h.play(false); h.advancePosition(1);
  vi.advanceTimersByTime(500); h.bus.emit('playback:seeking', { time: 1 }); h.state.set('liveEdge', false);
  vi.advanceTimersByTime(500); vi.advanceTimersByTime(2000);
  expect(h.plugin.getMetrics().playTime).toBe(500); expect(h.plugin.getMetrics().dvrTime).toBe(0);
});

it('never reports cumulative play credit that a later progress stall takes back, and never overlaps it with the rebuffer', async () => {
  h = await createHarness({ heartbeatInterval: 700, isLive: true }); h.attachVideo(false); h.play(false); h.advancePosition(1);
  // Normal playback: the element advances every sample
  for (let t = 1.5; t <= 4; t += 0.5) { vi.advanceTimersByTime(500); h.advancePosition(t); }
  // Then it freezes for long enough to confirm a stall, across several heartbeats, and resumes
  vi.advanceTimersByTime(4000); h.advancePosition(4.5); vi.advanceTimersByTime(1400);
  window.dispatchEvent(new Event('pagehide'));
  expect(h.sent('rebufferStart')).toHaveLength(1);
  const metrics = [...h.sent('heartbeat'), ...h.sent('viewEnd')];
  for (let i = 1; i < metrics.length; i++) {
    expect(metrics[i].playTime as number).toBeGreaterThanOrEqual(metrics[i - 1].playTime as number);
    expect(metrics[i].dvrTime as number).toBeGreaterThanOrEqual(metrics[i - 1].dvrTime as number);
  }
  for (const m of metrics) {
    expect((m.playTime as number) + (m.rebufferDuration as number) + (m.pauseDuration as number)).toBeLessThanOrEqual(m.watchTime as number);
  }
  // The stall keeps its full backdated duration: from the sample that first saw 4 (13500) to the one that saw 4.5 (17500)
  expect(h.sent('rebufferEnd')[0]?.duration).toBe(4000);
});
it('reports the full credit again once a short freeze resumes without becoming a stall', async () => {
  h = await createHarness({ heartbeatInterval: 1000 }); h.attachVideo(false); h.play(false); h.advancePosition(1);
  vi.advanceTimersByTime(1000); expect(h.sent('heartbeat').at(-1)?.playTime).toBe(0);
  // Playback resumes and keeps moving, as a real element's position does
  for (let t = 2; t <= 2.75; t += 0.25) { h.advancePosition(t); vi.advanceTimersByTime(250); }
  expect(h.sent('rebufferStart')).toHaveLength(0); expect(h.sent('heartbeat').at(-1)?.playTime).toBe(2000);
});

it('does not open a progress rebuffer while a Chromecast session owns playback', async () => {
  h = await createHarness({ heartbeatInterval: 1000 }); h.attachVideo(false); h.play(false); h.advancePosition(1);
  // Cast connects: the local element pauses, then the remote player's state is synced
  h.state.set('chromecastActive', true); h.state.set('playing', false); h.state.set('paused', true); h.bus.emit('playback:pause', undefined);
  // The viewer resumes through core: the remote plays, the local element stays paused and frozen
  h.bus.emit('playback:play', undefined); h.state.set('playing', true); h.state.set('paused', false);
  for (let t = 2; t <= 10; t++) { vi.advanceTimersByTime(1000); h.state.set('currentTime', t); }
  expect(h.sent('rebufferStart')).toHaveLength(0); expect(h.sent('heartbeat').at(-1)).toMatchObject({ rebufferCount: 0, playTime: 9000 });
  // Cast ends: local playback resumes and sampling with it
  h.state.set('chromecastActive', false); vi.advanceTimersByTime(2500); expect(h.sent('rebufferStart')).toHaveLength(1);
});
