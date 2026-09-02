/**
 * Composable for using Scarlett Player in Vue 3
 *
 * Provides a reactive API for controlling the player programmatically.
 */

import {
  ref,
  onMounted,
  onBeforeUnmount,
  computed,
  getCurrentInstance,
  type Ref,
} from 'vue';
import type { ScarlettPlayer, PlayerOptions } from '@scarlett-player/core';

export interface UseScarlettPlayerOptions extends Omit<PlayerOptions, 'container'> {
  /**
   * Container element ref
   */
  container: Ref<HTMLElement | null>;

  /**
   * Auto-initialize player on mount.
   *
   * Only has an effect inside a component's `setup()`: outside one there is no
   * mount to hook, and the caller drives `init()` itself.
   */
  autoInit?: boolean;
}

/**
 * Reactive Scarlett Player bindings for Vue 3.
 *
 * Lifecycle hooks are registered only when the composable runs inside a
 * component `setup()`. Called anywhere else (a store, a test, a plain
 * module), Vue's `onMounted`/`onBeforeUnmount` have no instance to attach to
 * and warn "onMounted is called when there is no active component instance"
 * while silently doing nothing, so the composable does not call them at all;
 * outside a component the caller owns `init()` and `player.value.destroy()`.
 *
 * @param options - Container ref plus the player options to construct with
 * @returns Reactive state refs, the player ref, and the control methods
 */
export function useScarlettPlayer(options: UseScarlettPlayerOptions) {
  const player = ref<ScarlettPlayer | null>(null);
  const isReady = ref(false);
  const error = ref<Error | null>(null);

  // Reactive state
  const playing = ref(false);
  const paused = ref(true);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(options.volume ?? 1);
  const muted = ref(options.muted ?? false);
  const bufferedAmount = ref(0);
  const fullscreen = ref(false);

  // Initialize player
  async function init() {
    if (!options.container.value) {
      error.value = new Error('Container element not found');
      return;
    }

    try {
      const { ScarlettPlayer: PlayerClass } = await import('@scarlett-player/core');

      const playerOptions: PlayerOptions = {
        container: options.container.value,
        src: options.src,
        poster: options.poster,
        autoplay: options.autoplay,
        loop: options.loop,
        volume: options.volume,
        muted: options.muted,
        logLevel: options.logLevel,
        plugins: options.plugins,
      };

      const instance = new PlayerClass(playerOptions);
      await instance.init();
      player.value = instance;

      // Setup state sync
      setupStateSync(instance);

      isReady.value = true;
    } catch (err) {
      error.value = err as Error;
      console.error('Failed to initialize Scarlett Player:', err);
    }
  }

  // Setup state synchronization
  function setupStateSync(playerInstance: ScarlettPlayer) {
    // Sync playback state
    playerInstance.on('playback:play', () => {
      playing.value = true;
      paused.value = false;
    });

    playerInstance.on('playback:pause', () => {
      playing.value = false;
      paused.value = true;
    });

    playerInstance.on('playback:timeupdate', (payload) => {
      currentTime.value = payload.currentTime;
    });

    // Sync volume state
    playerInstance.on('volume:change', (payload) => {
      volume.value = payload.volume;
      muted.value = payload.muted;
    });

    // Sync buffering state
    playerInstance.on('media:progress', (payload) => {
      bufferedAmount.value = payload.buffered;
    });

    // Sync fullscreen state
    playerInstance.on('fullscreen:change', (payload) => {
      fullscreen.value = payload.fullscreen;
    });

    // Sync media metadata
    playerInstance.on('media:loadedmetadata', (payload) => {
      duration.value = payload.duration ?? 0;
    });

    // Handle errors
    playerInstance.on('error', (err) => {
      error.value = err as unknown as Error;
    });
  }

  // Playback methods
  async function play() {
    if (player.value) {
      await player.value.play();
    }
  }

  function pause() {
    if (player.value) {
      player.value.pause();
    }
  }

  function seek(time: number) {
    if (player.value) {
      player.value.seek(time);
    }
  }

  async function load(src: string) {
    if (player.value) {
      await player.value.load(src);
    }
  }

  // Volume methods
  function setVolume(vol: number) {
    if (player.value) {
      player.value.setVolume(vol);
    }
  }

  function setMuted(mute: boolean) {
    if (player.value) {
      player.value.setMuted(mute);
    }
  }

  /**
   * Set the poster shown until the first frame renders.
   *
   * The `poster` option seeds the player at construction; this is how a
   * caller changes it afterwards. An empty string clears it.
   *
   * @param url - Poster image URL, or '' to clear it
   */
  function setPoster(url: string) {
    if (player.value) {
      player.value.setPoster(url);
    }
  }

  // Fullscreen methods
  async function requestFullscreen() {
    if (player.value) {
      await player.value.requestFullscreen();
    }
  }

  async function exitFullscreen() {
    if (player.value) {
      await player.value.exitFullscreen();
    }
  }

  async function toggleFullscreen() {
    if (player.value) {
      await player.value.toggleFullscreen();
    }
  }

  // Quality methods
  function getQualities() {
    return player.value?.getQualities() ?? [];
  }

  function setQuality(index: number) {
    if (player.value) {
      player.value.setQuality(index);
    }
  }

  function getCurrentQuality() {
    return player.value?.getCurrentQuality() ?? -1;
  }

  // Computed properties
  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  const isBuffering = computed(() => {
    if (!player.value) return false;
    const state = player.value.getState();
    return state.buffering ?? false;
  });

  // Lifecycle. Registered only inside a component's setup(): outside one, Vue
  // has no instance to attach the hooks to, so it warns and drops them, and
  // the caller is the one holding init() and destroy() anyway.
  if (getCurrentInstance()) {
    onMounted(() => {
      if (options.autoInit !== false) {
        init();
      }
    });

    onBeforeUnmount(() => {
      if (player.value) {
        player.value.destroy();
        player.value = null;
      }
    });
  }

  return {
    // Instance
    player,
    isReady,
    error,

    // State
    playing,
    paused,
    currentTime,
    duration,
    volume,
    muted,
    bufferedAmount,
    fullscreen,
    progress,
    isBuffering,

    // Methods
    init,
    play,
    pause,
    seek,
    load,
    setVolume,
    setMuted,
    setPoster,
    requestFullscreen,
    exitFullscreen,
    toggleFullscreen,
    getQualities,
    setQuality,
    getCurrentQuality,
  };
}
