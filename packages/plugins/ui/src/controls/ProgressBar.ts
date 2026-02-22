/**
 * Progress Bar Control
 *
 * Seekable progress bar with buffered ranges and time tooltip.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { createElement, getVideo, formatTime, formatLiveTime } from '../utils';
import { ThumbnailPreview } from './ThumbnailPreview';
import type { ThumbnailConfig } from './ThumbnailPreview';

export class ProgressBar implements Control {
  private wrapper: HTMLDivElement;
  private el: HTMLDivElement;
  private api: IPluginAPI;
  private filled: HTMLDivElement;
  private buffered: HTMLDivElement;
  private handle: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private thumbnailPreview: ThumbnailPreview;
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

    // Thumbnail preview
    this.thumbnailPreview = new ThumbnailPreview();

    track.appendChild(this.buffered);
    track.appendChild(this.filled);
    track.appendChild(this.handle);
    this.el.appendChild(track);
    this.el.appendChild(this.thumbnailPreview.getElement());
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
    this.wrapper.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.el.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('mousemove', this.onDocMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('touchmove', this.onDocTouchMove, { passive: false });
    document.addEventListener('touchend', this.onTouchEnd);
    document.addEventListener('touchcancel', this.onTouchEnd);
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

  /** Set thumbnail sprite configuration */
  setThumbnails(config: ThumbnailConfig | null): void {
    this.thumbnailPreview.setConfig(config);
  }

  update(): void {
    const currentTime = this.api.getState('currentTime') || 0;
    const duration = this.api.getState('duration') || 0;
    const bufferedRanges = this.api.getState('buffered');
    const live = this.api.getState('live');
    const seekableRange = this.api.getState('seekableRange');

    // Pick up thumbnails config from state if available
    const thumbnails = this.api.getState('thumbnails') as ThumbnailConfig | undefined;
    if (thumbnails && !this.thumbnailPreview.isConfigured()) {
      this.thumbnailPreview.setConfig(thumbnails);
    }

    // Toggle live mode class on progress bar
    this.el.classList.toggle('sp-progress--live', !!live);

    if (live && seekableRange) {
      // Live DVR mode: progress is relative to seekable range
      const rangeLength = seekableRange.end - seekableRange.start;
      if (rangeLength > 0) {
        const progress = ((currentTime - seekableRange.start) / rangeLength) * 100;
        this.filled.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        this.handle.style.left = `${Math.max(0, Math.min(100, progress))}%`;
      }

      // Update buffered relative to seekable range
      if (bufferedRanges && bufferedRanges.length > 0) {
        const rangeLength = seekableRange.end - seekableRange.start;
        if (rangeLength > 0) {
          const bufferedEnd = bufferedRanges.end(bufferedRanges.length - 1);
          const bufferedPercent = ((bufferedEnd - seekableRange.start) / rangeLength) * 100;
          this.buffered.style.width = `${Math.max(0, Math.min(100, bufferedPercent))}%`;
        }
      }

      // Update aria values for live DVR
      this.el.setAttribute('aria-valuemax', String(Math.floor(seekableRange.end)));
      this.el.setAttribute('aria-valuenow', String(Math.floor(currentTime)));
      this.el.setAttribute('aria-valuetext', `${Math.floor(seekableRange.end - currentTime)} seconds behind live`);
    } else if (duration > 0) {
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

    const live = this.api.getState('live');
    const seekableRange = this.api.getState('seekableRange');

    if (live && seekableRange) {
      // Map percentage to seekable range for live DVR
      const rangeLength = seekableRange.end - seekableRange.start;
      return seekableRange.start + percent * rangeLength;
    }

    const duration = this.api.getState('duration') || 0;
    return percent * duration;
  }

  private updateTooltip(clientX: number): void {
    const rect = this.el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = this.getTimeFromPosition(clientX);

    const live = this.api.getState('live');
    const seekableRange = this.api.getState('seekableRange');

    if (live && seekableRange) {
      // Show time behind live edge (e.g., "-1:30" or "LIVE")
      const behindLive = seekableRange.end - time;
      this.tooltip.textContent = formatLiveTime(behindLive);
    } else {
      this.tooltip.textContent = formatTime(time);
    }
    this.tooltip.style.left = `${percent * 100}%`;

    // Show thumbnail preview if configured
    if (this.thumbnailPreview.isConfigured()) {
      this.thumbnailPreview.show(time, percent);
    }
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

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const video = getVideo(this.api.container);
    this.wasPlayingBeforeDrag = video ? !video.paused : false;
    this.isDragging = true;
    this.el.classList.add('sp-progress--dragging');
    this.lastSeekTime = 0;
    this.seek(e.touches[0].clientX, true);
  };

  private onDocTouchMove = (e: TouchEvent): void => {
    if (this.isDragging) {
      e.preventDefault();
      this.seek(e.touches[0].clientX);
      this.updateVisualPosition(e.touches[0].clientX);
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (this.isDragging) {
      const clientX = e.changedTouches?.[0]?.clientX;
      if (clientX !== undefined) {
        this.seek(clientX, true);
      }
      this.isDragging = false;
      this.el.classList.remove('sp-progress--dragging');

      // Resume playback if was playing before drag
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

      // Hide tooltip on touch end
      this.tooltip.style.opacity = '0';
      this.thumbnailPreview.hide();
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.updateTooltip(e.clientX);
  };

  private onMouseLeave = (): void => {
    if (!this.isDragging) {
      this.tooltip.style.opacity = '0';
      this.thumbnailPreview.hide();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const video = getVideo(this.api.container);
    if (!video) return;

    const step = 5; // seconds
    const live = this.api.getState('live');
    const seekableRange = this.api.getState('seekableRange');

    if (live && seekableRange) {
      // Live DVR: constrain to seekable range
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(seekableRange.start, video.currentTime - step);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(seekableRange.end, video.currentTime + step);
          break;
        case 'Home':
          e.preventDefault();
          video.currentTime = seekableRange.start;
          break;
        case 'End':
          e.preventDefault();
          video.currentTime = seekableRange.end;
          break;
      }
    } else {
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
    this.wrapper.removeEventListener('touchstart', this.onTouchStart);
    document.removeEventListener('mousemove', this.onDocMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('touchmove', this.onDocTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    document.removeEventListener('touchcancel', this.onTouchEnd);
    this.thumbnailPreview.destroy();
    this.wrapper.remove();
  }
}
