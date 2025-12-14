/**
 * Parser Tests - Data attribute parsing and styling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseDataAttributes, applyContainerStyles, aspectRatioToPercent } from '../src/parser';

describe('parseDataAttributes', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
  });

  describe('source URL parsing', () => {
    it('should parse data-src attribute', () => {
      element.setAttribute('data-src', 'https://example.com/video.m3u8');
      const config = parseDataAttributes(element);
      expect(config.src).toBe('https://example.com/video.m3u8');
    });

    it('should parse src attribute as fallback', () => {
      element.setAttribute('src', 'https://example.com/stream.m3u8');
      const config = parseDataAttributes(element);
      expect(config.src).toBe('https://example.com/stream.m3u8');
    });

    it('should parse href attribute as fallback', () => {
      element.setAttribute('href', 'https://example.com/live.m3u8');
      const config = parseDataAttributes(element);
      expect(config.src).toBe('https://example.com/live.m3u8');
    });

    it('should prefer data-src over src', () => {
      element.setAttribute('data-src', 'https://example.com/video1.m3u8');
      element.setAttribute('src', 'https://example.com/video2.m3u8');
      const config = parseDataAttributes(element);
      expect(config.src).toBe('https://example.com/video1.m3u8');
    });
  });

  describe('boolean attributes parsing', () => {
    it('should parse autoplay attribute', () => {
      element.setAttribute('data-autoplay', 'true');
      const config = parseDataAttributes(element);
      expect(config.autoplay).toBe(true);
    });

    it('should parse autoplay as true when present without value', () => {
      element.setAttribute('autoplay', '');
      const config = parseDataAttributes(element);
      expect(config.autoplay).toBe(true);
    });

    it('should parse autoplay as false when explicitly false', () => {
      element.setAttribute('data-autoplay', 'false');
      const config = parseDataAttributes(element);
      expect(config.autoplay).toBe(false);
    });

    it('should parse muted attribute', () => {
      element.setAttribute('data-muted', 'true');
      const config = parseDataAttributes(element);
      expect(config.muted).toBe(true);
    });

    it('should parse controls attribute', () => {
      element.setAttribute('data-controls', 'false');
      const config = parseDataAttributes(element);
      expect(config.controls).toBe(false);
    });

    it('should parse keyboard attribute', () => {
      element.setAttribute('data-keyboard', 'true');
      const config = parseDataAttributes(element);
      expect(config.keyboard).toBe(true);
    });

    it('should parse loop attribute', () => {
      element.setAttribute('data-loop', 'true');
      const config = parseDataAttributes(element);
      expect(config.loop).toBe(true);
    });

    it('should handle multiple boolean attributes', () => {
      element.setAttribute('data-autoplay', 'true');
      element.setAttribute('data-muted', 'true');
      element.setAttribute('data-loop', 'true');
      element.setAttribute('data-controls', 'false');

      const config = parseDataAttributes(element);
      expect(config.autoplay).toBe(true);
      expect(config.muted).toBe(true);
      expect(config.loop).toBe(true);
      expect(config.controls).toBe(false);
    });
  });

  describe('string attributes parsing', () => {
    it('should parse poster attribute', () => {
      element.setAttribute('data-poster', 'https://example.com/poster.jpg');
      const config = parseDataAttributes(element);
      expect(config.poster).toBe('https://example.com/poster.jpg');
    });

    it('should parse brand-color attribute', () => {
      element.setAttribute('data-brand-color', '#ff5733');
      const config = parseDataAttributes(element);
      expect(config.brandColor).toBe('#ff5733');
    });

    it('should parse color as fallback for brand-color', () => {
      element.setAttribute('color', '#00ff00');
      const config = parseDataAttributes(element);
      expect(config.brandColor).toBe('#00ff00');
    });

    it('should parse primary-color attribute', () => {
      element.setAttribute('data-primary-color', '#ffffff');
      const config = parseDataAttributes(element);
      expect(config.primaryColor).toBe('#ffffff');
    });

    it('should parse background-color attribute', () => {
      element.setAttribute('data-background-color', '#000000');
      const config = parseDataAttributes(element);
      expect(config.backgroundColor).toBe('#000000');
    });

    it('should parse width attribute', () => {
      element.setAttribute('data-width', '640px');
      const config = parseDataAttributes(element);
      expect(config.width).toBe('640px');
    });

    it('should parse height attribute', () => {
      element.setAttribute('data-height', '360px');
      const config = parseDataAttributes(element);
      expect(config.height).toBe('360px');
    });

    it('should parse aspect-ratio attribute', () => {
      element.setAttribute('data-aspect-ratio', '16:9');
      const config = parseDataAttributes(element);
      expect(config.aspectRatio).toBe('16:9');
    });

    it('should parse class attribute', () => {
      element.setAttribute('data-class', 'custom-player');
      const config = parseDataAttributes(element);
      expect(config.className).toBe('custom-player');
    });
  });

  describe('number attributes parsing', () => {
    it('should parse hide-delay attribute', () => {
      element.setAttribute('data-hide-delay', '3000');
      const config = parseDataAttributes(element);
      expect(config.hideDelay).toBe(3000);
    });

    it('should parse playback-rate attribute', () => {
      element.setAttribute('data-playback-rate', '1.5');
      const config = parseDataAttributes(element);
      expect(config.playbackRate).toBe(1.5);
    });

    it('should parse start-time attribute', () => {
      element.setAttribute('data-start-time', '30.5');
      const config = parseDataAttributes(element);
      expect(config.startTime).toBe(30.5);
    });

    it('should ignore invalid numbers', () => {
      element.setAttribute('data-hide-delay', 'not-a-number');
      element.setAttribute('data-playback-rate', 'invalid');
      const config = parseDataAttributes(element);
      expect(config.hideDelay).toBeUndefined();
      expect(config.playbackRate).toBeUndefined();
    });
  });

  describe('comprehensive parsing', () => {
    it('should parse all attributes together', () => {
      element.setAttribute('data-src', 'https://example.com/video.m3u8');
      element.setAttribute('data-autoplay', 'true');
      element.setAttribute('data-muted', 'true');
      element.setAttribute('data-poster', 'poster.jpg');
      element.setAttribute('data-brand-color', '#ff5733');
      element.setAttribute('data-width', '100%');
      element.setAttribute('data-aspect-ratio', '16:9');

      const config = parseDataAttributes(element);

      expect(config.src).toBe('https://example.com/video.m3u8');
      expect(config.autoplay).toBe(true);
      expect(config.muted).toBe(true);
      expect(config.poster).toBe('poster.jpg');
      expect(config.brandColor).toBe('#ff5733');
      expect(config.width).toBe('100%');
      expect(config.aspectRatio).toBe('16:9');
    });

    it('should return empty config for element with no attributes', () => {
      const config = parseDataAttributes(element);
      expect(Object.keys(config).length).toBe(0);
    });
  });
});

describe('aspectRatioToPercent', () => {
  it('should convert 16:9 to percentage', () => {
    expect(aspectRatioToPercent('16:9')).toBe(56.25);
  });

  it('should convert 4:3 to percentage', () => {
    expect(aspectRatioToPercent('4:3')).toBe(75);
  });

  it('should convert 21:9 to percentage', () => {
    const result = aspectRatioToPercent('21:9');
    expect(result).toBeCloseTo(42.857, 2);
  });

  it('should convert 1:1 to percentage', () => {
    expect(aspectRatioToPercent('1:1')).toBe(100);
  });

  it('should return default 16:9 for invalid format', () => {
    expect(aspectRatioToPercent('invalid')).toBe(56.25);
  });

  it('should return default for empty string', () => {
    expect(aspectRatioToPercent('')).toBe(56.25);
  });

  it('should return default for malformed ratio', () => {
    expect(aspectRatioToPercent('16-9')).toBe(56.25);
    expect(aspectRatioToPercent('16')).toBe(56.25);
  });
});

describe('applyContainerStyles', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should apply custom class', () => {
    applyContainerStyles(container, { className: 'custom-player' });
    expect(container.classList.contains('custom-player')).toBe(true);
  });

  it('should apply multiple classes', () => {
    applyContainerStyles(container, { className: 'custom-player video-container' });
    expect(container.classList.contains('custom-player')).toBe(true);
    expect(container.classList.contains('video-container')).toBe(true);
  });

  it('should apply width style', () => {
    applyContainerStyles(container, { width: '640px' });
    expect(container.style.width).toBe('640px');
  });

  it('should apply height style', () => {
    applyContainerStyles(container, { height: '360px' });
    expect(container.style.height).toBe('360px');
  });

  it('should apply aspect ratio with padding-bottom technique', () => {
    applyContainerStyles(container, { aspectRatio: '16:9' });
    expect(container.style.position).toBe('relative');
    expect(container.style.paddingBottom).toBe('56.25%');
    expect(container.style.height).toBe('0px');
  });

  it('should prioritize height over aspect ratio', () => {
    applyContainerStyles(container, { height: '400px', aspectRatio: '16:9' });
    expect(container.style.height).toBe('400px');
    expect(container.style.paddingBottom).toBe('');
  });

  it('should apply width and aspect ratio together', () => {
    applyContainerStyles(container, { width: '100%', aspectRatio: '4:3' });
    expect(container.style.width).toBe('100%');
    expect(container.style.paddingBottom).toBe('75%');
  });

  it('should handle empty config', () => {
    const initialClass = container.className;
    const initialWidth = container.style.width;

    applyContainerStyles(container, {});

    expect(container.className).toBe(initialClass);
    expect(container.style.width).toBe(initialWidth);
  });

  it('should apply all styling options together', () => {
    applyContainerStyles(container, {
      className: 'player-wrapper',
      width: '800px',
      aspectRatio: '16:9',
    });

    expect(container.classList.contains('player-wrapper')).toBe(true);
    expect(container.style.width).toBe('800px');
    expect(container.style.paddingBottom).toBe('56.25%');
  });
});
