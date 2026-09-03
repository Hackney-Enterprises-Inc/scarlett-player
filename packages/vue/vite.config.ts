import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ScarlettPlayerVue',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['vue', '@scarlett-player/core'],
      output: {
        globals: {
          vue: 'Vue',
          '@scarlett-player/core': 'ScarlettPlayer',
        },
        exports: 'named',
      },
    },
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
    // NEVER true. The build runs `tsc` first, which emits the dist/*.d.ts that
    // `types` and `exports["."].types` point at, and Vite then writes
    // index.js/index.cjs beside them. `outDir` is inside the project root, so
    // Vite's default is to empty it: it deleted the declarations tsc had just
    // emitted, and @scarlett-player/vue@1.7.0 on npm lists 8 files and not one
    // .d.ts while its `types` field still promises ./dist/index.d.ts (measured
    // 2026-09-02 with `npm pack --dry-run`). The same defect shipped in
    // @scarlett-player/embed@1.7.0. The `rimraf dist` in the package's build
    // script is what cleans the directory now, once, before tsc runs.
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
