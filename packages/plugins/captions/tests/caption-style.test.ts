/**
 * Tests for viewer caption styling: the pure style helpers and the plugin's
 * style engine (scoped `video::cue` stylesheet, storage, public methods).
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { createCaptionsPlugin } from '../src/index';
import {
  buildCueCss,
  readStoredStyle,
  sanitizeCaptionStyle,
  writeStoredStyle,
  type CaptionFontSize,
  type CaptionStyle,
} from '../src/caption-style';

const STORAGE_KEY = 'scarlett-caption-style';

interface MockPluginApi extends IPluginAPI {
  logger: { debug: Mock; info: Mock; warn: Mock; error: Mock };
  getState: Mock;
  setState: Mock;
  defineState: Mock;
  on: Mock;
  off: Mock;
  emit: Mock;
  getPlugin: Mock;
  onDestroy: Mock;
  subscribeToState: Mock;
}

/**
 * Build a mock plugin API backed by a real container holding a real `<video>`.
 *
 * @returns Mock plugin API
 */
function createMockApi(): MockPluginApi {
  const container = document.createElement('div');
  container.appendChild(document.createElement('video'));

  return {
    pluginId: 'captions',
    container,
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    on: vi.fn().mockReturnValue(vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    setState: vi.fn(),
    defineState: vi.fn(),
    getState: vi.fn().mockReturnValue(null),
    subscribeToState: vi.fn().mockReturnValue(vi.fn()),
    onDestroy: vi.fn(),
    getPlugin: vi.fn().mockReturnValue(null),
  };
}

/**
 * The text of the caption stylesheet inside the container, or null when none.
 *
 * @param api - Mock plugin API
 * @returns Stylesheet text or null
 */
function cssOf(api: MockPluginApi): string | null {
  return api.container.querySelector('style')?.textContent ?? null;
}

/**
 * Whether a caption stylesheet's rule reaches a `<video>`, decided the way the
 * browser decides it: the scope attribute named in the selector has to sit on
 * an ancestor of that video.
 *
 * Two players carrying the same scope value both answer true for each other's
 * rule, which is the defect this exists to catch.
 *
 * @param css - Stylesheet text
 * @param video - The `<video>` whose cues the rule would style
 * @returns True when the rule applies to that video
 */
function appliesTo(css: string, video: HTMLVideoElement): boolean {
  const scope = /\[data-sp-caption-scope="([^"]+)"\]/.exec(css)?.[1];
  if (!scope) return false;
  return video.closest(`[data-sp-caption-scope="${scope}"]`) !== null;
}

/**
 * The `<video>` a mock API's container holds.
 *
 * @param api - Mock plugin API
 * @returns The video element
 */
function videoOf(api: MockPluginApi): HTMLVideoElement {
  return api.container.querySelector('video')!;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sanitizeCaptionStyle', () => {
  it('keeps every valid field', () => {
    const input = {
      fontSize: 150,
      color: 'yellow',
      backgroundColor: '#1a2B3c',
      backgroundOpacity: 0.5,
      edgeStyle: 'outline',
      fontFamily: 'serif',
    };

    expect(sanitizeCaptionStyle(input)).toEqual({ style: input, rejected: [] });
  });

  it('drops unknown keys and invalid values, and names them', () => {
    const { style, rejected } = sanitizeCaptionStyle({
      fontSize: 130,
      color: 'red;}body{x:y',
      backgroundColor: 'rgb(0,0,0)',
      backgroundOpacity: 2,
      edgeStyle: 'glow',
      fontFamily: 'Comic Sans MS',
      zoom: 3,
    });

    expect(style).toEqual({});
    expect(rejected.sort()).toEqual(
      ['backgroundColor', 'backgroundOpacity', 'color', 'edgeStyle', 'fontFamily', 'fontSize', 'zoom'].sort()
    );
  });

  it('accepts #rgb and #rrggbb hex, and nothing longer', () => {
    expect(sanitizeCaptionStyle({ color: '#abc' }).style).toEqual({ color: '#abc' });
    expect(sanitizeCaptionStyle({ color: '#aabbcc' }).style).toEqual({ color: '#aabbcc' });
    expect(sanitizeCaptionStyle({ color: '#aabbccdd' }).style).toEqual({});
    expect(sanitizeCaptionStyle({ color: '#ggg' }).style).toEqual({});
  });

  it('returns an empty style for non-objects', () => {
    for (const input of [null, undefined, 'x', 4, [], true]) {
      expect(sanitizeCaptionStyle(input).style).toEqual({});
    }
  });

  it('treats undefined fields as absent rather than rejected', () => {
    expect(sanitizeCaptionStyle({ fontSize: undefined, color: 'white' })).toEqual({
      style: { color: 'white' },
      rejected: [],
    });
  });
});

describe('buildCueCss', () => {
  it('returns an empty string when no field is set', () => {
    expect(buildCueCss('[data-x="1"]', {})).toBe('');
  });

  it('emits one scoped video::cue rule', () => {
    const css = buildCueCss('[data-x="1"]', { fontSize: 150, color: 'yellow', fontFamily: 'monospace' });

    expect(css.startsWith('[data-x="1"] video::cue')).toBe(true);
    expect(css).toContain('font-size: 150%');
    expect(css).toContain('color: #ffff00');
    expect(css).toContain('font-family: monospace');
  });

  it('pairs a background colour with the UA default alpha of 0.8', () => {
    expect(buildCueCss('s', { backgroundColor: 'blue' })).toContain('background-color: rgba(0, 0, 255, 0.8)');
  });

  it('pairs a background opacity with black', () => {
    expect(buildCueCss('s', { backgroundOpacity: 0.25 })).toContain('background-color: rgba(0, 0, 0, 0.25)');
  });

  it('merges a hex background colour with the opacity', () => {
    expect(buildCueCss('s', { backgroundColor: '#f80', backgroundOpacity: 1 })).toContain(
      'background-color: rgba(255, 136, 0, 1)'
    );
  });

  it('emits a text-shadow per edge style', () => {
    expect(buildCueCss('s', { edgeStyle: 'none' })).toContain('text-shadow: none');
    expect(buildCueCss('s', { edgeStyle: 'drop-shadow' })).toContain('text-shadow: 0.06em 0.06em 0.12em rgba(0, 0, 0, 0.9)');
    expect(buildCueCss('s', { edgeStyle: 'outline' })).toMatch(/text-shadow: (.+, ){3}.+;/);
  });
});

describe('stored style', () => {
  it('round-trips through localStorage as { v: 1, style }', () => {
    writeStoredStyle('k-roundtrip', { fontSize: 200 });

    expect(JSON.parse(localStorage.getItem('k-roundtrip')!)).toEqual({ v: 1, style: { fontSize: 200 } });
    expect(readStoredStyle('k-roundtrip')).toEqual({ fontSize: 200 });
  });

  it('removes the key when written null', () => {
    writeStoredStyle('k-null', { fontSize: 200 });
    writeStoredStyle('k-null', null);

    expect(localStorage.getItem('k-null')).toBeNull();
    expect(readStoredStyle('k-null')).toEqual({});
  });

  it('ignores an unknown version, malformed JSON and out-of-range values', () => {
    localStorage.setItem('k-v2', JSON.stringify({ v: 2, style: { fontSize: 200 } }));
    localStorage.setItem('k-bad', '{not json');
    localStorage.setItem('k-range', JSON.stringify({ v: 1, style: { fontSize: 9000, color: 'red' } }));
    localStorage.setItem('k-array', '[1,2]');

    expect(readStoredStyle('k-v2')).toEqual({});
    expect(readStoredStyle('k-bad')).toEqual({});
    expect(readStoredStyle('k-range')).toEqual({ color: 'red' });
    expect(readStoredStyle('k-array')).toEqual({});
  });

  it('falls back to memory when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(() => writeStoredStyle('k-throw', { color: 'cyan' })).not.toThrow();
    expect(readStoredStyle('k-throw')).toEqual({ color: 'cyan' });

    expect(() => writeStoredStyle('k-throw', null)).not.toThrow();
    expect(readStoredStyle('k-throw')).toEqual({});
  });

  it('prefers the in-memory value over the stale stored one after a failed write', () => {
    // Reads still work; only the write is refused. Storage keeps answering
    // with the value that was there before, so a read that trusts storage
    // hands every later player the preference the viewer just replaced.
    localStorage.setItem('k-stale', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    writeStoredStyle('k-stale', { fontSize: 50 });

    expect(readStoredStyle('k-stale')).toEqual({ fontSize: 50 });
  });

  it('keeps a reset cleared when the removal fails', () => {
    // The viewer reset, storage refused to hear about it, and the old value is
    // still sitting there. It must not come back.
    localStorage.setItem('k-reset', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    writeStoredStyle('k-reset', null);

    expect(readStoredStyle('k-reset')).toEqual({});
  });

  it('lets a later storage change win over a value held after a failed write', () => {
    // The write is refused, so the choice is held in memory. Storage then
    // comes back and another tab saves something else: that is newer than
    // anything this page knows, and the held value must not mask it.
    localStorage.setItem('k-restored', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    writeStoredStyle('k-restored', { fontSize: 50 });
    expect(readStoredStyle('k-restored')).toEqual({ fontSize: 50 });

    vi.restoreAllMocks();
    localStorage.setItem('k-restored', JSON.stringify({ v: 1, style: { color: 'red' } }));

    expect(readStoredStyle('k-restored')).toEqual({ color: 'red' });

    // The held value is gone for good, not just skipped once.
    localStorage.setItem('k-restored', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    expect(readStoredStyle('k-restored')).toEqual({ fontSize: 200 });
  });

  it('lets another tab save over a reset that storage refused', () => {
    // The failed removal leaves a "cleared" marker in memory. A save from
    // another tab afterwards is a newer choice and has to show through it.
    localStorage.setItem('k-tombstone', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    writeStoredStyle('k-tombstone', null);
    expect(readStoredStyle('k-tombstone')).toEqual({});

    localStorage.setItem('k-tombstone', JSON.stringify({ v: 1, style: { fontSize: 150 } }));

    expect(readStoredStyle('k-tombstone')).toEqual({ fontSize: 150 });
  });

  it('lets storage win when it comes back changed after being fully blocked', () => {
    // This page read the key while storage worked, then storage went away
    // entirely and a write was held in memory. When storage answers again
    // with something other than what was last seen, another tab changed it.
    localStorage.setItem('k-blocked', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    expect(readStoredStyle('k-blocked')).toEqual({ fontSize: 200 });

    for (const method of ['setItem', 'getItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
    }

    writeStoredStyle('k-blocked', { fontSize: 50 });
    expect(readStoredStyle('k-blocked')).toEqual({ fontSize: 50 });

    vi.restoreAllMocks();
    expect(readStoredStyle('k-blocked')).toEqual({ fontSize: 50 });

    localStorage.setItem('k-blocked', JSON.stringify({ v: 1, style: { color: 'red' } }));
    expect(readStoredStyle('k-blocked')).toEqual({ color: 'red' });
  });

  it('keeps the held value while storage is readable but unchanged, then yields to a change', () => {
    // Storage was never readable for this key, so there is nothing to compare
    // against. The first readable answer becomes the baseline and the choice
    // made on this page stays; a change after that wins.
    for (const method of ['setItem', 'getItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
    }

    writeStoredStyle('k-unseen', { color: 'cyan' });

    vi.restoreAllMocks();
    expect(readStoredStyle('k-unseen')).toEqual({ color: 'cyan' });
    expect(readStoredStyle('k-unseen')).toEqual({ color: 'cyan' });

    localStorage.setItem('k-unseen', JSON.stringify({ v: 1, style: { fontSize: 75 } }));
    expect(readStoredStyle('k-unseen')).toEqual({ fontSize: 75 });
  });

  it('keeps a reset when storage could not be read at the moment it failed', () => {
    // The reported sequence. This page read 200, so 200 is the baseline.
    // Another tab then saved 150. Storage stopped answering altogether and
    // the viewer reset: the reset is held as a tombstone, but with storage
    // unreadable the baseline is no longer knowable, so it must not stay at
    // 200. Storage coming back unchanged (still 150) is not a change observed
    // after the reset, so the older 150 must not undo it.
    localStorage.setItem('k-unreadable-reset', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    expect(readStoredStyle('k-unreadable-reset')).toEqual({ fontSize: 200 });

    localStorage.setItem('k-unreadable-reset', JSON.stringify({ v: 1, style: { fontSize: 150 } }));

    for (const method of ['getItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
    }

    writeStoredStyle('k-unreadable-reset', null);

    vi.restoreAllMocks();
    expect(readStoredStyle('k-unreadable-reset')).toEqual({});
  });

  it('keeps the choice made while storage could not be read', () => {
    // The same sequence with a denied write: this page read 200, another tab
    // saved 150, storage stopped answering and the viewer picked 50. The
    // baseline is unknowable at that point, so the 150 sitting in storage
    // when it comes back must not win over the 50 the viewer just chose.
    localStorage.setItem('k-unreadable-choice', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    expect(readStoredStyle('k-unreadable-choice')).toEqual({ fontSize: 200 });

    localStorage.setItem('k-unreadable-choice', JSON.stringify({ v: 1, style: { fontSize: 150 } }));

    for (const method of ['getItem', 'setItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
    }

    writeStoredStyle('k-unreadable-choice', { fontSize: 50 });

    vi.restoreAllMocks();
    expect(readStoredStyle('k-unreadable-choice')).toEqual({ fontSize: 50 });
  });
});

/**
 * Font sizes the model test writes, one per step position: distinct inside any
 * sequence, so a value that comes back can be told from the one written.
 */
const MODEL_WRITE_VALUES: CaptionFontSize[] = [50, 75, 100, 150];

/** One storage step the model test can take. */
type ModelStep = 'readOk' | 'readFail' | 'writeOk' | 'writeFail' | 'removeOk' | 'removeFail' | 'otherTabWrite';

/** Every step, in the order the sequences are built from them. */
const MODEL_STEPS: ModelStep[] = ['readOk', 'readFail', 'writeOk', 'writeFail', 'removeOk', 'removeFail', 'otherTabWrite'];

/**
 * Model state: the viewer's most recent action on the key, and the raw string
 * storage last answered with. `'unknown'` means nothing has been observed
 * since that action, so there is nothing to compare the next answer against.
 */
interface ModelState {
  held: CaptionStyle | null | undefined;
  seen: string | null | 'unknown';
}

/** Encode a style the way the module stores it. */
function encodeModelStyle(style: CaptionStyle): string {
  return JSON.stringify({ v: 1, style });
}

/**
 * What a read makes of a raw string this test wrote. Only ever well-formed
 * `{ v: 1, style }`, so the model needs none of the sanitiser.
 *
 * @param raw - Stored string
 * @returns The style it holds
 */
function parseModelRaw(raw: string): CaptionStyle {
  const parsed = JSON.parse(raw) as { v?: number; style?: CaptionStyle };
  return parsed.v === 1 && parsed.style ? { ...parsed.style } : {};
}

/**
 * Structural compare for the plain styles the model deals in.
 *
 * @param a - One style, or undefined for a step that does not read
 * @param b - The other
 * @returns True when they hold the same fields
 */
function sameModelStyle(a: CaptionStyle | undefined, b: CaptionStyle | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const keys = Object.keys(a) as (keyof CaptionStyle)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/**
 * Reference model of the storage contract, written from the invariant alone:
 * the viewer's most recent action on a key wins unless a storage change
 * observed after it differs from what was last observed.
 *
 * A failed write or removal keeps the action and refreshes the baseline only
 * when storage can still be read; when it cannot, the baseline becomes
 * unknown and the next readable read establishes it while the action stands.
 *
 * @param state - Model state, advanced in place
 * @param step - Step to apply
 * @param index - Position of the step in its sequence, which picks the value written
 * @param view - Storage as this page sees it
 * @returns The style a read step answers with, or undefined for the others
 */
function modelStep(
  state: ModelState,
  step: ModelStep,
  index: number,
  view: { raw: string | null; readable: boolean }
): CaptionStyle | undefined {
  const choice: CaptionStyle = { fontSize: MODEL_WRITE_VALUES[index] };

  if (step === 'readFail') {
    return state.held === undefined || state.held === null ? {} : { ...state.held };
  }

  if (step === 'readOk') {
    if (state.held !== undefined && state.seen !== 'unknown' && state.seen !== view.raw) {
      state.held = undefined;
    }
    state.seen = view.raw;
    if (state.held !== undefined) return state.held === null ? {} : { ...state.held };
    return view.raw === null ? {} : parseModelRaw(view.raw);
  }

  if (step === 'writeOk' || step === 'removeOk') {
    state.held = undefined;
    state.seen = step === 'writeOk' ? encodeModelStyle(choice) : null;
    return undefined;
  }

  if (step === 'otherTabWrite') {
    // Another tab wrote behind this page's back. Nothing is observed until a
    // read, so neither the action nor the baseline moves.
    return undefined;
  }

  state.held = step === 'writeFail' ? { ...choice } : null;
  state.seen = view.readable ? view.raw : 'unknown';
  return undefined;
}

describe('stored style: every short sequence against a reference model', () => {
  /** What storage holds for the key under test, and whether this page may touch it. */
  let storage: { raw: string | null; readable: boolean; writable: boolean };

  beforeEach(() => {
    storage = { raw: null, readable: true, writable: true };

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      if (!storage.readable) throw new DOMException('denied', 'SecurityError');
      return storage.raw;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((_key: string, value: string) => {
      if (!storage.writable) throw new DOMException('denied', 'SecurityError');
      storage.raw = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      if (!storage.writable) throw new DOMException('denied', 'SecurityError');
      storage.raw = null;
    });
  });

  it('matches the model on every sequence of up to four steps', () => {
    const sequences: ModelStep[][] = [];
    for (let length = 1; length <= 4; length += 1) {
      const extend = (prefix: ModelStep[]): void => {
        if (prefix.length === length) {
          sequences.push(prefix);
          return;
        }
        for (const step of MODEL_STEPS) extend([...prefix, step]);
      };
      extend([]);
    }

    const failures: string[] = [];
    let keyIndex = 0;

    // Both shapes a refused localStorage takes: everything throws (storage
    // gone), or only the writes throw while reads still answer (Safari
    // private mode). The baseline is only unknowable in the first.
    for (const blocked of ['everything', 'writes-only'] as const) {
      for (const sequence of sequences) {
        // A fresh key per sequence, so the module's per-key state starts clean.
        const key = `k-model-${keyIndex++}`;
        storage.raw = null;
        storage.readable = true;
        storage.writable = true;

        const state: ModelState = { held: undefined, seen: 'unknown' };
        const trace: string[] = [];

        sequence.forEach((step, index) => {
          if (step === 'readFail') {
            storage.readable = false;
            storage.writable = blocked === 'everything' ? false : true;
          } else if (step === 'writeFail' || step === 'removeFail') {
            storage.writable = false;
            storage.readable = blocked === 'everything' ? false : true;
          } else if (step !== 'otherTabWrite') {
            storage.readable = true;
            storage.writable = true;
          }

          trace.push(step);
          const expected = modelStep(state, step, index, storage);
          const choice: CaptionStyle = { fontSize: MODEL_WRITE_VALUES[index] };

          let actual: CaptionStyle | undefined;
          if (step === 'readOk' || step === 'readFail') {
            actual = readStoredStyle(key);
          } else if (step === 'writeOk' || step === 'writeFail') {
            writeStoredStyle(key, choice);
          } else if (step === 'removeOk' || step === 'removeFail') {
            writeStoredStyle(key, null);
          } else {
            storage.raw = encodeModelStyle(choice);
          }

          if (!sameModelStyle(expected, actual)) {
            failures.push(
              `${blocked} [${trace.join(' > ')}] at ${step}: expected ${JSON.stringify(expected)}, ` +
                `got ${JSON.stringify(actual)}`
            );
          }
        });
      }
    }

    expect(
      failures,
      `${failures.length} of ${keyIndex} sequences diverged; first: ${failures[0] ?? 'none'}`
    ).toEqual([]);
  });
});

describe('captions plugin style engine', () => {
  let api: MockPluginApi;

  beforeEach(() => {
    api = createMockApi();
  });

  it('injects a container-scoped video::cue rule for style.fontSize: 150', () => {
    const plugin = createCaptionsPlugin({ style: { fontSize: 150 } });
    plugin.init(api);

    const scope = api.container.getAttribute('data-sp-caption-scope');
    expect(scope).toBeTruthy();

    const css = cssOf(api)!;
    expect(css).toContain('video::cue');
    expect(css).toContain('font-size: 150%');
    expect(css.startsWith(`[data-sp-caption-scope="${scope}"] video::cue`)).toBe(true);
  });

  it('injects no <style> with no config and empty storage', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(api);

    expect(api.container.querySelector('style')).toBeNull();
    expect(document.head.querySelector('style')).toBeNull();
    expect(plugin.getCaptionStyle()).toEqual({});
  });

  it('lets a stored override beat config, field by field', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, style: { fontSize: 200 } }));

    const plugin = createCaptionsPlugin({ style: { fontSize: 75, color: 'yellow' } });
    plugin.init(api);

    expect(plugin.getCaptionStyle()).toEqual({ fontSize: 200, color: 'yellow' });
    expect(plugin.getCaptionStyleOverrides()).toEqual({ fontSize: 200 });
    expect(cssOf(api)).toContain('font-size: 200%');
    expect(cssOf(api)).toContain('color: #ffff00');
  });

  it('drops malformed or out-of-range storage without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{"v":1,"style":{"fontSize":"huge","color":"red;}body{x:y"}}');

    const plugin = createCaptionsPlugin();
    expect(() => plugin.init(api)).not.toThrow();

    expect(plugin.getCaptionStyleOverrides()).toEqual({});
    expect(api.container.querySelector('style')).toBeNull();
  });

  it('rejects a config colour carrying CSS and warns', () => {
    const plugin = createCaptionsPlugin({
      style: { color: 'red;}body{x:y' as never, fontSize: 150 },
    });
    plugin.init(api);

    expect(cssOf(api)).not.toContain('body');
    expect(cssOf(api)).toContain('font-size: 150%');
    expect(plugin.getCaptionStyle()).toEqual({ fontSize: 150 });
    expect(api.logger.warn).toHaveBeenCalledTimes(1);
    expect(api.logger.warn.mock.calls[0][1]).toEqual({ rejected: ['color'] });
  });

  it('persists a viewer change under the default key', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(api);

    plugin.setCaptionStyle({ color: 'cyan' });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ v: 1, style: { color: 'cyan' } });
    expect(cssOf(api)).toContain('color: #00ffff');
  });

  it('honours styleStorageKey', () => {
    const plugin = createCaptionsPlugin({ styleStorageKey: 'my-key' });
    plugin.init(api);

    plugin.setCaptionStyle({ fontSize: 50 });

    expect(localStorage.getItem('my-key')).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('never touches localStorage with persistStyle: false', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

    const plugin = createCaptionsPlugin({ persistStyle: false });
    plugin.init(api);
    plugin.setCaptionStyle({ fontSize: 150 });
    plugin.resetCaptionStyle();

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('still applies in memory when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const plugin = createCaptionsPlugin({ styleStorageKey: 'k-plugin-throw' });
    expect(() => plugin.init(api)).not.toThrow();
    expect(() => plugin.setCaptionStyle({ fontSize: 150 })).not.toThrow();

    expect(cssOf(api)).toContain('font-size: 150%');
    expect(plugin.getCaptionStyle()).toEqual({ fontSize: 150 });
  });

  it('falls back to the config value on setCaptionStyle({ fontSize: null })', () => {
    const plugin = createCaptionsPlugin({ style: { fontSize: 75 } });
    plugin.init(api);

    plugin.setCaptionStyle({ fontSize: 200 });
    expect(cssOf(api)).toContain('font-size: 200%');

    plugin.setCaptionStyle({ fontSize: null });
    expect(cssOf(api)).toContain('font-size: 75%');
    expect(plugin.getCaptionStyleOverrides()).toEqual({});
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores an invalid viewer value and warns', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(api);

    plugin.setCaptionStyle({ color: 'red;}body{x:y' as never });

    expect(plugin.getCaptionStyleOverrides()).toEqual({});
    expect(api.container.querySelector('style')).toBeNull();
    expect(api.logger.warn).toHaveBeenCalledTimes(1);
  });

  it('removes the <style> when the last field is cleared', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(api);

    plugin.setCaptionStyle({ fontSize: 150 });
    expect(api.container.querySelector('style')).not.toBeNull();

    plugin.setCaptionStyle({ fontSize: null });
    expect(api.container.querySelector('style')).toBeNull();
  });

  it('reuses one <style> element across changes', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(api);

    plugin.setCaptionStyle({ fontSize: 150 });
    plugin.setCaptionStyle({ color: 'red' });

    expect(api.container.querySelectorAll('style')).toHaveLength(1);
  });

  it('resetCaptionStyle clears overrides, removes the key and keeps config', () => {
    const plugin = createCaptionsPlugin({ style: { color: 'yellow' } });
    plugin.init(api);
    plugin.setCaptionStyle({ fontSize: 200, color: 'red' });

    plugin.resetCaptionStyle();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(plugin.getCaptionStyleOverrides()).toEqual({});
    expect(plugin.getCaptionStyle()).toEqual({ color: 'yellow' });
    expect(cssOf(api)).toContain('color: #ffff00');
    expect(cssOf(api)).not.toContain('font-size');
  });

  it('defines the captionStyle state key with the effective style and updates it', () => {
    const plugin = createCaptionsPlugin({ style: { fontSize: 150 } });
    plugin.init(api);

    expect(api.defineState).toHaveBeenCalledWith('captionStyle', { fontSize: 150 });

    plugin.setCaptionStyle({ color: 'green' });
    expect(api.setState).toHaveBeenLastCalledWith('captionStyle', { fontSize: 150, color: 'green' });
  });

  it('gives two players distinct scopes, each styling only itself', () => {
    const apiB = createMockApi();
    const a = createCaptionsPlugin({ style: { fontSize: 50 }, persistStyle: false });
    const b = createCaptionsPlugin({ style: { fontSize: 200 }, persistStyle: false });
    a.init(api);
    b.init(apiB);

    const scopeA = api.container.getAttribute('data-sp-caption-scope');
    const scopeB = apiB.container.getAttribute('data-sp-caption-scope');
    expect(scopeA).not.toBe(scopeB);
    expect(cssOf(api)).toContain(`[data-sp-caption-scope="${scopeA}"]`);
    expect(cssOf(apiB)).toContain(`[data-sp-caption-scope="${scopeB}"]`);
    expect(appliesTo(cssOf(api)!, videoOf(api))).toBe(true);
    expect(appliesTo(cssOf(api)!, videoOf(apiB))).toBe(false);
    expect(appliesTo(cssOf(apiB)!, videoOf(apiB))).toBe(true);
    expect(appliesTo(cssOf(apiB)!, videoOf(api))).toBe(false);
  });

  it('gives two separately bundled copies of the plugin distinct scopes on one document', async () => {
    // Two copies of this module on one page - the embed full and video builds,
    // or a host bundle beside the embed. A module-local counter restarts at 1
    // in each copy, so both containers would carry the same scope value and
    // each player's document-wide rule would reach the other's cues.
    vi.resetModules();
    const firstCopy = await import('../src/index');
    vi.resetModules();
    const secondCopy = await import('../src/index');

    const apiB = createMockApi();
    document.body.append(api.container, apiB.container);

    const a = firstCopy.createCaptionsPlugin({ style: { fontSize: 50 }, persistStyle: false });
    const b = secondCopy.createCaptionsPlugin({ style: { fontSize: 200 }, persistStyle: false });
    a.init(api);
    b.init(apiB);

    const scopeA = api.container.getAttribute('data-sp-caption-scope');
    const scopeB = apiB.container.getAttribute('data-sp-caption-scope');
    expect(scopeA).toBeTruthy();
    expect(scopeB).toBeTruthy();
    expect(scopeA).not.toBe(scopeB);

    // Each rule reaches only its own player's video.
    expect(appliesTo(cssOf(api)!, videoOf(api))).toBe(true);
    expect(appliesTo(cssOf(api)!, videoOf(apiB))).toBe(false);
    expect(appliesTo(cssOf(apiB)!, videoOf(apiB))).toBe(true);
    expect(appliesTo(cssOf(apiB)!, videoOf(api))).toBe(false);

    api.container.remove();
    apiB.container.remove();
  });

  it('gives a later player the in-memory value, not the stale stored one', () => {
    // Reads still work; only the write is refused. Storage keeps answering
    // with the value that was there before, so a player created afterwards
    // would start from the preference the viewer just replaced.
    localStorage.setItem('k-later', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const apiB = createMockApi();
    const first = createCaptionsPlugin({ styleStorageKey: 'k-later' });
    first.init(api);
    first.setCaptionStyle({ fontSize: 50 });

    const second = createCaptionsPlugin({ styleStorageKey: 'k-later' });
    second.init(apiB);

    expect(second.getCaptionStyleOverrides()).toEqual({ fontSize: 50 });
    expect(second.getCaptionStyle()).toEqual({ fontSize: 50 });
  });

  it('does not let a reset preference reappear for a later player', () => {
    localStorage.setItem('k-reappear', JSON.stringify({ v: 1, style: { fontSize: 200 } }));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const apiB = createMockApi();
    const first = createCaptionsPlugin({ styleStorageKey: 'k-reappear' });
    first.init(api);
    first.resetCaptionStyle();

    const second = createCaptionsPlugin({ styleStorageKey: 'k-reappear' });
    second.init(apiB);

    expect(second.getCaptionStyleOverrides()).toEqual({});
  });

  it('returns copies, so callers cannot mutate plugin state', () => {
    const plugin = createCaptionsPlugin({ style: { fontSize: 150 } });
    plugin.init(api);

    (plugin.getCaptionStyle() as { fontSize?: number }).fontSize = 50;

    expect(plugin.getCaptionStyle()).toEqual({ fontSize: 150 });
  });
});
