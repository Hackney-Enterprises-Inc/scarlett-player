<template>
  <div class="example-container">
    <h1>Scarlett Player - Composable Example</h1>

    <div ref="containerRef" class="video-wrapper"></div>

    <div v-if="error" class="error">
      Error: {{ error.message }}
    </div>

    <div v-if="isReady" class="info">
      <p>Status: {{ playing ? 'Playing' : paused ? 'Paused' : 'Loading' }}</p>
      <p>Time: {{ formatTime(currentTime) }} / {{ formatTime(duration) }}</p>
      <p>Progress: {{ progress.toFixed(1) }}%</p>
      <p>Volume: {{ (volume * 100).toFixed(0) }}%</p>
      <p>Muted: {{ muted ? 'Yes' : 'No' }}</p>
      <p>Buffered: {{ (bufferedAmount * 100).toFixed(1) }}%</p>
      <p>Fullscreen: {{ fullscreen ? 'Yes' : 'No' }}</p>
      <p v-if="live">🔴 LIVE</p>
    </div>

    <div v-if="isReady" class="controls">
      <button @click="play" :disabled="playing">Play</button>
      <button @click="pause" :disabled="!playing">Pause</button>
      <button @click="seek(0)">Restart</button>
      <button @click="seek(currentTime - 10)">-10s</button>
      <button @click="seek(currentTime + 10)">+10s</button>
      <button @click="toggleFullscreen">
        {{ fullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
      </button>
    </div>

    <div v-if="isReady" class="seekbar">
      <input
        type="range"
        :value="currentTime"
        :max="duration"
        step="0.1"
        @input="handleSeek"
        class="seekbar-input"
      />
    </div>

    <div v-if="isReady" class="volume-control">
      <button @click="setMuted(!muted)">
        {{ muted ? '🔇' : '🔊' }}
      </button>
      <input
        type="range"
        :value="volume"
        min="0"
        max="1"
        step="0.05"
        @input="handleVolumeChange"
        class="volume-input"
      />
      <span>{{ (volume * 100).toFixed(0) }}%</span>
    </div>

    <div v-if="isReady && qualities.length > 0" class="quality-selector">
      <label for="quality">Quality:</label>
      <select id="quality" @change="handleQualityChange">
        <option value="-1" :selected="currentQuality === -1">Auto</option>
        <option
          v-for="(quality, index) in qualities"
          :key="index"
          :value="index"
          :selected="currentQuality === index"
        >
          {{ quality.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useScarlettPlayer } from '../src/composables/useScarlettPlayer';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createNativePlugin } from '@scarlett-player/native';
import { uiPlugin } from '@scarlett-player/ui';

// Container ref
const containerRef = ref<HTMLElement | null>(null);

// Use composable
const {
  player,
  isReady,
  error,
  playing,
  paused,
  currentTime,
  duration,
  volume,
  muted,
  bufferedAmount,
  fullscreen,
  live,
  progress,
  play,
  pause,
  seek,
  setVolume,
  setMuted,
  toggleFullscreen,
  getQualities,
  setQuality,
  getCurrentQuality,
} = useScarlettPlayer({
  container: containerRef,
  src: 'https://vod.thestreamplatform.com/demo/bbb-2160p-stereo/playlist.m3u8',
  autoplay: false,
  plugins: [
    createHLSPlugin({
      debug: false,
    }),
    createNativePlugin(),
    uiPlugin({
      hideDelay: 3000,
      theme: {
        accentColor: '#00a8ff',
      },
    }),
  ],
  autoInit: true,
});

// Quality levels
const qualities = computed(() => getQualities());
const currentQuality = computed(() => getCurrentQuality());

// Event handlers
function handleSeek(e: Event) {
  const time = parseFloat((e.target as HTMLInputElement).value);
  seek(time);
}

function handleVolumeChange(e: Event) {
  const vol = parseFloat((e.target as HTMLInputElement).value);
  setVolume(vol);
}

function handleQualityChange(e: Event) {
  const index = parseInt((e.target as HTMLSelectElement).value);
  setQuality(index);
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

.error {
  background: #fee;
  color: #c00;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
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
  background: #00a8ff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #0088cc;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.seekbar {
  margin-bottom: 1rem;
}

.seekbar-input {
  width: 100%;
  cursor: pointer;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.volume-input {
  width: 150px;
  cursor: pointer;
}

.quality-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quality-selector label {
  font-size: 14px;
  font-weight: 500;
}

.quality-selector select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}
</style>
