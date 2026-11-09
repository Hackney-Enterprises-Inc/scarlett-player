/**
 * hls.js dynamic import retry: loadHlsJs() in the full and light loaders.
 *
 * A rejected `import('hls.js')` is retried once after ~1 s. Each test gets a
 * fresh module graph (vi.resetModules + vi.doMock) so the mocked import can
 * fail a chosen number of times and the loader's module-level cache starts
 * empty. The retry delay runs on fake timers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Loader = typeof import('../src/hls-loader');
type Specifier = 'hls.js' | 'hls.js/light';

interface ImportState {
  /** How many upcoming import() calls should reject before one succeeds */
  failuresLeft: number;
  /** How many times the mocked module was imported */
  importCalls: number;
  /** Value returned by isSupported() on the fake constructor */
  supported: boolean;
  /** Fake hls.js constructor returned as `default` on a successful import */
  ctor: any;
}

const imports: Record<Specifier, ImportState> = {
  'hls.js': freshState(),
  'hls.js/light': freshState(),
};

function freshState(): ImportState {
  const state: ImportState = {
    failuresLeft: 0,
    importCalls: 0,
    supported: true,
    ctor: undefined,
  };
  state.ctor = Object.assign(function FakeHls() {}, {
    isSupported: () => state.supported,
  });
  return state;
}

/** Stand-in for the module that `import(specifier)` resolves to. */
function fakeModule(specifier: Specifier): { default: unknown } {
  const state = imports[specifier];
  state.importCalls += 1;
  if (state.failuresLeft > 0) {
    state.failuresLeft -= 1;
    throw new TypeError(`Failed to fetch dynamically imported module: ${specifier}`);
  }
  return { default: state.ctor };
}

const KINDS = [
  {
    name: 'full loader',
    specifier: 'hls.js' as const,
    load: (): Promise<Loader> => import('../src/hls-loader'),
  },
  {
    name: 'light loader',
    specifier: 'hls.js/light' as const,
    load: (): Promise<Loader> => import('../src/hls-loader-light'),
  },
];

/** Fresh loader module with the mocked hls.js specifiers installed. */
async function freshLoader(kind: (typeof KINDS)[number]): Promise<Loader> {
  vi.resetModules();
  vi.doMock('hls.js', () => fakeModule('hls.js'));
  vi.doMock('hls.js/light', () => fakeModule('hls.js/light'));
  return kind.load();
}

describe.each(KINDS)('hls.js import retry: $name', (kind) => {
  let loader: Loader;
  let state: ImportState;

  beforeEach(async () => {
    vi.useFakeTimers();
    imports[kind.specifier] = freshState();
    state = imports[kind.specifier];
    loader = await freshLoader(kind);
  });

  afterEach(() => {
    vi.doUnmock('hls.js');
    vi.doUnmock('hls.js/light');
    vi.useRealTimers();
  });

  it('retries a rejected import once and caches the constructor', async () => {
    state.failuresLeft = 1;

    const pending = loader.loadHlsJs();
    await vi.advanceTimersByTimeAsync(999);
    expect(state.importCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe(state.ctor);
    expect(state.importCalls).toBe(2);
    expect(loader.getHlsConstructor()).toBe(state.ctor);

    // Cached: a later call does not import again.
    await expect(loader.loadHlsJs()).resolves.toBe(state.ctor);
    expect(state.importCalls).toBe(2);
  });

  it('rejects with the existing prefix after the retry also fails, and resets so a later call can retry', async () => {
    state.failuresLeft = 2;

    const pending = loader.loadHlsJs();
    // vitest rewrites an error thrown from a vi.doMock factory into its own
    // "error when mocking a module" text, so only the production prefix is
    // asserted here. The inner message is not the fake fetch error.
    const assertion = expect(pending).rejects.toThrow(/^Failed to load hls\.js: \S/);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(state.importCalls).toBe(2);
    expect(loader.getHlsConstructor()).toBeNull();

    // loadingPromise was reset, so this starts a new import attempt.
    const later = loader.loadHlsJs();
    await vi.advanceTimersByTimeAsync(0);
    await expect(later).resolves.toBe(state.ctor);
    expect(state.importCalls).toBe(3);
  });

  it('does not retry when hls.js loads but isSupported() is false', async () => {
    state.supported = false;

    const pending = loader.loadHlsJs();
    const assertion = expect(pending).rejects.toThrow(
      'Failed to load hls.js: hls.js is not supported in this browser'
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(state.importCalls).toBe(1);
  });

  it('does not retry when the first import succeeds', async () => {
    await expect(loader.loadHlsJs()).resolves.toBe(state.ctor);
    await vi.advanceTimersByTimeAsync(5000);
    expect(state.importCalls).toBe(1);
  });

  it('concurrent callers share one load and one retry', async () => {
    state.failuresLeft = 1;

    const first = loader.loadHlsJs();
    const second = loader.loadHlsJs();
    await vi.advanceTimersByTimeAsync(1000);

    await expect(Promise.all([first, second])).resolves.toEqual([state.ctor, state.ctor]);
    expect(state.importCalls).toBe(2);
  });
});
