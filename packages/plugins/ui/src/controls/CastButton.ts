/**
 * Cast Button Control
 *
 * Shared component for Chromecast and AirPlay.
 * Shows in supported browsers, disabled when no devices available.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';
import { createButton, getVideo } from '../utils';

export type CastType = 'chromecast' | 'airplay';

/** Check if browser supports Chromecast (Chrome/Chromium) */
function isChromecastSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
}

/** Check if browser supports AirPlay (Safari) */
function isAirPlaySupported(): boolean {
  if (typeof HTMLVideoElement === 'undefined') return false;
  return typeof (HTMLVideoElement.prototype as any).webkitShowPlaybackTargetPicker === 'function';
}

export class CastButton implements Control {
  private el: HTMLButtonElement;
  private api: IPluginAPI;
  private type: CastType;
  private supported: boolean;

  constructor(api: IPluginAPI, type: CastType) {
    this.api = api;
    this.type = type;
    this.supported = type === 'chromecast' ? isChromecastSupported() : isAirPlaySupported();

    const icon = type === 'chromecast' ? icons.chromecast : icons.airplay;
    const label = type === 'chromecast' ? 'Cast' : 'AirPlay';

    this.el = createButton(`sp-cast sp-cast--${type}`, label, icon);
    this.el.addEventListener('click', () => this.handleClick());

    // Hide completely in unsupported browsers
    if (!this.supported) {
      this.el.style.display = 'none';
    }
  }

  render(): HTMLElement {
    return this.el;
  }

  update(): void {
    // Hide in unsupported browsers
    if (!this.supported) {
      this.el.style.display = 'none';
      return;
    }

    if (this.type === 'chromecast') {
      const available = this.api.getState('chromecastAvailable');
      const active = this.api.getState('chromecastActive');

      // Show button in Chrome, but disable if no devices
      this.el.style.display = '';
      this.el.disabled = !available && !active;
      this.el.classList.toggle('sp-cast--active', !!active);
      this.el.classList.toggle('sp-cast--unavailable', !available && !active);

      if (active) {
        this.el.innerHTML = icons.chromecastConnected;
        this.el.setAttribute('aria-label', 'Stop casting');
      } else {
        this.el.innerHTML = icons.chromecast;
        this.el.setAttribute('aria-label', available ? 'Cast' : 'No Cast devices found');
      }
    } else {
      // AirPlay - always show in Safari since the picker handles device discovery
      // The webkitplaybacktargetavailabilitychanged event is unreliable
      const active = this.api.getState('airplayActive');

      this.el.style.display = '';
      this.el.disabled = false; // Always enabled - picker will show if devices exist
      this.el.classList.toggle('sp-cast--active', !!active);
      this.el.classList.remove('sp-cast--unavailable');
      this.el.setAttribute('aria-label', active ? 'Stop AirPlay' : 'AirPlay');
    }
  }

  private handleClick(): void {
    if (this.type === 'chromecast') {
      this.handleChromecast();
    } else {
      this.handleAirPlay();
    }
  }

  private handleChromecast(): void {
    // Get chromecast plugin and request session
    const chromecast = this.api.getPlugin<{
      requestSession(): Promise<void>;
      endSession(): void;
      isConnected(): boolean;
    }>('chromecast');

    if (!chromecast) return;

    if (chromecast.isConnected()) {
      chromecast.endSession();
    } else {
      chromecast.requestSession().catch(() => {});
    }
  }

  private async handleAirPlay(): Promise<void> {
    // Use the AirPlay plugin which handles switching to native HLS
    const airplayPlugin = this.api.getPlugin<{
      showPicker(): Promise<void>;
    }>('airplay');

    if (airplayPlugin) {
      await airplayPlugin.showPicker();
    } else {
      // Fallback: direct video element call
      const video = getVideo(this.api.container) as HTMLVideoElement & {
        webkitShowPlaybackTargetPicker?: () => void;
      };
      video?.webkitShowPlaybackTargetPicker?.();
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
