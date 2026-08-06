/**
 * PipButton tests (Phase 4 of fix/scarlett-error-absorption).
 *
 * The readiness gate must block PiP entry before HAVE_METADATA (the
 * InvalidStateError class from Sentry COMBATSPORTSNOW-PHP-2EC), every
 * rejection must be caught, the button must be disabled until media is
 * ready, and Safari's webkitSetPresentationMode path gets the same gate.
 *
 * jsdom implements none of the PiP API, so document.pictureInPictureEnabled
 * and the element methods are stubbed per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PipButton } from '../../src/controls/PipButton';
import type { IPluginAPI } from '@scarlett-player/core';

/** Flush pending microtasks so async click handlers settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Force the element's readyState (jsdom always reports 0). */
const setReadyState = (video: HTMLVideoElement, value: number): void => {
  Object.defineProperty(video, 'readyState', { value, configurable: true });
};

interface TestContext {
  api: IPluginAPI;
  container: HTMLElement;
  video: HTMLVideoElement;
  state: Record<string, unknown>;
}

const createMockApi = (): TestContext => {
  const state: Record<string, unknown> = { pip: false, playing: false };
  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  const api = {
    pluginId: 'ui-controls',
    container,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(),
    onDestroy: vi.fn(),
  } as unknown as IPluginAPI;

  return { api, container, video, state };
};

describe('PipButton', () => {
  let ctx: TestContext;
  let button: PipButton | null = null;

  beforeEach(() => {
    // Declare PiP support on the jsdom document
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(document, 'pictureInPictureElement', {
      value: null,
      writable: true,
      configurable: true,
    });
    (document as any).exitPictureInPicture = vi.fn().mockResolvedValue(undefined);

    ctx = createMockApi();
  });

  afterEach(() => {
    button?.destroy();
    button = null;
    ctx.container.remove();
    delete (document as any).pictureInPictureEnabled;
    delete (document as any).pictureInPictureElement;
    delete (document as any).exitPictureInPicture;
    vi.restoreAllMocks();
  });

  describe('readiness gate', () => {
    it('does not request PiP before metadata is loaded', async () => {
      const request = vi.fn().mockResolvedValue({});
      (ctx.video as any).requestPictureInPicture = request;
      setReadyState(ctx.video, 0);

      button = new PipButton(ctx.api);
      // The button is disabled while unready, so a user can't click it;
      // dispatch synthetically to prove the gate holds even if something
      // reaches the handler anyway (defense in depth)
      button.render().dispatchEvent(new MouseEvent('click'));
      await flush();

      expect(request).not.toHaveBeenCalled();
      expect(ctx.api.logger.debug).toHaveBeenCalledWith(
        'PiP: ignored, media not ready',
        { readyState: 0 }
      );
    });

    it('requests PiP once metadata is loaded', async () => {
      const request = vi.fn().mockResolvedValue({});
      (ctx.video as any).requestPictureInPicture = request;
      setReadyState(ctx.video, HTMLMediaElement.HAVE_METADATA);

      button = new PipButton(ctx.api);
      button.update();
      button.render().click();
      await flush();

      expect(request).toHaveBeenCalledTimes(1);
    });

    it('always allows exiting PiP regardless of readyState', async () => {
      setReadyState(ctx.video, 0);
      (document as any).pictureInPictureElement = ctx.video;
      ctx.state.pip = true;

      button = new PipButton(ctx.api);
      // In-PiP keeps the button enabled even though media is unready
      button.update();
      expect((button.render() as HTMLButtonElement).disabled).toBe(false);

      button.render().click();
      await flush();

      expect((document as any).exitPictureInPicture).toHaveBeenCalledTimes(1);
    });

    it('gates the Safari webkitSetPresentationMode path too', async () => {
      const setMode = vi.fn();
      (ctx.video as any).webkitSetPresentationMode = setMode;
      (ctx.video as any).webkitPresentationMode = 'inline';

      setReadyState(ctx.video, 0);
      button = new PipButton(ctx.api);
      button.render().dispatchEvent(new MouseEvent('click'));
      await flush();
      expect(setMode).not.toHaveBeenCalled();

      setReadyState(ctx.video, HTMLMediaElement.HAVE_METADATA);
      button.update();
      button.render().click();
      await flush();
      expect(setMode).toHaveBeenCalledWith('picture-in-picture');
    });
  });

  describe('rejection safety', () => {
    it('catches a rejected requestPictureInPicture and only logs a warning', async () => {
      (ctx.video as any).requestPictureInPicture = vi
        .fn()
        .mockRejectedValue(
          new Error('The video element is not ready to enter Picture-in-Picture mode.')
        );
      setReadyState(ctx.video, HTMLMediaElement.HAVE_METADATA);

      button = new PipButton(ctx.api);
      button.update();
      button.render().click();
      await flush();

      // An escaped rejection would fail the test run; assert the warn path
      expect(ctx.api.logger.warn).toHaveBeenCalledWith('PiP: failed', {
        error: 'The video element is not ready to enter Picture-in-Picture mode.',
      });
    });

    it('survives a non-Error rejection value', async () => {
      (ctx.video as any).requestPictureInPicture = vi.fn().mockRejectedValue('denied');
      setReadyState(ctx.video, HTMLMediaElement.HAVE_METADATA);

      button = new PipButton(ctx.api);
      button.update();
      button.render().click();
      await flush();

      expect(ctx.api.logger.warn).toHaveBeenCalledWith('PiP: failed', {
        error: 'denied',
      });
    });
  });

  describe('disabled-until-ready affordance', () => {
    it('starts disabled and enables once metadata is loaded', () => {
      button = new PipButton(ctx.api);
      const el = button.render() as HTMLButtonElement;

      expect(el.disabled).toBe(true);
      expect(el.getAttribute('aria-disabled')).toBe('true');

      setReadyState(ctx.video, 0);
      button.update();
      expect(el.disabled).toBe(true);

      setReadyState(ctx.video, HTMLMediaElement.HAVE_METADATA);
      button.update();
      expect(el.disabled).toBe(false);
      expect(el.getAttribute('aria-disabled')).toBe('false');
    });

    it('swaps the icon and label with pip state', () => {
      setReadyState(ctx.video, HTMLMediaElement.HAVE_METADATA);
      button = new PipButton(ctx.api);
      const el = button.render();
      button.update();

      const inactive_markup = el.innerHTML;
      expect(el.getAttribute('aria-label')).toBe('Picture-in-Picture');
      expect(el.classList.contains('sp-pip--active')).toBe(false);

      ctx.state.pip = true;
      button.update();

      expect(el.innerHTML).not.toBe(inactive_markup);
      expect(el.getAttribute('aria-label')).toBe('Exit Picture-in-Picture');
      expect(el.classList.contains('sp-pip--active')).toBe(true);
    });
  });

  describe('unsupported environment', () => {
    it('hides the button when no PiP API exists', () => {
      delete (document as any).pictureInPictureEnabled;

      button = new PipButton(ctx.api);
      const el = button.render();

      expect(el.style.display).toBe('none');
    });
  });
});
