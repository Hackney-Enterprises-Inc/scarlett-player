/**
 * Settings Menu Control
 *
 * Consolidated gear menu with sub-menus for Quality and Speed.
 * Replaces standalone QualityMenu with a unified settings panel.
 */

import type { IPluginAPI, QualityLevel, TextTrack } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createElement, createButton } from '../utils';

type Panel = 'main' | 'quality' | 'speed' | 'captions';

const SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: 'Normal', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2 },
];

export class SettingsMenu implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;
  private btn: HTMLButtonElement;
  private panel: HTMLDivElement;
  private isOpen = false;
  private currentPanel: Panel = 'main';
  private closeHandler: (e: MouseEvent) => void;
  private keyHandler: (e: KeyboardEvent) => void;
  private lastQualitiesJson = '';

  constructor(api: IPluginAPI) {
    this.api = api;

    // Container
    this.el = createElement('div', { className: 'sp-settings' });

    // Gear button
    this.btn = createButton('sp-settings__btn', 'Settings', icons.settings);
    this.btn.setAttribute('aria-haspopup', 'true');
    this.btn.setAttribute('aria-expanded', 'false');
    this.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Panel container
    this.panel = createElement('div', { className: 'sp-settings-panel' });
    this.panel.setAttribute('role', 'menu');
    this.panel.addEventListener('click', (e) => e.stopPropagation());

    this.el.appendChild(this.btn);
    this.el.appendChild(this.panel);

    // Close on outside click
    this.closeHandler = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node)) {
        this.close();
      }
    };
    document.addEventListener('click', this.closeHandler);

    // Keyboard handler
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (this.currentPanel !== 'main') {
          this.showPanel('main');
        } else {
          this.close();
          this.btn.focus();
        }
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const qualities = this.api.getState('qualities') || [];

    // Only rebuild when qualities change
    const qualitiesJson = JSON.stringify(qualities.map((q: QualityLevel) => q.id));
    if (qualitiesJson !== this.lastQualitiesJson) {
      this.lastQualitiesJson = qualitiesJson;
      if (this.isOpen && this.currentPanel === 'quality') {
        this.renderQualityPanel();
      }
    }

    // Update active states if panel is open
    if (this.isOpen) {
      if (this.currentPanel === 'quality') {
        this.updateQualityActiveStates();
      } else if (this.currentPanel === 'speed') {
        this.updateSpeedActiveStates();
      } else if (this.currentPanel === 'captions') {
        this.updateCaptionsActiveStates();
      }
    }
  }

  private toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  private open(): void {
    this.isOpen = true;
    this.currentPanel = 'main';
    this.renderMainPanel();
    this.panel.classList.add('sp-settings-panel--open');
    this.btn.setAttribute('aria-expanded', 'true');
  }

  close(): void {
    this.isOpen = false;
    this.currentPanel = 'main';
    this.panel.classList.remove('sp-settings-panel--open');
    this.btn.setAttribute('aria-expanded', 'false');
  }

  private showPanel(panel: Panel): void {
    this.currentPanel = panel;
    switch (panel) {
      case 'main':
        this.renderMainPanel();
        break;
      case 'quality':
        this.renderQualityPanel();
        break;
      case 'speed':
        this.renderSpeedPanel();
        break;
      case 'captions':
        this.renderCaptionsPanel();
        break;
    }
  }

  private renderMainPanel(): void {
    this.panel.innerHTML = '';
    this.panel.className = 'sp-settings-panel sp-settings-panel--open sp-settings-panel--main';

    const qualities = this.api.getState('qualities') || [];
    const currentQuality = this.api.getState('currentQuality');
    const playbackRate = this.api.getState('playbackRate') ?? 1;

    // Quality row (only show if quality levels available)
    if (qualities.length > 0) {
      const qualityRow = this.createMainRow(
        'Quality',
        currentQuality?.label || 'Auto',
        () => this.showPanel('quality')
      );
      this.panel.appendChild(qualityRow);
    }

    // Captions row (only show if text tracks available)
    const textTracks: TextTrack[] = this.api.getState('textTracks') || [];
    if (textTracks.length > 0) {
      const currentTextTrack: TextTrack | null = this.api.getState('currentTextTrack');
      const captionsLabel = currentTextTrack ? currentTextTrack.label : 'Off';
      const captionsRow = this.createMainRow(
        'Captions',
        captionsLabel,
        () => this.showPanel('captions')
      );
      this.panel.appendChild(captionsRow);
    }

    // Speed row
    const speedLabel = playbackRate === 1 ? 'Normal' : `${playbackRate}x`;
    const speedRow = this.createMainRow(
      'Speed',
      speedLabel,
      () => this.showPanel('speed')
    );
    this.panel.appendChild(speedRow);
  }

  private createMainRow(
    label: string,
    value: string,
    onClick: () => void
  ): HTMLDivElement {
    const row = createElement('div', { className: 'sp-settings-panel__row' });
    row.setAttribute('role', 'menuitem');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-haspopup', 'true');

    const labelEl = createElement('span', { className: 'sp-settings-panel__label' });
    labelEl.textContent = label;

    const rightSide = createElement('span', { className: 'sp-settings-panel__value' });
    rightSide.textContent = value;

    const arrow = createElement('span', { className: 'sp-settings-panel__arrow' });
    arrow.innerHTML = icons.chevronDown;

    rightSide.appendChild(arrow);
    row.appendChild(labelEl);
    row.appendChild(rightSide);

    row.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });

    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    });

    return row;
  }

  private renderQualityPanel(): void {
    this.panel.innerHTML = '';
    this.panel.className = 'sp-settings-panel sp-settings-panel--open sp-settings-panel--sub';

    // Back header
    const header = this.createSubHeader('Quality');
    this.panel.appendChild(header);

    const qualities = this.api.getState('qualities') || [];
    const currentQuality = this.api.getState('currentQuality');
    const activeId = currentQuality?.id || 'auto';

    // Auto option
    const autoItem = this.createMenuItem('Auto', 'auto', activeId === 'auto');
    autoItem.addEventListener('click', (e) => {
      e.preventDefault();
      this.selectQuality('auto');
    });
    this.panel.appendChild(autoItem);

    // Quality levels sorted by height descending
    const sorted = [...qualities].sort(
      (a: QualityLevel, b: QualityLevel) => b.height - a.height
    );
    for (const q of sorted) {
      if (q.id === 'auto') continue;
      const item = this.createMenuItem(q.label, q.id, q.id === activeId);
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectQuality(q.id);
      });
      this.panel.appendChild(item);
    }
  }

  private renderSpeedPanel(): void {
    this.panel.innerHTML = '';
    this.panel.className = 'sp-settings-panel sp-settings-panel--open sp-settings-panel--sub';

    // Back header
    const header = this.createSubHeader('Speed');
    this.panel.appendChild(header);

    const currentRate = this.api.getState('playbackRate') ?? 1;

    for (const opt of SPEED_OPTIONS) {
      const isActive = Math.abs(currentRate - opt.value) < 0.01;
      const item = this.createMenuItem(opt.label, String(opt.value), isActive);
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectSpeed(opt.value);
      });
      this.panel.appendChild(item);
    }
  }

  private renderCaptionsPanel(): void {
    this.panel.innerHTML = '';
    this.panel.className = 'sp-settings-panel sp-settings-panel--open sp-settings-panel--sub';

    // Back header
    const header = this.createSubHeader('Captions');
    this.panel.appendChild(header);

    const textTracks: TextTrack[] = this.api.getState('textTracks') || [];
    const currentTextTrack: TextTrack | null = this.api.getState('currentTextTrack');
    const activeId = currentTextTrack?.id || 'off';

    // Off option
    const offItem = this.createMenuItem('Off', 'off', activeId === 'off');
    offItem.addEventListener('click', (e) => {
      e.preventDefault();
      this.selectCaption(null);
    });
    this.panel.appendChild(offItem);

    // Text tracks
    for (const track of textTracks) {
      const item = this.createMenuItem(track.label, track.id, track.id === activeId);
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectCaption(track.id);
      });
      this.panel.appendChild(item);
    }
  }

  private selectCaption(trackId: string | null): void {
    this.api.emit('track:text', { trackId });
    this.close();
  }

  private updateCaptionsActiveStates(): void {
    const currentTextTrack: TextTrack | null = this.api.getState('currentTextTrack');
    const activeId = currentTextTrack?.id || 'off';
    const items = this.panel.querySelectorAll('.sp-settings-panel__item');
    items.forEach((item) => {
      const id = item.getAttribute('data-id');
      item.classList.toggle('sp-settings-panel__item--active', id === activeId);
    });
  }

  private createSubHeader(title: string): HTMLDivElement {
    const header = createElement('div', { className: 'sp-settings-panel__header' });
    header.setAttribute('role', 'menuitem');
    header.setAttribute('tabindex', '0');

    const backArrow = createElement('span', { className: 'sp-settings-panel__back' });
    backArrow.innerHTML = icons.chevronUp;

    const label = createElement('span', { className: 'sp-settings-panel__header-label' });
    label.textContent = title;

    header.appendChild(backArrow);
    header.appendChild(label);

    header.addEventListener('click', (e) => {
      e.preventDefault();
      this.showPanel('main');
    });

    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.showPanel('main');
      }
    });

    return header;
  }

  private createMenuItem(
    label: string,
    dataId: string,
    isActive: boolean
  ): HTMLDivElement {
    const item = createElement('div', {
      className: `sp-settings-panel__item${isActive ? ' sp-settings-panel__item--active' : ''}`,
    });
    item.setAttribute('role', 'menuitem');
    item.setAttribute('tabindex', '0');
    item.setAttribute('data-id', dataId);

    const labelEl = createElement('span');
    labelEl.textContent = label;

    const check = createElement('span', { className: 'sp-settings-panel__check' });
    check.innerHTML = icons.checkmark;

    item.appendChild(labelEl);
    item.appendChild(check);

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });

    return item;
  }

  private selectQuality(qualityId: string): void {
    this.api.emit('quality:select', {
      quality: qualityId,
      auto: qualityId === 'auto',
    });
    this.close();
  }

  private selectSpeed(rate: number): void {
    this.api.emit('playback:ratechange', { rate });

    // Apply to video element directly
    const video = this.api.container.querySelector('video');
    if (video) {
      video.playbackRate = rate;
    }

    this.close();
  }

  private updateQualityActiveStates(): void {
    const currentQuality = this.api.getState('currentQuality');
    const activeId = currentQuality?.id || 'auto';
    const items = this.panel.querySelectorAll('.sp-settings-panel__item');
    items.forEach((item) => {
      const id = item.getAttribute('data-id');
      item.classList.toggle('sp-settings-panel__item--active', id === activeId);
    });
  }

  private updateSpeedActiveStates(): void {
    const currentRate = this.api.getState('playbackRate') ?? 1;
    const items = this.panel.querySelectorAll('.sp-settings-panel__item');
    items.forEach((item) => {
      const id = item.getAttribute('data-id');
      const value = parseFloat(id || '1');
      item.classList.toggle(
        'sp-settings-panel__item--active',
        Math.abs(currentRate - value) < 0.01
      );
    });
  }

  getPanel(): Panel {
    return this.currentPanel;
  }

  isMenuOpen(): boolean {
    return this.isOpen;
  }

  destroy(): void {
    document.removeEventListener('click', this.closeHandler);
    document.removeEventListener('keydown', this.keyHandler);
    this.el.remove();
  }
}
