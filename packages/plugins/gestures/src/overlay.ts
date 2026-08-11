/**
 * Gesture surface and feedback.
 *
 * Layering rules that matter, and why:
 *
 * - The surface sits above the gradient and below the control bar, so the
 *   buttons and the progress bar keep every pixel they already own.
 * - It never calls `preventDefault` or `stopPropagation` on a tap. The settings
 *   and quality menus close via document-level click listeners; swallowing the
 *   event would leave them stuck open.
 * - Feedback elements are `pointer-events: none` and `aria-hidden`, with a
 *   single polite live region carrying the announcement instead.
 */

import type { GestureZone, PointerRecord } from './types';

const STYLE_ID = 'sp-gestures-styles';

/** Callbacks the overlay reports pointer activity through. */
export interface OverlayOptions {
  /** Called for every pointer record, already reduced and normalised. */
  onPointer: (record: PointerRecord) => void;
  /** Whether to render ripple and text feedback. */
  feedback: boolean;
}

export const styles = `
.sp-gestures {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  /* The bottom strip belongs to the progress bar and control bar. */
  bottom: 64px;
  z-index: 6;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.sp-gestures__zone {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  color: #fff;
  transition: opacity 0.25s ease;
}

.sp-gestures__zone--left {
  left: 0;
  border-radius: 0 50% 50% 0;
}

.sp-gestures__zone--right {
  right: 0;
  border-radius: 50% 0 0 50%;
}

.sp-gestures__zone--active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.sp-gestures__label {
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.sp-gestures__live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sp-gestures__zone {
    transition: none;
  }
}
`;

export class GestureOverlay {
  private el: HTMLDivElement;
  private zones: Record<'left' | 'right', HTMLDivElement>;
  private labels: Record<'left' | 'right', HTMLSpanElement>;
  private live: HTMLDivElement;
  private styleEl: HTMLStyleElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly pointerHandler = (event: PointerEvent): void => {
    // Mouse and pen are untouched: a desktop viewer's click behaviour must not
    // change just because this plugin is installed.
    if (event.pointerType !== 'touch') return;

    const rect = this.el.getBoundingClientRect();
    const width = rect.width || 1;

    this.options.onPointer({
      type:
        event.type === 'pointerdown'
          ? 'down'
          : event.type === 'pointermove'
            ? 'move'
            : event.type === 'pointerup'
              ? 'up'
              : 'cancel',
      x: event.clientX,
      y: event.clientY,
      fraction: Math.max(0, Math.min(1, (event.clientX - rect.left) / width)),
      pointerId: event.pointerId,
      timeStamp: event.timeStamp,
    });
  };

  constructor(
    private container: HTMLElement,
    private options: OverlayOptions,
  ) {
    this.injectStyles();

    this.el = document.createElement('div');
    this.el.className = 'sp-gestures';

    const left = this.createZone('left');
    const right = this.createZone('right');

    this.zones = { left: left.zone, right: right.zone };
    this.labels = { left: left.label, right: right.label };

    this.live = document.createElement('div');
    this.live.className = 'sp-gestures__live';
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('role', 'status');

    this.el.appendChild(left.zone);
    this.el.appendChild(right.zone);
    this.el.appendChild(this.live);

    this.el.addEventListener('pointerdown', this.pointerHandler);
    this.el.addEventListener('pointermove', this.pointerHandler);
    this.el.addEventListener('pointerup', this.pointerHandler);
    this.el.addEventListener('pointercancel', this.pointerHandler);

    container.appendChild(this.el);
  }

  /** Size the zones to match the recognizer's split. */
  setZoneWidths(left: number, right: number): void {
    this.zones.left.style.width = `${left * 100}%`;
    this.zones.right.style.width = `${right * 100}%`;
  }

  /**
   * Show the cumulative seek for a zone.
   *
   * @param zone - Which side was tapped
   * @param seconds - Total seconds this sequence has moved
   */
  showSeek(zone: GestureZone, seconds: number): void {
    if (zone === 'middle') return;

    const direction = zone === 'right' ? 'forward' : 'back';
    this.live.textContent = `${seconds} seconds ${direction}`;

    if (!this.options.feedback) return;

    const target = this.zones[zone];
    this.labels[zone].textContent = `${seconds} seconds`;
    target.classList.add('sp-gestures__zone--active');

    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.zones.left.classList.remove('sp-gestures__zone--active');
      this.zones.right.classList.remove('sp-gestures__zone--active');
      this.hideTimer = null;
    }, 600);
  }

  /** Announce that a forward seek was refused because the viewer is at the live edge. */
  announceLiveEdge(): void {
    this.live.textContent = 'Already at the live edge';
  }

  destroy(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.el.removeEventListener('pointerdown', this.pointerHandler);
    this.el.removeEventListener('pointermove', this.pointerHandler);
    this.el.removeEventListener('pointerup', this.pointerHandler);
    this.el.removeEventListener('pointercancel', this.pointerHandler);
    this.el.remove();
    this.styleEl?.remove();
    this.styleEl = null;
  }

  /** Exposed for tests and for hosts that want to inspect the surface. */
  getElement(): HTMLElement {
    return this.el;
  }

  private createZone(side: 'left' | 'right'): { zone: HTMLDivElement; label: HTMLSpanElement } {
    const zone = document.createElement('div');
    zone.className = `sp-gestures__zone sp-gestures__zone--${side}`;
    zone.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'sp-gestures__label';
    zone.appendChild(label);

    return { zone, label };
  }

  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    this.styleEl = document.createElement('style');
    this.styleEl.id = STYLE_ID;
    this.styleEl.textContent = styles;
    document.head.appendChild(this.styleEl);
  }
}
