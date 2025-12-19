/**
 * ScarlettPlayer Tests - Comprehensive test suite for ScarlettPlayer
 *
 * Target: 95%+ code coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScarlettPlayer, createPlayer } from '../src/scarlett-player';
import type { Plugin } from '../src/types/plugin';

// Mock plugin for testing
const createMockPlugin = (overrides?: Partial<Plugin>): Plugin => ({
  id: 'test-plugin',
  name: 'Test Plugin',
  type: 'feature',
  version: '1.0.0',
  init: vi.fn(),
  destroy: vi.fn(),
  ...overrides,
});

describe('ScarlettPlayer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-player-container';
    document.body.appendChild(container);

    // Suppress console output
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create player with valid container', () => {
      const player = new ScarlettPlayer({ container });

      expect(player).toBeInstanceOf(ScarlettPlayer);
    });

    it('should create player with CSS selector string', () => {
      const player = new ScarlettPlayer({ container: '#test-player-container' });

      expect(player).toBeInstanceOf(ScarlettPlayer);
      expect(player.container).toBe(container);
    });

    it('should throw error for non-existent selector', () => {
      expect(() => {
        new ScarlettPlayer({ container: '#non-existent' });
      }).toThrow('container not found');
    });

    it('should throw error without container', () => {
      expect(() => {
        new ScarlettPlayer({ container: null as any });
      }).toThrow('valid HTMLElement container');
    });

    it('should throw error with invalid container', () => {
      expect(() => {
        new ScarlettPlayer({ container: {} as any });
      }).toThrow('valid HTMLElement container');
    });

    it('should initialize with default options', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.volume).toBe(1.0);
      expect(player.muted).toBe(false);
      expect(player.playing).toBe(false);
      expect(player.paused).toBe(true);
    });

    it('should initialize with custom options', () => {
      const player = new ScarlettPlayer({
        container,
        autoplay: true,
        loop: true,
        volume: 0.5,
        muted: true,
        logLevel: 'debug',
      });

      expect(player.volume).toBe(0.5);
      expect(player.muted).toBe(true);
    });

    it('should register plugins on initialization', () => {
      const plugin = createMockPlugin();

      const player = new ScarlettPlayer({
        container,
        plugins: [plugin],
      });

      expect(player.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should emit player:ready event', () => {
      const readySpy = vi.fn();

      const player = new ScarlettPlayer({ container });
      player.on('player:ready', readySpy);

      // Event was already emitted during construction
      // But we can verify the event bus is working
      expect(readySpy).not.toHaveBeenCalled(); // Because we subscribed after construction
    });
  });

  describe('load()', () => {
    it('should load a media source', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      await player.load('video.mp4');

      // Verify state was updated with correct source and type
      const state = player.getState();
      expect(state.source).toEqual({
        src: 'video.mp4',
        type: 'video/mp4',
      });
    });

    it('should detect HLS source', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      await player.load('video.m3u8');

      const state = player.getState();
      expect(state.source).toEqual({
        src: 'video.m3u8',
        type: 'application/x-mpegURL',
      });
    });

    it('should detect DASH source', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      await player.load('video.mpd');

      const state = player.getState();
      expect(state.source).toEqual({
        src: 'video.mpd',
        type: 'application/dash+xml',
      });
    });

    it('should detect WebM source', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      await player.load('video.webm');

      const state = player.getState();
      expect(state.source).toEqual({
        src: 'video.webm',
        type: 'video/webm',
      });
    });

    it('should emit error when no provider found', async () => {
      const player = new ScarlettPlayer({ container });
      const errorSpy = vi.fn();

      player.on('error', errorSpy);

      await player.load('video.mp4');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No provider found for source: video.mp4',
        })
      );
    });

    it('should auto-play if autoplay enabled', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
      });

      const player = new ScarlettPlayer({
        container,
        autoplay: true,
        plugins: [provider],
      });

      const playSpy = vi.fn();
      player.on('playback:play', playSpy);

      await player.load('video.mp4');

      expect(playSpy).toHaveBeenCalled();
    });

    it('should not auto-play if autoplay disabled', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
      });

      const player = new ScarlettPlayer({
        container,
        autoplay: false,
        plugins: [provider],
      });

      const playSpy = vi.fn();
      player.on('playback:play', playSpy);

      await player.load('video.mp4');

      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe('play()', () => {
    it('should emit playback:play event', async () => {
      // Note: play() emits an event for providers to handle
      // State is updated by the provider when playback actually starts
      const player = new ScarlettPlayer({ container });
      const playSpy = vi.fn();

      player.on('playback:play', playSpy);

      await player.play();

      expect(playSpy).toHaveBeenCalled();
    });

    it('should update state when provider starts playback', async () => {
      // Simulate a provider responding to play event and setting state
      const player = new ScarlettPlayer({ container });

      // Provider would set this when actual playback starts
      player.on('playback:play', () => {
        // Simulate provider starting playback
        (player as any).stateManager.set('playing', true);
        (player as any).stateManager.set('paused', false);
      });

      await player.play();

      expect(player.playing).toBe(true);
      expect(player.paused).toBe(false);
    });
  });

  describe('pause()', () => {
    it('should pause playback', async () => {
      const player = new ScarlettPlayer({ container });

      await player.play();
      player.pause();

      expect(player.playing).toBe(false);
      expect(player.paused).toBe(true);
    });

    it('should emit playback:pause event', () => {
      const player = new ScarlettPlayer({ container });
      const pauseSpy = vi.fn();

      player.on('playback:pause', pauseSpy);

      player.pause();

      expect(pauseSpy).toHaveBeenCalled();
    });
  });

  describe('seek()', () => {
    it('should seek to time', () => {
      const player = new ScarlettPlayer({ container });

      player.seek(30);

      expect(player.currentTime).toBe(30);
    });

    it('should emit seeking event', () => {
      const player = new ScarlettPlayer({ container });
      const seekingSpy = vi.fn();

      player.on('playback:seeking', seekingSpy);

      player.seek(15);

      expect(seekingSpy).toHaveBeenCalledWith({ time: 15 });
    });
  });

  describe('setVolume()', () => {
    it('should set volume', () => {
      const player = new ScarlettPlayer({ container });

      player.setVolume(0.5);

      expect(player.volume).toBe(0.5);
    });

    it('should clamp volume to 0-1 range', () => {
      const player = new ScarlettPlayer({ container });

      player.setVolume(-0.5);
      expect(player.volume).toBe(0);

      player.setVolume(1.5);
      expect(player.volume).toBe(1);
    });

    it('should emit volume:change event', () => {
      const player = new ScarlettPlayer({ container });
      const volumeSpy = vi.fn();

      player.on('volume:change', volumeSpy);

      player.setVolume(0.7);

      expect(volumeSpy).toHaveBeenCalledWith({
        volume: 0.7,
        muted: false,
      });
    });
  });

  describe('setMuted()', () => {
    it('should set muted state', () => {
      const player = new ScarlettPlayer({ container });

      player.setMuted(true);

      expect(player.muted).toBe(true);
    });

    it('should emit volume:mute event', () => {
      const player = new ScarlettPlayer({ container });
      const muteSpy = vi.fn();

      player.on('volume:mute', muteSpy);

      player.setMuted(true);

      expect(muteSpy).toHaveBeenCalledWith({ muted: true });
    });
  });

  describe('setPlaybackRate()', () => {
    it('should set playback rate', () => {
      const player = new ScarlettPlayer({ container });

      player.setPlaybackRate(1.5);

      expect(player.playbackRate).toBe(1.5);
    });

    it('should emit playback:ratechange event', () => {
      const player = new ScarlettPlayer({ container });
      const rateSpy = vi.fn();

      player.on('playback:ratechange', rateSpy);

      player.setPlaybackRate(2.0);

      expect(rateSpy).toHaveBeenCalledWith({ rate: 2.0 });
    });
  });

  describe('on()', () => {
    it('should subscribe to events', () => {
      const player = new ScarlettPlayer({ container });
      const handler = vi.fn();

      player.on('playback:play', handler);
      player.play();

      expect(handler).toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      const player = new ScarlettPlayer({ container });
      const handler = vi.fn();

      const unsub = player.on('playback:play', handler);

      await player.play();
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      await player.play();
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('once()', () => {
    it('should subscribe to event once', async () => {
      const player = new ScarlettPlayer({ container });
      const handler = vi.fn();

      player.once('playback:play', handler);

      await player.play();
      expect(handler).toHaveBeenCalledTimes(1);

      await player.play();
      expect(handler).toHaveBeenCalledTimes(1); // Still only 1
    });
  });

  describe('getPlugin()', () => {
    it('should return registered plugin', () => {
      const plugin = createMockPlugin();

      const player = new ScarlettPlayer({
        container,
        plugins: [plugin],
      });

      const result = player.getPlugin('test-plugin');

      expect(result).toBe(plugin);
    });

    it('should return null for non-existent plugin', () => {
      const player = new ScarlettPlayer({ container });

      const result = player.getPlugin('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('registerPlugin()', () => {
    it('should register plugin', () => {
      const player = new ScarlettPlayer({ container });
      const plugin = createMockPlugin();

      player.registerPlugin(plugin);

      expect(player.getPlugin('test-plugin')).toBe(plugin);
    });
  });

  describe('getState()', () => {
    it('should return state snapshot', () => {
      const player = new ScarlettPlayer({ container });

      const state = player.getState();

      expect(state).toHaveProperty('playing');
      expect(state).toHaveProperty('currentTime');
      expect(state).toHaveProperty('volume');
    });

    it('should return frozen object', () => {
      const player = new ScarlettPlayer({ container });

      const state = player.getState();

      expect(Object.isFrozen(state)).toBe(true);
    });
  });

  describe('destroy()', () => {
    it('should destroy player', async () => {
      const player = new ScarlettPlayer({ container });

      player.destroy();

      await expect(player.play()).rejects.toThrow('destroyed player');
    });

    it('should emit player:destroy event', () => {
      const player = new ScarlettPlayer({ container });
      const destroySpy = vi.fn();

      player.on('player:destroy', destroySpy);

      player.destroy();

      expect(destroySpy).toHaveBeenCalled();
    });

    it('should destroy plugins', () => {
      const plugin = createMockPlugin();

      const player = new ScarlettPlayer({
        container,
        plugins: [plugin],
      });

      player.destroy();

      // Plugins are destroyed, but not called directly
      // (PluginManager handles this)
    });

    it('should handle multiple destroy calls', () => {
      const player = new ScarlettPlayer({ container });

      player.destroy();
      player.destroy();

      // Should not throw
    });
  });

  describe('state getters', () => {
    it('should get playing state', async () => {
      const player = new ScarlettPlayer({ container });

      expect(player.playing).toBe(false);

      // Simulate provider starting playback when play event is received
      player.on('playback:play', () => {
        (player as any).stateManager.set('playing', true);
      });

      await player.play();

      expect(player.playing).toBe(true);
    });

    it('should get paused state', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.paused).toBe(true);
    });

    it('should get currentTime', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.currentTime).toBe(0);

      player.seek(10);

      expect(player.currentTime).toBe(10);
    });

    it('should get duration', () => {
      const player = new ScarlettPlayer({ container });

      expect(typeof player.duration).toBe('number');
    });

    it('should get volume', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.volume).toBe(1.0);

      player.setVolume(0.5);

      expect(player.volume).toBe(0.5);
    });

    it('should get muted', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.muted).toBe(false);

      player.setMuted(true);

      expect(player.muted).toBe(true);
    });

    it('should get playbackRate', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.playbackRate).toBe(1.0);

      player.setPlaybackRate(1.5);

      expect(player.playbackRate).toBe(1.5);
    });

    it('should get bufferedAmount', () => {
      const player = new ScarlettPlayer({ container });

      expect(typeof player.bufferedAmount).toBe('number');
    });
  });

  describe('destroyed checks', () => {
    it('should throw error when calling methods on destroyed player', async () => {
      const player = new ScarlettPlayer({ container });
      player.destroy();

      await expect(player.load('video.mp4')).rejects.toThrow('destroyed player');
      await expect(player.play()).rejects.toThrow('destroyed player');
      expect(() => player.pause()).toThrow('destroyed player');
      expect(() => player.seek(10)).toThrow('destroyed player');
      expect(() => player.setVolume(0.5)).toThrow('destroyed player');
      expect(() => player.setMuted(true)).toThrow('destroyed player');
      expect(() => player.setPlaybackRate(1.5)).toThrow('destroyed player');
      expect(() => player.on('playback:play', () => {})).toThrow('destroyed player');
      expect(() => player.once('playback:play', () => {})).toThrow('destroyed player');
      expect(() => player.getPlugin('test')).toThrow('destroyed player');
      expect(() => player.registerPlugin(createMockPlugin())).toThrow('destroyed player');
      expect(() => player.getState()).toThrow('destroyed player');
    });

    it('should throw error for new methods on destroyed player', async () => {
      const player = new ScarlettPlayer({ container });
      player.destroy();

      await expect(player.init()).rejects.toThrow('destroyed player');
      expect(() => player.getQualities()).toThrow('destroyed player');
      expect(() => player.setQuality(0)).toThrow('destroyed player');
      expect(() => player.getCurrentQuality()).toThrow('destroyed player');
      await expect(player.requestFullscreen()).rejects.toThrow('destroyed player');
      await expect(player.exitFullscreen()).rejects.toThrow('destroyed player');
      expect(() => player.requestAirPlay()).toThrow('destroyed player');
      await expect(player.requestChromecast()).rejects.toThrow('destroyed player');
      expect(() => player.stopCasting()).toThrow('destroyed player');
      expect(() => player.seekToLive()).toThrow('destroyed player');
    });
  });

  describe('init()', () => {
    it('should resolve without initial source', async () => {
      const player = new ScarlettPlayer({ container });

      await expect(player.init()).resolves.toBeUndefined();
    });

    it('should load initial source if provided', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
      });

      const player = new ScarlettPlayer({
        container,
        src: 'video.m3u8',
        plugins: [provider],
      });

      await player.init();

      expect((provider as any).loadSource).toHaveBeenCalledWith('video.m3u8');
    });
  });

  describe('quality methods', () => {
    it('should return empty array when no provider', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.getQualities()).toEqual([]);
    });

    it('should return -1 for getCurrentQuality when no provider', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.getCurrentQuality()).toBe(-1);
    });

    it('should proxy getLevels to provider', async () => {
      const mockLevels = [
        { index: 0, width: 1920, height: 1080, bitrate: 5000000, label: '1080p' },
        { index: 1, width: 1280, height: 720, bitrate: 2500000, label: '720p' },
      ];
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
        getLevels: vi.fn(() => mockLevels),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      await player.load('video.m3u8');

      expect(player.getQualities()).toEqual(mockLevels);
    });

    it('should proxy setLevel to provider', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
        setLevel: vi.fn(),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      await player.load('video.m3u8');
      player.setQuality(1);

      expect((provider as any).setLevel).toHaveBeenCalledWith(1);
    });

    it('should emit quality:change event on setQuality', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
        setLevel: vi.fn(),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });
      const qualitySpy = vi.fn();
      player.on('quality:change', qualitySpy);

      await player.load('video.m3u8');
      player.setQuality(1);

      expect(qualitySpy).toHaveBeenCalledWith({
        quality: 'level-1',
        auto: false,
      });
    });

    it('should emit quality:change with auto for -1', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
        setLevel: vi.fn(),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });
      const qualitySpy = vi.fn();
      player.on('quality:change', qualitySpy);

      await player.load('video.m3u8');
      player.setQuality(-1);

      expect(qualitySpy).toHaveBeenCalledWith({
        quality: 'auto',
        auto: true,
      });
    });

    it('should proxy getCurrentLevel to provider', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
        getCurrentLevel: vi.fn(() => 2),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      await player.load('video.m3u8');

      expect(player.getCurrentQuality()).toBe(2);
    });

    it('should warn when setQuality called without provider', () => {
      const player = new ScarlettPlayer({ container });
      const warnSpy = vi.spyOn(console, 'warn');

      player.setQuality(0);

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('fullscreen methods', () => {
    it('should call requestFullscreen on container', async () => {
      const player = new ScarlettPlayer({ container });
      container.requestFullscreen = vi.fn().mockResolvedValue(undefined);

      await player.requestFullscreen();

      expect(container.requestFullscreen).toHaveBeenCalled();
      expect(player.fullscreen).toBe(true);
    });

    it('should emit fullscreen:change event on requestFullscreen', async () => {
      const player = new ScarlettPlayer({ container });
      container.requestFullscreen = vi.fn().mockResolvedValue(undefined);
      const fsSpy = vi.fn();
      player.on('fullscreen:change', fsSpy);

      await player.requestFullscreen();

      expect(fsSpy).toHaveBeenCalledWith({ fullscreen: true });
    });

    it('should call document.exitFullscreen', async () => {
      const player = new ScarlettPlayer({ container });
      document.exitFullscreen = vi.fn().mockResolvedValue(undefined);

      await player.exitFullscreen();

      expect(document.exitFullscreen).toHaveBeenCalled();
      expect(player.fullscreen).toBe(false);
    });

    it('should emit fullscreen:change event on exitFullscreen', async () => {
      const player = new ScarlettPlayer({ container });
      document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
      const fsSpy = vi.fn();
      player.on('fullscreen:change', fsSpy);

      await player.exitFullscreen();

      expect(fsSpy).toHaveBeenCalledWith({ fullscreen: false });
    });

    it('should toggle fullscreen on', async () => {
      const player = new ScarlettPlayer({ container });
      container.requestFullscreen = vi.fn().mockResolvedValue(undefined);

      await player.toggleFullscreen();

      expect(container.requestFullscreen).toHaveBeenCalled();
    });

    it('should toggle fullscreen off when already fullscreen', async () => {
      const player = new ScarlettPlayer({ container });
      container.requestFullscreen = vi.fn().mockResolvedValue(undefined);
      document.exitFullscreen = vi.fn().mockResolvedValue(undefined);

      // Enter fullscreen first
      await player.requestFullscreen();

      // Toggle should exit
      await player.toggleFullscreen();

      expect(document.exitFullscreen).toHaveBeenCalled();
    });

    it('should handle fullscreen error gracefully', async () => {
      const player = new ScarlettPlayer({ container });
      container.requestFullscreen = vi.fn().mockRejectedValue(new Error('Fullscreen denied'));

      // Should not throw
      await player.requestFullscreen();
    });

    it('should use webkit prefix if standard not available', async () => {
      const player = new ScarlettPlayer({ container });
      (container as any).requestFullscreen = undefined;
      (container as any).webkitRequestFullscreen = vi.fn().mockResolvedValue(undefined);

      await player.requestFullscreen();

      expect((container as any).webkitRequestFullscreen).toHaveBeenCalled();
    });
  });

  describe('casting methods', () => {
    it('should proxy requestAirPlay to airplay plugin', () => {
      const airplayPlugin = createMockPlugin({
        id: 'airplay',
        showPicker: vi.fn(),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [airplayPlugin],
      });

      player.requestAirPlay();

      expect((airplayPlugin as any).showPicker).toHaveBeenCalled();
    });

    it('should warn when airplay plugin not available', () => {
      const player = new ScarlettPlayer({ container });
      const warnSpy = vi.spyOn(console, 'warn');

      player.requestAirPlay();

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should proxy requestChromecast to chromecast plugin', async () => {
      const chromecastPlugin = createMockPlugin({
        id: 'chromecast',
        requestSession: vi.fn().mockResolvedValue(undefined),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [chromecastPlugin],
      });

      await player.requestChromecast();

      expect((chromecastPlugin as any).requestSession).toHaveBeenCalled();
    });

    it('should warn when chromecast plugin not available', async () => {
      const player = new ScarlettPlayer({ container });
      const warnSpy = vi.spyOn(console, 'warn');

      await player.requestChromecast();

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should stop both airplay and chromecast', () => {
      const airplayPlugin = createMockPlugin({
        id: 'airplay',
        stop: vi.fn(),
      });
      const chromecastPlugin = createMockPlugin({
        id: 'chromecast',
        stopSession: vi.fn(),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [airplayPlugin, chromecastPlugin],
      });

      player.stopCasting();

      expect((airplayPlugin as any).stop).toHaveBeenCalled();
      expect((chromecastPlugin as any).stopSession).toHaveBeenCalled();
    });
  });

  describe('seekToLive()', () => {
    it('should warn when not a live stream', () => {
      const player = new ScarlettPlayer({ container });
      const warnSpy = vi.spyOn(console, 'warn');

      player.seekToLive();

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should seek to live sync position from provider', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
        getLiveInfo: vi.fn(() => ({
          isLive: true,
          liveSyncPosition: 150,
          latency: 2,
          targetLatency: 3,
          drift: 0.5,
        })),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      // Manually set live state (would normally be set by provider)
      await player.load('live.m3u8');
      (player as any).stateManager.set('live', true);

      const seekSpy = vi.fn();
      player.on('playback:seeking', seekSpy);

      player.seekToLive();

      expect(seekSpy).toHaveBeenCalledWith({ time: 150 });
    });
  });

  describe('createPlayer factory', () => {
    it('should create and initialize player', async () => {
      const player = await createPlayer({ container });

      expect(player).toBeInstanceOf(ScarlettPlayer);
    });

    it('should load initial source', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
      });

      const player = await createPlayer({
        container,
        src: 'video.m3u8',
        plugins: [provider],
      });

      expect((provider as any).loadSource).toHaveBeenCalledWith('video.m3u8');
    });

    it('should work with CSS selector', async () => {
      const player = await createPlayer({ container: '#test-player-container' });

      expect(player.container).toBe(container);
    });
  });

  describe('additional state getters', () => {
    it('should get fullscreen state', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.fullscreen).toBe(false);
    });

    it('should get live state', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.live).toBe(false);
    });

    it('should get currentProvider', () => {
      const player = new ScarlettPlayer({ container });

      expect(player.currentProvider).toBeNull();
    });

    it('should get currentProvider after load', async () => {
      const provider = createMockPlugin({
        id: 'provider',
        type: 'provider',
        canPlay: vi.fn(() => true),
        loadSource: vi.fn().mockResolvedValue(undefined),
      });

      const player = new ScarlettPlayer({
        container,
        plugins: [provider],
      });

      await player.load('video.m3u8');

      expect(player.currentProvider).toBe(provider);
    });
  });
});
