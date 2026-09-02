import { defineConfig, type Rollup } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

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

/**
 * Name a shared chunk stably, so the CDN can serve it from a fixed path.
 *
 * Rollup's default name carries a content hash, which the CDN layout cannot
 * use: `latest/embed.audio.js` has to keep importing the same filename across
 * releases. The previous fixed string `'hls.js'` assumed there was exactly one
 * chunk and one build. Neither holds:
 *
 * - The playlist plugin registers its controls through
 *   `void import('@scarlett-player/ui')`, so the audio build (which has no
 *   static ui import) gets a SECOND chunk. Rollup deduplicated the fixed name
 *   to `hls2.js`, which `scripts/upload-cdn.sh` never uploaded, so
 *   `embed.audio.js` on the CDN imported a URL that 404s. Live from the
 *   v1.6.0 release on 2026-08-11 (the commit that added the dynamic import is
 *   55cf252, 2026-08-11, first released in v1.6.0) until this fix; still
 *   reproducible on 2026-09-02 against v1.6.0, v1.7.0 and latest.
 * - The three builds share one `dist`. The audio build's chunk is the
 *   hls.js LIGHT bundle, so a single fixed name would let it overwrite the
 *   full and video builds' `hls.js` with a smaller, feature-reduced file.
 *
 * So: name the hls.js chunk after which hls.js entry it came from, and give
 * every other chunk the build's own prefix plus the chunk name
 * (`embed.audio.index.js` for the ui registry chunk the audio build emits).
 *
 * The prefix is what makes the shared directory safe. An unprefixed chunk name
 * is only unambiguous while at most one of the three builds emits a chunk by
 * that name, and the moment two do, the later build overwrites the earlier
 * one with content built for a different module graph.
 * `scripts/check-embed-chunks.mjs` could not catch that, because the file
 * would still exist. It also keeps an anonymous `index.js` off the CDN, where
 * everything shares one flat directory.
 *
 * The two hls.js chunks stay unprefixed on purpose: the full and video builds
 * emit byte-identical `hls.js` (verified by md5 on 2026-09-02), so one copy
 * serves both, and the audio build's light chunk has a distinct name of its
 * own.
 *
 * @param chunkInfo - Rollup's pre-render chunk metadata
 * @returns Stable, unhashed file name for the chunk
 */
const chunkFileNames = (chunkInfo: Rollup.PreRenderedChunk): string => {
  const modules = chunkInfo.moduleIds ?? [];
  const isHlsChunk = chunkInfo.name === 'hls' || modules.some((id) => id.includes('hls.js'));

  if (isHlsChunk) {
    // hls.js/light resolves through .../hls.js/dist/hls.light.mjs
    const isLight = modules.some((id) => /hls\.js[\\/].*light/.test(id));
    return isLight ? 'hls.light.js' : 'hls.js';
  }

  return `${baseName}.${chunkInfo.name}.js`;
};

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
        // Each entry assigns its API object to window.ScarlettPlayer inside the
        // module body AND default-exports it, which Rollup warns about ("using
        // named and default exports together"). 'named' picks the behaviour the
        // published UMD already has, so the warning goes away without changing
        // what a <script> tag sees. scripts/verify-browser.mjs pins that:
        // window.ScarlettPlayer.create must stay a function.
        exports: 'named',
        // Stable chunk names for CDN deployment (no hash). See chunkFileNames.
        chunkFileNames,
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
    // NEVER true. The build runs `tsc` first, which emits the dist/*.d.ts that
    // `types` and all three `exports[*].types` point at, and Vite then writes
    // the bundles beside them. With `true` on the full build, Vite deleted the
    // declarations tsc had just emitted: @scarlett-player/embed@1.7.0 on npm
    // lists 20 files and not one .d.ts. The three builds also share this
    // directory, so emptying it in any of them discards the earlier builds'
    // output. The `rimraf dist` in the package's build script is what cleans
    // the directory now, once, before tsc runs.
    emptyOutDir: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    // src/version.ts reads this; the three entries build their reported
    // `version` from it (plus the '-video' / '-audio' suffix) instead of the
    // hand-written '0.5.3' literals they carried while the package published
    // at 1.7.0. The CDN's latest/embed.umd.cjs still answered
    // window.ScarlettPlayer.version === '0.5.3' on 2026-09-02, so support had
    // no way to tell which build a viewer was running.
    // scripts/verify-browser.mjs pins the built UMD's value to this one.
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
});
