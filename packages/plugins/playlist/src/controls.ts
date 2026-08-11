/**
 * Playlist control-bar controls.
 *
 * Three controls, registered under `playlist-previous`, `playlist-next` and
 * `playlist`. A host places them by listing those ids in its control layout.
 *
 * These exist for a concrete viewer problem: an event VOD that opens with a
 * copyright card, a sponsor reel or a preshow the viewer has already seen.
 * Without a skip control the only way past it is to guess with the scrubber.
 */

import type { IPlaylistPlugin, PlaylistTrack } from './types';

/** Matches the Control interface in @scarlett-player/ui without importing it. */
export interface PlaylistControl {
  render(): HTMLElement;
  update(): void;
  destroy(): void;
}

/** 24px icons on a 0 0 24 24 viewBox, matching @scarlett-player/ui. */
export const PLAYLIST_ICONS: Record<string, string> = {
  previous:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M6 6h2v12H6V6zm3.5 6L18 6v12l-8.5-6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M16 6h2v12h-2V6zM6 6l8.5 6L6 18V6z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M3 6h11v2H3V6zm0 5h11v2H3v-2zm0 5h7v2H3v-2zm13-1.5V8l6 3.5-6 3.5z"/></svg>',
};

/**
 * Skip to the next or previous playlist item.
 *
 * Disabled rather than hidden at the ends of the queue: a control that vanishes
 * mid-session moves everything next to it, and the viewer loses their place.
 */
export class PlaylistSkipButton implements PlaylistControl {
  private el: HTMLButtonElement;

  private readonly clickHandler = (): void => {
    if (this.direction === 'next') {
      this.plugin.next();
    } else {
      this.plugin.previous();
    }
  };

  constructor(
    private plugin: IPlaylistPlugin,
    private direction: 'next' | 'previous',
  ) {
    const label = direction === 'next' ? 'Next item' : 'Previous item';

    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = `sp-control sp-playlist-skip sp-playlist-skip--${direction}`;
    this.el.setAttribute('aria-label', label);
    this.el.setAttribute('title', label);
    this.el.innerHTML = PLAYLIST_ICONS[direction];
    this.el.addEventListener('click', this.clickHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const state = this.plugin.getState();

    // A single-item playlist is not a playlist. Hiding both buttons keeps the
    // control bar honest for the overwhelmingly common case of one video.
    if (state.tracks.length <= 1) {
      this.el.style.display = 'none';
      return;
    }

    this.el.style.display = '';
    const enabled = this.direction === 'next' ? state.hasNext : state.hasPrevious;
    this.el.disabled = !enabled;
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}

/** Options for {@link PlaylistPanel}. */
export interface PlaylistPanelOptions {
  /** Called with the index the viewer picked. */
  onSelect: (index: number) => void;
}

/**
 * A button that opens the queue as a list, so a viewer can see what else is
 * there rather than stepping through blind.
 */
export class PlaylistPanel implements PlaylistControl {
  private el: HTMLDivElement;
  private button: HTMLButtonElement;
  private panel: HTMLDivElement;
  private open = false;
  private renderedIds = '';

  private toggleHandler = (event: MouseEvent): void => {
    event.stopPropagation();
    this.setOpen(!this.open);
  };

  private documentClickHandler = (): void => {
    if (this.open) this.setOpen(false);
  };

  private keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.open) {
      this.setOpen(false);
      this.button.focus();
    }
  };

  constructor(
    private plugin: IPlaylistPlugin,
    private options: PlaylistPanelOptions,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'sp-playlist';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'sp-control sp-playlist__button';
    this.button.setAttribute('aria-label', 'Playlist');
    this.button.setAttribute('title', 'Playlist');
    this.button.setAttribute('aria-haspopup', 'true');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = PLAYLIST_ICONS.list;

    this.panel = document.createElement('div');
    this.panel.className = 'sp-playlist__panel';
    this.panel.setAttribute('role', 'menu');
    this.panel.hidden = true;

    this.el.appendChild(this.button);
    this.el.appendChild(this.panel);

    this.button.addEventListener('click', this.toggleHandler);
    document.addEventListener('click', this.documentClickHandler);
    document.addEventListener('keydown', this.keydownHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const state = this.plugin.getState();

    if (state.tracks.length <= 1) {
      this.el.style.display = 'none';
      return;
    }

    this.el.style.display = '';

    // Rebuild only when the queue itself changed. update() runs on every time
    // update, and re-rendering a list under the viewer's cursor loses hover.
    const signature = state.tracks.map((track) => track.id).join('|');
    if (signature !== this.renderedIds) {
      this.renderedIds = signature;
      this.renderPanel(state.tracks, state.currentIndex);
      return;
    }

    this.markActive(state.currentIndex);
  }

  destroy(): void {
    this.button.removeEventListener('click', this.toggleHandler);
    document.removeEventListener('click', this.documentClickHandler);
    document.removeEventListener('keydown', this.keydownHandler);
    this.el.remove();
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.panel.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
    this.el.classList.toggle('sp-playlist--open', open);
  }

  private markActive(currentIndex: number): void {
    const items = this.panel.querySelectorAll('.sp-playlist__item');
    items.forEach((item, index) => {
      item.classList.toggle('sp-playlist__item--active', index === currentIndex);
      item.setAttribute('aria-current', index === currentIndex ? 'true' : 'false');
    });
  }

  private renderPanel(tracks: PlaylistTrack[], currentIndex: number): void {
    this.panel.textContent = '';

    tracks.forEach((track, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sp-playlist__item';
      item.setAttribute('role', 'menuitem');
      item.setAttribute('aria-current', index === currentIndex ? 'true' : 'false');

      if (index === currentIndex) {
        item.classList.add('sp-playlist__item--active');
      }

      const position = document.createElement('span');
      position.className = 'sp-playlist__position';
      position.textContent = String(index + 1);

      const text = document.createElement('span');
      text.className = 'sp-playlist__text';

      const title = document.createElement('span');
      title.className = 'sp-playlist__title';
      title.textContent = track.title ?? `Item ${index + 1}`;
      text.appendChild(title);

      if (track.artist) {
        const artist = document.createElement('span');
        artist.className = 'sp-playlist__artist';
        artist.textContent = track.artist;
        text.appendChild(artist);
      }

      item.appendChild(position);
      item.appendChild(text);

      item.addEventListener('click', (event) => {
        event.stopPropagation();
        this.options.onSelect(index);
        this.setOpen(false);
      });

      this.panel.appendChild(item);
    });
  }
}
