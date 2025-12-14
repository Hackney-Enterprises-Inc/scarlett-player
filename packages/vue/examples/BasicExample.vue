<template>
  <div class="example-container">
    <h1>Scarlett Player - Basic Example</h1>

    <div class="video-wrapper">
      <ScarlettPlayerComponent
        ref="playerRef"
        :src="videoUrl"
        :autoplay="false"
        :plugins="plugins"
        @ready="onPlayerReady"
        @play="onPlay"
        @pause="onPause"
        @timeupdate="onTimeUpdate"
        @error="onError"
      />
    </div>

    <div class="info">
      <p>Status: {{ playerStatus }}</p>
      <p>
        Time: {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </p>
      <p>Progress: {{ progress.toFixed(1) }}%</p>
    </div>

    <div class="controls">
      <button @click="playVideo" :disabled="isPlaying">Play</button>
      <button @click="pauseVideo" :disabled="!isPlaying">Pause</button>
      <button @click="seekTo(0)">Restart</button>
      <button @click="seekTo(30)">Skip to 30s</button>
      <button @click="changeQuality">Toggle Quality</button>
      <button @click="toggleMute">{{ isMuted ? 'Unmute' : 'Mute' }}</button>
    </div>

    <div class="source-selector">
      <label>
        <input
          type="radio"
          value="hls"
          v-model="sourceType"
          @change="changeSource"
        />
        HLS Stream
      </label>
      <label>
        <input
          type="radio"
          value="mp4"
          v-model="sourceType"
          @change="changeSource"
        />
        MP4 Video
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ScarlettPlayerComponent } from '../src/index';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createNativePlugin } from '@scarlett-player/native';
import { uiPlugin } from '@scarlett-player/ui';

// Player ref
const playerRef = ref();

// Video sources
const sources = {
  hls: 'https://vod.thestreamplatform.com/demo/bbb-2160p-stereo/playlist.m3u8',
  mp4: 'https://example.com/video.mp4',
};

const sourceType = ref<'hls' | 'mp4'>('hls');
const videoUrl = ref(sources.hls);

// Player state
const playerStatus = ref('Not Ready');
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const isMuted = ref(false);

// Computed
const progress = computed(() => {
  if (duration.value === 0) return 0;
  return (currentTime.value / duration.value) * 100;
});

// Plugins
const plugins = [
  createHLSPlugin({
    debug: false,
  }),
  createNativePlugin(),
  uiPlugin({
    hideDelay: 3000,
    theme: {
      accentColor: '#e50914',
    },
  }),
];

// Event handlers
function onPlayerReady(player: any) {
  playerStatus.value = 'Ready';
  console.log('Player ready!', player);
}

function onPlay() {
  isPlaying.value = true;
  playerStatus.value = 'Playing';
}

function onPause() {
  isPlaying.value = false;
  playerStatus.value = 'Paused';
}

function onTimeUpdate(payload: { currentTime: number; duration: number }) {
  currentTime.value = payload.currentTime;
  duration.value = payload.duration;
}

function onError(error: any) {
  console.error('Player error:', error);
  playerStatus.value = 'Error';
}

// Control methods
async function playVideo() {
  await playerRef.value?.play();
}

function pauseVideo() {
  playerRef.value?.pause();
}

function seekTo(time: number) {
  playerRef.value?.seek(time);
}

function changeQuality() {
  const qualities = playerRef.value?.getQualities() ?? [];
  if (qualities.length > 0) {
    const current = playerRef.value?.getCurrentQuality() ?? -1;
    const nextIndex = current === -1 ? 0 : (current + 1) % qualities.length;
    playerRef.value?.setQuality(nextIndex);
    console.log('Quality changed to:', qualities[nextIndex]?.label ?? 'Auto');
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value;
  playerRef.value?.setMuted(isMuted.value);
}

async function changeSource() {
  videoUrl.value = sources[sourceType.value];
  await playerRef.value?.load(videoUrl.value);
}

// Utility
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.example-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
}

h1 {
  margin-bottom: 2rem;
  color: #333;
}

.video-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  margin-bottom: 2rem;
  border-radius: 8px;
  overflow: hidden;
}

.info {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.info p {
  margin: 0.5rem 0;
  font-size: 14px;
}

.controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  background: #e50914;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #c40812;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.source-selector {
  display: flex;
  gap: 1rem;
}

.source-selector label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  cursor: pointer;
}

.source-selector input[type='radio'] {
  cursor: pointer;
}
</style>
