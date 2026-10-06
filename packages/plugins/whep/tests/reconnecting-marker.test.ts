/**
 * `detail.reconnecting` marker on fatal errors (HEI-26, SCAR-ANALYTICS-15).
 *
 * handleFailure emits the fatal `error` before it schedules the reconnect,
 * so the error itself now says whether auto-reconnect will take over.
 * WebRTC and fetch are the fakes in ./fakes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWHEPPlugin, type IWHEPPlugin, type WHEPPluginConfig } from '../src/index';
import {
  FakePeerConnection,
  answer,
  createMockApi,
  envelope,
  installBrowserFakes,
  installFetch,
  type MockPluginApi,
} from './fakes';

const SRC = 'https://origin.example.com:8889/whep/v1/streams/show-1';

const settle = (ms = 1) => vi.advanceTimersByTimeAsync(ms);

const built: Array<{ plugin: IWHEPPlugin; api: MockPluginApi }> = [];

async function setup(config?: WHEPPluginConfig): Promise<{ plugin: IWHEPPlugin; api: MockPluginApi }> {
  const plugin = createWHEPPlugin(config);
  const api = createMockApi();
  await plugin.init(api);
  built.push({ plugin, api });
  return { plugin, api };
}

async function load(plugin: IWHEPPlugin): Promise<void> {
  plugin.loadSource(SRC).catch(() => {});
  await settle();
}

const fatalDetails = (api: MockPluginApi) =>
  (api.emitted('error') as Array<{ fatal: boolean; detail?: Record<string, unknown> }>)
    .filter((payload) => payload.fatal)
    .map((payload) => payload.detail ?? {});

beforeEach(() => {
  vi.useFakeTimers();
  installBrowserFakes();
  vi.spyOn(Math, 'random').mockReturnValue(1);
});

afterEach(async () => {
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

describe('reconnecting marker', () => {
  it('does not schedule a reconnect after an error listener destroys the provider', async () => {
    installFetch([envelope(503, 'unavailable', 'offline')]);
    const { plugin, api } = await setup();
    api.emit.mockImplementation((event: string) => {
      if (event === 'error') void plugin.destroy();
    });
    await load(plugin);

    expect(api.emitted('error:reconnecting')).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('marks a lost connection that will reconnect, and the error still comes first', async () => {
    installFetch([answer(), answer('/whep/v1/streams/show-1/sessions/second')]);
    const { plugin, api } = await setup();
    await load(plugin);

    FakePeerConnection.instances[0].setConnectionState('failed');
    await settle();

    expect(fatalDetails(api)).toHaveLength(1);
    expect(fatalDetails(api)[0].reconnecting).toBe(true);
    const order = (api.emit as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(([name]) => name);
    expect(order.indexOf('error')).toBeLessThan(order.indexOf('error:reconnecting'));
  });

  it('marks a recoverable join failure', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5')]);
    const { plugin, api } = await setup();
    await load(plugin);

    expect(fatalDetails(api)[0].reconnecting).toBe(true);
  });

  it('marks a server failure when a reconnect is scheduled', async () => {
    installFetch([envelope(503, 'unavailable', 'offline')]);
    const { plugin, api } = await setup();
    await load(plugin);
    expect(fatalDetails(api)[0]).toMatchObject({ httpStatus: 503, reconnecting: true });
    expect(api.emitted('error:reconnecting')).toHaveLength(1);
  });

  it('marks a connection timeout when a reconnect is scheduled', async () => {
    installFetch([answer()]);
    FakePeerConnection.options.outcome = 'never';
    const { plugin, api } = await setup({ loadTimeoutMs: 100 });
    await load(plugin);
    expect(fatalDetails(api)).toEqual([]);
    await settle(100);
    expect(fatalDetails(api)[0].reconnecting).toBe(true);
    expect(api.emitted('error')[0]).toMatchObject({ message: expect.stringContaining('timed out') });
    expect(api.emitted('error:reconnecting')).toHaveLength(1);
  });

  it('does not mark a terminal failure', async () => {
    installFetch([envelope(404, 'not_found', 'no such stream')]);
    const { plugin, api } = await setup();
    await load(plugin);

    expect(fatalDetails(api)[0]).not.toHaveProperty('reconnecting');
  });

  it('does not mark a terminal answer inside a reconnect window', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5'), envelope(404, 'not_found', 'gone')]);
    const { plugin, api } = await setup();
    await load(plugin);
    await settle(5000);

    const details = fatalDetails(api);
    expect(details).toHaveLength(2);
    expect(details[0].reconnecting).toBe(true);
    expect(details[1]).not.toHaveProperty('reconnecting');
  });

  it('does not mark a recoverable failure when autoReconnect is off', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5')]);
    const { plugin, api } = await setup({ autoReconnect: false });
    await load(plugin);

    expect(fatalDetails(api)[0]).not.toHaveProperty('reconnecting');
  });

  it('does not mark the terminal error when the window closes', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5')]);
    const { plugin, api } = await setup({ reconnectWindowMs: 12000 });
    await load(plugin);
    await settle(60000);

    const details = fatalDetails(api);
    const terminal = details[details.length - 1];
    expect(terminal.reconnectExhausted).toBe(true);
    expect(terminal).not.toHaveProperty('reconnecting');
  });
});
