/**
 * ThumbnailPreview Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThumbnailPreview } from '../../src/controls/ThumbnailPreview';
import type { ThumbnailConfig } from '../../src/controls/ThumbnailPreview';

const MOCK_CONFIG: ThumbnailConfig = {
  src: 'https://example.com/sprites.jpg',
  width: 160,
  height: 90,
  columns: 10,
  interval: 10, // one thumbnail every 10 seconds
};

describe('ThumbnailPreview', () => {
  let preview: ThumbnailPreview;

  beforeEach(() => {
    preview = new ThumbnailPreview();
  });

  afterEach(() => {
    preview.destroy();
  });

  it('should create element with correct class', () => {
    const el = preview.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('sp-thumbnail-preview')).toBe(true);
  });

  it('should contain an image div', () => {
    const el = preview.getElement();
    const img = el.querySelector('.sp-thumbnail-preview__img');
    expect(img).toBeTruthy();
  });

  it('should not be configured initially', () => {
    expect(preview.isConfigured()).toBe(false);
  });

  it('should be configured after setConfig', () => {
    preview.setConfig(MOCK_CONFIG);
    expect(preview.isConfigured()).toBe(true);
  });

  it('should not be configured after setConfig(null)', () => {
    preview.setConfig(MOCK_CONFIG);
    preview.setConfig(null);
    expect(preview.isConfigured()).toBe(false);
  });

  it('should set dimensions from config', () => {
    preview.setConfig(MOCK_CONFIG);
    const el = preview.getElement();
    expect(el.style.width).toBe('160px');
    expect(el.style.height).toBe('90px');
  });

  it('should hide when show called without config', () => {
    preview.show(30, 0.5);
    const el = preview.getElement();
    expect(el.style.display).toBe('none');
  });

  it('should calculate correct sprite position for first frame', () => {
    preview.setConfig(MOCK_CONFIG);
    // Simulate image loaded
    (preview as any).loaded = true;

    preview.show(5, 0.1); // 5s -> index 0 -> col 0, row 0

    const img = preview.getElement().querySelector('.sp-thumbnail-preview__img') as HTMLDivElement;
    expect(img.style.backgroundPosition).toBe('0px 0px');
    expect(img.style.backgroundImage).toContain('sprites.jpg');
  });

  it('should calculate correct sprite position for middle frames', () => {
    preview.setConfig(MOCK_CONFIG);
    (preview as any).loaded = true;

    // 25s -> index 2 -> col 2, row 0
    preview.show(25, 0.5);
    const img = preview.getElement().querySelector('.sp-thumbnail-preview__img') as HTMLDivElement;
    expect(img.style.backgroundPosition).toBe(`-${2 * 160}px 0px`);
  });

  it('should wrap to next row after columns', () => {
    preview.setConfig(MOCK_CONFIG);
    (preview as any).loaded = true;

    // 105s -> index 10 -> col 0, row 1
    preview.show(105, 0.5);
    const img = preview.getElement().querySelector('.sp-thumbnail-preview__img') as HTMLDivElement;
    expect(img.style.backgroundPosition).toBe(`0px -${90}px`);
  });

  it('should set horizontal position based on percent', () => {
    preview.setConfig(MOCK_CONFIG);
    (preview as any).loaded = true;

    preview.show(0, 0.75);
    const el = preview.getElement();
    expect(el.style.left).toBe('75%');
  });

  it('should hide element', () => {
    preview.setConfig(MOCK_CONFIG);
    (preview as any).loaded = true;
    preview.show(0, 0.5);

    preview.hide();
    const el = preview.getElement();
    expect(el.style.display).toBe('none');
  });

  it('should remove element on destroy', () => {
    const el = preview.getElement();
    document.body.appendChild(el);
    expect(document.body.contains(el)).toBe(true);

    preview.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
