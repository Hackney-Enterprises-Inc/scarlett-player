import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig({
  // src/version.ts reads this and falls back to '0.0.0-dev' when it is absent,
  // so the exported VERSION is the package's own version instead of a
  // hand-written literal. Every hand-written version in the repo had drifted
  // (descriptors '1.0.0', embed '0.5.3', packages 1.7.0; measured 2026-09-02).
  // vitest reads this same config, so core's tests see the real version.
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  root: 'demo',
  publicDir: false,
  server: {
    open: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ScarlettPlayer',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    },
    minify: 'terser',
    sourcemap: true,
    target: 'es2020',
    outDir: '../dist',  // Output to package root dist/, not demo/dist/
    // MUST stay false. `root` is demo/, so outDir sits outside the project
    // root and Vite warns about emptying it. The warning is not an invitation
    // to set `true`: the build is `tsc && vite build`, tsc emits the
    // dist/*.d.ts that `types` and every plugin's tsconfig `paths` point at,
    // and Vite then writes index.js/index.cjs beside them. Emptying the
    // directory would delete the declarations, which is exactly the failure
    // that shipped in @scarlett-player/embed 1.7.0 (no .d.ts in the tarball).
    // Setting it explicitly also silences the warning.
    emptyOutDir: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    root: './',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        'src/index.ts'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      }
    }
  }
});
