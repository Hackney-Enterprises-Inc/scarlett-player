<template>
  <div ref="containerRef" class="scarlett-player-container"></div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
  type PropType,
  defineExpose,
} from 'vue';
import type { ScarlettPlayer, PlayerOptions, Plugin } from '@scarlett-player/core';

// Props
const props = defineProps({
  /**
   * Video source URL
   */
  src: {
    type: String,
    required: false,
  },
  /**
   * Poster image URL
   */
  poster: {
    type: String,
    required: false,
  },
  /**
   * Autoplay video
   */
  autoplay: {
    type: Boolean,
    default: false,
  },
  /**
   * Loop playback
   */
  loop: {
    type: Boolean,
    default: false,
  },
  /**
   * Initial volume (0-1)
   */
  volume: {
    type: Number,
    default: 1.0,
    validator: (value: number) => value >= 0 && value <= 1,
  },
  /**
   * Start muted
   */
  muted: {
    type: Boolean,
    default: false,
  },
  /**
   * Log level
   */
  logLevel: {
    type: String as PropType<'debug' | 'info' | 'warn' | 'error'>,
    default: 'warn',
  },
  /**
   * Plugins to register
   */
  plugins: {
    type: Array as PropType<Plugin[]>,
    default: () => [],
  },
  /**
   * Player options (overrides individual props)
   */
  options: {
    type: Object as PropType<Partial<PlayerOptions>>,
    default: () => ({}),
  },
});

// Emits
const emit = defineEmits<{
  ready: [player: ScarlettPlayer];
  play: [];
  pause: [];
  seeking: [payload: { time: number }];
  seeked: [];
  timeupdate: [payload: { currentTime: number; duration: number }];
  volumechange: [payload: { volume: number; muted: boolean }];
  ratechange: [payload: { rate: number }];
  ended: [];
  error: [error: any];
  loaded: [payload: any];
  loadedmetadata: [payload: any];
  qualitychange: [payload: { quality: string; auto: boolean }];
  qualitylevels: [payload: any];
  fullscreenchange: [payload: { fullscreen: boolean }];
  destroy: [];
}>();

// Refs
const containerRef = ref<HTMLElement | null>(null);
const playerInstance = ref<ScarlettPlayer | null>(null);

// Lifecycle
onMounted(async () => {
  if (!containerRef.value) {
    console.error('ScarlettPlayer: Container ref not found');
    return;
  }

  try {
    // Import ScarlettPlayer dynamically to avoid SSR issues
    const { ScarlettPlayer: PlayerClass } = await import('@scarlett-player/core');

    // Merge props into options
    const playerOptions: PlayerOptions = {
      container: containerRef.value,
      src: props.src,
      poster: props.poster,
      autoplay: props.autoplay,
      loop: props.loop,
      volume: props.volume,
      muted: props.muted,
      logLevel: props.logLevel,
      plugins: props.plugins,
      ...props.options, // Allow options prop to override
    };

    // Create player instance
    playerInstance.value = new PlayerClass(playerOptions);

    // Initialize player
    await playerInstance.value.init();

    // Set up event listeners
    setupEventListeners(playerInstance.value);

    // Emit ready event
    emit('ready', playerInstance.value);
  } catch (error) {
    console.error('Failed to initialize ScarlettPlayer:', error);
    emit('error', error);
  }
});

onBeforeUnmount(() => {
  if (playerInstance.value) {
    playerInstance.value.destroy();
    playerInstance.value = null;
  }
});

// Watch for src changes
watch(
  () => props.src,
  async (newSrc) => {
    if (newSrc && playerInstance.value) {
      await playerInstance.value.load(newSrc);
    }
  }
);

// Watch for volume changes
watch(
  () => props.volume,
  (newVolume) => {
    if (playerInstance.value) {
      playerInstance.value.setVolume(newVolume);
    }
  }
);

// Watch for muted changes
watch(
  () => props.muted,
  (newMuted) => {
    if (playerInstance.value) {
      playerInstance.value.setMuted(newMuted);
    }
  }
);

// Watch for autoplay changes
watch(
  () => props.autoplay,
  (newAutoplay) => {
    if (playerInstance.value) {
      playerInstance.value.setAutoplay(newAutoplay);
    }
  }
);

// Event listeners setup
function setupEventListeners(player: ScarlettPlayer) {
  // Player events
  player.on('player:ready', () => emit('ready', player));
  player.on('player:destroy', () => emit('destroy'));

  // Playback events
  player.on('playback:play', () => emit('play'));
  player.on('playback:pause', () => emit('pause'));
  player.on('playback:seeking', (payload) => emit('seeking', payload));
  player.on('playback:seeked', () => emit('seeked'));
  player.on('playback:timeupdate', (payload) => emit('timeupdate', payload));
  player.on('playback:ended', () => emit('ended'));
  player.on('playback:ratechange', (payload) => emit('ratechange', payload));

  // Media events
  player.on('media:loaded', (payload) => emit('loaded', payload));
  player.on('media:loadedmetadata', (payload) => emit('loadedmetadata', payload));

  // Volume events
  player.on('volume:change', (payload) => emit('volumechange', payload));

  // Quality events
  player.on('quality:change', (payload) => emit('qualitychange', payload));
  player.on('quality:levels', (payload) => emit('qualitylevels', payload));

  // Fullscreen events
  player.on('fullscreen:change', (payload) => emit('fullscreenchange', payload));

  // Error events
  player.on('error', (error) => emit('error', error));
}

// Public API (exposed to parent component via ref)
defineExpose({
  player: playerInstance,

  // Playback methods
  async play() {
    await playerInstance.value?.play();
  },
  pause() {
    playerInstance.value?.pause();
  },
  seek(time: number) {
    playerInstance.value?.seek(time);
  },

  // Volume methods
  setVolume(volume: number) {
    playerInstance.value?.setVolume(volume);
  },
  setMuted(muted: boolean) {
    playerInstance.value?.setMuted(muted);
  },

  // Playback rate
  setPlaybackRate(rate: number) {
    playerInstance.value?.setPlaybackRate(rate);
  },

  // Quality methods
  getQualities() {
    return playerInstance.value?.getQualities() ?? [];
  },
  setQuality(index: number) {
    playerInstance.value?.setQuality(index);
  },
  getCurrentQuality() {
    return playerInstance.value?.getCurrentQuality() ?? -1;
  },

  // Fullscreen methods
  async requestFullscreen() {
    await playerInstance.value?.requestFullscreen();
  },
  async exitFullscreen() {
    await playerInstance.value?.exitFullscreen();
  },
  async toggleFullscreen() {
    await playerInstance.value?.toggleFullscreen();
  },

  // Casting methods
  requestAirPlay() {
    playerInstance.value?.requestAirPlay();
  },
  async requestChromecast() {
    await playerInstance.value?.requestChromecast();
  },
  stopCasting() {
    playerInstance.value?.stopCasting();
  },

  // Live stream methods
  seekToLive() {
    playerInstance.value?.seekToLive();
  },

  // State methods
  getState() {
    return playerInstance.value?.getState();
  },

  // Plugin methods
  getPlugin<T>(name: string) {
    return playerInstance.value?.getPlugin<T>(name) ?? null;
  },
  registerPlugin(plugin: Plugin) {
    playerInstance.value?.registerPlugin(plugin);
  },

  // Load source
  async load(src: string) {
    await playerInstance.value?.load(src);
  },

  // Destroy
  destroy() {
    playerInstance.value?.destroy();
  },

  // State getters
  get playing() {
    return playerInstance.value?.playing ?? false;
  },
  get paused() {
    return playerInstance.value?.paused ?? true;
  },
  get currentTime() {
    return playerInstance.value?.currentTime ?? 0;
  },
  get duration() {
    return playerInstance.value?.duration ?? 0;
  },
  get volume() {
    return playerInstance.value?.volume ?? 1;
  },
  get muted() {
    return playerInstance.value?.muted ?? false;
  },
  get playbackRate() {
    return playerInstance.value?.playbackRate ?? 1;
  },
  get bufferedAmount() {
    return playerInstance.value?.bufferedAmount ?? 0;
  },
  get fullscreen() {
    return playerInstance.value?.fullscreen ?? false;
  },
  get live() {
    return playerInstance.value?.live ?? false;
  },
  get autoplay() {
    return playerInstance.value?.autoplay ?? false;
  },
});
</script>

<style scoped>
.scarlett-player-container {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
