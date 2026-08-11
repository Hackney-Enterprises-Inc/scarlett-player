/**
 * Chapter List Control
 *
 * A control-bar button that opens a scrollable list of chapters. Registered
 * with the UI package under the id `chapters`, so a host places it by listing
 * that id in its control layout.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { ResolvedChapter } from './types';
import { CHAPTERS_ICON } from './icon';

/** Options for {@link ChapterList}. */
export interface ChapterListOptions {
  /** Called with the chapter index the viewer picked. */
  onSelect: (index: number) => void;
}

/**
 * Format a chapter start time the way a viewer reads it: h:mm:ss for anything
 * an hour or longer, m:ss below that. Event VODs run past an hour routinely, so
 * the hour part cannot be dropped.
 *
 * @param seconds - Chapter start time
 * @returns Display string
 */
export function formatChapterTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export class ChapterList {
  private el: HTMLDivElement;
  private button: HTMLButtonElement;
  private panel: HTMLDivElement;
  private chapters: ResolvedChapter[] = [];
  private activeIndex = -1;
  private open = false;
  private onSelect: (index: number) => void;
  private api: IPluginAPI | null = null;

  private toggleHandler = (event: MouseEvent): void => {
    // The panel closes on any document click. Without this the same click that
    // opened it would immediately close it again.
    event.stopPropagation();
    this.setOpen(!this.open);
  };

  private documentClickHandler = (): void => {
    if (this.open) {
      this.setOpen(false);
    }
  };

  private keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.open) {
      this.setOpen(false);
      this.button.focus();
    }
  };

  constructor(options: ChapterListOptions) {
    this.onSelect = options.onSelect;

    this.el = document.createElement('div');
    this.el.className = 'sp-chapters';

    this.button = document.createElement('button');
    this.button.className = 'sp-control sp-chapters__button';
    this.button.type = 'button';
    this.button.setAttribute('aria-label', 'Chapters');
    this.button.setAttribute('aria-haspopup', 'true');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = CHAPTERS_ICON;

    this.panel = document.createElement('div');
    this.panel.className = 'sp-chapters__panel';
    this.panel.setAttribute('role', 'menu');
    this.panel.hidden = true;

    this.el.appendChild(this.button);
    this.el.appendChild(this.panel);

    this.button.addEventListener('click', this.toggleHandler);
    document.addEventListener('click', this.documentClickHandler);
    document.addEventListener('keydown', this.keydownHandler);
  }

  /** Give the control access to the player, once the UI package hands it over. */
  attach(api: IPluginAPI): void {
    this.api = api;
  }

  render(): HTMLElement {
    return this.el;
  }

  /**
   * Hide the whole control when the media has no chapters.
   *
   * A chapters button that opens an empty panel is worse than no button, and
   * most media has no chapters at all.
   */
  update(): void {
    this.el.style.display = this.chapters.length > 0 ? '' : 'none';
  }

  /** Replace the rendered list. */
  setChapters(chapters: ResolvedChapter[]): void {
    this.chapters = chapters;
    this.renderPanel();
    this.update();
  }

  /** Mark a chapter as the one holding the playhead. -1 clears the marking. */
  setActiveIndex(index: number): void {
    if (index === this.activeIndex) return;

    this.activeIndex = index;

    const items = this.panel.querySelectorAll('.sp-chapters__item');
    items.forEach((item, i) => {
      item.classList.toggle('sp-chapters__item--active', i === index);
      item.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
  }

  destroy(): void {
    this.button.removeEventListener('click', this.toggleHandler);
    document.removeEventListener('click', this.documentClickHandler);
    document.removeEventListener('keydown', this.keydownHandler);
    this.el.remove();
    this.api = null;
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.panel.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
    this.el.classList.toggle('sp-chapters--open', open);

    if (open && this.activeIndex >= 0) {
      const active = this.panel.querySelectorAll('.sp-chapters__item')[this.activeIndex];
      active?.scrollIntoView({ block: 'nearest' });
    }
  }

  private renderPanel(): void {
    this.panel.textContent = '';

    this.chapters.forEach((chapter, index) => {
      const item = document.createElement('button');
      item.className = 'sp-chapters__item';
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.setAttribute('aria-current', index === this.activeIndex ? 'true' : 'false');

      if (index === this.activeIndex) {
        item.classList.add('sp-chapters__item--active');
      }

      const time = document.createElement('span');
      time.className = 'sp-chapters__time';
      time.textContent = formatChapterTime(chapter.time);

      const text = document.createElement('span');
      text.className = 'sp-chapters__text';

      const label = document.createElement('span');
      label.className = 'sp-chapters__label';
      label.textContent = chapter.label;
      text.appendChild(label);

      if (chapter.subtitle) {
        const subtitle = document.createElement('span');
        subtitle.className = 'sp-chapters__subtitle';
        subtitle.textContent = chapter.subtitle;
        text.appendChild(subtitle);
      }

      item.appendChild(time);
      item.appendChild(text);

      item.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onSelect(index);
        this.setOpen(false);
      });

      this.panel.appendChild(item);
    });
  }
}
