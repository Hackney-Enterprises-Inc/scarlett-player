/**
 * OverflowTray Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OverflowTray } from '../../src/controls/OverflowTray';
import { CaptionsButton } from '../../src/controls/CaptionsButton';
import type { IPluginAPI, TextTrack } from '@scarlett-player/core';

const MOCK_TRACKS: TextTrack[] = [
  { id: 'en', label: 'English', language: 'en', kind: 'subtitles', active: false },
];

function createMockApi(overrides: Record<string, unknown> = {}): IPluginAPI {
  const state: Record<string, unknown> = {
    textTracks: [],
    currentTextTrack: null,
    ...overrides,
  };

  const container = document.createElement('div');
  document.body.appendChild(container);

  return {
    pluginId: 'test',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as IPluginAPI;
}

describe('OverflowTray', () => {
  let api: IPluginAPI;
  let tray: OverflowTray;

  const el = (): HTMLElement => tray.render();
  const button = (): HTMLButtonElement =>
    el().querySelector('.sp-overflow__btn') as HTMLButtonElement;
  const panel = (): HTMLElement => el().querySelector('.sp-overflow-tray') as HTMLElement;
  const isOpen = (): boolean => panel().classList.contains('sp-overflow-tray--open');

  /** A plain 44px-ish control element standing in for anything the bar evicts. */
  const adoptable = (className = 'sp-pip'): HTMLElement => {
    const btn = document.createElement('button');
    btn.className = `sp-control ${className}`;

    return btn;
  };

  beforeEach(() => {
    api = createMockApi();
    tray = new OverflowTray(api);
    api.container.appendChild(tray.render());
  });

  afterEach(() => {
    tray.destroy();
    api.container.remove();
  });

  // --- Rendering ---
  it('renders a button and a panel', () => {
    expect(button()).not.toBeNull();
    expect(panel()).not.toBeNull();
    expect(button().getAttribute('aria-label')).toBe('More controls');
    expect(button().getAttribute('aria-haspopup')).toBe('true');
  });

  it('is hidden while it holds nothing', () => {
    // An empty "more" button is a dead affordance, and a desktop bar that fits
    // must look exactly as it did before.
    expect(el().style.display).toBe('none');
  });

  it('appears once it adopts a control', () => {
    tray.adopt(adoptable());

    expect(el().style.display).toBe('');
  });

  it('disappears again when its last control goes back to the bar', () => {
    const control = adoptable();
    tray.adopt(control);

    tray.release(control);

    expect(el().style.display).toBe('none');
  });

  it('stays hidden while everything it holds hid itself', () => {
    // A cast button with no device on the network is in the tray but shows
    // nothing, so the button that opens the tray has nothing to offer either.
    const control = adoptable('sp-cast');
    control.style.display = 'none';

    tray.adopt(control);

    expect(el().style.display).toBe('none');
  });

  it('reports what it holds', () => {
    const control = adoptable();

    expect(tray.holds(control)).toBe(false);
    tray.adopt(control);
    expect(tray.holds(control)).toBe(true);
    tray.release(control);
    expect(tray.holds(control)).toBe(false);
  });

  // --- Open and close ---
  it('opens and closes on the button, tracking aria-expanded', () => {
    tray.adopt(adoptable());

    button().click();
    expect(isOpen()).toBe(true);
    expect(button().getAttribute('aria-expanded')).toBe('true');

    button().click();
    expect(isOpen()).toBe(false);
    expect(button().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on an outside click', () => {
    tray.adopt(adoptable());
    tray.open();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(isOpen()).toBe(false);
  });

  it('stays open when the click lands inside it', () => {
    const control = adoptable();
    tray.adopt(control);
    tray.open();

    control.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(isOpen()).toBe(true);
  });

  it('closes on Escape and gives focus back to the button', () => {
    tray.adopt(adoptable());
    tray.open();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(button());
  });

  it('ignores Escape while it is closed', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

    document.dispatchEvent(event);

    // The settings menu is listening on the same document; swallowing Escape
    // while this tray is shut would take it away from whatever is open.
    expect(event.defaultPrevented).toBe(false);
  });

  it('closes itself when the last visible control hides', () => {
    const control = adoptable();
    tray.adopt(control);
    tray.open();

    control.style.display = 'none';
    tray.refresh();

    expect(isOpen()).toBe(false);
    expect(el().style.display).toBe('none');
  });

  // --- Adoption keeps the control intact ---
  it('keeps an adopted control working, listeners and all', () => {
    // The whole point of moving elements rather than re-rendering them: a
    // CaptionsButton in the tray is the same button, so it still toggles.
    api = createMockApi({ textTracks: MOCK_TRACKS });
    const captions = new CaptionsButton(api);
    captions.update();

    tray.adopt(captions.render());
    captions.render().dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(api.emit).toHaveBeenCalledWith('track:text', { trackId: 'en' });

    captions.destroy();
  });

  it('keeps an adopted control working after it returns to the bar', () => {
    api = createMockApi({ textTracks: MOCK_TRACKS });
    const captions = new CaptionsButton(api);
    captions.update();
    const bar = document.createElement('div');
    document.body.appendChild(bar);

    tray.adopt(captions.render());
    bar.appendChild(tray.release(captions.render()));
    captions.render().dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(api.emit).toHaveBeenCalledWith('track:text', { trackId: 'en' });

    captions.destroy();
    bar.remove();
  });

  it('releases an element it never adopted without throwing', () => {
    const stray = adoptable();

    expect(() => tray.release(stray)).not.toThrow();
  });

  // --- Lifecycle ---
  it('has no state of its own to update', () => {
    expect(() => tray.update()).not.toThrow();
  });

  it('removes its document listeners on destroy', () => {
    tray.adopt(adoptable());
    tray.open();
    const removed = tray.render();

    tray.destroy();

    expect(removed.parentNode).toBeNull();
    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    ).not.toThrow();
  });
});
