import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Build variants:
 * - Default: Full build with all features (embed.js)
 * - BUILD_VIDEO=true: Video-only build (embed.video.js)
 * - BUILD_AUDIO=true: Audio-only build (embed.audio.js)
 *
 * All builds expose window.ScarlettPlayer
 */

const isVideo = process.env.BUILD_VIDEO === 'true';
const isAudio = process.env.BUILD_AUDIO === 'true';

// Determine entry point and output name
let entry: string;
let baseName: string;

if (isVideo) {
  entry = resolve(__dirname, 'src/index-video.ts');
  baseName = 'embed.video';
} else if (isAudio) {
  entry = resolve(__dirname, 'src/index-audio.ts');
  baseName = 'embed.audio';
} else {
  // Default: full build
  entry = resolve(__dirname, 'src/index.ts');
  baseName = 'embed';
}

const fileName = (format: string) => {
  if (format === 'umd') {
    return `${baseName}.umd.cjs`;
  }
  return `${baseName}.js`;
};

// Only empty outDir on first build (default/full)
const shouldEmptyOutDir = !isVideo && !isAudio;

export default defineConfig({
  build: {
    lib: {
      entry,
      name: 'ScarlettPlayer', // All builds use same global name
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
