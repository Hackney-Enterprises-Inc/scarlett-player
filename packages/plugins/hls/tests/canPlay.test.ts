/**
 * HLS Plugin - canPlay() Tests
 * Focused tests for HLS URL detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';

describe('HLS Plugin - canPlay()', () => {
  let plugin: ReturnType<typeof createHLSPlugin>;

  beforeEach(() => {
    // Mock HLS support
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    plugin = createHLSPlugin();
  });

  describe('HLS URL detection', () => {
    it('should detect .m3u8 files', () => {
      expect(plugin.canPlay('video.m3u8')).toBe(true);
      expect(plugin.canPlay('stream.M3U8')).toBe(true);
      expect(plugin.canPlay('PLAYLIST.m3u8')).toBe(true);
    });

    it('should detect .m3u8 URLs with paths', () => {
      expect(plugin.canPlay('http://example.com/video.m3u8')).toBe(true);
      expect(plugin.canPlay('https://cdn.example.com/stream.m3u8')).toBe(true);
      expect(plugin.canPlay('/path/to/stream.m3u8')).toBe(true);
    });

    it('should detect .m3u8 URLs with query parameters', () => {
      expect(plugin.canPlay('http://example.com/stream.m3u8?token=abc')).toBe(true);
      expect(plugin.canPlay('https://cdn.example.com/video.m3u8?quality=high&auth=123')).toBe(true);
    });

    it('should detect HLS MIME types in URL', () => {
      expect(plugin.canPlay('stream?type=application/x-mpegurl')).toBe(true);
      expect(plugin.canPlay('stream?type=application/vnd.apple.mpegurl')).toBe(true);
      expect(plugin.canPlay('https://example.com/stream?format=application/x-mpegurl')).toBe(true);
    });
  });

  describe('non-HLS URL rejection', () => {
    it('should reject non-HLS video formats', () => {
      expect(plugin.canPlay('video.mp4')).toBe(false);
      expect(plugin.canPlay('video.webm')).toBe(false);
      expect(plugin.canPlay('video.ogg')).toBe(false);
      expect(plugin.canPlay('video.avi')).toBe(false);
    });

    it('should reject DASH manifests', () => {
      expect(plugin.canPlay('video.mpd')).toBe(false);
      expect(plugin.canPlay('http://example.com/stream.mpd')).toBe(false);
    });

    it('should reject generic URLs without HLS indicators', () => {
      expect(plugin.canPlay('http://example.com/stream')).toBe(false);
      expect(plugin.canPlay('https://cdn.example.com/video')).toBe(false);
    });

    it('should reject empty or invalid URLs', () => {
      expect(plugin.canPlay('')).toBe(false);
      expect(plugin.canPlay('   ')).toBe(false);
    });
  });

  describe('HLS support detection', () => {
    it('should return false when HLS is not supported', () => {
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(false);
      const unsupportedPlugin = createHLSPlugin();

      expect(unsupportedPlugin.canPlay('video.m3u8')).toBe(false);
      expect(unsupportedPlugin.canPlay('http://example.com/stream.m3u8')).toBe(false);
    });

    it('should return false for all URLs when HLS unsupported', () => {
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(false);
      const unsupportedPlugin = createHLSPlugin();

      expect(unsupportedPlugin.canPlay('video.m3u8')).toBe(false);
      expect(unsupportedPlugin.canPlay('video.mp4')).toBe(false);
      expect(unsupportedPlugin.canPlay('stream?type=application/x-mpegurl')).toBe(false);
    });
  });

  describe('plugin metadata', () => {
    it('should have correct plugin id', () => {
      expect(plugin.id).toBe('hls-provider');
    });

    it('should have correct plugin name', () => {
      expect(plugin.name).toBe('HLS Provider');
    });

    it('should have correct plugin type', () => {
      expect(plugin.type).toBe('provider');
    });

    it('should have version number', () => {
      expect(plugin.version).toBe('1.0.0');
    });

    it('should have description', () => {
      expect(plugin.description).toBe('HLS playback provider using hls.js');
    });
  });

  describe('edge cases', () => {
    it('should handle case-insensitive extension matching', () => {
      expect(plugin.canPlay('VIDEO.M3U8')).toBe(true);
      expect(plugin.canPlay('Stream.m3U8')).toBe(true);
      expect(plugin.canPlay('LIVE.M3u8')).toBe(true);
    });

    it('should handle URLs with fragments', () => {
      expect(plugin.canPlay('http://example.com/stream.m3u8#start=30')).toBe(true);
    });

    it('should handle relative paths', () => {
      expect(plugin.canPlay('../videos/stream.m3u8')).toBe(true);
      expect(plugin.canPlay('./assets/video.m3u8')).toBe(true);
    });

    it('should handle data URLs (should reject)', () => {
      expect(plugin.canPlay('data:video/mp4;base64,AAAAA...')).toBe(false);
    });

    it('should handle blob URLs (should reject)', () => {
      expect(plugin.canPlay('blob:http://example.com/abc-123')).toBe(false);
    });
  });
});
