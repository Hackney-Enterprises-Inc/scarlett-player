/**
 * CaptionsButton Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CaptionsButton } from '../../src/controls/CaptionsButton';
import type { IPluginAPI, TextTrack } from '@scarlett-player/core';

const MOCK_TRACKS: TextTrack[] = [
  { id: 'en', label: 'English', language: 'en', kind: 'subtitles', active: false },
  { id: 'es', label: 'Spanish', language: 'es', kind: 'subtitles', active: false },
];

function createMockApi(overrides: Record<string, unknown> = {}): IPluginAPI {
  const state: Record<string, unknown> = {
    textTracks: [],
    currentTextTrack: null,
    ...overrides,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
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

describe('CaptionsButton', () => {
  let api: ReturnType<typeof createMockApi>;
  let btn: CaptionsButton;

  beforeEach(() => {
    api = createMockApi();
    btn = new CaptionsButton(api);
  });

  afterEach(() => {
    btn.destroy();
  });

  // --- Rendering ---
  it('should render a button with correct class', () => {
    const el = btn.render();
    expect(el.tagName).toBe('BUTTON');
    expect(el.classList.contains('sp-captions')).toBe(true);
  });

  it('should have correct initial aria-label', () => {
    const el = btn.render();
    expect(el.getAttribute('aria-label')).toBe('Captions');
  });

  // --- Visibility ---
  it('should be hidden when no text tracks available', () => {
    const el = btn.render();
    btn.update();
    expect(el.style.display).toBe('none');
  });

  it('should be visible when text tracks are available', () => {
    api = createMockApi({ textTracks: MOCK_TRACKS });
    btn.destroy();
    btn = new CaptionsButton(api);
    const el = btn.render();
    btn.update();
    expect(el.style.display).toBe('');
  });

  // --- Active State ---
  it('should show active icon when a track is selected', () => {
    api = createMockApi({
      textTracks: MOCK_TRACKS,
      currentTextTrack: MOCK_TRACKS[0],
    });
    btn.destroy();
    btn = new CaptionsButton(api);
    const el = btn.render();
    btn.update();

    expect(el.classList.contains('sp-captions--active')).toBe(true);
    expect(el.getAttribute('aria-label')).toBe('Captions: English');
  });

  it('should show inactive icon when no track is selected', () => {
    api = createMockApi({ textTracks: MOCK_TRACKS, currentTextTrack: null });
    btn.destroy();
    btn = new CaptionsButton(api);
    const el = btn.render();
    btn.update();

    expect(el.classList.contains('sp-captions--active')).toBe(false);
    expect(el.getAttribute('aria-label')).toBe('Captions');
  });

  // --- Toggle ---
  it('should emit track:text with first track id when clicked (captions off -> on)', () => {
    api = createMockApi({ textTracks: MOCK_TRACKS, currentTextTrack: null });
    btn.destroy();
    btn = new CaptionsButton(api);
    const el = btn.render();

    el.click();

    expect(api.emit).toHaveBeenCalledWith('track:text', { trackId: 'en' });
  });

  it('should emit track:text with null when clicked (captions on -> off)', () => {
    api = createMockApi({
      textTracks: MOCK_TRACKS,
      currentTextTrack: MOCK_TRACKS[0],
    });
    btn.destroy();
    btn = new CaptionsButton(api);
    const el = btn.render();

    el.click();

    expect(api.emit).toHaveBeenCalledWith('track:text', { trackId: null });
  });

  it('should not emit when no tracks available', () => {
    const el = btn.render();
    el.click();
    expect(api.emit).not.toHaveBeenCalled();
  });

  // --- Cleanup ---
  it('should remove element on destroy', () => {
    const el = btn.render();
    document.body.appendChild(el);
    expect(document.body.contains(el)).toBe(true);

    btn.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
