/**
 * Progress Bar Control
 *
 * Seekable progress bar with buffered ranges and time tooltip.
 */

import type { Chapter, IPluginAPI, ThumbnailConfig } from '@scarlett-player/core';
import type { Control } from './Control';
import { createElement, getVideo, formatTime, formatLiveTime } from '../utils';
import { ThumbnailPreview } from './ThumbnailPreview';
import { attachTimelineHost } from '../timeline-registry';
import type {
  TimelineExtension,
  TimelineExtensionFactory,
  TimelineSurface,
} from '../timeline-registry';

/** Keys the progress bar acts on; anything else is left to the page. */
const SEEK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

/** Options the UI plugin passes when it builds the bar's progress control. */
export interface ProgressBarOptions {
  /**
   * Called when a registered timeline extension enters or leaves editing mode.
   *
   * The plugin uses it to hold the control bar visible while an editor is on
   * screen, and to restart the ordinary hide delay when it closes.
   */
  onEditingChange?: (active: boolean) => void;
}

export class ProgressBar implements Control {
  private wrapper: HTMLDivElement;
  private el: HTMLDivElement;
  private api: IPluginAPI;
  private filled: HTMLDivElement;
  private buffered: HTMLDivElement;
  private handle: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private markers: HTMLDivElement;
  private thumbnailPreview: ThumbnailPreview;
  private isDragging = false;
  private lastSeekTime = 0;
  private seekThrottleMs = 100; // Throttle seeks to max 10/sec
  private wasPlayingBeforeDrag = false;
  /** Chapter list the marker layer was last built from, to avoid rebuilding every frame. */
  private renderedChapters: Chapter[] | null = null;
  /** Duration the marker layer was last built against, since positions are a percentage of it. */
  private renderedDuration = 0;

  // --- timeline extension seam (see ../timeline-registry.ts) ---
  /** The layer a registered extension paints into; empty and inert without one. */
  private extensionLayer: HTMLDivElement;
  /** The mounted extension, or null when none is registered. */
  private extension: TimelineExtension | null = null;
  /** Detaches this bar from the registry on destroy. */
  private detachTimelineHost: (() => void) | null = null;
  /** True while the extension holds the pointer: ordinary seeking is suppressed. */
  private extensionDragging = false;
  /** True while the extension is editing: the bar is held open and geometry reserved. */
  private extensionEditing = false;
  private readonly options: ProgressBarOptions;

  /**
   * @param api - The per-player plugin API
   * @param options - Optional hooks; see {@link ProgressBarOptions}
   */
  constructor(api: IPluginAPI, options: ProgressBarOptions = {}) {
    this.api = api;
    this.options = options;

    // Create wrapper (positioned above controls)
    this.wrapper = createElement('div', { className: 'sp-progress-wrapper' });

    // Create progress bar
    this.el = createElement('div', { className: 'sp-progress' });
    const track = createElement('div', { className: 'sp-progress__track' });
    this.buffered = createElement('div', { className: 'sp-progress__buffered' });
    this.filled = createElement('div', { className: 'sp-progress__filled' });
    this.markers = createElement('div', { className: 'sp-progress__markers' });
    this.handle = createElement('div', { className: 'sp-progress__handle' });
    this.tooltip = createElement('div', { className: 'sp-progress__tooltip' });
    this.tooltip.textContent = '0:00';

    // Thumbnail preview
    this.thumbnailPreview = new ThumbnailPreview();

    // Markers sit above the fill so a chapter divider stays visible over
    // watched progress, and below the handle so they never hide the grab point.
    track.appendChild(this.buffered);
    track.appendChild(this.filled);
    track.appendChild(this.markers);
    track.appendChild(this.handle);
    this.el.appendChild(track);
    this.el.appendChild(this.thumbnailPreview.getElement());
    this.el.appendChild(this.tooltip);
    this.wrapper.appendChild(this.el);

    // Sibling of the slider, never a child of it: an editor's own handles are
    // interactive controls in their own right, and nesting them inside
    // role="slider" would hide them from assistive technology behind the
    // slider's semantics. Positioned by CSS onto the rail's own centre line.
    this.extensionLayer = createElement('div', { className: 'sp-progress__extension' });
    this.wrapper.appendChild(this.extensionLayer);

    // Accessibility
    this.el.setAttribute('role', 'slider');
    this.el.setAttribute('aria-label', 'Seek');
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuemax', '0');
    this.el.setAttribute('aria-valuenow', '0');
    this.el.setAttribute('aria-valuetext', '0:00');
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

    // Last: a factory registered before the UI plugin initialised mounts here,
    // and it must not run against a half-built bar.
    this.detachTimelineHost = attachTimelineHost(this.api.container, {
      setFactory: (factory) => this.mountExtension(factory),
    });
  }

  // --------------------------------------------------------------------------
  // Timeline extension seam
  // --------------------------------------------------------------------------

  /**
   * Mount a registered extension factory, replacing any predecessor.
   *
   * The previous extension is destroyed and every lease it held is released
   * first, so a replacement never inherits a stale editing or dragging state.
   *
   * @param factory - The factory to mount, or null to unmount
   */
  private mountExtension(factory: TimelineExtensionFactory | null): void {
    if (this.extension) {
      this.extension.destroy();
      this.extension = null;
      this.setExtensionDragging(false);
      this.setExtensionEditing(false);
      this.extensionLayer.replaceChildren();
    }

    if (!factory) return;

    const surface: TimelineSurface = {
      element: this.extensionLayer,
      getRailRect: () => this.el.getBoundingClientRect(),
      setEditing: (active) => this.setExtensionEditing(active),
      setDragging: (active) => this.setExtensionDragging(active),
    };
    this.extension = factory(surface);
    this.extension.update();
  }

  /** Whether a registered extension is currently editing. */
  isTimelineEditing(): boolean {
    return this.extensionEditing;
  }

  /**
   * Apply the editing lease: reserve the handle lanes and hold the bar open.
   *
   * @param active - Whether the extension is editing
   */
  private setExtensionEditing(active: boolean): void {
    if (this.extensionEditing === active) return;
    this.extensionEditing = active;
    this.wrapper.classList.toggle('sp-progress-wrapper--editing', active);
    if (active) this.show();
    this.options.onEditingChange?.(active);
  }

  /**
   * Apply the pointer lease: suppress ordinary seeking while the extension
   * owns the gesture, and get the hover tooltip out of the way.
   *
   * @param active - Whether the extension owns the pointer
   */
  private setExtensionDragging(active: boolean): void {
    if (this.extensionDragging === active) return;
    this.extensionDragging = active;
    this.wrapper.classList.toggle('sp-progress-wrapper--ext-dragging', active);
    if (active) {
      // A drag that started on a handle is not a scrub: end any seek this bar
      // thought it owned rather than leaving it latched.
      this.isDragging = false;
      this.el.classList.remove('sp-progress--dragging');
      this.tooltip.style.opacity = '0';
      this.thumbnailPreview.hide();
    } else {
      // Cleared, not zeroed - an inline '0' outranks the stylesheet's hover
      // rule and would hide the tooltip for the rest of the session.
      this.tooltip.style.opacity = '';
    }
  }

  /**
   * Whether an input event belongs to the extension rather than to seeking.
   *
   * Two independent reasons, and both are needed: the extension holds the
   * pointer lease (its drag has moved off its handle and onto the rail), or
   * the event started inside the extension layer at all. Touch and mouse
   * compatibility events replay a handle press as a wrapper press, and only
   * the target check catches those.
   *
   * @param event - The incoming pointer, mouse or touch event
   * @returns True when the timeline must not act on it
   */
  private isExtensionInput(event: Event): boolean {
    if (this.extensionDragging) return true;
    const target = event.target;
    return target instanceof Node && this.extensionLayer.contains(target);
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
    const thumbnails = this.api.getState('thumbnails');
    if (thumbnails && !this.thumbnailPreview.isConfigured()) {
      this.thumbnailPreview.setConfig(thumbnails);
    }

    // Toggle live mode class on progress bar
    this.el.classList.toggle('sp-progress--live', !!live);

    this.updateMarkers(duration, live, seekableRange);

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

    // Last, so an extension repaints against the geometry this update settled.
    this.extension?.update();
  }

  /**
   * Label of the chapter containing a point on the timeline.
   *
   * Mirrors the chapters plugin's own lookup: a start time belongs to its
   * chapter, an end time belongs to the next one, and a point in a gap between
   * sparse chapters belongs to neither.
   *
   * @param time - Position in seconds
   * @returns The chapter label, or null when the point is outside every chapter
   */
  private chapterLabelAt(time: number): string | null {
    const chapters = (this.api.getState('chapters') ?? []) as Chapter[];

    for (let i = chapters.length - 1; i >= 0; i--) {
      const chapter = chapters[i];
      if (time < chapter.time) continue;

      const next = chapters[i + 1];
      const end = chapter.endTime ?? (next ? next.time : Infinity);

      return time < end ? chapter.label : null;
    }

    return null;
  }

  /**
   * Paint chapter dividers along the track.
   *
   * Reads the `chapters` state that core owns, so this works whether the list
   * came from the chapters plugin or the host set it directly, and renders
   * nothing at all when there are none.
   *
   * Rebuilds only when the list or the duration actually changed. `update()`
   * runs on every time update, and rebuilding a dozen nodes 4 times a second
   * would churn the DOM for no reason.
   *
   * @param duration - Media duration in seconds
   * @param live - Whether the media is live
   * @param seekableRange - DVR window, when the media is live
   */
  private updateMarkers(
    duration: number,
    live: boolean | undefined,
    seekableRange: { start: number; end: number } | null | undefined
  ): void {
    const chapters = (this.api.getState('chapters') ?? []) as Chapter[];

    // Live without a DVR window has no stable timeline to place markers on:
    // the same second sits at a different position on every refresh.
    const range = live
      ? seekableRange
        ? seekableRange.end - seekableRange.start
        : 0
      : duration;

    if (chapters.length === 0 || range <= 0) {
      if (this.renderedChapters !== null) {
        this.markers.textContent = '';
        this.renderedChapters = null;
        this.renderedDuration = 0;
      }
      return;
    }

    if (chapters === this.renderedChapters && range === this.renderedDuration) {
      return;
    }

    const origin = live && seekableRange ? seekableRange.start : 0;

    this.markers.textContent = '';

    for (const chapter of chapters) {
      // The first chapter almost always starts at 0, where a divider would just
      // be a smudge against the left edge.
      if (chapter.time <= origin) continue;

      const percent = ((chapter.time - origin) / range) * 100;
      if (percent <= 0 || percent >= 100) continue;

      const marker = createElement('div', { className: 'sp-progress__marker' });
      marker.style.left = `${percent}%`;
      marker.title = chapter.label;
      this.markers.appendChild(marker);
    }

    this.renderedChapters = chapters;
    this.renderedDuration = range;
  }

  private getTimeFromPosition(clientX: number): number | null {
    const rect = this.el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

    const live = this.api.getState('live');
    const seekableRange = this.api.getState('seekableRange');

    if (live && seekableRange) {
      // Map percentage to seekable range for live DVR
      const rangeLength = seekableRange.end - seekableRange.start;
      const time = seekableRange.start + percent * rangeLength;
      return Number.isFinite(time) ? time : null;
    }

    const duration = this.api.getState('duration') || 0;
    const time = percent * duration;
    return Number.isFinite(time) ? time : null;
  }

  private updateTooltip(clientX: number): void {
    const rect = this.el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = this.getTimeFromPosition(clientX) ?? 0;

    const live = this.api.getState('live');
    const seekableRange = this.api.getState('seekableRange');

    if (live && seekableRange) {
      // Show time behind live edge (e.g., "-1:30" or "LIVE")
      const behindLive = seekableRange.end - time;
      this.tooltip.textContent = formatLiveTime(behindLive);
    } else {
      this.tooltip.textContent = formatTime(time);
    }

    // Name the chapter under the cursor. On a three hour card "1:47:12" tells a
    // viewer nothing; "Alvarez vs Reyes" is the reason they are scrubbing.
    const chapterLabel = this.chapterLabelAt(time);
    if (chapterLabel) {
      const label = createElement('span', { className: 'sp-progress__tooltip-chapter' });
      label.textContent = chapterLabel;
      this.tooltip.appendChild(label);
    }

    this.tooltip.style.left = `${percent * 100}%`;

    // Show thumbnail preview if configured
    if (this.thumbnailPreview.isConfigured()) {
      this.thumbnailPreview.show(time, percent);
    }
  }

  private onMouseDown = (e: MouseEvent): void => {
    // A press on an extension handle, or anywhere while it owns the pointer,
    // is not a seek. Left unguarded, grabbing a clip handle also scrubbed.
    if (this.isExtensionInput(e)) return;
    e.preventDefault();
    this.extension?.onSeekStart();
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
      this.extension?.onSeekEnd();

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
    if (this.isExtensionInput(e)) return;
    e.preventDefault();
    this.extension?.onSeekStart();
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
      // Also reached by touchcancel, which is the gesture being taken away:
      // the extension hears the same "seek is over" either way.
      this.extension?.onSeekEnd();

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

      // Clear the inline value rather than setting '0': an inline style
      // outranks `.sp-progress-wrapper:hover .sp-progress__tooltip { opacity: 1 }`,
      // so '0' hid the tooltip for the rest of the session.
      this.tooltip.style.opacity = '';
      this.thumbnailPreview.hide();
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    // No hover tooltip over an extension's own controls, and none at all while
    // it is dragging: it would track a pointer that is editing, not scrubbing.
    if (this.isExtensionInput(e)) return;
    this.updateTooltip(e.clientX);
  };

  private onMouseLeave = (): void => {
    if (!this.isDragging) {
      // Clear rather than zero - see onTouchEnd. The stylesheet's hover rule
      // brings the tooltip back on the next hover only if nothing inline wins.
      this.tooltip.style.opacity = '';
      this.thumbnailPreview.hide();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const video = getVideo(this.api.container);
    if (!video) return;
    if (!SEEK_KEYS.has(e.key)) return;

    // Keyboard seeking is a complete gesture in one event, so the extension
    // hears both ends of it - the same contract mouse and touch get.
    this.extension?.onSeekStart();
    try {
      this.applyKeyboardSeek(e, video);
    } finally {
      this.extension?.onSeekEnd();
    }
  };

  /**
   * Apply one keyboard seek to the element.
   *
   * @param e - The key event (already known to be a seek key)
   * @param video - The player's media element
   */
  private applyKeyboardSeek(e: KeyboardEvent, video: HTMLVideoElement): void {
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
  }

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
    if (time !== null && Number.isFinite(time)) {
      video.currentTime = time;
    }
  }

  destroy(): void {
    // Registry first: a rebuilt bar has already attached its replacement, and
    // attachTimelineHost's disposer checks identity before detaching.
    this.detachTimelineHost?.();
    this.detachTimelineHost = null;
    this.extension?.destroy();
    this.extension = null;
    this.wrapper.removeEventListener('mousedown', this.onMouseDown);
    this.wrapper.removeEventListener('mousemove', this.onMouseMove);
    this.wrapper.removeEventListener('mouseleave', this.onMouseLeave);
    this.wrapper.removeEventListener('touchstart', this.onTouchStart);
    this.el.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('mousemove', this.onDocMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('touchmove', this.onDocTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    document.removeEventListener('touchcancel', this.onTouchEnd);
    this.thumbnailPreview.destroy();
    this.wrapper.remove();
  }
}
