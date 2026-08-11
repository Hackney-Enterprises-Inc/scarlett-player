/**
 * Playlist control tests.
 *
 * The viewer-facing promise here is small and specific: one press moves past
 * the copyright card, and the control never lies about whether that is possible.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaylistPanel, PlaylistSkipButton } from '../src/controls';
import type { IPlaylistPlugin, PlaylistState, PlaylistTrack } from '../src/types';

const TRACKS: PlaylistTrack[] = [
  { id: '1', src: '/copyright.mp4', title: 'Copyright notice' },
  { id: '2', src: '/main.mp4', title: 'Main event', artist: 'CSN' },
  { id: '3', src: '/outro.mp4', title: 'Outro' },
];

/** Minimal plugin double: the controls only touch these four members. */
function createPluginStub(state: Partial<PlaylistState> = {}) {
  const full: PlaylistState = {
    tracks: TRACKS,
    currentIndex: 0,
    currentTrack: TRACKS[0],
    shuffle: false,
    repeat: 'none',
    shuffleOrder: [],
    hasNext: true,
    hasPrevious: false,
    ...state,
  };

  return {
    getState: vi.fn(() => full),
    next: vi.fn(),
    previous: vi.fn(),
    play: vi.fn(),
    state: full,
  } as unknown as IPlaylistPlugin & {
    getState: ReturnType<typeof vi.fn>;
    next: ReturnType<typeof vi.fn>;
    previous: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    state: PlaylistState;
  };
}

describe('PlaylistSkipButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('advances the queue when pressed, which is how a viewer skips the copyright card', () => {
    const plugin = createPluginStub();
    const button = new PlaylistSkipButton(plugin, 'next');

    button.render().dispatchEvent(new MouseEvent('click'));

    expect(plugin.next).toHaveBeenCalledTimes(1);
  });

  it('goes back when pressed on the previous button', () => {
    const plugin = createPluginStub();
    const button = new PlaylistSkipButton(plugin, 'previous');

    button.render().dispatchEvent(new MouseEvent('click'));

    expect(plugin.previous).toHaveBeenCalledTimes(1);
  });

  it('carries an accessible name', () => {
    const plugin = createPluginStub();

    expect(new PlaylistSkipButton(plugin, 'next').render().getAttribute('aria-label')).toBe(
      'Next item'
    );
    expect(new PlaylistSkipButton(plugin, 'previous').render().getAttribute('aria-label')).toBe(
      'Previous item'
    );
  });

  it('disables rather than hides at the end of the queue, so the bar does not reflow', () => {
    const plugin = createPluginStub({ hasNext: false });
    const button = new PlaylistSkipButton(plugin, 'next');

    button.update();
    const el = button.render() as HTMLButtonElement;

    expect(el.disabled).toBe(true);
    expect(el.style.display).toBe('');
  });

  it('enables when the queue can move', () => {
    const plugin = createPluginStub({ hasNext: true });
    const button = new PlaylistSkipButton(plugin, 'next');

    button.update();

    expect((button.render() as HTMLButtonElement).disabled).toBe(false);
  });

  it('hides entirely for a single item, since that is not a playlist', () => {
    const plugin = createPluginStub({ tracks: [TRACKS[0]] });
    const button = new PlaylistSkipButton(plugin, 'next');

    button.update();

    expect(button.render().style.display).toBe('none');
  });

  it('hides for an empty queue', () => {
    const plugin = createPluginStub({ tracks: [], hasNext: false, hasPrevious: false });
    const button = new PlaylistSkipButton(plugin, 'next');

    button.update();

    expect(button.render().style.display).toBe('none');
  });

  it('detaches its handler on destroy', () => {
    const plugin = createPluginStub();
    const button = new PlaylistSkipButton(plugin, 'next');
    const el = button.render();

    button.destroy();
    el.dispatchEvent(new MouseEvent('click'));

    expect(plugin.next).not.toHaveBeenCalled();
  });
});

describe('PlaylistPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('lists every queue item', () => {
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });

    panel.update();

    expect(panel.render().querySelectorAll('.sp-playlist__item')).toHaveLength(3);
  });

  it('marks the current item', () => {
    const plugin = createPluginStub({ currentIndex: 1 });
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });

    panel.update();
    const items = panel.render().querySelectorAll('.sp-playlist__item');

    expect(items[1].getAttribute('aria-current')).toBe('true');
    expect(items[0].getAttribute('aria-current')).toBe('false');
  });

  it('reports the picked index', () => {
    const onSelect = vi.fn();
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect });

    panel.update();
    (panel.render().querySelectorAll('.sp-playlist__item')[2] as HTMLElement).click();

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('closes after a pick', () => {
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });
    panel.update();
    const el = panel.render();

    (el.querySelector('.sp-playlist__button') as HTMLElement).click();
    expect((el.querySelector('.sp-playlist__panel') as HTMLElement).hidden).toBe(false);

    (el.querySelectorAll('.sp-playlist__item')[0] as HTMLElement).click();

    expect((el.querySelector('.sp-playlist__panel') as HTMLElement).hidden).toBe(true);
  });

  it('starts closed and reports that to assistive tech', () => {
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });
    const el = panel.render();

    expect((el.querySelector('.sp-playlist__panel') as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('.sp-playlist__button')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not rebuild the list when only the current index moved', () => {
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });
    panel.update();
    const firstItem = panel.render().querySelector('.sp-playlist__item');

    plugin.state.currentIndex = 2;
    panel.update();

    expect(panel.render().querySelector('.sp-playlist__item')).toBe(firstItem);
    expect(
      panel.render().querySelectorAll('.sp-playlist__item')[2].getAttribute('aria-current')
    ).toBe('true');
  });

  it('rebuilds when the queue itself changes', () => {
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });
    panel.update();

    plugin.state.tracks = [TRACKS[0], TRACKS[1]];
    panel.update();

    expect(panel.render().querySelectorAll('.sp-playlist__item')).toHaveLength(2);
  });

  it('falls back to a positional title when an item has none', () => {
    const plugin = createPluginStub({
      tracks: [
        { id: 'a', src: '/a.mp4' },
        { id: 'b', src: '/b.mp4' },
      ],
    });
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });

    panel.update();

    expect(panel.render().querySelector('.sp-playlist__title')?.textContent).toBe('Item 1');
  });

  it('hides for a single item', () => {
    const plugin = createPluginStub({ tracks: [TRACKS[0]] });
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });

    panel.update();

    expect(panel.render().style.display).toBe('none');
  });

  it('closes on a document click', () => {
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });
    panel.update();
    const el = panel.render();
    document.body.appendChild(el);

    (el.querySelector('.sp-playlist__button') as HTMLElement).click();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect((el.querySelector('.sp-playlist__panel') as HTMLElement).hidden).toBe(true);
  });

  it('closes on Escape', () => {
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect: vi.fn() });
    panel.update();
    const el = panel.render();

    (el.querySelector('.sp-playlist__button') as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect((el.querySelector('.sp-playlist__panel') as HTMLElement).hidden).toBe(true);
  });

  it('stops listening to the document after destroy', () => {
    const onSelect = vi.fn();
    const plugin = createPluginStub();
    const panel = new PlaylistPanel(plugin, { onSelect });
    panel.update();

    panel.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
