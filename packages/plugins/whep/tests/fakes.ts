/**
 * Test doubles for @scarlett-player/whep.
 *
 * jsdom has no WebRTC, so the plugin is exercised against a fake
 * `RTCPeerConnection` that plays the browser's part deterministically: it
 * reports gathering complete on `setLocalDescription`, and after
 * `setRemoteDescription` it delivers the two remote tracks and moves the
 * connection state as the case asks (on a zero-delay timer, so a test with
 * fake timers steps it with `vi.advanceTimersByTimeAsync`). `fetch` is a
 * vitest mock the cases script with `Response`s.
 */

import { vi, type Mock } from 'vitest';
import type { IPluginAPI, StateChangeEvent } from '@scarlett-player/core';

/** What the fake connection does after the answer is applied. */
export type FakeConnectOutcome = 'connected' | 'failed' | 'never';

/** Per-test knobs for the fake, read by every instance at the moment of use. */
export interface FakePeerOptions {
  /** Whether `setLocalDescription` reports gathering complete (default true). */
  gathers?: boolean;
  /** The connection state reached after the answer (default `connected`). */
  outcome?: FakeConnectOutcome;
  /** Which remote tracks arrive (default both). */
  tracks?: Array<'video' | 'audio'>;
  /** Makes `setRemoteDescription` reject, as a browser does for a bad SDP. */
  rejectAnswer?: boolean;
  /** The stats report `getStats()` resolves with. */
  stats?: unknown[];
}

/** A fake remote track: only `kind` and `id` are read. */
export interface FakeTrack {
  kind: 'video' | 'audio';
  id: string;
}

/**
 * A `MediaStream` stand-in: jsdom has none.
 */
export class FakeMediaStream {
  private readonly tracks: FakeTrack[] = [];

  /** Adds a track. */
  addTrack(track: FakeTrack): void {
    this.tracks.push(track);
  }

  /** The tracks added so far. */
  getTracks(): FakeTrack[] {
    return [...this.tracks];
  }
}

/**
 * The fake `RTCPeerConnection`.
 */
export class FakePeerConnection extends EventTarget {
  /** Every instance built since the last `reset()`, in order. */
  static instances: FakePeerConnection[] = [];
  /** The knobs the next instances read. */
  static options: FakePeerOptions = {};

  /** Forget the instances and the knobs. */
  static reset(): void {
    FakePeerConnection.instances = [];
    FakePeerConnection.options = {};
  }

  readonly config: RTCConfiguration | undefined;
  readonly transceivers: Array<{ kind: string; init?: RTCRtpTransceiverInit }> = [];
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  iceGatheringState: RTCIceGatheringState = 'new';
  connectionState: RTCPeerConnectionState = 'new';
  closed = false;
  ontrack: ((event: { track: FakeTrack; streams: unknown[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  /**
   * @param config - The configuration the plugin passed
   */
  constructor(config?: RTCConfiguration) {
    super();
    this.config = config;
    FakePeerConnection.instances.push(this);
  }

  /** Records the transceiver. */
  addTransceiver(kind: string, init?: RTCRtpTransceiverInit): void {
    this.transceivers.push({ kind, init });
  }

  /** A fixed offer. */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (this.closed) throw new DOMException('closed', 'InvalidStateError');
    return { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 102\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' };
  }

  /** Stores the offer and reports gathering complete unless told not to. */
  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) throw new DOMException('closed', 'InvalidStateError');
    this.localDescription = desc;
    if (FakePeerConnection.options.gathers !== false) {
      this.iceGatheringState = 'complete';
      this.dispatchEvent(new Event('icegatheringstatechange'));
    }
  }

  /**
   * Stores the answer, then on the next timer tick delivers the tracks and
   * moves the connection state to the configured outcome.
   */
  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) throw new DOMException('closed', 'InvalidStateError');
    if (FakePeerConnection.options.rejectAnswer) {
      throw new DOMException('Failed to parse SessionDescription', 'InvalidAccessError');
    }
    this.remoteDescription = desc;
    const { outcome = 'connected', tracks = ['video', 'audio'] } = FakePeerConnection.options;
    setTimeout(() => {
      if (this.closed) return;
      for (const kind of tracks) {
        this.ontrack?.({ track: { kind, id: `${kind}-${FakePeerConnection.instances.indexOf(this)}` }, streams: [] });
      }
      if (outcome !== 'never') this.setConnectionState(outcome);
    }, 0);
  }

  /** Moves the connection state and notifies, as the browser would. */
  setConnectionState(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }

  /** The configured stats as a Map, the shape `RTCStatsReport` iterates. */
  async getStats(): Promise<Map<string, unknown>> {
    if (this.closed) throw new DOMException('closed', 'InvalidStateError');
    const entries = (FakePeerConnection.options.stats ?? []) as Array<{ id: string }>;
    return new Map(entries.map((entry) => [entry.id, entry]));
  }

  /** Closes: later calls throw, pending timers do nothing. */
  close(): void {
    this.closed = true;
    this.connectionState = 'closed';
  }
}

/**
 * Build a `Response` for the fetch mock.
 *
 * @param status - HTTP status
 * @param body - Body text
 * @param headers - Headers
 * @returns The response
 */
export function reply(status: number, body = '', headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

/** A 201 answer with a session Location. */
export function answer(location = '/whep/v1/streams/show-1/sessions/abc'): Response {
  return reply(201, 'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 102\r\na=sendonly\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendonly\r\n', {
    'Content-Type': 'application/sdp',
    Location: location,
  });
}

/** A Tmesis JSON error envelope. */
export function envelope(status: number, code: string, message: string, retryAfter?: string): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (retryAfter) headers['Retry-After'] = retryAfter;
  return reply(status, JSON.stringify({ error: { code, message, details: [], request_id: '', milestone: null } }), headers);
}

/**
 * The fetch mock, with the calls it saw.
 */
export interface FetchMock extends Mock {
  /** Every call as `[url, init]`. */
  calls(): Array<[string, RequestInit | undefined]>;
  /** Only the POSTs. */
  posts(): Array<[string, RequestInit | undefined]>;
  /** Only the DELETEs. */
  deletes(): Array<[string, RequestInit | undefined]>;
}

/**
 * Install a fetch mock that answers POSTs from a queue and DELETEs with 200.
 *
 * @param responses - The answers to successive POSTs; the last repeats
 * @returns The mock
 */
export function installFetch(responses: Array<Response | (() => Response)>): FetchMock {
  let index = 0;
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') return reply(200);
    const next = responses[Math.min(index, responses.length - 1)];
    index++;
    return typeof next === 'function' ? next() : next.clone();
  }) as unknown as FetchMock;
  mock.calls = () => mock.mock.calls as Array<[string, RequestInit | undefined]>;
  mock.posts = () => mock.calls().filter(([, init]) => init?.method === 'POST');
  mock.deletes = () => mock.calls().filter(([, init]) => init?.method === 'DELETE');
  vi.stubGlobal('fetch', mock);
  return mock;
}

/**
 * A stubbed `IPluginAPI` with a real state store, so what the plugin writes
 * it can read back, plus the hooks a case needs to drive it.
 */
export interface MockPluginApi extends IPluginAPI {
  logger: { debug: Mock; info: Mock; warn: Mock; error: Mock };
  emit: Mock;
  /** The state as written. */
  state: Map<string, unknown>;
  /** Fire a player event at the plugin's listeners. */
  fire(event: string, payload?: unknown): void;
  /** Run the cleanups registered with `onDestroy`. */
  runDestroy(): void;
  /** Every `emit` call for one event name, payloads only. */
  emitted(event: string): unknown[];
  /** Every `setState` value for one key, in order. */
  written(key: string): unknown[];
}

/**
 * Build the mock API.
 *
 * @returns The mock
 */
export function createMockApi(): MockPluginApi {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const state = new Map<string, unknown>([
    ['liveLatency', 0],
    ['lowLatencyMode', false],
    ['muted', false],
    ['volume', 1],
    ['poster', ''],
  ]);
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const stateSubscribers = new Set<(event: StateChangeEvent) => void>();
  const cleanups: Array<() => void> = [];
  const writes: Array<[string, unknown]> = [];

  const emit = vi.fn();
  const api: MockPluginApi = {
    pluginId: 'whep-provider',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    state,
    getState: ((key: string) => state.get(key)) as IPluginAPI['getState'],
    setState: ((key: string, value: unknown) => {
      const previous = state.get(key);
      state.set(key, value);
      writes.push([key, value]);
      for (const sub of stateSubscribers) {
        sub({ key, value, previousValue: previous } as unknown as StateChangeEvent);
      }
    }) as IPluginAPI['setState'],
    defineState: vi.fn(),
    on: ((event: string, handler: (payload: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      return () => listeners.get(event)?.delete(handler);
    }) as IPluginAPI['on'],
    off: vi.fn(),
    emit,
    getPlugin: vi.fn().mockReturnValue(null),
    onDestroy: (cleanup: () => void) => {
      cleanups.push(cleanup);
    },
    subscribeToState: (callback: (event: StateChangeEvent) => void) => {
      stateSubscribers.add(callback);
      return () => stateSubscribers.delete(callback);
    },
    fire: (event, payload) => {
      for (const handler of listeners.get(event) ?? []) handler(payload);
    },
    runDestroy: () => {
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
    emitted: (event) => emit.mock.calls.filter(([name]) => name === event).map(([, payload]) => payload),
    written: (key) => writes.filter(([k]) => k === key).map(([, value]) => value),
  };
  return api;
}

/**
 * Install the WebRTC and media element fakes on the global scope.
 *
 * `HTMLMediaElement.play` and `pause` are jsdom's "not implemented" stubs;
 * the replacements resolve and fire the events a browser fires, and track
 * `paused` on the element.
 */
export function installBrowserFakes(): void {
  FakePeerConnection.reset();
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  vi.stubGlobal('MediaStream', FakeMediaStream);

  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get(this: HTMLMediaElement & { __paused?: boolean }) {
      return this.__paused ?? true;
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (this: HTMLMediaElement & { __paused?: boolean }) {
    this.__paused = false;
    this.dispatchEvent(new Event('play'));
    this.dispatchEvent(new Event('playing'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement & { __paused?: boolean }) {
    this.__paused = true;
    this.dispatchEvent(new Event('pause'));
  });
}
