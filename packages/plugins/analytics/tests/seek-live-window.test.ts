import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHarness } from './harness';
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it('includes a live window on player and element seeks', async () => {
  const h = await createHarness(); h.state.set('live', true); h.state.set('seekableRange', { start: 120, end: 600 });
  h.bus.emit('playback:seeking', { time: 150 }); expect(h.sent('seeking')[0]).toMatchObject({ seekableStart: 120, seekableEnd: 600 });
  vi.advanceTimersByTime(1100); h.elementSeek(200); expect(h.sent('seeking').at(-1)).toMatchObject({ seekableStart: 120, seekableEnd: 600 }); await h.plugin.destroy();
});
it('omits the window on VOD and after the hls.js ENDLIST reset', async () => {
  const h = await createHarness(); h.bus.emit('playback:seeking', { time: 5 }); expect(h.sent('seeking')[0]).not.toHaveProperty('seekableStart');
  h.state.set('live', true); h.state.set('seekableRange', { start: 120, end: 600 });
  h.state.set('live', false); h.state.set('seekableRange', null); h.bus.emit('media:loadedmetadata', { duration: 600 });
  vi.advanceTimersByTime(1100); h.bus.emit('playback:seeking', { time: 120 }); expect(h.sent('seeking').at(-1)).not.toHaveProperty('seekableStart'); expect(h.sent('seeking').at(-1)).not.toHaveProperty('seekableEnd'); await h.plugin.destroy();
});
