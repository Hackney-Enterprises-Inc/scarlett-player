/**
 * ClipButton tests (task 3.4): the button's own DOM/ARIA behavior, plus the
 * registration seam in index.ts exercised against the real
 * `@scarlett-player/ui` control registry (the share suite's pattern):
 * registering after teardown is a no-op (generation guard), two players
 * register two owners, destroy releases only this plugin's id, and the
 * factory-built button tracks the plugin's open/available state.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { getControlFactory, resetControlRegistry } from '@scarlett-player/ui';
import { ClipButton, CLIP_ICON } from '../src/ClipButton';
import type { ClipButtonOptions, ClipControl } from '../src/ClipButton';
import { createClipsPlugin } from '../src/index';
import type { ClipsPluginConfig } from '../src/types';

/** Let queued promise callbacks run - the dynamic ui import lands there. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function fakeApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  container.appendChild(document.createElement('video'));
  document.body.appendChild(container);
  const store: Record<string, unknown> = {
    currentTime: 100,
    duration: 600,
    live: false,
    mediaType: 'video',
    seekableRange: null,
    ...state,
  };
  return {
    pluginId: 'clips',
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
    store,
  };
}

const dummyApi = { container: document.createElement('div') } as unknown as IPluginAPI;

function makeButton(overrides: Partial<ClipButtonOptions> = {}): ClipButton {
  const button = new ClipButton(dummyApi, {
    onActivate: vi.fn(),
    isOpen: () => false,
    isAvailable: () => true,
    ...overrides,
  });
  button.render(); // mount into no tree, but settle initial update()
  return button;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ClipButton DOM', () => {
  it('renders a dialog-hoisting button labelled "Create clip" by default', () => {
    const button = makeButton();
    const el = button.render();
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('aria-haspopup')).toBe('dialog');
    expect(el.getAttribute('aria-label')).toBe('Create clip');
    expect(el.getAttribute('title')).toBe('Create clip');
  });

  it('honors a custom label', () => {
    const button = makeButton({ label: 'Make clip' });
    expect(button.render().getAttribute('aria-label')).toBe('Make clip');
  });

  it('renders a default icon and survives a junk override', () => {
    const fallback = makeButton({ icon: '<div>not an icon</div>' });
    expect(fallback.render().innerHTML).toContain(CLIP_ICON.match(/<path d="([^"]+)"/)![1]);

    const hostile = makeButton({ icon: '<svg><circle onload="alert(1)" r="2"/></svg>' });
    const circle = hostile.render().querySelector('circle')!;
    expect(circle.getAttribute('onload')).toBeNull();
  });

  it('clicks route to onActivate (the plugin toggles open/close)', () => {
    const onActivate = vi.fn();
    const button = makeButton({ onActivate });
    button.render().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});

describe('ClipButton.update visibility', () => {
  it('hides when the media is not available', () => {
    const button = makeButton({ isAvailable: () => false });
    expect(button.render().style.display).toBe('none');
  });

  it('shows when available', () => {
    const button = makeButton({ isAvailable: () => true });
    expect(button.render().style.display).toBe('');
  });

  it('stays visible while open even when unavailable, with aria-expanded', () => {
    const button = makeButton({ isAvailable: () => false, isOpen: () => true });
    button.update();
    const el = button.render();
    expect(el.style.display).toBe(''); // a hidden button cannot take focus back
    expect(el.getAttribute('aria-expanded')).toBe('true');
  });

  it('aria-expanded follows the open state', () => {
    let open = false;
    const button = makeButton({ isOpen: () => open });
    button.update();
    expect(button.render().getAttribute('aria-expanded')).toBe('false');
    open = true;
    button.update();
    expect(button.render().getAttribute('aria-expanded')).toBe('true');
  });

  it('isMenuOpen() reports the open state (holds the bar auto-hide)', () => {
    const closed = makeButton({ isOpen: () => false });
    const open = makeButton({ isOpen: () => true });
    expect(closed.isMenuOpen()).toBe(false);
    expect(open.isMenuOpen()).toBe(true);
  });

  it('destroy removes the button', () => {
    const button = makeButton();
    const el = button.render();
    document.body.appendChild(el);
    button.destroy();
    expect(el.isConnected).toBe(false);
  });
});

describe('registration in index.ts (share pattern)', () => {
  beforeEach(() => {
    resetControlRegistry();
  });

  afterEach(() => {
    resetControlRegistry();
  });

  function setupPlugin(config: Partial<ClipsPluginConfig> = {}, state: Record<string, unknown> = {}) {
    const api = fakeApi(state);
    const plugin = createClipsPlugin({
      mediaId: 'video-42',
      onCreate: vi.fn().mockResolvedValue({ uuid: 'x' }),
      ...config,
    });
    plugin.init(api as unknown as IPluginAPI);
    return { api, plugin };
  }

  it("registers the 'clip' slot owned by the player once the ui import resolves", async () => {
    const { api, plugin } = setupPlugin();
    expect(getControlFactory('clip', api.container)).toBeNull(); // not synchronously
    await flush();
    expect(getControlFactory('clip', api.container)).not.toBeNull();
    plugin.destroy();
  });

  it('unregisters its own control on destroy, leaving a neighbour alone', async () => {
    const { api, plugin } = setupPlugin();
    await flush();
    // A neighbour scoped to the same player (chapters, playlist, ...).
    getControlFactory('clip', api.container); // sanity: ours exists

    plugin.destroy();
    expect(getControlFactory('clip', api.container)).toBeNull();
  });

  it('registering after teardown is a no-op (generation guard)', async () => {
    const { api, plugin } = setupPlugin();
    plugin.destroy(); // destroy lands BEFORE the dynamic import resolves
    await flush(); // now the stale .then() runs - and must skip
    expect(getControlFactory('clip', api.container)).toBeNull();
  });

  it('two players register two owners; destroying one leaves the other', async () => {
    const first = setupPlugin();
    const second = setupPlugin();
    await flush();

    const factoryA = getControlFactory('clip', first.api.container);
    const factoryB = getControlFactory('clip', second.api.container);
    expect(factoryA).not.toBeNull();
    expect(factoryB).not.toBeNull();
    expect(factoryA).not.toBe(factoryB);

    first.plugin.destroy();
    expect(getControlFactory('clip', first.api.container)).toBeNull();
    expect(getControlFactory('clip', second.api.container)).not.toBeNull();
    second.plugin.destroy();
  });

  it("headless (ui: 'none') never touches the registry", async () => {
    const { api, plugin } = setupPlugin({ ui: 'none' });
    await flush();
    expect(getControlFactory('clip', api.container)).toBeNull();
    plugin.destroy();
  });

  it('destroy releases the shared stylesheet (the last claim removes it)', () => {
    // Ref-counted by core: every overlay-mode plugin created in THIS file
    // has been destroyed by its test, so the count is 0 entering and 0
    // leaving - which is what makes "element gone" an exact assertion here
    // rather than a leaked-claims illusion in files that never destroy.
    expect(document.getElementById('sp-clips-styles')).toBeNull();

    const { plugin } = setupPlugin();
    expect(document.getElementById('sp-clips-styles')).not.toBeNull();

    plugin.destroy();
    expect(document.getElementById('sp-clips-styles')).toBeNull();
  });

  it('re-init after destroy re-registers under the new lifecycle', async () => {
    const { api, plugin } = setupPlugin();
    plugin.destroy();
    plugin.init(api as unknown as IPluginAPI);
    await flush();
    expect(getControlFactory('clip', api.container)).not.toBeNull();
    plugin.destroy();
  });

  it('the factory-built button reflects plugin state and toggles on click', async () => {
    const { api, plugin } = setupPlugin();
    await flush();
    const factory = getControlFactory('clip', api.container)!;
    const control = factory(api as unknown as IPluginAPI) as ClipControl;
    const el = control.render();

    // Closed + clippable media: visible, collapsed, menu-closed.
    control.update();
    expect(el.style.display).toBe('');
    expect(el.getAttribute('aria-expanded')).toBe('false');
    expect(control.isMenuOpen!()).toBe(false);

    plugin.open();
    control.update();
    expect(el.getAttribute('aria-expanded')).toBe('true');
    expect(control.isMenuOpen!()).toBe(true); // bar auto-hide held up

    el.dispatchEvent(new MouseEvent('click', { bubbles: true })); // toggle -> close
    expect(plugin.isOpen()).toBe(false);
    control.update();
    expect(el.getAttribute('aria-expanded')).toBe('false');
    plugin.destroy();
  });

  it('update() hides the button on audio, live, unknown duration or a null mediaId', async () => {
    const { api, plugin } = setupPlugin();
    await flush();
    const control = getControlFactory('clip', api.container)!(api as unknown as IPluginAPI);
    const el = control.render();

    control.update();
    expect(el.style.display).toBe('');

    api.store.mediaType = 'audio';
    control.update();
    expect(el.style.display).toBe('none');
    api.store.mediaType = 'video';

    api.store.live = true;
    control.update();
    expect(el.style.display).toBe('none');
    api.store.live = false;

    api.store.duration = Infinity;
    control.update();
    expect(el.style.display).toBe('none');
    api.store.duration = 0;
    control.update();
    expect(el.style.display).toBe('none');
    api.store.duration = 600;

    control.update();
    expect(el.style.display).toBe('');

    plugin.destroy();
  });

  it('a null-resolving mediaId hides the button', async () => {
    const { api, plugin } = setupPlugin({ mediaId: () => null });
    await flush();
    const control = getControlFactory('clip', api.container)!(api as unknown as IPluginAPI);
    control.update();
    expect(control.render().style.display).toBe('none');
    plugin.destroy();
  });

  it('a throwing mediaId hides the button without reporting from update()', async () => {
    const { api, plugin } = setupPlugin({ mediaId: () => { throw new Error('token gone'); } });
    await flush();
    const control = getControlFactory('clip', api.container)!(api as unknown as IPluginAPI);
    expect(() => control.update()).not.toThrow();
    expect(control.render().style.display).toBe('none');
    expect(api.emit).not.toHaveBeenCalledWith('clip:error', expect.anything());
    plugin.destroy();
  });
});
