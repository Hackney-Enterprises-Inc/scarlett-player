import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ScarlettPlayer',
      formats: ['es', 'umd'],
      fileName: (format) => {
        if (format === 'umd') {
          return 'embed.umd.cjs';
        }
        return 'embed.js';
      },
    },
    rollupOptions: {
      // No externals - bundle everything for CDN usage
      external: [],
      output: {
        // Provide global names for UMD build
        globals: {},
        // Generate minified version as well
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'embed.css';
          }
          return assetInfo.name || 'asset';
        },
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
    sourcemap: true,
    target: 'es2020',
    // Output both regular and minified versions
    outDir: 'dist',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
});
