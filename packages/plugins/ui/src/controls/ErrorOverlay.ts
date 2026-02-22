/**
 * Error Overlay Component
 *
 * Displays user-friendly error messages when playback fails.
 * Shows automatically on fatal errors, hides on recovery.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { Control } from './Control';
import { icons } from '../icons';

/** Map internal error codes/messages to user-friendly strings */
function getUserMessage(error: Error | null): string {
  if (!error) return 'Something went wrong.';

  const msg = error.message?.toLowerCase() || '';

  // Network-related errors
  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('fetch') ||
    msg.includes('connection') ||
    msg.includes('manifest')
  ) {
    return 'Having trouble connecting. Check your internet and try again.';
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

  constructor(api: IPluginAPI) {
    this.api = api;
    this.el = this.createElement();
  }

  private createElement(): HTMLDivElement {
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

    const retryBtn = document.createElement('button');
    retryBtn.className = 'sp-error-overlay__retry';
    retryBtn.setAttribute('type', 'button');
    retryBtn.setAttribute('aria-label', 'Try again');
    retryBtn.textContent = 'Try Again';
    retryBtn.addEventListener('click', this.handleRetry);
    retryBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleRetry();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'sp-error-overlay__dismiss';
    dismissBtn.setAttribute('type', 'button');
    dismissBtn.setAttribute('aria-label', 'Go back');
    dismissBtn.textContent = 'Go Back';
    dismissBtn.addEventListener('click', this.handleDismiss);
    dismissBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleDismiss();
    });

    actions.appendChild(retryBtn);
    actions.appendChild(dismissBtn);

    content.appendChild(iconEl);
    content.appendChild(messageEl);
    content.appendChild(actions);
    overlay.appendChild(content);

    return overlay;
  }

  private handleRetry = (): void => {
    this.hide();
    const source = this.api.getState('source') as { src?: string } | null;
    const src = source?.src || this.lastSource;
    if (src) {
      this.api.emit('error:retry', { src });
      // Emit load + play through the plugin API
      // The player will handle this via its load/play methods
      const video = this.api.container.querySelector('video');
      if (video) {
        video.src = src;
        video.load();
        video.play().catch(() => {});
      }
    }
  };

  private handleDismiss = (): void => {
    this.hide();
    this.api.emit('error:dismiss', undefined);
  };

  render(): HTMLElement {
    return this.el;
  }

  /** Show the error overlay with the given error */
  show(error: Error | null): void {
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
    this.el.classList.add('sp-error-overlay--visible');
  }

  /** Hide the error overlay */
  hide(): void {
    this.visible = false;
    this.el.classList.remove('sp-error-overlay--visible');
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
    const retryBtn = this.el.querySelector('.sp-error-overlay__retry');
    const dismissBtn = this.el.querySelector('.sp-error-overlay__dismiss');
    retryBtn?.removeEventListener('click', this.handleRetry);
    dismissBtn?.removeEventListener('click', this.handleDismiss);
    this.el.remove();
  }
}

export { getUserMessage };
