/**
 * Picture-in-Picture Button Control
 *
 * Toggles PiP mode. Hidden when not supported.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, getVideo } from '../utils';

export class PipButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;
  private supported: boolean;

  private clickHandler = (): void => {
    this.toggle();
  };

  constructor(api: IPluginAPI) {
    this.api = api;
    // Support both standard PiP and Safari's webkit PiP
    const video = document.createElement('video');
    this.supported = 'pictureInPictureEnabled' in document ||
      'webkitSetPresentationMode' in video;

    this.el = createButton('sp-pip', 'Picture-in-Picture', icons.pip);
    this.el.addEventListener('click', this.clickHandler);

    // Hide if not supported
    if (!this.supported) {
      this.el.style.display = 'none';
    }
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    if (!this.supported) return;

    const pip = this.api.getState('pip');
    this.el.setAttribute('aria-label', pip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture');
    this.el.classList.toggle('sp-pip--active', !!pip);
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

    try {
      // Check if currently in PiP (standard or Safari)
      const isInPip = document.pictureInPictureElement === video ||
        video.webkitPresentationMode === 'picture-in-picture';

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
      this.api.logger.warn('PiP: failed', { error: (e as Error).message });
    }
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
