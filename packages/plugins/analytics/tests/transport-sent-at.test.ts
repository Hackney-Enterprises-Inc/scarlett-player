import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTransport } from '../src/transport';
import { createHarness } from './harness';
import type { AnalyticsConfig, BeaconPayload } from '../src/types';
const payload = () => ({ event: 'heartbeat', timestamp: Date.now() } as BeaconPayload);
const fetchMock = vi.fn().mockResolvedValue({});
const logger = { debug: vi.fn() };
const transport = (config: Partial<AnalyticsConfig> = {}, blocked = () => false) => createTransport({ beaconUrl: 'https://example.com', videoId: 'v', ...config }, logger, blocked);
const bodies = () => fetchMock.mock.calls.map((call) => JSON.parse(call[1].body));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); fetchMock.mockClear(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('stamps an unbatched body without changing timestamp', () => {
  transport().send(payload()); expect(bodies()[0]).toMatchObject({ timestamp: 10000, sentAt: 10000 });
});
it('stamps after async headers resolve two seconds later', async () => {
  transport({ headers: () => new Promise(resolve => setTimeout(() => resolve({}), 2000)) }).send(payload());
  await vi.advanceTimersByTimeAsync(2000); expect(bodies()[0]).toMatchObject({ timestamp: 10000, sentAt: 12000 });
});
it('stamps sendBeacon and restamps its fetch fallback after synchronous headers', () => {
  const beacon = vi.fn(() => false); vi.stubGlobal('navigator', { sendBeacon: beacon });
  transport({ headers: () => { vi.setSystemTime(12000); return {}; } }).sendUnload(payload());
  expect(beacon).toHaveBeenCalledOnce(); expect(bodies()[0]).toMatchObject({ timestamp: 10000, sentAt: 12000 });
});
it('stamps a successful sendBeacon body', async () => {
  let captured: Blob | undefined; vi.stubGlobal('navigator', { sendBeacon: (_url: string, body: Blob) => { captured = body; return true; } });
  transport().sendUnload(payload());
  vi.useRealTimers();
  const reader = new FileReader(); const read = new Promise(resolve => { reader.onload = () => resolve(JSON.parse(reader.result as string)); });
  reader.readAsText(captured!); expect(await read).toMatchObject({ timestamp: 10000, sentAt: 10000 }); expect(fetchMock).not.toHaveBeenCalled();
});
it('stamps a batch at dispatch after flush and header delay', async () => {
  transport({ batch: { intervalMs: 1000 }, headers: () => new Promise(resolve => setTimeout(() => resolve({}), 2000)) }).send(payload());
  await vi.advanceTimersByTimeAsync(3000); expect(bodies()[0]).toMatchObject({ sentAt: 13000, events: [{ timestamp: 10000 }] });
});
it('still splits batches before 60000 bytes', () => {
  const t = transport({ batch: true }); t.send({ ...payload(), padding: 'x'.repeat(35000) }); t.send({ ...payload(), padding: 'x'.repeat(35000) }); t.flush();
  expect(bodies()).toHaveLength(2); for (const b of bodies()) expect(new TextEncoder().encode(JSON.stringify(b)).length).toBeLessThanOrEqual(60000);
});
it('leaves customBeacon untouched and drops opted-out sends', () => {
  const customBeacon = vi.fn(); const p = payload(); transport({ customBeacon }).send(p); expect(customBeacon.mock.calls[0][1]).toBe(p); expect(p).not.toHaveProperty('sentAt');
  transport({}, () => true).send(p); expect(fetchMock).not.toHaveBeenCalled();
});
it('adds sentAt after beforeSend even when the hook tries to remove it', async () => {
  const beforeSend = vi.fn(p => { expect(p).not.toHaveProperty('sentAt'); delete p.sentAt; return p; });
  const h = await createHarness({ customBeacon: undefined, beforeSend });
  expect(bodies()[0]).toMatchObject({ timestamp: 10000, sentAt: 10000 }); await h.plugin.destroy();
});
it('strips a hook or custom-dimension sentAt from every event, so batched events cannot disagree with the envelope', async () => {
  const seen: unknown[] = [];
  const beforeSend = vi.fn((p: BeaconPayload) => { seen.push(p.sentAt); return { ...p, sentAt: -1 }; });
  const h = await createHarness({ customBeacon: undefined, batch: true, beforeSend, customDimensions: { sentAt: 5 } });
  h.play(); await h.plugin.destroy();
  expect(seen.every((value) => value === undefined)).toBe(true);
  const posts = bodies(); expect(posts.length).toBeGreaterThan(0);
  for (const post of posts) {
    expect(post).toMatchObject({ batch: 1, sentAt: 10000 });
    for (const event of post.events) expect(event).not.toHaveProperty('sentAt');
  }
});
it('gives customBeacon the same stripped payload', async () => {
  const customBeacon = vi.fn();
  const h = await createHarness({ customBeacon, beforeSend: (p) => ({ ...p, sentAt: -1 }), customDimensions: { sentAt: 5 } });
  await h.plugin.destroy();
  expect(customBeacon).toHaveBeenCalled(); for (const [, p] of customBeacon.mock.calls) expect(p).not.toHaveProperty('sentAt');
});
it.each(['throws', 'returns nothing'] as const)('strips a sentAt the hook wrote in place when it then %s, in batches and for customBeacon', async (ending) => {
  const beforeSend = (p: BeaconPayload) => { p.sentAt = -1; if (ending === 'throws') throw new Error('host failure'); return undefined as unknown as BeaconPayload; };
  const h = await createHarness({ customBeacon: undefined, batch: { maxEvents: 1 }, beforeSend });
  await h.plugin.destroy();
  const posts = bodies(); expect(posts.length).toBeGreaterThan(0);
  for (const post of posts) { expect(post).toMatchObject({ batch: 1, sentAt: 10000 }); for (const event of post.events) expect(event).not.toHaveProperty('sentAt'); }
  const customBeacon = vi.fn();
  const c = await createHarness({ customBeacon, beforeSend }); await c.plugin.destroy();
  expect(customBeacon).toHaveBeenCalled(); for (const [, p] of customBeacon.mock.calls) expect(p).not.toHaveProperty('sentAt');
});
