/**
 * Tests for the Share Plugin.
 *
 * The most important case in this file is the security one: no configuration
 * and no code path may cause the media `src` to be shared.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSharePlugin } from '../src/index';
import { applyTimestamp, resolveBaseUrl } from '../src/url';
import { resolveTargets } from '../src/targets';
import { ShareButton } from '../src/ShareButton';

/** Let queued promise callbacks run — target handlers are async. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const SIGNED_SRC = 'https://cdn.example.com/master.m3u8?token=SECRET-DO-NOT-SHARE';

function createMockApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  container.appendChild(document.createElement('video'));
  document.body.appendChild(container);

  const store: Record<string, unknown> = {
    currentTime: 0,
    live: false,
    src: SIGNED_SRC,
    ...state,
  };

  return {
    pluginId: 'share',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => store[key]),
    setState: vi.fn(),
    defineState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  };
}

/** Install a clipboard double, since jsdom ships none. */
function stubClipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

function stubNativeShare(impl: (data: unknown) => Promise<void>) {
  Object.defineProperty(navigator, 'share', {
    value: vi.fn(impl),
    configurable: true,
    writable: true,
  });
  return navigator.share as ReturnType<typeof vi.fn>;
}

function removeNativeShare() {
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

describe('URL resolution', () => {
  beforeEach(() => {
    removeNativeShare();
  });

  it('defaults to the current page URL', () => {
    expect(resolveBaseUrl({})).toBe(window.location.href);
  });

  it('accepts a string override', () => {
    expect(resolveBaseUrl({ url: 'https://tsp.test/watch/abc' })).toBe('https://tsp.test/watch/abc');
  });

  it('accepts a function override, evaluated per share', () => {
    let current = 'https://tsp.test/watch/one';
    const config = { url: () => current };

    expect(resolveBaseUrl(config)).toBe('https://tsp.test/watch/one');
    current = 'https://tsp.test/watch/two';
    expect(resolveBaseUrl(config)).toBe('https://tsp.test/watch/two');
  });

  it('never shares the media src', async () => {
    // The security case. No url configured, a signed src in state — the shared
    // URL must come from the page, never from the stream.
    const api = createMockApi({ src: SIGNED_SRC, currentTime: 30 });
    const plugin = createSharePlugin();
    plugin.init(api as never);

    const shared = plugin.getShareUrl();

    expect(shared).not.toContain('SECRET-DO-NOT-SHARE');
    expect(shared).not.toContain('m3u8');
    expect(shared).toContain(window.location.origin);
  });
});

describe('timestamps', () => {
  it('appends the position to a bare URL', () => {
    const result = applyTimestamp('https://tsp.test/watch/abc', 42.7, false, {});
    expect(result).toBe('https://tsp.test/watch/abc?t=42');
  });

  it('preserves an existing query string', () => {
    const result = applyTimestamp('https://tsp.test/watch/abc?ref=email', 42, false, {});
    expect(result).toContain('ref=email');
    expect(result).toContain('t=42');
  });

  it('preserves a fragment', () => {
    const result = applyTimestamp('https://tsp.test/watch/abc#chat', 42, false, {});
    expect(result).toContain('#chat');
    expect(result).toContain('t=42');
  });

  it('replaces a previous timestamp rather than appending a second', () => {
    const result = applyTimestamp('https://tsp.test/watch/abc?t=10', 99, false, {});
    expect(result.match(/t=/g)).toHaveLength(1);
    expect(result).toContain('t=99');
  });

  it('honours a custom parameter name', () => {
    const result = applyTimestamp('https://tsp.test/w', 42, false, { timestampParam: 'start' });
    expect(result).toContain('start=42');
  });

  it('keeps fractional seconds when rounding is disabled', () => {
    const result = applyTimestamp('https://tsp.test/w', 42.5, false, { roundTimestamp: false });
    expect(result).toContain('t=42.5');
  });

  it('omits the timestamp on live media', () => {
    // An offset into a sliding DVR window means nothing to the recipient.
    const result = applyTimestamp('https://tsp.test/live', 500, true, {});
    expect(result).toBe('https://tsp.test/live');
  });

  it('omits the timestamp when disabled', () => {
    const result = applyTimestamp('https://tsp.test/w', 42, false, { withTimestamp: false });
    expect(result).toBe('https://tsp.test/w');
  });

  it('omits the timestamp at position zero', () => {
    expect(applyTimestamp('https://tsp.test/w', 0, false, {})).toBe('https://tsp.test/w');
  });

  it('returns an unparseable URL unchanged rather than throwing', () => {
    expect(() => applyTimestamp('::::', 10, false, {})).not.toThrow();
  });
});

describe('targets', () => {
  it('resolves built-in ids', () => {
    const resolved = resolveTargets(['copy', 'x']);
    expect(resolved.map((t) => t.id)).toEqual(['copy', 'x']);
  });

  it('drops unknown ids and reports them', () => {
    const onUnknown = vi.fn();
    const resolved = resolveTargets(['copy', 'myspace'], onUnknown);

    expect(resolved.map((t) => t.id)).toEqual(['copy']);
    expect(onUnknown).toHaveBeenCalledWith('myspace');
  });

  it('accepts a custom target and builds its href', () => {
    const resolved = resolveTargets([
      { id: 'signal', label: 'Signal', href: (c) => `https://signal.me/#p/${encodeURIComponent(c.url)}` },
    ]);

    expect(resolved[0]?.id).toBe('signal');
    expect(
      resolved[0]?.href?.({ url: 'https://tsp.test/w', title: 'T', currentTime: 0, isLive: false }),
    ).toContain('signal.me');
  });

  it('builds share intents that carry the URL', () => {
    const context = { url: 'https://tsp.test/w?t=5', title: 'Fight Night', currentTime: 5, isLive: false };
    const [x] = resolveTargets(['x']);

    const href = x?.href?.(context) ?? '';
    expect(href).toContain(encodeURIComponent(context.url));
  });
});

describe('native share', () => {
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    api = createMockApi();
  });

  afterEach(() => {
    removeNativeShare();
    api.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('uses the OS sheet directly when nothing custom is configured', async () => {
    const share = stubNativeShare(() => Promise.resolve());
    const onShare = vi.fn();

    const plugin = createSharePlugin({ url: 'https://tsp.test/w', onShare });
    plugin.init(api as never);
    await plugin.share();

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://tsp.test/w' }),
    );
    expect(onShare).toHaveBeenCalledWith('native', 'https://tsp.test/w');
  });

  it('treats a dismissed sheet as a non-event, not an error', async () => {
    const abort = new Error('dismissed');
    abort.name = 'AbortError';
    stubNativeShare(() => Promise.reject(abort));

    const onError = vi.fn();
    const onShare = vi.fn();
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', onError, onShare });
    plugin.init(api as never);

    await plugin.share();

    expect(onError).not.toHaveBeenCalled();
    expect(onShare).not.toHaveBeenCalled();
  });

  it('reports a genuine native failure', async () => {
    stubNativeShare(() => Promise.reject(new Error('not allowed')));

    const onError = vi.fn();
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', onError });
    plugin.init(api as never);

    await plugin.share();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('hides the native target where the browser has no share sheet', async () => {
    removeNativeShare();
    stubClipboard();

    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['native', 'copy'] });
    plugin.init(api as never);
    await plugin.share();

    const labels = Array.from(api.container.querySelectorAll('.sp-share-label')).map(
      (el) => el.textContent,
    );
    expect(labels).toContain('Copy link');
    expect(labels).not.toContain('Share');
  });
});

describe('copy', () => {
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    api = createMockApi();
    removeNativeShare();
  });

  afterEach(() => {
    api.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('copies the resolved URL', async () => {
    const writeText = stubClipboard();

    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy'] });
    plugin.init(api as never);
    await plugin.share('copy');

    expect(writeText).toHaveBeenCalledWith('https://tsp.test/w');
  });

  it('falls back rather than throwing when the clipboard is blocked', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    // jsdom has no execCommand; absence exercises the final fallback.
    const onError = vi.fn();

    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy'], onError });
    plugin.init(api as never);

    await expect(plugin.share('copy')).resolves.not.toThrow();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('embed target', () => {
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    api = createMockApi();
    removeNativeShare();
    stubClipboard();
  });

  afterEach(() => {
    api.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('is hidden when no embed base URL is configured', async () => {
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy', 'embed'] });
    plugin.init(api as never);
    await plugin.share();

    const labels = Array.from(api.container.querySelectorAll('.sp-share-label')).map(
      (el) => el.textContent,
    );
    expect(labels).not.toContain('Embed');
  });

  it('copies a snippet carrying shareUrl, so the embed shares the page not itself', async () => {
    const writeText = stubClipboard();

    const plugin = createSharePlugin({
      url: 'https://tsp.test/watch/abc',
      targets: ['embed'],
      embedBaseUrl: 'https://cdn.example.com/iframe.html',
    });
    plugin.init(api as never);
    await plugin.share('embed');

    const snippet = writeText.mock.calls[0]?.[0] as string;
    expect(snippet).toContain('<iframe');
    expect(snippet).toContain('cdn.example.com');
    expect(snippet).toContain('shareUrl=');
    expect(snippet).toContain(encodeURIComponent('https://tsp.test/watch/abc'));
  });
});

describe('ShareButton control', () => {
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    api = createMockApi();
  });

  afterEach(() => {
    api.container.remove();
  });

  it('renders a button with an accessible name', () => {
    const button = new ShareButton(api as never, vi.fn());
    const el = button.render();

    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('aria-label')).toBe('Share');
    // Announces that activating it opens a dialog, not navigates away.
    expect(el.getAttribute('aria-haspopup')).toBe('dialog');
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('invokes the activate callback when clicked', () => {
    const onActivate = vi.fn();
    const button = new ShareButton(api as never, onActivate);

    button.render().dispatchEvent(new MouseEvent('click'));

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('stays visible regardless of playback state', () => {
    const button = new ShareButton(api as never, vi.fn());
    const el = button.render();

    // Unlike captions or quality, sharing a page URL is valid before playback
    // has even started, so update() must never hide it.
    button.update();

    expect(el.style.display).toBe('');
  });

  it('detaches its handler on destroy', () => {
    const onActivate = vi.fn();
    const button = new ShareButton(api as never, onActivate);
    const el = button.render();
    api.container.appendChild(el);

    button.destroy();
    el.dispatchEvent(new MouseEvent('click'));

    expect(onActivate).not.toHaveBeenCalled();
    expect(api.container.contains(el)).toBe(false);
  });
});

describe('sheet behaviour', () => {
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    api = createMockApi();
    removeNativeShare();
    stubClipboard();
  });

  afterEach(() => {
    api.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('renders into the player container so it survives fullscreen', async () => {
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy', 'x'] });
    plugin.init(api as never);
    await plugin.share();

    expect(api.container.querySelector('.sp-share-sheet')).not.toBeNull();
    expect(document.body.querySelector(':scope > .sp-share-sheet')).toBeNull();
  });

  it('marks the sheet as a modal dialog', async () => {
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy'] });
    plugin.init(api as never);
    await plugin.share();

    const sheet = api.container.querySelector('.sp-share-sheet');
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');
  });

  it('closes on Escape', async () => {
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy'] });
    plugin.init(api as never);
    await plugin.share();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(api.emit).toHaveBeenCalledWith('share:closed', undefined);
  });

  it('gives every target an accessible name', async () => {
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy', 'x', 'email'] });
    plugin.init(api as never);
    await plugin.share();

    const buttons = Array.from(api.container.querySelectorAll('.sp-share-target'));
    expect(buttons.length).toBe(3);
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('keeps Tab inside the sheet', async () => {
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy', 'x', 'email'] });
    plugin.init(api as never);
    await plugin.share();

    const buttons = api.container.querySelectorAll<HTMLElement>('.sp-share-target');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    // Tab off the end wraps to the start rather than escaping to the page behind.
    last?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    // And Shift+Tab off the start wraps to the end.
    first?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
  });

  it('offers the link for manual copying when the clipboard is blocked', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));

    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy'] });
    plugin.init(api as never);
    await plugin.share();

    api.container.querySelector<HTMLElement>('.sp-share-target')?.dispatchEvent(new MouseEvent('click'));
    await flush();

    // Last resort: show the URL selected, so it can still be copied by hand.
    const input = api.container.querySelector<HTMLInputElement>('.sp-share-fallback input');
    expect(input).not.toBeNull();
    expect(input?.value).toBe('https://tsp.test/w');
    expect(input?.readOnly).toBe(true);
  });

  it('cleans up its DOM on destroy', async () => {
    const plugin = createSharePlugin({ url: 'https://tsp.test/w', targets: ['copy'] });
    plugin.init(api as never);
    await plugin.share();

    plugin.destroy();

    expect(api.container.querySelector('.sp-share-sheet')).toBeNull();
    expect(document.getElementById('sp-share-styles')).toBeNull();
  });
});
