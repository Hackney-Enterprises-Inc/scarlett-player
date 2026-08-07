/**
 * Error Overlay Component
 *
 * Displays user-friendly error messages when playback fails.
 * Shows automatically on fatal errors, hides on recovery.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';

/** Error shape accepted by the overlay: a structured PlayerError or plain Error */
export type OverlayError = { code?: string; message?: string } | Error | null;

/**
 * Map internal error codes/messages to user-friendly strings.
 *
 * Structured codes are authoritative when present; the prose match is only a
 * fallback for plain Errors. Provider prose like "fragLoadError" contains
 * none of the matched keywords, so without codes every network outage used
 * to display the generic fallback.
 */
function getUserMessage(error: OverlayError): string {
  if (!error) return 'Something went wrong.';

  const code = (error as { code?: string }).code;
  if (code) {
    switch (code) {
      case 'MEDIA_NETWORK_ERROR':
        return 'Having trouble connecting. Check your internet and try again.';
      case 'MEDIA_DECODE_ERROR':
        return "This video can't be played right now.";
      case 'SOURCE_LOAD_FAILED':
      case 'SOURCE_NOT_SUPPORTED':
      case 'PROVIDER_NOT_FOUND':
        return 'Unable to load video. Please try again.';
      case 'PLAYBACK_FAILED':
        return 'Playback stopped unexpectedly. Please try again.';
      case 'MEDIA_APPEND_ERROR':
        return 'Video playback was interrupted. Please try again.';
      case 'MEDIA_BUFFER_FULL':
        return 'Your device is low on video memory. Close other apps or tabs and try again.';
      case 'PLAYLIST_INVALID':
        return 'The stream is temporarily unavailable. Please try again.';
    }
  }

  const msg = error.message?.toLowerCase() || '';

  // Network-related errors
  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('fetch') ||
    msg.includes('connection')
  ) {
    return 'Having trouble connecting. Check your internet and try again.';
  }

  // Manifest errors (separate from generic network)
  if (msg.includes('manifest')) {
    return 'Unable to load video. Please try again.';
  }

  // Media decode errors
  if (
    msg.includes('decode') ||
    msg.includes('media') ||
    msg.includes('format') ||
    msg.includes('codec')
  ) {
    return "This video can't be played right now.";
  }

  // Source not found
  if (
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('source') ||
    msg.includes('not supported')
  ) {
    return 'Video not found.';
  }

  return 'Something went wrong.';
}

export class ErrorOverlay implements Control {
  private el: HTMLDivElement;
  private api: IPluginAPI;
  private visible = false;
  private lastSource: string | null = null;
  private retryBtn: HTMLButtonElement;
  private dismissBtn: HTMLButtonElement;

  constructor(api: IPluginAPI) {
    this.api = api;

    const overlay = document.createElement('div');
    overlay.className = 'sp-error-overlay';
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');

    const content = document.createElement('div');
    content.className = 'sp-error-overlay__content';

    // Error icon
    const iconEl = document.createElement('div');
    iconEl.className = 'sp-error-overlay__icon';
    iconEl.innerHTML = icons.error;

    // Message
    const messageEl = document.createElement('p');
    messageEl.className = 'sp-error-overlay__message';
    messageEl.textContent = 'Something went wrong.';

    // Actions
    const actions = document.createElement('div');
    actions.className = 'sp-error-overlay__actions';

    this.retryBtn = document.createElement('button');
    this.retryBtn.className = 'sp-error-overlay__retry';
    this.retryBtn.setAttribute('type', 'button');
    this.retryBtn.setAttribute('aria-label', 'Try again');
    this.retryBtn.textContent = 'Try Again';
    this.retryBtn.addEventListener('click', this.handleRetry);

    this.dismissBtn = document.createElement('button');
    this.dismissBtn.className = 'sp-error-overlay__dismiss';
    this.dismissBtn.setAttribute('type', 'button');
    this.dismissBtn.setAttribute('aria-label', 'Go back');
    this.dismissBtn.textContent = 'Go Back';
    this.dismissBtn.addEventListener('click', this.handleDismiss);

    actions.appendChild(this.retryBtn);
    actions.appendChild(this.dismissBtn);

    content.appendChild(iconEl);
    content.appendChild(messageEl);
    content.appendChild(actions);
    overlay.appendChild(content);

    this.el = overlay;
  }

  private handleRetry = (): void => {
    // Prevent double-tap
    if (this.retryBtn.disabled) return;
    this.retryBtn.disabled = true;

    this.hide();
    const source = this.api.getState('source') as { src?: string } | null;
    const src = source?.src || this.lastSource;
    if (src) {
      // The core player listens for error:retry and reloads through the
      // normal provider path, restoring the viewer's position (or the live
      // edge for live streams). Writing to the video element directly here
      // would bypass the provider and leave e.g. a raw manifest URL on an
      // MSE-backed element.
      this.api.emit('error:retry', { src });
    }

    // Re-enable after short delay
    setTimeout(() => {
      this.retryBtn.disabled = false;
    }, 1000);
  };

  private handleDismiss = (): void => {
    this.hide();
    this.api.emit('error:dismiss', undefined);
  };

  render(): HTMLElement {
    return this.el;
  }

  /** Show the error overlay with the given error */
  show(error: OverlayError): void {
    const message = getUserMessage(error);
    const messageEl = this.el.querySelector('.sp-error-overlay__message');
    if (messageEl) {
      messageEl.textContent = message;
    }

    // Save source for retry
    const source = this.api.getState('source') as { src?: string } | null;
    if (source?.src) {
      this.lastSource = source.src;
    }

    this.visible = true;
    this.retryBtn.disabled = false;
    this.el.classList.remove('sp-error-overlay--reconnecting');
    this.el.classList.add('sp-error-overlay--visible');
  }

  /**
   * Show the reconnecting state.
   *
   * Displayed while the provider auto-reconnects after a fatal error, so the
   * viewer sees the player working on the problem instead of a dead-end
   * error. Try Again stays available for viewers who want to force an
   * immediate attempt.
   */
  showReconnecting(): void {
    const messageEl = this.el.querySelector('.sp-error-overlay__message');
    if (messageEl) {
      messageEl.textContent = 'Connection lost. Reconnecting...';
    }

    // Save source for a manual retry during reconnection
    const source = this.api.getState('source') as { src?: string } | null;
    if (source?.src) {
      this.lastSource = source.src;
    }

    this.visible = true;
    this.retryBtn.disabled = false;
    this.el.classList.add('sp-error-overlay--reconnecting');
    this.el.classList.add('sp-error-overlay--visible');
  }

  /** Hide the error overlay */
  hide(): void {
    this.visible = false;
    this.el.classList.remove('sp-error-overlay--visible');
    this.el.classList.remove('sp-error-overlay--reconnecting');
  }

  isVisible(): boolean {
    return this.visible;
  }

  update(): void {
    // Check if playback has recovered
    const playbackState = this.api.getState('playbackState');
    if (
      this.visible &&
      playbackState !== 'error' &&
      playbackState !== 'loading'
    ) {
      const playing = this.api.getState('playing');
      if (playing) {
        this.hide();
      }
    }
  }

  destroy(): void {
    this.retryBtn.removeEventListener('click', this.handleRetry);
    this.dismissBtn.removeEventListener('click', this.handleDismiss);
    this.el.remove();
  }
}

export { getUserMessage };
