/**
 * SettingsMenu Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsMenu } from '../../src/controls/SettingsMenu';
import type { IPluginAPI, QualityLevel, TextTrack } from '@scarlett-player/core';

function createMockApi(overrides: Record<string, unknown> = {}): IPluginAPI {
  const state: Record<string, unknown> = {
    qualities: [],
    currentQuality: null,
    playbackRate: 1,
    ...overrides,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  video.play = vi.fn(() => Promise.resolve());
  video.pause = vi.fn();
  container.appendChild(video);

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
  };
}

const MOCK_TRACKS: TextTrack[] = [
  { id: 'en', label: 'English', language: 'en', kind: 'subtitles', active: false },
  { id: 'es', label: 'Spanish', language: 'es', kind: 'subtitles', active: false },
];

const MOCK_QUALITIES: QualityLevel[] = [
  { id: '360p', label: '360p', height: 360, bitrate: 800000 },
  { id: '720p', label: '720p', height: 720, bitrate: 2500000 },
  { id: '1080p', label: '1080p', height: 1080, bitrate: 5000000 },
];

describe('SettingsMenu', () => {
  let api: ReturnType<typeof createMockApi>;
  let menu: SettingsMenu;

  beforeEach(() => {
    api = createMockApi();
    menu = new SettingsMenu(api);
  });

  afterEach(() => {
    menu.destroy();
  });

  // --- Rendering ---
  it('should render a div element with correct class', () => {
    const el = menu.render();
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('sp-settings')).toBe(true);
  });

  it('should contain a gear button', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn');
    expect(btn).toBeTruthy();
    expect(btn?.getAttribute('aria-label')).toBe('Settings');
    expect(btn?.getAttribute('aria-haspopup')).toBe('true');
    expect(btn?.getAttribute('aria-expanded')).toBe('false');
  });

  it('should contain a hidden panel', () => {
    const el = menu.render();
    const panel = el.querySelector('.sp-settings-panel');
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute('role')).toBe('menu');
    expect(panel?.classList.contains('sp-settings-panel--open')).toBe(false);
  });

  // --- Open / Close ---
  it('should open menu when gear button is clicked', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();
    expect(menu.isMenuOpen()).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('should close menu when gear button is clicked again', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click(); // open
    btn.click(); // close
    expect(menu.isMenuOpen()).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('should close menu on outside click', () => {
    menu.render();
    const btn = menu.render().querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click(); // open
    expect(menu.isMenuOpen()).toBe(true);

    // Simulate outside click
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.isMenuOpen()).toBe(false);
  });

  // --- Main Panel ---
  it('should show Speed row on main panel', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();
    expect(menu.getPanel()).toBe('main');

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    // No quality levels, so only Speed row
    expect(rows.length).toBe(1);
    const labels = Array.from(rows).map(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent
    );
    expect(labels).toContain('Speed');
  });

  it('should show Quality row when quality levels exist', () => {
    api = createMockApi({ qualities: MOCK_QUALITIES });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    expect(rows.length).toBe(2);
    const labels = Array.from(rows).map(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent
    );
    expect(labels).toContain('Quality');
    expect(labels).toContain('Speed');
  });

  it('should display current speed value in main panel', () => {
    api = createMockApi({ playbackRate: 1.5 });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const speedRow = Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    );
    const value = speedRow?.querySelector('.sp-settings-panel__value');
    expect(value?.textContent).toContain('1.5x');
  });

  it('should display "Normal" for 1x speed in main panel', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const speedRow = Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    );
    const value = speedRow?.querySelector('.sp-settings-panel__value');
    expect(value?.textContent).toContain('Normal');
  });

  it('should display current quality label in main panel', () => {
    api = createMockApi({
      qualities: MOCK_QUALITIES,
      currentQuality: { id: '720p', label: '720p' },
    });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const qualityRow = Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Quality'
    );
    const value = qualityRow?.querySelector('.sp-settings-panel__value');
    expect(value?.textContent).toContain('720p');
  });

  // --- Quality Sub-Panel ---
  it('should navigate to quality panel when Quality row is clicked', () => {
    api = createMockApi({ qualities: MOCK_QUALITIES });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const qualityRow = Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Quality'
    ) as HTMLElement;
    qualityRow.click();

    expect(menu.getPanel()).toBe('quality');
  });

  it('should show Auto option and quality levels sorted by height descending', () => {
    api = createMockApi({ qualities: MOCK_QUALITIES });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    // Navigate to quality panel
    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const qualityRow = Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Quality'
    ) as HTMLElement;
    qualityRow.click();

    const items = el.querySelectorAll('.sp-settings-panel__item');
    const labels = Array.from(items).map((i) => i.querySelector('span')?.textContent);
    // Auto first, then sorted descending: 1080p, 720p, 360p
    expect(labels).toEqual(['Auto', '1080p', '720p', '360p']);
  });

  it('should mark Auto as active when no quality is selected', () => {
    api = createMockApi({ qualities: MOCK_QUALITIES, currentQuality: null });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Quality'
    ) as HTMLElement).click();

    const autoItem = el.querySelector('.sp-settings-panel__item[data-id="auto"]');
    expect(autoItem?.classList.contains('sp-settings-panel__item--active')).toBe(true);
  });

  it('should emit quality:select when a quality is chosen', () => {
    api = createMockApi({ qualities: MOCK_QUALITIES });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    // Navigate to quality
    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Quality'
    ) as HTMLElement).click();

    // Select 720p
    const items = el.querySelectorAll('.sp-settings-panel__item');
    const item720 = Array.from(items).find(
      (i) => i.getAttribute('data-id') === '720p'
    ) as HTMLElement;
    item720.click();

    expect(api.emit).toHaveBeenCalledWith('quality:select', {
      quality: '720p',
      auto: false,
    });
    expect(menu.isMenuOpen()).toBe(false);
  });

  it('should emit quality:select with auto flag when Auto is chosen', () => {
    api = createMockApi({
      qualities: MOCK_QUALITIES,
      currentQuality: { id: '720p', label: '720p' },
    });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Quality'
    ) as HTMLElement).click();

    const autoItem = el.querySelector('.sp-settings-panel__item[data-id="auto"]') as HTMLElement;
    autoItem.click();

    expect(api.emit).toHaveBeenCalledWith('quality:select', {
      quality: 'auto',
      auto: true,
    });
  });

  // --- Speed Sub-Panel ---
  it('should navigate to speed panel when Speed row is clicked', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const speedRow = Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    ) as HTMLElement;
    speedRow.click();

    expect(menu.getPanel()).toBe('speed');
  });

  it('should show all speed options', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    ) as HTMLElement).click();

    const items = el.querySelectorAll('.sp-settings-panel__item');
    const labels = Array.from(items).map((i) => i.querySelector('span')?.textContent);
    expect(labels).toEqual(['0.5x', '0.75x', 'Normal', '1.25x', '1.5x', '2x']);
  });

  it('should mark Normal as active at default speed', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    ) as HTMLElement).click();

    const normalItem = el.querySelector('.sp-settings-panel__item[data-id="1"]');
    expect(normalItem?.classList.contains('sp-settings-panel__item--active')).toBe(true);
  });

  it('should apply playback rate when speed option is clicked', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    ) as HTMLElement).click();

    // Select 2x
    const items = el.querySelectorAll('.sp-settings-panel__item');
    const item2x = Array.from(items).find(
      (i) => i.getAttribute('data-id') === '2'
    ) as HTMLElement;
    item2x.click();

    expect(api.emit).toHaveBeenCalledWith('playback:ratechange', { rate: 2 });

    const video = api.container.querySelector('video') as HTMLVideoElement;
    expect(video.playbackRate).toBe(2);
    expect(menu.isMenuOpen()).toBe(false);
  });

  // --- Navigation (back button) ---
  it('should go back to main panel when sub-panel header is clicked', () => {
    api = createMockApi({ qualities: MOCK_QUALITIES });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    // Go to quality
    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Quality'
    ) as HTMLElement).click();
    expect(menu.getPanel()).toBe('quality');

    // Click back header
    const header = el.querySelector('.sp-settings-panel__header') as HTMLElement;
    header.click();
    expect(menu.getPanel()).toBe('main');
  });

  // --- Keyboard Navigation ---
  it('should close menu on Escape key from main panel', () => {
    menu.render();
    const btn = menu.render().querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();
    expect(menu.isMenuOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.isMenuOpen()).toBe(false);
  });

  it('should go back to main panel on Escape from sub-panel', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    // Navigate to speed
    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    ) as HTMLElement).click();
    expect(menu.getPanel()).toBe('speed');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.getPanel()).toBe('main');
    expect(menu.isMenuOpen()).toBe(true); // still open, just went back
  });

  it('should activate row on Enter key', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const row = el.querySelector('.sp-settings-panel__row') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // Should have navigated to the speed panel (only row without quality data)
    expect(menu.getPanel()).toBe('speed');
  });

  it('should activate row on Space key', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const row = el.querySelector('.sp-settings-panel__row') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(menu.getPanel()).toBe('speed');
  });

  // --- ARIA Attributes ---
  it('should have proper ARIA attributes on menu rows', () => {
    api = createMockApi({ qualities: MOCK_QUALITIES });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    rows.forEach((row) => {
      expect(row.getAttribute('role')).toBe('menuitem');
      expect(row.getAttribute('tabindex')).toBe('0');
      expect(row.getAttribute('aria-haspopup')).toBe('true');
    });
  });

  it('should have proper ARIA attributes on menu items', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    // Go to speed panel
    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    ) as HTMLElement).click();

    const items = el.querySelectorAll('.sp-settings-panel__item');
    items.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitem');
      expect(item.getAttribute('tabindex')).toBe('0');
    });
  });

  // --- Update ---
  it('should update active states on quality change', () => {
    api = createMockApi({
      qualities: MOCK_QUALITIES,
      currentQuality: { id: '720p', label: '720p' },
    });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    // Go to quality panel
    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Quality'
    ) as HTMLElement).click();

    // Verify 720p is active
    const item720 = el.querySelector('.sp-settings-panel__item[data-id="720p"]');
    expect(item720?.classList.contains('sp-settings-panel__item--active')).toBe(true);

    // Simulate quality change to 1080p
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentQuality') return { id: '1080p', label: '1080p' };
      if (key === 'qualities') return MOCK_QUALITIES;
      if (key === 'playbackRate') return 1;
      return undefined;
    });
    menu.update();

    const item1080 = el.querySelector('.sp-settings-panel__item[data-id="1080p"]');
    expect(item1080?.classList.contains('sp-settings-panel__item--active')).toBe(true);
    expect(
      el.querySelector('.sp-settings-panel__item[data-id="720p"]')?.classList.contains(
        'sp-settings-panel__item--active'
      )
    ).toBe(false);
  });

  it('should update active states on speed change', () => {
    api = createMockApi({ playbackRate: 1 });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    // Go to speed panel
    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Speed'
    ) as HTMLElement).click();

    // Verify Normal is active
    const normalItem = el.querySelector('.sp-settings-panel__item[data-id="1"]');
    expect(normalItem?.classList.contains('sp-settings-panel__item--active')).toBe(true);

    // Simulate speed change
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playbackRate') return 1.5;
      return undefined;
    });
    menu.update();

    const item15 = el.querySelector('.sp-settings-panel__item[data-id="1.5"]');
    expect(item15?.classList.contains('sp-settings-panel__item--active')).toBe(true);
    expect(
      el.querySelector('.sp-settings-panel__item[data-id="1"]')?.classList.contains(
        'sp-settings-panel__item--active'
      )
    ).toBe(false);
  });

  // --- Captions Sub-Panel ---
  it('should show Captions row when text tracks are available', () => {
    api = createMockApi({ textTracks: MOCK_TRACKS });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const labels = Array.from(rows).map(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent
    );
    expect(labels).toContain('Captions');
  });

  it('should not show Captions row when no text tracks', () => {
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const labels = Array.from(rows).map(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent
    );
    expect(labels).not.toContain('Captions');
  });

  it('should display "Off" when no caption track is active', () => {
    api = createMockApi({ textTracks: MOCK_TRACKS, currentTextTrack: null });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const captionsRow = Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Captions'
    );
    const value = captionsRow?.querySelector('.sp-settings-panel__value');
    expect(value?.textContent).toContain('Off');
  });

  it('should display active track label in Captions row', () => {
    api = createMockApi({
      textTracks: MOCK_TRACKS,
      currentTextTrack: MOCK_TRACKS[0],
    });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    const captionsRow = Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Captions'
    );
    const value = captionsRow?.querySelector('.sp-settings-panel__value');
    expect(value?.textContent).toContain('English');
  });

  it('should navigate to captions panel and show Off + track options', () => {
    api = createMockApi({ textTracks: MOCK_TRACKS });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Captions'
    ) as HTMLElement).click();

    expect(menu.getPanel()).toBe('captions');

    const items = el.querySelectorAll('.sp-settings-panel__item');
    const labels = Array.from(items).map((i) => i.querySelector('span')?.textContent);
    expect(labels).toEqual(['Off', 'English', 'Spanish']);
  });

  it('should emit track:text when selecting a caption track', () => {
    api = createMockApi({ textTracks: MOCK_TRACKS });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Captions'
    ) as HTMLElement).click();

    const items = el.querySelectorAll('.sp-settings-panel__item');
    const spanishItem = Array.from(items).find(
      (i) => i.getAttribute('data-id') === 'es'
    ) as HTMLElement;
    spanishItem.click();

    expect(api.emit).toHaveBeenCalledWith('track:text', { trackId: 'es' });
    expect(menu.isMenuOpen()).toBe(false);
  });

  it('should emit track:text with null when selecting Off', () => {
    api = createMockApi({
      textTracks: MOCK_TRACKS,
      currentTextTrack: MOCK_TRACKS[0],
    });
    menu.destroy();
    menu = new SettingsMenu(api);
    const el = menu.render();
    const btn = el.querySelector('.sp-settings__btn') as HTMLButtonElement;
    btn.click();

    const rows = el.querySelectorAll('.sp-settings-panel__row');
    (Array.from(rows).find(
      (r) => r.querySelector('.sp-settings-panel__label')?.textContent === 'Captions'
    ) as HTMLElement).click();

    const offItem = el.querySelector('.sp-settings-panel__item[data-id="off"]') as HTMLElement;
    offItem.click();

    expect(api.emit).toHaveBeenCalledWith('track:text', { trackId: null });
  });

  // --- Cleanup ---
  it('should remove event listeners on destroy', () => {
    const el = menu.render();
    document.body.appendChild(el);

    const removeClickSpy = vi.spyOn(document, 'removeEventListener');
    menu.destroy();

    expect(removeClickSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(removeClickSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    removeClickSpy.mockRestore();
  });

  it('should remove element on destroy', () => {
    const el = menu.render();
    document.body.appendChild(el);
    expect(document.body.contains(el)).toBe(true);

    menu.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
