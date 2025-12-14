/**
 * Fullscreen Button Control
 *
 * Toggles fullscreen mode with webkit fallback for iOS.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, getVideo } from '../utils';

export class FullscreenButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;

  private clickHandler = (): void => {
    this.toggle();
  };

  constructor(api: IPluginAPI) {
    this.api = api;
    this.el = createButton('sp-fullscreen', 'Fullscreen', icons.fullscreen);
    this.el.addEventListener('click', this.clickHandler);
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    const fullscreen = this.api.getState('fullscreen');

    if (fullscreen) {
      this.el.innerHTML = icons.exitFullscreen;
      this.el.setAttribute('aria-label', 'Exit fullscreen');
    } else {
      this.el.innerHTML = icons.fullscreen;
      this.el.setAttribute('aria-label', 'Fullscreen');
    }
  }

  private async toggle(): Promise<void> {
    const container = this.api.container;
    const video = getVideo(container) as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitExitFullscreen?: () => void;
    };

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        // iOS Safari fallback
        video.webkitEnterFullscreen();
      }
    } catch {
      // Fullscreen may not be available
    }
  }

  destroy(): void {
    this.el.removeEventListener('click', this.clickHandler);
    this.el.remove();
  }
}
