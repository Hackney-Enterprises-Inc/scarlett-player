# @scarlett-player/vue

Vue 3 component wrapper for Scarlett Player.

## Installation

```bash
npm install @scarlett-player/vue @scarlett-player/core
```

## Quick Start

### Basic Component Usage

```vue
<template>
  <div class="video-container">
    <ScarlettPlayer
      ref="playerRef"
      :src="videoUrl"
      :autoplay="false"
      :plugins="plugins"
      @ready="onPlayerReady"
      @play="onPlay"
      @pause="onPause"
      @timeupdate="onTimeUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ScarlettPlayerComponent } from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createNativePlugin } from '@scarlett-player/native';
import { uiPlugin } from '@scarlett-player/ui';

const playerRef = ref();
const videoUrl = ref('https://example.com/video.m3u8');

const plugins = [
  createHLSPlugin(),
  createNativePlugin(),
  uiPlugin({
    theme: {
      accentColor: '#e50914',
    },
  }),
];

function onPlayerReady(player) {
  console.log('Player ready!', player);
}

function onPlay() {
  console.log('Playing');
}

function onPause() {
  console.log('Paused');
}

function onTimeUpdate({ currentTime, duration }) {
  console.log(`Time: ${currentTime}s / ${duration}s`);
}

// Control player programmatically
async function playVideo() {
  await playerRef.value?.play();
}

function pauseVideo() {
  playerRef.value?.pause();
}

function seekTo(time: number) {
  playerRef.value?.seek(time);
}
</script>

<style scoped>
.video-container {
  width: 100%;
  max-width: 1280px;
  aspect-ratio: 16 / 9;
}
</style>
```

### Using the Composable API

For more control and reactive state management:

```vue
<template>
  <div>
    <div ref="containerRef" class="video-container"></div>

    <div class="controls">
      <button @click="play" :disabled="playing">Play</button>
      <button @click="pause" :disabled="!playing">Pause</button>
      <button @click="toggleFullscreen">Fullscreen</button>

      <div class="time">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>

      <input
        type="range"
        :value="currentTime"
        :max="duration"
        @input="seek($event.target.value)"
      />

      <div class="volume">
        <button @click="setMuted(!muted)">
          {{ muted ? 'Unmute' : 'Mute' }}
        </button>
        <input
          type="range"
          :value="volume"
          min="0"
          max="1"
          step="0.1"
          @input="setVolume($event.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useScarlettPlayer } from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createNativePlugin } from '@scarlett-player/native';
import { uiPlugin } from '@scarlett-player/ui';

const containerRef = ref<HTMLElement | null>(null);

const {
  player,
  isReady,
  playing,
  paused,
  currentTime,
  duration,
  volume,
  muted,
  fullscreen,
  play,
  pause,
  seek,
  setVolume,
  setMuted,
  toggleFullscreen,
} = useScarlettPlayer({
  container: containerRef,
  src: 'https://example.com/video.m3u8',
  plugins: [
    createHLSPlugin(),
    createNativePlugin(),
    uiPlugin(),
  ],
  autoInit: true,
});

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.video-container {
  width: 100%;
  max-width: 1280px;
  aspect-ratio: 16 / 9;
  background: #000;
}

.controls {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
  align-items: center;
}
</style>
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | - | Video source URL |
| `poster` | `string` | - | Poster image URL |
| `autoplay` | `boolean` | `false` | Auto-play video on load |
| `loop` | `boolean` | `false` | Loop playback |
| `volume` | `number` | `1.0` | Initial volume (0-1) |
| `muted` | `boolean` | `false` | Start muted |
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error'` | `'warn'` | Console log level |
| `plugins` | `Plugin[]` | `[]` | Scarlett Player plugins |
| `options` | `PlayerOptions` | `{}` | Additional player options |

## Component Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | `ScarlettPlayer` | Player initialized and ready |
| `play` | - | Playback started |
| `pause` | - | Playback paused |
| `seeking` | `{ time: number }` | Seeking to new time |
| `seeked` | - | Seek completed |
| `timeupdate` | `{ currentTime: number, duration: number }` | Time updated |
| `volumechange` | `{ volume: number, muted: boolean }` | Volume/mute changed |
| `ratechange` | `{ rate: number }` | Playback rate changed |
| `ended` | - | Playback ended |
| `error` | `Error` | Error occurred |
| `loaded` | `any` | Media loaded |
| `loadedmetadata` | `any` | Metadata loaded |
| `qualitychange` | `{ quality: string, auto: boolean }` | Quality level changed |
| `qualitylevels` | `any` | Quality levels available |
| `fullscreenchange` | `{ fullscreen: boolean }` | Fullscreen state changed |
| `destroy` | - | Player destroyed |

## Component Methods (via ref)

Access player methods via template ref:

```vue
<template>
  <ScarlettPlayer ref="playerRef" />
</template>

<script setup>
const playerRef = ref();

// Access methods
playerRef.value.play();
playerRef.value.pause();
playerRef.value.seek(30);
playerRef.value.setVolume(0.5);
playerRef.value.setMuted(true);
playerRef.value.setQuality(2);
playerRef.value.requestFullscreen();
</script>
```

### Available Methods

- `play()` - Start playback
- `pause()` - Pause playback
- `seek(time: number)` - Seek to time in seconds
- `load(src: string)` - Load new source
- `setVolume(volume: number)` - Set volume (0-1)
- `setMuted(muted: boolean)` - Set muted state
- `setPlaybackRate(rate: number)` - Set playback speed
- `getQualities()` - Get available quality levels
- `setQuality(index: number)` - Set quality level (-1 for auto)
- `getCurrentQuality()` - Get current quality index
- `requestFullscreen()` - Enter fullscreen
- `exitFullscreen()` - Exit fullscreen
- `toggleFullscreen()` - Toggle fullscreen
- `requestAirPlay()` - Show AirPlay picker
- `requestChromecast()` - Request Chromecast session
- `stopCasting()` - Stop casting
- `seekToLive()` - Seek to live edge (for live streams)
- `getState()` - Get current state snapshot
- `getPlugin(name: string)` - Get plugin instance
- `registerPlugin(plugin: Plugin)` - Register new plugin
- `destroy()` - Destroy player instance

## Composable API

The `useScarlettPlayer` composable provides reactive state and methods:

```typescript
const {
  // Instance
  player,
  isReady,
  error,

  // Reactive state
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
  isBuffering,

  // Methods
  init,
  play,
  pause,
  seek,
  load,
  setVolume,
  setMuted,
  requestFullscreen,
  exitFullscreen,
  toggleFullscreen,
  getQualities,
  setQuality,
  getCurrentQuality,
} = useScarlettPlayer(options);
```

## Global Plugin Installation

You can register the component globally:

```typescript
import { createApp } from 'vue';
import { ScarlettPlayerPlugin } from '@scarlett-player/vue';
import App from './App.vue';

const app = createApp(App);
app.use(ScarlettPlayerPlugin);
app.mount('#app');
```

Then use it without importing:

```vue
<template>
  <ScarlettPlayer :src="videoUrl" :plugins="plugins" />
</template>
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  ScarlettPlayer,
  PlayerOptions,
  QualityLevel,
  ScarlettPlugin,
  EventName,
  StateStore,
} from '@scarlett-player/vue';
```

## Examples

### Custom Controls

```vue
<template>
  <div class="player-wrapper">
    <ScarlettPlayer
      ref="playerRef"
      :src="videoUrl"
      :plugins="plugins"
      @timeupdate="onTimeUpdate"
    />

    <!-- Custom UI overlay -->
    <div class="custom-controls">
      <button @click="playPause">
        {{ playing ? 'Pause' : 'Play' }}
      </button>

      <div class="progress-bar" @click="handleProgressClick">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <select @change="handleQualityChange">
        <option value="-1">Auto</option>
        <option
          v-for="(quality, index) in qualities"
          :key="index"
          :value="index"
        >
          {{ quality.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ScarlettPlayerComponent } from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const playerRef = ref();
const videoUrl = ref('https://example.com/video.m3u8');
const playing = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const qualities = ref([]);

const plugins = [
  createHLSPlugin(),
  uiPlugin({ hideDelay: 3000 }),
];

const progressPercent = computed(() => {
  if (duration.value === 0) return 0;
  return (currentTime.value / duration.value) * 100;
});

function onTimeUpdate({ currentTime: ct, duration: d }) {
  currentTime.value = ct;
  duration.value = d;
}

function playPause() {
  if (playing.value) {
    playerRef.value?.pause();
  } else {
    playerRef.value?.play();
  }
  playing.value = !playing.value;
}

function handleProgressClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const seekTime = percent * duration.value;
  playerRef.value?.seek(seekTime);
}

function handleQualityChange(e: Event) {
  const index = parseInt((e.target as HTMLSelectElement).value);
  playerRef.value?.setQuality(index);
}

function loadQualities() {
  qualities.value = playerRef.value?.getQualities() ?? [];
}
</script>
```

### Live Stream with DVR

```vue
<template>
  <div>
    <ScarlettPlayer
      ref="playerRef"
      :src="liveStreamUrl"
      :autoplay="true"
      :plugins="plugins"
      @loadedmetadata="onMetadataLoaded"
    />

    <button v-if="isLive" @click="goToLive">
      Go to Live
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ScarlettPlayerComponent } from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const playerRef = ref();
const liveStreamUrl = ref('https://example.com/live.m3u8');
const isLive = ref(false);

const plugins = [
  createHLSPlugin({ lowLatencyMode: true }),
  uiPlugin(),
];

function onMetadataLoaded(payload) {
  isLive.value = payload.live ?? false;
}

function goToLive() {
  playerRef.value?.seekToLive();
}
</script>
```

## Browser Support

- Chrome 80+
- Firefox 78+
- Safari 14+
- Edge 80+

## License

MIT

## Credits

Built with Scarlett Player - Modular. Extensible. Yours.
