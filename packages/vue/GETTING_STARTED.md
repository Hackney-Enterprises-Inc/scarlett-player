# Getting Started with @scarlett-player/vue

Quick start guide for integrating Scarlett Player into your Vue 3 application.

## Installation

```bash
npm install @scarlett-player/vue @scarlett-player/core @scarlett-player/hls @scarlett-player/native @scarlett-player/ui
```

Or with pnpm:

```bash
pnpm add @scarlett-player/vue @scarlett-player/core @scarlett-player/hls @scarlett-player/native @scarlett-player/ui
```

## Minimal Setup

### 1. Import and Use Component

```vue
<template>
  <div class="player-container">
    <ScarlettPlayer
      :src="videoUrl"
      :plugins="plugins"
      @ready="onPlayerReady"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ScarlettPlayer from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createNativePlugin } from '@scarlett-player/native';
import { uiPlugin } from '@scarlett-player/ui';

const videoUrl = ref('https://example.com/video.m3u8');

const plugins = [
  createHLSPlugin(),       // For HLS streams (.m3u8)
  createNativePlugin(),    // For MP4, WebM, MOV, MKV
  uiPlugin(),              // Player UI controls
];

function onPlayerReady(player) {
  console.log('Player is ready!', player);
}
</script>

<style scoped>
.player-container {
  width: 100%;
  max-width: 1280px;
  aspect-ratio: 16 / 9;
}
</style>
```

### 2. Control Playback Programmatically

```vue
<template>
  <div>
    <ScarlettPlayer
      ref="playerRef"
      :src="videoUrl"
      :plugins="plugins"
    />

    <div class="controls">
      <button @click="play">Play</button>
      <button @click="pause">Pause</button>
      <button @click="seekForward">+10s</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ScarlettPlayer from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const playerRef = ref();
const videoUrl = ref('https://example.com/video.m3u8');

const plugins = [
  createHLSPlugin(),
  uiPlugin(),
];

async function play() {
  await playerRef.value?.play();
}

function pause() {
  playerRef.value?.pause();
}

function seekForward() {
  const currentTime = playerRef.value?.currentTime ?? 0;
  playerRef.value?.seek(currentTime + 10);
}
</script>
```

### 3. Listen to Player Events

```vue
<template>
  <div>
    <ScarlettPlayer
      :src="videoUrl"
      :plugins="plugins"
      @play="onPlay"
      @pause="onPause"
      @timeupdate="onTimeUpdate"
      @error="onError"
    />

    <p>Status: {{ status }}</p>
    <p>Time: {{ currentTime.toFixed(2) }}s</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ScarlettPlayer from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const videoUrl = ref('https://example.com/video.m3u8');
const status = ref('Loading');
const currentTime = ref(0);

const plugins = [createHLSPlugin(), uiPlugin()];

function onPlay() {
  status.value = 'Playing';
}

function onPause() {
  status.value = 'Paused';
}

function onTimeUpdate({ currentTime: time }) {
  currentTime.value = time;
}

function onError(error) {
  console.error('Player error:', error);
  status.value = 'Error';
}
</script>
```

## Using the Composable API

For more reactive control, use the `useScarlettPlayer` composable:

```vue
<template>
  <div>
    <div ref="containerRef" class="player-wrapper"></div>

    <div class="info">
      <p>{{ playing ? 'Playing' : 'Paused' }}</p>
      <p>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</p>
      <p>Volume: {{ (volume * 100).toFixed(0) }}%</p>
    </div>

    <div class="controls">
      <button @click="play">Play</button>
      <button @click="pause">Pause</button>
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
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useScarlettPlayer } from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const containerRef = ref(null);

const {
  playing,
  currentTime,
  duration,
  volume,
  play,
  pause,
  setVolume,
} = useScarlettPlayer({
  container: containerRef,
  src: 'https://example.com/video.m3u8',
  plugins: [createHLSPlugin(), uiPlugin()],
});

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.player-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}
</style>
```

## Common Use Cases

### HLS Live Stream

```vue
<ScarlettPlayer
  :src="'https://example.com/live.m3u8'"
  :autoplay="true"
  :plugins="[createHLSPlugin({ lowLatencyMode: true }), uiPlugin()]"
  @loadedmetadata="checkIfLive"
/>
```

### MP4 Video

```vue
<ScarlettPlayer
  :src="'https://example.com/video.mp4'"
  :plugins="[createNativePlugin(), uiPlugin()]"
/>
```

### Custom Theme

```vue
<script setup>
const plugins = [
  createHLSPlugin(),
  uiPlugin({
    theme: {
      accentColor: '#ff6b6b',      // Custom accent color
      primaryColor: '#ffffff',      // Text/icon color
      controlBarHeight: 56,         // Taller controls
    },
  }),
];
</script>
```

### Quality Selection

```vue
<template>
  <div>
    <ScarlettPlayer
      ref="playerRef"
      :src="videoUrl"
      :plugins="plugins"
      @qualitylevels="onQualityLevels"
    />

    <select @change="changeQuality">
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
</template>

<script setup>
const playerRef = ref();
const qualities = ref([]);

function onQualityLevels(payload) {
  qualities.value = payload.levels || [];
}

function changeQuality(e) {
  const index = parseInt(e.target.value);
  playerRef.value?.setQuality(index);
}
</script>
```

## TypeScript Support

All components and composables are fully typed:

```typescript
import type {
  ScarlettPlayer,
  PlayerOptions,
  QualityLevel,
  StateStore,
} from '@scarlett-player/vue';

const playerRef = ref<InstanceType<typeof ScarlettPlayerComponent>>();
```

## Next Steps

- Check out the [full API documentation](./README.md)
- See [examples](./examples/) for more advanced usage
- Learn about [plugins](../../README.md#packages) in the main docs

## Troubleshooting

### Player not initializing?

Make sure the container element exists before the player mounts:

```vue
<template>
  <div v-if="mounted">
    <ScarlettPlayer :src="src" :plugins="plugins" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});
</script>
```

### SSR (Nuxt) compatibility?

The player automatically handles SSR by dynamically importing the core on mount:

```vue
<template>
  <ClientOnly>
    <ScarlettPlayer :src="src" :plugins="plugins" />
  </ClientOnly>
</template>
```

### Events not firing?

Ensure you're using the correct event names (with colons):

```vue
<!-- ✅ Correct -->
<ScarlettPlayer @timeupdate="handler" />

<!-- ❌ Incorrect -->
<ScarlettPlayer @time-update="handler" />
```

## Support

- [GitHub Issues](https://github.com/thestreamplatform/scarlett-player/issues)
- [Documentation](https://scarlettplayer.com)
