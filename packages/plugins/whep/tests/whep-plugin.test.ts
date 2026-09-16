/**
 * Tests for the WHEP provider plugin: the offer round trip, session handling,
 * the error table, the reconnect scheduler, the latency estimate, and
 * teardown. WebRTC and fetch are the fakes in ./fakes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCode } from '@scarlett-player/core';
import { createWHEPPlugin, DEFAULT_WHEP_CONFIG, type IWHEPPlugin, type WHEPPluginConfig } from '../src/index';
import {
  FakePeerConnection,
  answer,
  createMockApi,
  envelope,
  installBrowserFakes,
  installFetch,
  reply,
  type MockPluginApi,
} from './fakes';

const SRC = 'https://origin.example.com:8889/whep/v1/streams/show-1?x=1';
const SESSION = 'https://origin.example.com:8889/whep/v1/streams/show-1/sessions/abc';

/** Run due timers and the microtasks between them. */
const settle = (ms = 1) => vi.advanceTimersByTimeAsync(ms);

/** Every plugin and API a case built, torn down after it. */
const built: Array<{ plugin: IWHEPPlugin; api: MockPluginApi }> = [];

/** A plugin, initialised against a fresh mock API. */
async function setup(config?: WHEPPluginConfig): Promise<{ plugin: IWHEPPlugin; api: MockPluginApi }> {
  const plugin = createWHEPPlugin(config);
  const api = createMockApi();
  await plugin.init(api);
  built.push({ plugin, api });
  return { plugin, api };
}

/**
 * Start a load and let it run to its first outcome.
 *
 * Returns the load promise inside an object on purpose: an async function
 * that returned it directly would flatten it, and the caller would await
 * the load itself.
 */
async function load(plugin: IWHEPPlugin, src = SRC): Promise<{ loading: Promise<void> }> {
  const loading = plugin.loadSource(src);
  loading.catch(() => {});
  await settle();
  return { loading };
}

/** The fatal `error` payloads emitted. */
const fatalErrors = (api: MockPluginApi) =>
  api.emitted('error').filter((payload) => (payload as { fatal: boolean }).fatal) as Array<{
    code: ErrorCode;
    message: string;
    detail?: Record<string, unknown>;
  }>;

beforeEach(() => {
  vi.useFakeTimers();
  installBrowserFakes();
  vi.spyOn(Math, 'random').mockReturnValue(1);
});

afterEach(async () => {
  // Tear every plugin down so no session, timer, or window listener from
  // one case reaches the next.
  for (const { plugin, api } of built.splice(0)) {
    await plugin.destroy();
    api.runDestroy();
  }
  await settle();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('createWHEPPlugin', () => {
  it('creates a provider plugin with the expected metadata', () => {
    const plugin = createWHEPPlugin();
    expect(plugin.id).toBe('whep-provider');
    expect(plugin.name).toBe('WHEP Provider');
    expect(plugin.type).toBe('provider');
    expect(plugin.description).toContain('WHEP');
    expect(typeof plugin.canPlay).toBe('function');
    expect(typeof plugin.loadSource).toBe('function');
    expect(typeof plugin.getSessionUrl).toBe('function');
  });

  it('exposes the documented defaults', () => {
    expect(DEFAULT_WHEP_CONFIG).toEqual({
      autoReconnect: true,
      reconnectBaseDelayMs: 2000,
      reconnectMaxDelayMs: 30000,
      reconnectWindowMs: 300000,
      loadTimeoutMs: 10000,
    });
  });
});

describe('canPlay', () => {
  const plugin = createWHEPPlugin();

  it('claims a URL with a whep path segment: Tmesis, MediaMTX, the draft examples', () => {
    expect(plugin.canPlay('https://box.example.com:8889/whep/v1/streams/show-1')).toBe(true);
    expect(plugin.canPlay('http://10.0.0.5:8889/whep/v1/streams/a?token=x')).toBe(true);
    expect(plugin.canPlay('/whep/v1/streams/relative')).toBe(true);
    expect(plugin.canPlay('http://localhost:8889/mystream/whep')).toBe(true);
    expect(plugin.canPlay('http://localhost:8889/mystream/whep/')).toBe(true);
    expect(plugin.canPlay('https://whep.example.com/whep/endpoint-1')).toBe(true);
    expect(plugin.canPlay('https://example.com/WHEP/x')).toBe(true);
  });

  it('leaves everything else to other providers', () => {
    expect(plugin.canPlay('https://cdn.example.com/live/show-1/index.m3u8')).toBe(false);
    expect(plugin.canPlay('https://example.com/video.mp4')).toBe(false);
    expect(plugin.canPlay('https://example.com/other?next=/whep/v1/streams/x')).toBe(false);
    // The letters inside a longer segment, or the host name alone, are not it.
    expect(plugin.canPlay('https://example.com/whepish/stream.m3u8')).toBe(false);
    expect(plugin.canPlay('https://example.com/my-whep-stream.mp4')).toBe(false);
    expect(plugin.canPlay('https://whep.example.com/stream.m3u8')).toBe(false);
  });
});

describe('loadSource', () => {
  it('offers, posts, applies the answer, and attaches the tracks', async () => {
    const fetchMock = installFetch([answer()]);
    const { plugin, api } = await setup();

    const { loading } = await load(plugin);
    await expect(loading).resolves.toBeUndefined();

    // The peer connection: two receive-only transceivers, no ICE servers.
    const pc = FakePeerConnection.instances[0];
    expect(pc.config).toEqual({ iceServers: [] });
    expect(pc.transceivers).toEqual([
      { kind: 'video', init: { direction: 'recvonly' } },
      { kind: 'audio', init: { direction: 'recvonly' } },
    ]);

    // The POST: the local SDP as application/sdp, no Authorization.
    const [url, init] = fetchMock.posts()[0];
    expect(url).toBe(SRC);
    expect(init?.headers).toEqual({ 'Content-Type': 'application/sdp' });
    expect(init?.body).toBe(pc.localDescription?.sdp);

    // The answer applied, the session remembered as an absolute URL.
    expect(pc.remoteDescription?.type).toBe('answer');
    expect(pc.remoteDescription?.sdp).toContain('a=sendonly');
    expect(plugin.getSessionUrl()).toBe(SESSION);

    // The element, created the way the native provider creates its own.
    const video = api.container.querySelector('video') as HTMLVideoElement & { srcObject: unknown };
    expect(video).not.toBeNull();
    expect(video.playsInline).toBe(true);
    expect(video.controls).toBe(false);
    expect(video.style.position).toBe('absolute');
    expect(video.style.objectFit).toBe('contain');
    expect(video.srcObject).toBeInstanceOf(MediaStream);
    expect((video.srcObject as MediaStream).getTracks().map((t) => t.kind)).toEqual(['video', 'audio']);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // The state a live source with no DVR carries.
    expect(api.state.get('live')).toBe(true);
    expect(api.state.get('liveEdge')).toBe(true);
    expect(api.state.get('seekableRange')).toBeNull();
    expect(api.state.get('lowLatencyMode')).toBe(true);
    expect(api.state.get('mediaType')).toBe('video');
    expect(api.state.get('duration')).toBe(0);
    expect(api.state.get('source')).toEqual({ src: SRC, type: 'application/sdp' });
    // The element reported `playing` from the mocked play() before the
    // connection state settled, and `ready` must not regress it.
    expect(api.written('playbackState')).toEqual(['loading', 'playing']);
    expect(api.emitted('media:loaded')).toEqual([{ src: SRC, type: 'application/sdp' }]);
    expect(api.emitted('live:lowlatency')).toEqual([{ enabled: true }]);
    expect(fatalErrors(api)).toEqual([]);
  });

  it('attaches a video-only answer through the same path', async () => {
    installFetch([answer()]);
    FakePeerConnection.options.tracks = ['video'];
    const { plugin, api } = await setup();

    await expect((await load(plugin)).loading).resolves.toBeUndefined();

    const video = api.container.querySelector('video') as HTMLVideoElement & { srcObject: MediaStream };
    expect(video.srcObject.getTracks().map((t) => t.kind)).toEqual(['video']);
  });

  it('sends a configured bearer token and the ICE servers', async () => {
    const fetchMock = installFetch([answer()]);
    const iceServers = [{ urls: 'stun:stun.example.com' }];
    const { plugin } = await setup({ token: 'secret', iceServers });

    await load(plugin);

    expect(fetchMock.posts()[0][1]?.headers).toEqual({
      'Content-Type': 'application/sdp',
      Authorization: 'Bearer secret',
    });
    expect(FakePeerConnection.instances[0].config).toEqual({ iceServers });
  });

  it('asks the token provider before every request and sends nothing for null', async () => {
    const fetchMock = installFetch([answer()]);
    const tokenProvider = vi.fn().mockResolvedValueOnce(null).mockResolvedValue('fresh');
    const { plugin } = await setup({ token: 'ignored', tokenProvider });

    await load(plugin);
    expect(fetchMock.posts()[0][1]?.headers).toEqual({ 'Content-Type': 'application/sdp' });

    await plugin.destroy();
    await settle();
    // The DELETE asked again and got the refreshed token.
    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(fetchMock.deletes()[0][1]?.headers).toEqual({ Authorization: 'Bearer fresh' });
  });

  it('posts the offer after one second when gathering never completes', async () => {
    const fetchMock = installFetch([answer()]);
    FakePeerConnection.options.gathers = false;
    const { plugin } = await setup();

    const { loading } = await load(plugin);
    expect(fetchMock.posts()).toHaveLength(0);

    await settle(1000);
    expect(fetchMock.posts()).toHaveLength(1);
    await expect(loading).resolves.toBeUndefined();
  });

  it('keeps the session when the server sends no Location', async () => {
    const fetchMock = installFetch([reply(201, 'v=0\r\n', { 'Content-Type': 'application/sdp' })]);
    const { plugin } = await setup();

    await expect((await load(plugin)).loading).resolves.toBeUndefined();
    expect(plugin.getSessionUrl()).toBeNull();

    await plugin.destroy();
    await settle();
    expect(fetchMock.deletes()).toHaveLength(0);
  });

  it('ignores a Location on another origin, so the token never travels there', async () => {
    const fetchMock = installFetch([answer('https://elsewhere.example.net/whep/sessions/abc')]);
    const { plugin } = await setup({ token: 'secret' });

    await expect((await load(plugin)).loading).resolves.toBeUndefined();
    expect(plugin.getSessionUrl()).toBeNull();

    await plugin.destroy();
    await settle();
    expect(fetchMock.deletes()).toHaveLength(0);
  });

  it('rejects and closes the first connection when a newer load supersedes it', async () => {
    installFetch([answer(), answer('/whep/v1/streams/show-2/sessions/def')]);
    FakePeerConnection.options.outcome = 'never';
    const { plugin } = await setup();

    const first = plugin.loadSource(SRC);
    first.catch(() => {});
    await settle();
    FakePeerConnection.options.outcome = 'connected';
    const { loading: second } = await load(plugin, 'https://origin.example.com:8889/whep/v1/streams/show-2');

    await expect(first).rejects.toThrow(/superseded/);
    await expect(second).resolves.toBeUndefined();
    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(FakePeerConnection.instances[1].closed).toBe(false);
    expect(plugin.getSessionUrl()).toContain('show-2');
  });

  it('throws when not initialised', async () => {
    const plugin = createWHEPPlugin();
    await expect(plugin.loadSource(SRC)).rejects.toThrow('Plugin not initialized');
  });
});

describe('the error table', () => {
  const terminal: Array<[string, () => Response, ErrorCode, RegExp]> = [
    ['400 bad_request', () => envelope(400, 'bad_request', 'the offer is not an SDP'), ErrorCode.SOURCE_LOAD_FAILED, /rejected the offer \(400\)/],
    ['401', () => reply(401, ''), ErrorCode.SOURCE_LOAD_FAILED, /refused the token \(401\)/],
    ['403', () => reply(403, ''), ErrorCode.SOURCE_LOAD_FAILED, /refused the token \(403\)/],
    ['404 not_found', () => envelope(404, 'not_found', 'no such stream on this node'), ErrorCode.SOURCE_LOAD_FAILED, /not found \(404\)/],
    ['405', () => envelope(405, 'method_not_allowed', 'nope'), ErrorCode.SOURCE_LOAD_FAILED, /\(405\)/],
    ['406 unsupported_media', () => envelope(406, 'unsupported_media', 'neither H.264 nor Opus'), ErrorCode.SOURCE_LOAD_FAILED, /cannot serve a codec/],
    ['406 counter-offer', () => reply(406, 'v=0\r\n', { 'Content-Type': 'application/sdp' }), ErrorCode.SOURCE_LOAD_FAILED, /counter-offer/],
    ['413', () => envelope(413, 'payload_too_large', 'too big'), ErrorCode.SOURCE_LOAD_FAILED, /\(413\)/],
    ['415', () => envelope(415, 'unsupported_media_type', 'a WHEP offer is application/sdp'), ErrorCode.SOURCE_LOAD_FAILED, /\(415\)/],
  ];

  for (const [name, response, code, message] of terminal) {
    it(`${name} is terminal: fatal error, no reconnect, load rejects`, async () => {
      const fetchMock = installFetch([response]);
      const { plugin, api } = await setup();

      const { loading } = await load(plugin);
      await expect(loading).rejects.toThrow(message);

      const errors = fatalErrors(api);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(code);
      expect(errors[0].detail?.httpStatus).toBe(Number(name.slice(0, 3)));
      expect(errors[0].detail?.url).toBe('https://origin.example.com:8889/whep/v1/streams/show-1');
      expect(api.state.get('playbackState')).toBe('error');
      expect(api.emitted('error:reconnecting')).toEqual([]);

      await settle(60000);
      expect(fetchMock.posts()).toHaveLength(1);
      expect(FakePeerConnection.instances[0].closed).toBe(true);
    });
  }

  it('401 reports a network failure class so a host can tell it from a missing stream', async () => {
    installFetch([reply(401, '')]);
    const { plugin, api } = await setup();
    await load(plugin);
    expect(fatalErrors(api)[0].detail?.type).toBe('network');
    expect(fatalErrors(api)[0].detail?.httpStatus).toBe(401);
  });

  it('406 reports a media failure class', async () => {
    installFetch([envelope(406, 'unsupported_media', 'x')]);
    const { plugin, api } = await setup();
    await load(plugin);
    expect(fatalErrors(api)[0].detail?.type).toBe('media');
  });

  const recoverable: Array<[string, () => Response, number]> = [
    ['409 not_live', () => envelope(409, 'not_live', 'no preview media yet', '5'), 5000],
    ['503 max_monitors', () => envelope(503, 'max_monitors', 'at the monitor cap', '30'), 30000],
    ['503 preview_disabled', () => envelope(503, 'preview_disabled', 'the preview is off', '30'), 30000],
    ['500 without Retry-After', () => envelope(500, 'internal', 'the answer could not be built'), 2000],
  ];

  for (const [name, response, delayMs] of recoverable) {
    it(`${name} is recoverable: MEDIA_NETWORK_ERROR, reconnect at ${delayMs}ms`, async () => {
      const fetchMock = installFetch([response, response, answer()]);
      const { plugin, api } = await setup();

      const { loading } = await load(plugin);

      const errors = fatalErrors(api);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
      expect(api.emitted('error:reconnecting')).toEqual([
        { attempt: 1, delayMs, elapsedMs: 0, windowMs: 300000 },
      ]);

      // The timer was set during load()'s first tick, so it is due one
      // tick before delayMs has passed from here.
      await settle(delayMs - 2);
      expect(fetchMock.posts()).toHaveLength(1);
      await settle(2);
      expect(fetchMock.posts()).toHaveLength(2);

      // The second failure inside the window emits no second fatal error.
      expect(fatalErrors(api)).toHaveLength(1);
      expect(api.emitted('error:reconnecting')).toHaveLength(2);

      // The second delay doubles, capped at reconnectMaxDelayMs.
      const second = Math.min(delayMs * 2, 30000);
      await settle(second);
      expect(fetchMock.posts()).toHaveLength(3);
      await expect(loading).resolves.toBeUndefined();
      const [recovered] = api.emitted('error:recovered') as Array<{ attempt: number; elapsedMs: number }>;
      expect(recovered.attempt).toBe(2);
      expect(recovered.elapsedMs).toBeGreaterThanOrEqual(delayMs + second);
      expect(recovered.elapsedMs).toBeLessThan(delayMs + second + 10);
      expect(api.state.get('playbackState')).toBe('playing');
    });
  }

  it('a failed request is recoverable', async () => {
    installFetch([() => { throw new TypeError('Failed to fetch'); }, answer()]);
    const { plugin, api } = await setup();

    const { loading } = await load(plugin);
    expect(fatalErrors(api)[0].code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
    expect(fatalErrors(api)[0].message).toContain('Failed to fetch');

    await settle(2000);
    await expect(loading).resolves.toBeUndefined();
  });

  it('an answer the browser cannot apply is recoverable', async () => {
    installFetch([answer()]);
    FakePeerConnection.options.rejectAnswer = true;
    const { plugin, api } = await setup();

    await load(plugin);
    expect(fatalErrors(api)[0].code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
    expect(fatalErrors(api)[0].message).toContain('could not be applied');
    expect(api.emitted('error:reconnecting')).toHaveLength(1);
  });

  it('a Retry-After never shrinks below what the server asked for', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5')]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { plugin, api } = await setup();
    await load(plugin);
    expect(api.emitted('error:reconnecting')[0]).toMatchObject({ delayMs: 5000 });
  });

  it('doubles from the Retry-After and holds at the cap', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5')]);
    const { plugin, api } = await setup();
    await load(plugin);

    const delays = async () => (api.emitted('error:reconnecting') as Array<{ delayMs: number }>).map((e) => e.delayMs);
    await settle(5000);
    await settle(10000);
    await settle(20000);
    await settle(30000);
    expect(await delays()).toEqual([5000, 10000, 20000, 30000, 30000]);
  });

  it('a terminal answer inside a reconnect window ends it with a fatal error', async () => {
    const fetchMock = installFetch([envelope(409, 'not_live', 'x', '5'), envelope(404, 'not_found', 'gone')]);
    const { plugin, api } = await setup();

    const { loading } = await load(plugin);
    expect(fatalErrors(api)).toHaveLength(1);
    await settle(5000);

    // The 404 is reported even though the window was open, so the overlay's
    // "reconnecting" comes down; nothing further is scheduled.
    expect(fatalErrors(api)).toHaveLength(2);
    expect(fatalErrors(api)[1].code).toBe(ErrorCode.SOURCE_LOAD_FAILED);
    await expect(loading).rejects.toThrow(/not found/);
    await settle(60000);
    expect(fetchMock.posts()).toHaveLength(2);
    expect(api.emitted('error:reconnecting')).toHaveLength(1);
  });

  it('a 404 after the stream had played is the publisher leaving: recoverable, then recovers', async () => {
    // MediaMTX answers a path with no publisher with 404 (Tmesis: 409), so a
    // stream that played and then lost its publisher must wait it out.
    const gone = () => reply(404, '{"status":"error","error":"no stream is available on path \'live\'"}', { 'Content-Type': 'application/json' });
    const fetchMock = installFetch([answer(), gone, gone, answer('/whep/v1/streams/show-1/sessions/again')]);
    const { plugin, api } = await setup();
    await load(plugin);

    FakePeerConnection.instances[0].setConnectionState('failed');
    await settle();
    expect(api.emitted('error:reconnecting')).toHaveLength(1);

    await settle(2000); // attempt 1: 404
    expect(fetchMock.posts()).toHaveLength(2);
    expect(api.emitted('error:reconnecting')).toHaveLength(2);
    // The 404 is reported quietly inside the window, not as a fatal error.
    expect(fatalErrors(api)).toHaveLength(1);
    expect(api.logger.warn).toHaveBeenCalledWith(expect.stringContaining("no stream is available on path 'live'"));

    await settle(4000); // attempt 2: 404 again
    await settle(8000); // attempt 3: back
    expect(fetchMock.posts()).toHaveLength(4);
    expect(api.emitted('error:recovered')).toHaveLength(1);
    expect(plugin.getSessionUrl()).toContain('/sessions/again');
  });

  it('a 404 on the first join stays terminal even if an earlier source had played', async () => {
    installFetch([answer(), envelope(404, 'not_found', 'no such stream')]);
    const { plugin, api } = await setup();
    await load(plugin);

    const { loading } = await load(plugin, 'https://origin.example.com:8889/whep/v1/streams/other');
    await expect(loading).rejects.toThrow(/not found/);
    expect(api.emitted('error:reconnecting')).toEqual([]);
  });

  it('autoReconnect: false makes a recoverable failure terminal', async () => {
    const fetchMock = installFetch([envelope(409, 'not_live', 'x', '5')]);
    const { plugin, api } = await setup({ autoReconnect: false });

    const { loading } = await load(plugin);
    await expect(loading).rejects.toThrow(/not live/);
    expect(api.emitted('error:reconnecting')).toEqual([]);
    await settle(10000);
    expect(fetchMock.posts()).toHaveLength(1);
  });
});

describe('the reconnect window', () => {
  it('gives up when the window closes: exhausted event, final fatal error, load rejects', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5')]);
    const { plugin, api } = await setup({ reconnectWindowMs: 12000 });

    const { loading } = await load(plugin);
    await settle(5000); // attempt 1 at 5 s
    await settle(10000); // attempt 2 at 15 s: past the window when it schedules again

    const [exhausted] = api.emitted('error:reconnect-exhausted') as Array<{ attempts: number; elapsedMs: number; windowMs: number }>;
    expect(exhausted).toMatchObject({ attempts: 2, windowMs: 12000 });
    expect(exhausted.elapsedMs).toBeGreaterThanOrEqual(15000);
    const errors = fatalErrors(api);
    expect(errors).toHaveLength(2);
    expect(errors[1].code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
    expect(errors[1].message).toContain('gave up after 2 attempts');
    expect(errors[1].detail).toMatchObject({ reconnectExhausted: true, retriesExhausted: true, attempts: 2, httpStatus: 409 });
    await expect(loading).rejects.toThrow(/gave up/);
    expect(api.state.get('playbackState')).toBe('error');
  });

  it('flags a long outage past ten minutes with an infinite window', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5')]);
    const { plugin, api } = await setup({ reconnectWindowMs: Infinity });

    await load(plugin);
    await settle(LONG_ENOUGH);

    const events = api.emitted('error:reconnecting') as Array<{ longOutage?: boolean }>;
    expect(events.length).toBeGreaterThan(20);
    expect(events[events.length - 1].longOutage).toBe(true);
    expect(api.emitted('error:reconnect-exhausted')).toEqual([]);
  });
});

/** Ten minutes of 30 s polls, plus the ramp. */
const LONG_ENOUGH = 660000;

describe('a lost connection', () => {
  it('reconnects after the connection fails, freeing the dead session first', async () => {
    const fetchMock = installFetch([answer(), answer('/whep/v1/streams/show-1/sessions/second')]);
    const { plugin, api } = await setup();
    await load(plugin);

    const first = FakePeerConnection.instances[0];
    first.setConnectionState('failed');
    await settle();

    expect(first.closed).toBe(true);
    const [deleteUrl, deleteInit] = fetchMock.deletes()[0];
    expect(deleteUrl).toBe(SESSION);
    expect(deleteInit?.keepalive).toBe(true);
    expect(fatalErrors(api)[0].code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
    expect(fatalErrors(api)[0].message).toContain('connection lost');
    expect(api.state.get('playbackState')).toBe('error');
    expect(api.emitted('error:reconnecting')).toEqual([{ attempt: 1, delayMs: 2000, elapsedMs: 0, windowMs: 300000 }]);

    await settle(2000);
    expect(FakePeerConnection.instances).toHaveLength(2);
    expect(plugin.getSessionUrl()).toContain('/sessions/second');
    expect(api.emitted('error:recovered')).toEqual([{ attempt: 1, elapsedMs: expect.any(Number) }]);
  });

  it('tolerates a disconnected state that recovers inside the grace period', async () => {
    installFetch([answer()]);
    const { plugin, api } = await setup();
    await load(plugin);

    const pc = FakePeerConnection.instances[0];
    pc.setConnectionState('disconnected');
    await settle(3000);
    expect(api.state.get('buffering')).toBe(true);
    pc.setConnectionState('connected');
    await settle(5000);

    expect(fatalErrors(api)).toEqual([]);
    expect(FakePeerConnection.instances).toHaveLength(1);
    expect(pc.closed).toBe(false);
    // A MediaStream element fires no canplay for a hiccup it never saw, so
    // the buffering the disconnect raised must come down with the recovery.
    expect(api.state.get('buffering')).toBe(false);
  });

  it('treats a disconnected state past the grace period as lost', async () => {
    installFetch([answer(), answer()]);
    const { plugin, api } = await setup();
    await load(plugin);

    FakePeerConnection.instances[0].setConnectionState('disconnected');
    await settle(5001);

    expect(fatalErrors(api)[0].message).toContain('disconnected');
    expect(api.emitted('error:reconnecting')).toHaveLength(1);
  });

  it('gives up on a join that never connects at loadTimeoutMs', async () => {
    const fetchMock = installFetch([answer(), answer()]);
    FakePeerConnection.options.outcome = 'never';
    const { plugin, api } = await setup({ loadTimeoutMs: 4000 });

    await load(plugin);
    await settle(3998);
    expect(fatalErrors(api)).toEqual([]);
    await settle(2);

    expect(fatalErrors(api)[0].code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
    expect(fatalErrors(api)[0].message).toContain('timed out');
    expect(FakePeerConnection.instances[0].closed).toBe(true);
    // The half-made session is freed.
    expect(fetchMock.deletes().map(([url]) => url)).toEqual([SESSION]);
    expect(api.emitted('error:reconnecting')).toHaveLength(1);
  });
});

describe('the latency estimate', () => {
  it('polls getStats once a second and reports jitter buffer plus half the RTT', async () => {
    installFetch([answer()]);
    FakePeerConnection.options.stats = [
      { id: 'in-v', type: 'inbound-rtp', kind: 'video', jitterBufferDelay: 3, jitterBufferEmittedCount: 60 },
      { id: 't', type: 'transport', selectedCandidatePairId: 'pair-b' },
      { id: 'pair-a', type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.5 },
      { id: 'pair-b', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.02 },
    ];
    const { plugin, api } = await setup();
    await load(plugin);

    expect(api.emitted('live:latency')).toEqual([]);
    await settle(1000);
    expect(api.state.get('liveLatency')).toBeCloseTo(0.06, 5);
    expect(api.emitted('live:latency')).toEqual([{ latency: expect.closeTo(0.06, 5) }]);

    // Unchanged counters mean no frame was emitted: no second write.
    await settle(1000);
    expect(api.emitted('live:latency')).toHaveLength(1);

    // Sixty more frames that each waited 200 ms: the estimate is the window
    // (0.2 + 0.01), not the mean since the join (0.125 + 0.01).
    FakePeerConnection.options.stats = [
      { id: 'in-v', type: 'inbound-rtp', kind: 'video', jitterBufferDelay: 15, jitterBufferEmittedCount: 120 },
      { id: 't', type: 'transport', selectedCandidatePairId: 'pair-b' },
      { id: 'pair-b', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.02 },
    ];
    await settle(1000);
    expect(api.state.get('liveLatency')).toBeCloseTo(0.21, 5);
    expect(api.emitted('live:latency')).toHaveLength(2);

    // Stops with the connection.
    await plugin.destroy();
    await settle(3000);
    expect(api.emitted('live:latency')).toHaveLength(2);
  });
});

describe('playback controls', () => {
  it('plays and pauses the element on the core events without echoing them', async () => {
    installFetch([answer()]);
    const { plugin, api } = await setup();
    await load(plugin);
    const video = api.container.querySelector('video') as HTMLVideoElement;
    video.pause();
    api.emit.mockClear();

    api.fire('playback:play');
    await settle();
    expect(api.state.get('playing')).toBe(true);
    // The core emitted playback:play itself; the element's own must not echo.
    expect(api.emitted('playback:play')).toEqual([]);

    api.fire('playback:pause');
    expect(api.state.get('paused')).toBe(true);
    expect(api.emitted('playback:pause')).toEqual([]);

    // A direct element pause (the UI's button) is reported.
    video.play();
    video.pause();
    expect(api.emitted('playback:pause')).toHaveLength(1);
  });

  it('mirrors volume and mute, and the poster key', async () => {
    installFetch([answer()]);
    const { plugin, api } = await setup();
    await load(plugin);
    const video = api.container.querySelector('video') as HTMLVideoElement;

    api.fire('volume:change', { volume: 0.25, muted: true });
    expect(video.volume).toBe(0.25);
    expect(video.muted).toBe(true);
    api.fire('volume:mute', { muted: false });
    expect(video.muted).toBe(false);

    api.setState('poster', 'https://example.com/p.jpg');
    expect(video.poster).toBe('https://example.com/p.jpg');
  });
});

describe('teardown', () => {
  it('destroy DELETEs the session with keepalive, closes, removes the element, and unsubscribes', async () => {
    const fetchMock = installFetch([answer()]);
    const { plugin, api } = await setup();
    await load(plugin);
    const pc = FakePeerConnection.instances[0];

    await plugin.destroy();
    await settle();

    const [url, init] = fetchMock.deletes()[0];
    expect(url).toBe(SESSION);
    expect(init?.method).toBe('DELETE');
    expect(init?.keepalive).toBe(true);
    expect(pc.closed).toBe(true);
    expect(api.container.querySelector('video')).toBeNull();
    expect(plugin.getSessionUrl()).toBeNull();
    expect(api.state.get('live')).toBe(false);

    // The listeners registered in init() go through onDestroy.
    api.runDestroy();
    api.fire('playback:play');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('destroy rejects a pending load and cancels a scheduled reconnect', async () => {
    const fetchMock = installFetch([envelope(409, 'not_live', 'x', '5')]);
    const { plugin } = await setup();
    const { loading } = await load(plugin);

    await plugin.destroy();
    await expect(loading).rejects.toThrow(/destroyed/);
    await settle(60000);
    expect(fetchMock.posts()).toHaveLength(1);
  });

  it('frees the session on pagehide with keepalive', async () => {
    const fetchMock = installFetch([answer()]);
    const { plugin } = await setup();
    await load(plugin);

    window.dispatchEvent(new Event('pagehide'));
    await settle();

    expect(fetchMock.deletes()).toHaveLength(1);
    expect(fetchMock.deletes()[0][1]?.keepalive).toBe(true);
    expect(plugin.getSessionUrl()).toBeNull();
  });
});
