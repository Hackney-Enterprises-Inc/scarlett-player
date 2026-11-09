/**
 * Load and poster log payloads must never carry a signed-URL token.
 *
 * Covers the 'Loading source', 'Load superseded by newer load call' and
 * 'Poster set' logs, which used to receive the raw URL.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScarlettPlayer } from '../src/scarlett-player';
import { Logger } from '../src/logger';
import { sanitizeUrl } from '../src/utils/url';

const QUERY_SECRET = 'SECRET-QUERY-TOKEN-7f3a9c';
// `<expiry>_<nonce>_<sig>` path segment: sanitizeUrl redacts it.
const PATH_TOKEN = '1700000000_ab12cd34ef56ab78_9f8e7d6c5b4a3921';
const SIGNED_SOURCE = `https://cdn.example/v/${PATH_TOKEN}/master.m3u8?token=${QUERY_SECRET}`;
const SIGNED_POSTER = `https://cdn.example/art/${PATH_TOKEN}/poster.jpg?sig=${QUERY_SECRET}`;

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

/** Every argument of every logger call, serialised, so any leak is caught. */
type LogSpies = Record<(typeof LEVELS)[number], { mock: { calls: unknown[][] } }>;

const allLogPayloads = (spies: LogSpies): string =>
  LEVELS.flatMap((level) => spies[level].mock.calls.map((call) => JSON.stringify(call))).join('\n');

const tick = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));

const createProvider = (loadSource = vi.fn().mockResolvedValue(undefined)) => ({
  id: 'provider',
  name: 'Provider',
  type: 'provider',
  version: '1.0.0',
  init: vi.fn(),
  destroy: vi.fn(),
  canPlay: vi.fn(() => true),
  loadSource,
});

describe('load and poster logging', () => {
  let container: HTMLElement;
  let spies: LogSpies;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Capture every logger call on the player's Logger instance.
    spies = {
      debug: vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(Logger.prototype, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('logs the sanitized URL for a load', async () => {
    const provider = createProvider();
    const player = new ScarlettPlayer({ container, plugins: [provider as any] });

    await player.load(SIGNED_SOURCE, { autoplay: false });

    const payloads = allLogPayloads(spies);
    expect(payloads).toContain('Loading source');
    expect(payloads).not.toContain(QUERY_SECRET);
    expect(payloads).not.toContain(PATH_TOKEN);
    expect(payloads).toContain(sanitizeUrl(SIGNED_SOURCE) as string);
  });

  it('never logs the token on the superseded-load path', async () => {
    const provider = createProvider();
    const player = new ScarlettPlayer({ container, plugins: [provider as any] });

    // Two overlapping loads: the first bails at its checkpoint.
    const first = player.load(SIGNED_SOURCE, { autoplay: false });
    const second = player.load(`https://cdn.example/other/${PATH_TOKEN}/b.m3u8?token=${QUERY_SECRET}`, {
      autoplay: false,
    });
    await Promise.all([first, second]);
    for (let i = 0; i < 5; i++) await tick();

    const supersededCalls = spies.info.mock.calls.filter(
      ([message]) => message === 'Load superseded by newer load call'
    );
    expect(supersededCalls.length).toBeGreaterThan(0);

    const payloads = allLogPayloads(spies);
    expect(payloads).not.toContain(QUERY_SECRET);
    expect(payloads).not.toContain(PATH_TOKEN);
  });

  it('logs the sanitized poster URL from setPoster()', () => {
    const player = new ScarlettPlayer({ container });

    player.setPoster(SIGNED_POSTER);

    const payloads = allLogPayloads(spies);
    expect(payloads).toContain('Poster set');
    expect(payloads).not.toContain(QUERY_SECRET);
    expect(payloads).not.toContain(PATH_TOKEN);
  });
});
