/**
 * QualityMenu Control Tests
 */

import { describe, it, expect, vi } from 'vitest';
import type { MockPluginAPI } from '../mock-api';
import { QualityMenu } from '../../src/controls/QualityMenu';
import type { QualityLevel } from '@scarlett-player/core';

const LEVELS: QualityLevel[] = [
  { id: 'level-0', label: '1080p', width: 1920, height: 1080, bitrate: 5_000_000, active: true },
  { id: 'level-1', label: '720p', width: 1280, height: 720, bitrate: 2_500_000, active: false },
];

function createMockApi(overrides: Record<string, unknown> = {}): MockPluginAPI {
  const state: Record<string, unknown> = {
    qualities: LEVELS,
    currentQuality: LEVELS[0],
    ...overrides,
  };

  const container = document.createElement('div');

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
    defineState: vi.fn(),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as MockPluginAPI;
}

describe('QualityMenu', () => {
  it('opens and closes on the button', () => {
    const api = createMockApi();
    const menu = new QualityMenu(api);
    menu.update();

    const btn = menu.render().querySelector('button') as HTMLButtonElement;

    btn.click();
    expect(menu.isMenuOpen()).toBe(true);

    btn.click();
    expect(menu.isMenuOpen()).toBe(false);

    menu.destroy();
  });

  it('closes itself when the last quality level goes away', () => {
    const api = createMockApi();
    const menu = new QualityMenu(api);
    menu.update();

    (menu.render().querySelector('button') as HTMLButtonElement).click();
    expect(menu.isMenuOpen()).toBe(true);

    // A source switch that drops the rendition list - HLS to a progressive
    // file, say - hides the control.
    api.setState('qualities', []);
    menu.update();

    expect(menu.render().style.display).toBe('none');
    // The control bar's auto-hide waits on isMenuOpen(). Left true behind a
    // display:none wrapper, the bar stayed on screen with nothing holding it.
    expect(menu.isMenuOpen()).toBe(false);

    menu.destroy();
  });

  it('stays closed across an update that leaves it hidden', () => {
    const api = createMockApi({ qualities: [], currentQuality: null });
    const menu = new QualityMenu(api);

    menu.update();
    menu.update();

    expect(menu.isMenuOpen()).toBe(false);

    menu.destroy();
  });
});
