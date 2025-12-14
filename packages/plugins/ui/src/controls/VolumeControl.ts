/**
 * Volume Control
 *
 * Icon button with expandable slider on hover.
 * Tap toggles mute on mobile.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createElement, getVideo } from '../utils';

export class VolumeControl implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;
  private btn: HTMLButtonElement;
  private slider: HTMLDivElement;
  private level: HTMLDivElement;
  private isDragging = false;

  constructor(api: IPluginAPI) {
    this.api = api;

    // Container
    this.el = createElement('div', { className: 'sp-volume' });

    // Button
    this.btn = createElement('button', {
      className: 'sp-control sp-volume__btn',
      'aria-label': 'Mute',
      type: 'button',
    }) as HTMLButtonElement;
    this.btn.innerHTML = icons.volumeHigh;
    this.btn.onclick = () => this.toggleMute();

    // Slider wrapper (expands on hover)
    const sliderWrap = createElement('div', { className: 'sp-volume__slider-wrap' });

    // Slider track
    this.slider = createElement('div', { className: 'sp-volume__slider' });
    this.slider.setAttribute('role', 'slider');
    this.slider.setAttribute('aria-label', 'Volume');
    this.slider.setAttribute('aria-valuemin', '0');
    this.slider.setAttribute('aria-valuemax', '100');
    this.slider.setAttribute('tabindex', '0');

    // Level fill
    this.level = createElement('div', { className: 'sp-volume__level' });
    this.slider.appendChild(this.level);
    sliderWrap.appendChild(this.slider);

    this.el.appendChild(this.btn);
    this.el.appendChild(sliderWrap);

    // Events
    this.slider.addEventListener('mousedown', this.onMouseDown);
    this.slider.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('mousemove', this.onDocMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const volume = this.api.getState('volume') ?? 1;
    const muted = this.api.getState('muted') ?? false;

    // Update icon
    let icon: string;
    let label: string;

    if (muted || volume === 0) {
      icon = icons.volumeMute;
      label = 'Unmute';
    } else if (volume < 0.5) {
      icon = icons.volumeLow;
      label = 'Mute';
    } else {
      icon = icons.volumeHigh;
      label = 'Mute';
    }

    this.btn.innerHTML = icon;
    this.btn.setAttribute('aria-label', label);

    // Update slider
    const displayVolume = muted ? 0 : volume;
    this.level.style.width = `${displayVolume * 100}%`;
    this.slider.setAttribute('aria-valuenow', String(Math.round(displayVolume * 100)));
  }

  private toggleMute(): void {
    const video = getVideo(this.api.container);
    if (!video) return;

    video.muted = !video.muted;
  }

  private setVolume(percent: number): void {
    const video = getVideo(this.api.container);
    if (!video) return;

    const vol = Math.max(0, Math.min(1, percent));
    video.volume = vol;
    if (vol > 0 && video.muted) {
      video.muted = false;
    }
  }

  private getVolumeFromPosition(clientX: number): number {
    const rect = this.slider.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  private onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    this.isDragging = true;
    this.setVolume(this.getVolumeFromPosition(e.clientX));
  };

  private onDocMouseMove = (e: MouseEvent): void => {
    if (this.isDragging) {
      this.setVolume(this.getVolumeFromPosition(e.clientX));
    }
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const video = getVideo(this.api.container);
    if (!video) return;

    const step = 0.1;

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        this.setVolume(video.volume + step);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        this.setVolume(video.volume - step);
        break;
    }
  };

  destroy(): void {
    document.removeEventListener('mousemove', this.onDocMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.el.remove();
  }
}
