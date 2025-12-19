/**
 * Playlist Plugin for Scarlett Player
 *
 * Provides playlist management with:
 * - Queue management (add, remove, reorder)
 * - Shuffle mode with Fisher-Yates algorithm
 * - Repeat modes (none, one, all)
 * - Auto-advance to next track
 * - Gapless playback preparation
 * - LocalStorage persistence
 */

import type { IPluginAPI, PluginType } from '@scarlett-player/core';
import type {
  PlaylistPluginConfig,
  PlaylistTrack,
  PlaylistState,
  RepeatMode,
  IPlaylistPlugin,
} from './types';

// Re-export types
export type {
  PlaylistPluginConfig,
  PlaylistTrack,
  PlaylistState,
  RepeatMode,
  IPlaylistPlugin,
} from './types';

/** Default configuration */
const DEFAULT_CONFIG: PlaylistPluginConfig = {
  autoAdvance: true,
  preloadNext: true,
  persist: false,
  persistKey: 'scarlett-playlist',
  shuffle: false,
  repeat: 'none',
};

/**
 * Generate a unique ID for tracks without one
 */
function generateId(): string {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Create a Playlist Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Playlist Plugin instance
 *
 * @example
 * ```ts
 * import { createPlaylistPlugin } from '@scarlett-player/playlist';
 *
 * const player = new ScarlettPlayer({
 *   container: document.getElementById('player'),
 *   plugins: [
 *     createPlaylistPlugin({
 *       autoAdvance: true,
 *       shuffle: false,
 *       repeat: 'none',
 *     }),
 *   ],
 * });
 *
 * // Add tracks
 * const playlist = player.getPlugin('playlist');
 * playlist.add([
 *   { id: '1', src: 'track1.mp3', title: 'Track 1', artist: 'Artist' },
 *   { id: '2', src: 'track2.mp3', title: 'Track 2', artist: 'Artist' },
 * ]);
 *
 * // Start playback
 * playlist.play();
 * ```
 */
export function createPlaylistPlugin(config?: Partial<PlaylistPluginConfig>): IPlaylistPlugin {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Plugin state
  let api: IPluginAPI | null = null;
  let tracks: PlaylistTrack[] = mergedConfig.tracks || [];
  let currentIndex = -1;
  let shuffle = mergedConfig.shuffle || false;
  let repeat: RepeatMode = mergedConfig.repeat || 'none';
  let shuffleOrder: number[] = [];

  // Ensure all tracks have IDs
  tracks = tracks.map((t) => ({ ...t, id: t.id || generateId() }));

  /**
   * Generate shuffle order
   */
  const generateShuffleOrder = (): void => {
    const indices = tracks.map((_, i) => i);
    shuffleOrder = shuffleArray(indices);

    // If currently playing, move current track to front of shuffle
    if (currentIndex >= 0) {
      const currentPos = shuffleOrder.indexOf(currentIndex);
      if (currentPos > 0) {
        shuffleOrder.splice(currentPos, 1);
        shuffleOrder.unshift(currentIndex);
      }
    }
  };

  /**
   * Get the actual index based on shuffle mode
   */
  const getActualIndex = (logicalIndex: number): number => {
    if (!shuffle || shuffleOrder.length === 0) {
      return logicalIndex;
    }
    return shuffleOrder[logicalIndex] ?? logicalIndex;
  };

  /**
   * Get the logical index from actual index
   */
  const getLogicalIndex = (actualIndex: number): number => {
    if (!shuffle || shuffleOrder.length === 0) {
      return actualIndex;
    }
    return shuffleOrder.indexOf(actualIndex);
  };

  /**
   * Check if there's a next track
   */
  const hasNextTrack = (): boolean => {
    if (tracks.length === 0) return false;
    if (repeat === 'one' || repeat === 'all') return true;

    const logicalIndex = getLogicalIndex(currentIndex);
    return logicalIndex < tracks.length - 1;
  };

  /**
   * Check if there's a previous track
   */
  const hasPreviousTrack = (): boolean => {
    if (tracks.length === 0) return false;
    if (repeat === 'one' || repeat === 'all') return true;

    const logicalIndex = getLogicalIndex(currentIndex);
    return logicalIndex > 0;
  };

  /**
   * Get next track index
   */
  const getNextIndex = (): number => {
    if (tracks.length === 0) return -1;

    if (repeat === 'one') {
      return currentIndex;
    }

    const logicalIndex = getLogicalIndex(currentIndex);
    let nextLogical = logicalIndex + 1;

    if (nextLogical >= tracks.length) {
      if (repeat === 'all') {
        // Regenerate shuffle for variety
        if (shuffle) {
          generateShuffleOrder();
        }
        nextLogical = 0;
      } else {
        return -1; // End of playlist
      }
    }

    return getActualIndex(nextLogical);
  };

  /**
   * Get previous track index
   */
  const getPreviousIndex = (): number => {
    if (tracks.length === 0) return -1;

    if (repeat === 'one') {
      return currentIndex;
    }

    const logicalIndex = getLogicalIndex(currentIndex);
    let prevLogical = logicalIndex - 1;

    if (prevLogical < 0) {
      if (repeat === 'all') {
        prevLogical = tracks.length - 1;
      } else {
        return -1;
      }
    }

    return getActualIndex(prevLogical);
  };

  /**
   * Save playlist to localStorage
   */
  const persistPlaylist = (): void => {
    if (!mergedConfig.persist) return;

    try {
      const data = {
        tracks,
        currentIndex,
        shuffle,
        repeat,
        shuffleOrder,
      };
      localStorage.setItem(mergedConfig.persistKey!, JSON.stringify(data));
    } catch (e) {
      api?.logger.warn('Failed to persist playlist', e);
    }
  };

  /**
   * Load playlist from localStorage
   */
  const loadPersistedPlaylist = (): void => {
    if (!mergedConfig.persist) return;

    try {
      const data = localStorage.getItem(mergedConfig.persistKey!);
      if (data) {
        const parsed = JSON.parse(data);
        tracks = parsed.tracks || [];
        currentIndex = parsed.currentIndex ?? -1;
        shuffle = parsed.shuffle ?? false;
        repeat = parsed.repeat ?? 'none';
        shuffleOrder = parsed.shuffleOrder || [];
      }
    } catch (e) {
      api?.logger.warn('Failed to load persisted playlist', e);
    }
  };

  /**
   * Emit playlist state change
   */
  const emitChange = (): void => {
    const track = currentIndex >= 0 ? tracks[currentIndex] : null;
    api?.emit('playlist:change' as any, { track, index: currentIndex });
    persistPlaylist();
  };

  /**
   * Set current track (emits playlist:change event)
   * NOTE: Does NOT load the source directly - the consumer should listen
   * for playlist:change events and call player.load(track.src)
   */
  const setCurrentTrack = (index: number): void => {
    if (index < 0 || index >= tracks.length) {
      api?.logger.warn('Invalid track index', { index });
      return;
    }

    const track = tracks[index];
    currentIndex = index;

    api?.logger.info('Track changed', { index, title: track.title, src: track.src });

    // Update state with track metadata
    if (track.title) {
      api?.setState('title', track.title);
    }
    if (track.artwork) {
      api?.setState('poster', track.artwork);
    }
    api?.setState('mediaType', track.type || 'audio');

    // Emit change event - the consumer should handle loading
    emitChange();
  };

  // Plugin implementation
  const plugin: IPlaylistPlugin = {
    id: 'playlist',
    name: 'Playlist',
    version: '1.0.0',
    type: 'feature' as PluginType,
    description: 'Playlist management with shuffle, repeat, and gapless playback',

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      api.logger.info('Playlist plugin initialized');

      // Load persisted playlist
      loadPersistedPlaylist();

      // Generate initial shuffle order if needed
      if (shuffle && tracks.length > 0) {
        generateShuffleOrder();
      }

      // Listen for playback ended to auto-advance
      const unsubEnded = api.on('playback:ended', () => {
        if (!mergedConfig.autoAdvance) return;

        const nextIdx = getNextIndex();
        if (nextIdx >= 0) {
          api?.logger.debug('Auto-advancing to next track', { nextIdx });
          setCurrentTrack(nextIdx);
          // Note: Consumer should handle loading and playing from playlist:change event
        } else {
          api?.logger.info('Playlist ended');
          api?.emit('playlist:ended' as any, undefined as any);
        }
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubEnded();
        persistPlaylist();
      });
    },

    async destroy(): Promise<void> {
      api?.logger.info('Playlist plugin destroying');
      persistPlaylist();
      api = null;
    },

    add(trackOrTracks: PlaylistTrack | PlaylistTrack[]): void {
      const newTracks = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];

      newTracks.forEach((track) => {
        const normalizedTrack = { ...track, id: track.id || generateId() };
        const index = tracks.length;
        tracks.push(normalizedTrack);

        api?.emit('playlist:add' as any, { track: normalizedTrack, index });
        api?.logger.debug('Track added', { title: normalizedTrack.title, index });
      });

      // Update shuffle order if needed
      if (shuffle) {
        // Add new indices to shuffle order
        const startIndex = tracks.length - newTracks.length;
        for (let i = startIndex; i < tracks.length; i++) {
          // Insert at random position (except before current)
          const insertPos = Math.floor(Math.random() * (shuffleOrder.length - getLogicalIndex(currentIndex))) + getLogicalIndex(currentIndex) + 1;
          shuffleOrder.splice(Math.min(insertPos, shuffleOrder.length), 0, i);
        }
      }

      persistPlaylist();
    },

    insert(index: number, track: PlaylistTrack): void {
      const normalizedTrack = { ...track, id: track.id || generateId() };
      const clampedIndex = Math.max(0, Math.min(index, tracks.length));

      tracks.splice(clampedIndex, 0, normalizedTrack);

      // Adjust current index if needed
      if (currentIndex >= clampedIndex) {
        currentIndex++;
      }

      // Update shuffle order
      if (shuffle) {
        // Increment all indices >= clampedIndex
        shuffleOrder = shuffleOrder.map((i) => (i >= clampedIndex ? i + 1 : i));
        // Add new index at random position
        const insertPos = Math.floor(Math.random() * shuffleOrder.length);
        shuffleOrder.splice(insertPos, 0, clampedIndex);
      }

      api?.emit('playlist:add' as any, { track: normalizedTrack, index: clampedIndex });
      persistPlaylist();
    },

    remove(idOrIndex: string | number): void {
      let index: number;

      if (typeof idOrIndex === 'string') {
        index = tracks.findIndex((t) => t.id === idOrIndex);
        if (index === -1) {
          api?.logger.warn('Track not found', { id: idOrIndex });
          return;
        }
      } else {
        index = idOrIndex;
      }

      if (index < 0 || index >= tracks.length) {
        api?.logger.warn('Invalid track index', { index });
        return;
      }

      const [removedTrack] = tracks.splice(index, 1);

      // Adjust current index
      if (index < currentIndex) {
        currentIndex--;
      } else if (index === currentIndex) {
        // Current track removed - stay at same index (next track slides in)
        if (currentIndex >= tracks.length) {
          currentIndex = tracks.length - 1;
        }
        emitChange();
      }

      // Update shuffle order
      if (shuffle) {
        shuffleOrder = shuffleOrder
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i));
      }

      api?.emit('playlist:remove' as any, { track: removedTrack, index });
      persistPlaylist();
    },

    clear(): void {
      tracks = [];
      currentIndex = -1;
      shuffleOrder = [];

      api?.emit('playlist:clear' as any, undefined as any);
      emitChange();
    },

    play(idOrIndex?: string | number): void {
      let index: number;

      if (idOrIndex === undefined) {
        // Play current or first track
        index = currentIndex >= 0 ? currentIndex : (shuffle ? getActualIndex(0) : 0);
      } else if (typeof idOrIndex === 'string') {
        index = tracks.findIndex((t) => t.id === idOrIndex);
        if (index === -1) {
          api?.logger.warn('Track not found', { id: idOrIndex });
          return;
        }
      } else {
        index = idOrIndex;
      }

      if (tracks.length === 0) {
        api?.logger.warn('Playlist is empty');
        return;
      }

      setCurrentTrack(index);
      // Consumer should handle loading and playing from playlist:change event
    },

    next(): void {
      const nextIdx = getNextIndex();
      if (nextIdx >= 0) {
        setCurrentTrack(nextIdx);
        // Consumer should handle loading and playing from playlist:change event
      } else {
        api?.logger.info('No next track');
      }
    },

    previous(): void {
      // If more than 3 seconds into track, restart current track
      const currentTime = api?.getState('currentTime') || 0;
      if (currentTime > 3) {
        api?.emit('playback:seeking', { time: 0 });
        return;
      }

      const prevIdx = getPreviousIndex();
      if (prevIdx >= 0) {
        setCurrentTrack(prevIdx);
        // Consumer should handle loading and playing from playlist:change event
      } else {
        api?.logger.info('No previous track');
      }
    },

    toggleShuffle(): void {
      this.setShuffle(!shuffle);
    },

    setShuffle(enabled: boolean): void {
      shuffle = enabled;

      if (enabled) {
        generateShuffleOrder();
      } else {
        shuffleOrder = [];
      }

      api?.emit('playlist:shuffle' as any, { enabled });
      api?.logger.info('Shuffle mode', { enabled });
      persistPlaylist();
    },

    cycleRepeat(): void {
      const modes: RepeatMode[] = ['none', 'all', 'one'];
      const currentIdx = modes.indexOf(repeat);
      const nextIdx = (currentIdx + 1) % modes.length;
      this.setRepeat(modes[nextIdx]);
    },

    setRepeat(mode: RepeatMode): void {
      repeat = mode;
      api?.emit('playlist:repeat' as any, { mode });
      api?.logger.info('Repeat mode', { mode });
      persistPlaylist();
    },

    move(fromIndex: number, toIndex: number): void {
      if (fromIndex < 0 || fromIndex >= tracks.length) return;
      if (toIndex < 0 || toIndex >= tracks.length) return;
      if (fromIndex === toIndex) return;

      const [track] = tracks.splice(fromIndex, 1);
      tracks.splice(toIndex, 0, track);

      // Adjust current index
      if (currentIndex === fromIndex) {
        currentIndex = toIndex;
      } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
        currentIndex--;
      } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
        currentIndex++;
      }

      // Regenerate shuffle order
      if (shuffle) {
        generateShuffleOrder();
      }

      api?.emit('playlist:reorder' as any, { tracks: [...tracks] });
      persistPlaylist();
    },

    getState(): PlaylistState {
      return {
        tracks: [...tracks],
        currentIndex,
        currentTrack: currentIndex >= 0 ? tracks[currentIndex] : null,
        shuffle,
        repeat,
        shuffleOrder: [...shuffleOrder],
        hasNext: hasNextTrack(),
        hasPrevious: hasPreviousTrack(),
      };
    },

    getTracks(): PlaylistTrack[] {
      return [...tracks];
    },

    getCurrentTrack(): PlaylistTrack | null {
      return currentIndex >= 0 ? tracks[currentIndex] : null;
    },

    getTrack(id: string): PlaylistTrack | null {
      return tracks.find((t) => t.id === id) || null;
    },
  };

  return plugin;
}

// Default export
export default createPlaylistPlugin;
