/**
 * Progress Bar Control
 *
 * Seekable progress bar with buffered ranges and time tooltip.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { createElement, getVideo, formatTime } from '../utils';

export class ProgressBar implements Control {
  private wrapper: HTMLDivElement;
  private el: HTMLDivElement;
  private api: IPluginAPI;
  private filled: HTMLDivElement;
  private buffered: HTMLDivElement;
  private handle: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private isDragging = false;
  private lastSeekTime = 0;
  private seekThrottleMs = 100; // Throttle seeks to max 10/sec
  private wasPlayingBeforeDrag = false;

  constructor(api: IPluginAPI) {
    this.api = api;

    // Create wrapper (positioned above controls)
    this.wrapper = createElement('div', { className: 'sp-progress-wrapper' });

    // Create progress bar
    this.el = createElement('div', { className: 'sp-progress' });
    const track = createElement('div', { className: 'sp-progress__track' });
    this.buffered = createElement('div', { className: 'sp-progress__buffered' });
    this.filled = createElement('div', { className: 'sp-progress__filled' });
    this.handle = createElement('div', { className: 'sp-progress__handle' });
    this.tooltip = createElement('div', { className: 'sp-progress__tooltip' });
    this.tooltip.textContent = '0:00';

    track.appendChild(this.buffered);
    track.appendChild(this.filled);
    track.appendChild(this.handle);
    this.el.appendChild(track);
    this.el.appendChild(this.tooltip);
    this.wrapper.appendChild(this.el);

    // Accessibility
    this.el.setAttribute('role', 'slider');
    this.el.setAttribute('aria-label', 'Seek');
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('tabindex', '0');

    // Event listeners - attach to wrapper for larger hit area
    this.wrapper.addEventListener('mousedown', this.onMouseDown);
    this.wrapper.addEventListener('mousemove', this.onMouseMove);
    this.wrapper.addEventListener('mouseleave', this.onMouseLeave);
    this.el.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('mousemove', this.onDocMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  render(): HTMLElement {
    return this.wrapper;
  }

  /** Show the progress bar */
  show(): void {
    this.wrapper.classList.add('sp-progress-wrapper--visible');
  }

  /** Hide the progress bar */
  hide(): void {
    this.wrapper.classList.remove('sp-progress-wrapper--visible');
  }

  update(): void {
    const currentTime = this.api.getState('currentTime') || 0;
    const duration = this.api.getState('duration') || 0;
    const bufferedRanges = this.api.getState('buffered');

    if (duration > 0) {
      const progress = (currentTime / duration) * 100;
      this.filled.style.width = `${progress}%`;
      this.handle.style.left = `${progress}%`;

      // Update buffered
      if (bufferedRanges && bufferedRanges.length > 0) {
        const bufferedEnd = bufferedRanges.end(bufferedRanges.length - 1);
        const bufferedPercent = (bufferedEnd / duration) * 100;
        this.buffered.style.width = `${bufferedPercent}%`;
      }

      // Update aria values
      this.el.setAttribute('aria-valuemax', String(Math.floor(duration)));
      this.el.setAttribute('aria-valuenow', String(Math.floor(currentTime)));
      this.el.setAttribute('aria-valuetext', formatTime(currentTime));
    }
  }

  private getTimeFromPosition(clientX: number): number {
    const rect = this.el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const duration = this.api.getState('duration') || 0;
    return percent * duration;
  }

  private updateTooltip(clientX: number): void {
    const rect = this.el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = this.getTimeFromPosition(clientX);

    this.tooltip.textContent = formatTime(time);
    this.tooltip.style.left = `${percent * 100}%`;
  }

  private onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    const video = getVideo(this.api.container);
    this.wasPlayingBeforeDrag = video ? !video.paused : false;
    this.isDragging = true;
    this.el.classList.add('sp-progress--dragging');
    this.lastSeekTime = 0; // Reset throttle for initial click
    this.seek(e.clientX, true); // Force initial seek
  };

  private onDocMouseMove = (e: MouseEvent): void => {
    if (this.isDragging) {
      this.seek(e.clientX); // Throttled during drag
      // Update visual position immediately even when throttled
      this.updateVisualPosition(e.clientX);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.isDragging) {
      this.seek(e.clientX, true); // Force final seek
      this.isDragging = false;
      this.el.classList.remove('sp-progress--dragging');

      // Resume playback if video was playing before drag
      // Wait for seeked event to avoid stutter
      if (this.wasPlayingBeforeDrag) {
        const video = getVideo(this.api.container);
        if (video && video.paused) {
          const resumePlayback = () => {
            video.removeEventListener('seeked', resumePlayback);
            video.play().catch(() => {});
          };
          video.addEventListener('seeked', resumePlayback);
        }
      }
    }
  };

  private updateVisualPosition(clientX: number): void {
    const rect = this.el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    this.filled.style.width = `${percent * 100}%`;
    this.handle.style.left = `${percent * 100}%`;
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.updateTooltip(e.clientX);
  };

  private onMouseLeave = (): void => {
    if (!this.isDragging) {
      this.tooltip.style.opacity = '0';
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const video = getVideo(this.api.container);
    if (!video) return;

    const step = 5; // seconds
    const duration = this.api.getState('duration') || 0;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - step);
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(duration, video.currentTime + step);
        break;
      case 'Home':
        e.preventDefault();
        video.currentTime = 0;
        break;
      case 'End':
        e.preventDefault();
        video.currentTime = duration;
        break;
    }
  };

  private seek(clientX: number, force = false): void {
    const video = getVideo(this.api.container);
    if (!video) return;

    // Throttle seeks during drag to prevent choppy playback
    const now = Date.now();
    if (!force && this.isDragging && now - this.lastSeekTime < this.seekThrottleMs) {
      return;
    }
    this.lastSeekTime = now;

    const time = this.getTimeFromPosition(clientX);
    video.currentTime = time;
  }

  destroy(): void {
    this.wrapper.removeEventListener('mousedown', this.onMouseDown);
    this.wrapper.removeEventListener('mousemove', this.onMouseMove);
    this.wrapper.removeEventListener('mouseleave', this.onMouseLeave);
    document.removeEventListener('mousemove', this.onDocMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.wrapper.remove();
  }
}
