/**
 * Parser Tests - Data attribute parsing and styling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseDataAttributes,
  applyContainerStyles,
  aspectRatioToPercent,
  DEFAULT_ASPECT_RATIO,
} from '../src/parser';

describe('parseDataAttributes', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
  });

  describe('player type parsing', () => {
    it('should parse data-type attribute for video', () => {
      element.setAttribute('data-type', 'video');
      const config = parseDataAttributes(element);
      expect(config.type).toBe('video');
    });

    it('should parse data-type attribute for audio', () => {
      element.setAttribute('data-type', 'audio');
      const config = parseDataAttributes(element);
      expect(config.type).toBe('audio');
    });

    it('should parse data-type attribute for audio-mini', () => {
      element.setAttribute('data-type', 'audio-mini');
      const config = parseDataAttributes(element);
      expect(config.type).toBe('audio-mini');
    });

    it('should ignore invalid type values', () => {
      element.setAttribute('data-type', 'invalid');
      const config = parseDataAttributes(element);
      expect(config.type).toBeUndefined();
    });
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

  describe('analytics attributes', () => {
    it('parses explicit privacy and batching booleans only with a beacon URL', () => {
      element.setAttribute('data-analytics-beacon-url', 'https://example.com/beacon');
      element.setAttribute('data-analytics-api-key', 'key');
      element.setAttribute('data-analytics-video-id', 'video-1');
      element.setAttribute('data-analytics-anonymous', '');
      element.setAttribute('data-analytics-respect-dnt', 'false');
      element.setAttribute('data-analytics-batch', 'true');
      expect(parseDataAttributes(element).analytics).toEqual({
        beaconUrl: 'https://example.com/beacon',
        apiKey: 'key',
        videoId: 'video-1',
        anonymous: true,
        respectDoNotTrack: false,
        batch: true,
      });
    });

    it('leaves absent analytics options unset and accepts explicit false', () => {
      element.setAttribute('data-analytics-beacon-url', 'https://example.com/beacon');
      expect(parseDataAttributes(element).analytics).not.toHaveProperty('anonymous');
      expect(parseDataAttributes(element).analytics).not.toHaveProperty('respectDoNotTrack');
      expect(parseDataAttributes(element).analytics).not.toHaveProperty('batch');
      for (const name of ['anonymous', 'respect-dnt', 'batch']) {
        element.setAttribute(`data-analytics-${name}`, 'false');
      }
      expect(parseDataAttributes(element).analytics).toMatchObject({
        anonymous: false,
        respectDoNotTrack: false,
        batch: false,
      });
    });

    it('does not enable analytics from option attributes without a beacon URL', () => {
      element.setAttribute('data-analytics-anonymous', '');
      element.setAttribute('data-analytics-respect-dnt', '');
      element.setAttribute('data-analytics-batch', '');
      expect(parseDataAttributes(element).analytics).toBeUndefined();
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

    it('should parse big play button attribute as false', () => {
      element.setAttribute('data-big-play-button', 'false');
      const config = parseDataAttributes(element);
      expect(config.bigPlayButton).toBe(false);
    });

    it('should parse big play button attribute as true', () => {
      element.setAttribute('data-big-play-button', 'true');
      const config = parseDataAttributes(element);
      expect(config.bigPlayButton).toBe(true);
    });

    it('should leave big play button out of the config when the attribute is absent', () => {
      const config = parseDataAttributes(element);
      // Absent, not `undefined`: createEmbedPlayer() forwards the key only
      // when it is present, so the ui plugin keeps its own default.
      expect('bigPlayButton' in config).toBe(false);
    });

    it('should parse gestures attribute as false', () => {
      element.setAttribute('data-gestures', 'false');
      const config = parseDataAttributes(element);
      expect(config.gestures).toBe(false);
    });

    it('should parse gestures attribute as true', () => {
      element.setAttribute('data-gestures', 'true');
      const config = parseDataAttributes(element);
      expect(config.gestures).toBe(true);
    });

    it('should leave gestures out of the config when the attribute is absent', () => {
      const config = parseDataAttributes(element);
      // Absent, not `undefined`: createEmbedPlayer() reads
      // `config.gestures !== false`, so an absent attribute keeps the default.
      expect('gestures' in config).toBe(false);
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

    it('should parse brand-text-color attribute', () => {
      element.setAttribute('data-brand-text-color', '#ff8a90');
      const config = parseDataAttributes(element);
      expect(config.brandTextColor).toBe('#ff8a90');
    });

    it('should leave brandTextColor unset when the attribute is absent', () => {
      element.setAttribute('data-brand-color', '#00008b');
      const config = parseDataAttributes(element);
      // Absent is meaningful: the embed derives a readable tone from the brand
      // colour, and a key present as undefined would look like a host choice.
      expect(config.brandTextColor).toBeUndefined();
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

  describe('share attributes parsing', () => {
    it('should parse share-url attribute', () => {
      element.setAttribute('data-share-url', 'https://example.com/watch/abc');
      const config = parseDataAttributes(element);
      expect(config.shareUrl).toBe('https://example.com/watch/abc');
    });

    it('should parse share-url without the data prefix', () => {
      element.setAttribute('share-url', 'https://example.com/watch/abc');
      const config = parseDataAttributes(element);
      expect(config.shareUrl).toBe('https://example.com/watch/abc');
    });

    it('should leave share URL out of the config when the attribute is absent', () => {
      const config = parseDataAttributes(element);
      // Absent, not `undefined`: createEmbedPlayer() adds the share plugin and
      // the share slot in the layout only when a share URL was given, so an
      // existing embed keeps the control bar it has always had.
      expect('shareUrl' in config).toBe(false);
    });

    it('should parse embed-base-url attribute', () => {
      element.setAttribute('data-embed-base-url', 'https://cdn.example.com/iframe.html');
      const config = parseDataAttributes(element);
      expect(config.embedBaseUrl).toBe('https://cdn.example.com/iframe.html');
    });

    it('should leave embed base URL out of the config when the attribute is absent', () => {
      const config = parseDataAttributes(element);
      // The `embed` share target removes itself when this is missing, rather
      // than offering a snippet that points nowhere.
      expect('embedBaseUrl' in config).toBe(false);
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

  describe('captions attribute parsing', () => {
    afterEach(() => vi.restoreAllMocks());

    it('should parse data-captions into captions.sources, keeping default', () => {
      const sources = [
        { language: 'en', label: 'English', src: '/en.vtt', kind: 'subtitles', default: true },
        { language: 'es', label: 'Español', src: '/es.vtt' },
      ];
      element.setAttribute('data-captions', JSON.stringify(sources));
      const config = parseDataAttributes(element);
      expect(config.captions).toEqual({ sources });
    });

    it('should warn and drop invalid data-captions JSON', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      element.setAttribute('data-captions', '[{ language: en }');
      const config = parseDataAttributes(element);
      expect(config.captions).toBeUndefined();
      expect(warn).toHaveBeenCalledWith('[ScarlettPlayer] Invalid data-captions JSON: expected an array');
    });

    it('should warn and drop data-captions JSON that is not an array', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      element.setAttribute('data-captions', '{"language":"en","label":"English","src":"/en.vtt"}');
      expect(parseDataAttributes(element).captions).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('chapters attribute parsing', () => {
    afterEach(() => vi.restoreAllMocks());

    it('should parse an inline JSON list into chapters.chapters', () => {
      const chapters = [
        { time: 0, label: 'Walkouts' },
        { time: 312, label: 'Fight 1', endTime: 900, subtitle: 'Main card' },
      ];
      element.setAttribute('data-chapters', `  ${JSON.stringify(chapters)}\n`);
      expect(parseDataAttributes(element).chapters).toEqual({ chapters });
    });

    it('should parse any other value as a WebVTT URL into chapters.src', () => {
      element.setAttribute('data-chapters', ' https://cdn.example.com/event/chapters.vtt ');
      expect(parseDataAttributes(element).chapters).toEqual({
        src: 'https://cdn.example.com/event/chapters.vtt',
      });
    });

    it('should warn and drop invalid data-chapters JSON', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      element.setAttribute('data-chapters', '[{"time": 0, "label": }]');
      expect(parseDataAttributes(element).chapters).toBeUndefined();
      expect(warn).toHaveBeenCalledWith('[ScarlettPlayer] Invalid data-chapters JSON: expected an array');
    });

    it('should ignore an empty data-chapters', () => {
      element.setAttribute('data-chapters', '   ');
      expect(parseDataAttributes(element).chapters).toBeUndefined();
    });
  });

  describe('clips attribute parsing', () => {
    afterEach(() => vi.restoreAllMocks());

    it('should parse every data-clips-* attribute', () => {
      element.setAttribute('data-src', 'https://example.com/video.m3u8');
      element.setAttribute('data-clips-endpoint', '/api/scarlett/clips');
      element.setAttribute('data-clips-csrf', 'meta');
      element.setAttribute('data-clips-media-id', 'abc123');
      element.setAttribute('data-clips-max-duration', '90');
      element.setAttribute('data-clips-min-duration', '2.5');

      expect(parseDataAttributes(element).clips).toEqual({
        endpoint: '/api/scarlett/clips',
        csrf: 'meta',
        mediaId: 'abc123',
        maxDuration: 90,
        minDuration: 2.5,
      });
    });

    // createEmbedPlayer() owns the "inert without the opt-in" rule, so a
    // programmatic create() gets it too; the parser only reports what it saw.
    it('should parse data-clips-endpoint without data-clips-csrf, leaving csrf unset', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      element.setAttribute('data-clips-endpoint', '/api/scarlett/clips');
      element.setAttribute('data-clips-media-id', 'abc123');
      const clips = parseDataAttributes(element).clips;
      expect(clips).toEqual({ endpoint: '/api/scarlett/clips', mediaId: 'abc123' });
      expect(clips).not.toHaveProperty('csrf');
      expect(warn).not.toHaveBeenCalled();
    });

    it('should warn and leave csrf unset for any value but meta', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      element.setAttribute('data-clips-endpoint', '/api/scarlett/clips');
      element.setAttribute('data-clips-csrf', 'cookie');
      expect(parseDataAttributes(element).clips).not.toHaveProperty('csrf');
      expect(warn).toHaveBeenCalledWith(
        '[ScarlettPlayer] Invalid data-clips-csrf "cookie": the only accepted value is "meta"'
      );
    });

    it('should not produce clips without data-clips-endpoint', () => {
      element.setAttribute('data-clips-csrf', 'meta');
      element.setAttribute('data-clips-media-id', 'abc123');
      expect(parseDataAttributes(element).clips).toBeUndefined();
    });

    // data-analytics-video-id only reaches config.analytics when a beacon URL
    // is set, so the parser resolves that attribute here; the fallback to the
    // source lives in createEmbedPlayer() so programmatic create() gets it too.
    it('should fall back to data-analytics-video-id for mediaId even without analytics', () => {
      element.setAttribute('data-src', 'https://example.com/video.m3u8');
      element.setAttribute('data-analytics-video-id', 'vid-42');
      element.setAttribute('data-clips-endpoint', '/api/scarlett/clips');
      const config = parseDataAttributes(element);
      expect(config.analytics).toBeUndefined();
      expect(config.clips?.mediaId).toBe('vid-42');
    });

    it('should prefer data-clips-media-id over data-analytics-video-id', () => {
      element.setAttribute('data-analytics-video-id', 'vid-42');
      element.setAttribute('data-clips-media-id', 'abc123');
      element.setAttribute('data-clips-endpoint', '/api/scarlett/clips');
      expect(parseDataAttributes(element).clips?.mediaId).toBe('abc123');
    });

    it('should leave mediaId unset without either attribute', () => {
      element.setAttribute('data-src', 'https://example.com/video.m3u8');
      element.setAttribute('data-clips-endpoint', '/api/scarlett/clips');
      expect(parseDataAttributes(element).clips).not.toHaveProperty('mediaId');
    });

    it('should drop non-numeric durations', () => {
      element.setAttribute('data-clips-endpoint', '/api/scarlett/clips');
      element.setAttribute('data-clips-max-duration', 'long');
      element.setAttribute('data-clips-min-duration', '');
      const clips = parseDataAttributes(element).clips;
      expect(clips).not.toHaveProperty('maxDuration');
      expect(clips).not.toHaveProperty('minDuration');
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
      element.setAttribute('data-share-url', 'https://example.com/watch/abc');

      const config = parseDataAttributes(element);

      expect(config.src).toBe('https://example.com/video.m3u8');
      expect(config.shareUrl).toBe('https://example.com/watch/abc');
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

describe('applyContainerStyles - class tokenising and default ratio', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('tolerates multiple spaces between class names', () => {
    applyContainerStyles(container, { className: 'one   two' });

    expect(container.classList.contains('one')).toBe(true);
    expect(container.classList.contains('two')).toBe(true);
    expect(container.classList.length).toBe(2);
  });

  it('tolerates leading, trailing and tab separators', () => {
    expect(() =>
      applyContainerStyles(container, { className: '  lead\ttab trail  ' })
    ).not.toThrow();

    expect(Array.from(container.classList)).toEqual(['lead', 'tab', 'trail']);
  });

  it('adds nothing for a whitespace-only class attribute', () => {
    expect(() => applyContainerStyles(container, { className: '   ' })).not.toThrow();

    expect(container.classList.length).toBe(0);
  });

  it('falls back to 16:9 when a video embed declares no dimensions', () => {
    applyContainerStyles(container, { type: 'video' });

    expect(container.style.paddingBottom).toBe(`${aspectRatioToPercent(DEFAULT_ASPECT_RATIO)}%`);
    expect(container.style.height).toBe('0px');
    expect(container.style.position).toBe('relative');
  });

  it('leaves an explicit height alone', () => {
    applyContainerStyles(container, { type: 'video', height: '360px' });

    expect(container.style.height).toBe('360px');
    expect(container.style.paddingBottom).toBe('');
  });

  it('does not force a ratio onto an audio embed', () => {
    applyContainerStyles(container, { type: 'audio' });

    expect(container.style.paddingBottom).toBe('');
    expect(container.style.height).toBe('120px');
  });
});
