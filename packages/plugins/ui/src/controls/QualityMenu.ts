/**
 * Quality Menu Control
 *
 * Dropdown menu with available quality levels.
 * Shows Auto as first option and current quality in button.
 */

import type { IPluginAPI, QualityLevel } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createElement, createButton } from '../utils';

export class QualityMenu implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;
  private btn: HTMLButtonElement;
  private btnLabel: HTMLSpanElement;
  private menu: HTMLDivElement;
  private isOpen = false;
  private closeHandler: (e: MouseEvent) => void;
  private lastQualitiesJson = '';

  constructor(api: IPluginAPI) {
    this.api = api;

    // Container
    this.el = createElement('div', { className: 'sp-quality' });

    // Toggle button with label for current quality
    this.btn = createButton('sp-quality__btn', 'Quality', icons.settings);
    this.btnLabel = createElement('span', { className: 'sp-quality__label' }) as HTMLSpanElement;
    this.btnLabel.textContent = 'Auto';
    this.btn.appendChild(this.btnLabel);

    this.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Dropdown menu
    this.menu = createElement('div', { className: 'sp-quality-menu' });
    this.menu.setAttribute('role', 'menu');

    // Prevent menu clicks from closing immediately
    this.menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    this.el.appendChild(this.btn);
    this.el.appendChild(this.menu);

    // Close on outside click
    this.closeHandler = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node)) {
        this.close();
      }
    };
    document.addEventListener('click', this.closeHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const qualities = this.api.getState('qualities') || [];
    const currentQuality = this.api.getState('currentQuality');

    // Hide if no quality levels
    this.el.style.display = qualities.length > 0 ? '' : 'none';

    // Update button label to show current quality
    this.btnLabel.textContent = currentQuality?.label || 'Auto';

    // Only rebuild menu when qualities actually change
    const qualitiesJson = JSON.stringify(qualities.map(q => q.id));
    const currentId = currentQuality?.id || 'auto';

    if (qualitiesJson !== this.lastQualitiesJson) {
      this.lastQualitiesJson = qualitiesJson;
      this.rebuildMenu(qualities);
    }

    // Update active states without rebuilding
    this.updateActiveStates(currentId);
  }

  private rebuildMenu(qualities: QualityLevel[]): void {
    this.menu.innerHTML = '';

    // Add Auto option first
    const autoItem = this.createMenuItem('Auto', 'auto');
    this.menu.appendChild(autoItem);

    // Add quality levels (sorted by height descending)
    const sorted = [...qualities].sort((a, b) => b.height - a.height);
    for (const q of sorted) {
      if (q.id === 'auto') continue;
      const item = this.createMenuItem(q.label, q.id);
      this.menu.appendChild(item);
    }
  }

  private updateActiveStates(activeId: string): void {
    const items = this.menu.querySelectorAll('.sp-quality-menu__item');
    items.forEach((item) => {
      const id = item.getAttribute('data-quality-id');
      const isActive = id === activeId;
      item.classList.toggle('sp-quality-menu__item--active', isActive);
    });
  }

  private createMenuItem(label: string, qualityId: string): HTMLDivElement {
    const item = createElement('div', {
      className: 'sp-quality-menu__item',
    });
    item.setAttribute('role', 'menuitem');
    item.setAttribute('data-quality-id', qualityId);

    const labelSpan = createElement('span', { className: 'sp-quality-menu__label' });
    labelSpan.textContent = label;
    item.appendChild(labelSpan);

    // Use addEventListener for Safari compatibility
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectQuality(qualityId);
    });

    return item;
  }

  private selectQuality(qualityId: string): void {
    // Emit quality select event - HLS plugin will handle it
    this.api.emit('quality:select', {
      quality: qualityId,
      auto: qualityId === 'auto',
    });
    this.close();
  }

  private toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  private open(): void {
    this.isOpen = true;
    this.menu.classList.add('sp-quality-menu--open');
    this.btn.setAttribute('aria-expanded', 'true');
  }

  private close(): void {
    this.isOpen = false;
    this.menu.classList.remove('sp-quality-menu--open');
    this.btn.setAttribute('aria-expanded', 'false');
  }

  destroy(): void {
    document.removeEventListener('click', this.closeHandler);
    this.el.remove();
  }
}
