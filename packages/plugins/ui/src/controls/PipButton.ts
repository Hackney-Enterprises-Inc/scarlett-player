/**
 * Picture-in-Picture Button Control
 *
 * Toggles PiP mode. Hidden when unsupported; disabled until the media
 * element has metadata, because requestPictureInPicture() before
 * HAVE_METADATA rejects with InvalidStateError (the production error
 * class behind Sentry COMBATSPORTSNOW-PHP-2EC).
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, getVideo, setAttr, setHTML } from '../utils';

export class PipButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;
  private supported: boolean;

  private clickHandler = (): void => {
    // toggle() catches internally; the extra catch guarantees a PiP failure
    // can never surface as an unhandled rejection from the click path
    void this.toggle().catch(() => {});
  };

  constructor(api: IPluginAPI) {
    this.api = api;
    // Support both standard PiP and Safari's webkit PiP
    const probe = document.createElement('video');
    this.supported = 'pictureInPictureEnabled' in document ||
      'webkitSetPresentationMode' in probe;

    this.el = createButton('sp-pip', 'Picture-in-Picture', icons.pip);
    this.el.addEventListener('click', this.clickHandler);

    // Hide if not supported; otherwise start disabled until media is ready
    if (!this.supported) {
      this.el.style.display = 'none';
    } else {
      this.el.disabled = true;
      this.el.setAttribute('aria-disabled', 'true');
    }
  }

  render(): HTMLElement {
    return this.el;
  }

  /** Whether the media element is ready to enter PiP (metadata loaded). */
  private isMediaReady(): boolean {
    const video = getVideo(this.api.container);
    return !!video && video.readyState >= HTMLMediaElement.HAVE_METADATA;
  }

  update(): void {
    if (!this.supported) return;

    const pip = !!this.api.getState('pip');
    // While in PiP the button must stay usable (to exit) even if the media
    // element resets below HAVE_METADATA mid-recovery
    const enabled = pip || this.isMediaReady();
    this.el.disabled = !enabled;
    setAttr(this.el, 'aria-disabled', String(!enabled));

    setHTML(this.el, pip ? icons.exitPip : icons.pip);
    setAttr(this.el, 'aria-label', pip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture');
    this.el.classList.toggle('sp-pip--active', pip);
  }

  private async toggle(): Promise<void> {
    const video = getVideo(this.api.container) as HTMLVideoElement & {
      webkitPresentationMode?: string;
      webkitSetPresentationMode?: (mode: string) => void;
    };
    if (!video) {
      this.api.logger.warn('PiP: video element not found');
      return;
    }

    // Check if currently in PiP (standard or Safari)
    const isInPip = document.pictureInPictureElement === video ||
      video.webkitPresentationMode === 'picture-in-picture';

    // Readiness gate: entering PiP before the element has metadata rejects
    // with InvalidStateError. Exiting is always allowed.
    if (!isInPip && video.readyState < HTMLMediaElement.HAVE_METADATA) {
      this.api.logger.debug('PiP: ignored, media not ready', {
        readyState: video.readyState,
      });
      return;
    }

    try {
      if (isInPip) {
        // Exit PiP
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (video.webkitSetPresentationMode) {
          // Safari fallback
          video.webkitSetPresentationMode('inline');
        }
        this.api.logger.debug('PiP: exited');
      } else {
        // Enter PiP
        if (video.requestPictureInPicture) {
          await video.requestPictureInPicture();
        } else if (video.webkitSetPresentationMode) {
          // Safari fallback
          video.webkitSetPresentationMode('picture-in-picture');
        }
        this.api.logger.debug('PiP: entered');
      }
    } catch (e) {
      // Never user-facing: a PiP failure leaves playback untouched
      const message = e instanceof Error ? e.message : String(e);
      this.api.logger.warn('PiP: failed', { error: message });
    }
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
