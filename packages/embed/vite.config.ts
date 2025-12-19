import { defineConfig } from 'vite';
import { resolve } from 'path';

// Determine which variant to build based on environment variables
const isLight = process.env.BUILD_LIGHT === 'true';
const isFull = process.env.BUILD_FULL === 'true';
const isAudio = process.env.BUILD_AUDIO === 'true';
const isAudioLight = process.env.BUILD_AUDIO_LIGHT === 'true';

// Determine entry point and output name
let entry: string;
let baseName: string;
let globalName: string;

if (isAudioLight) {
  entry = resolve(__dirname, 'src/index-audio-light.ts');
  baseName = 'embed.audio.light';
  globalName = 'ScarlettAudio';
} else if (isAudio) {
  entry = resolve(__dirname, 'src/index-audio.ts');
  baseName = 'embed.audio';
  globalName = 'ScarlettAudio';
} else if (isFull) {
  entry = resolve(__dirname, 'src/index-full.ts');
  baseName = 'embed.full';
  globalName = 'ScarlettPlayer';
} else if (isLight) {
  entry = resolve(__dirname, 'src/index-light.ts');
  baseName = 'embed.light';
  globalName = 'ScarlettPlayer';
} else {
  entry = resolve(__dirname, 'src/index.ts');
  baseName = 'embed';
  globalName = 'ScarlettPlayer';
}

const fileName = (format: string) => {
  if (format === 'umd') {
    return `${baseName}.umd.cjs`;
  }
  return `${baseName}.js`;
};

// Only empty outDir on first build (default/standard)
const shouldEmptyOutDir = !isLight && !isFull && !isAudio && !isAudioLight;

export default defineConfig({
  build: {
    lib: {
      entry,
      name: globalName,
      formats: ['es', 'umd'],
      fileName,
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return `${baseName}.css`;
          }
          return assetInfo.name || 'asset';
        },
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
    sourcemap: true,
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: shouldEmptyOutDir,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
});
