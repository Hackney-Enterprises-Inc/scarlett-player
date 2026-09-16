import { defineConfig } from 'tsup';
import pkg from './package.json';

/**
 * tsup build for @scarlett-player/whep.
 *
 * The entries and formats live here rather than as CLI flags so the build
 * can also `define` the package's own version: `src/version.ts` reads
 * `__PKG_VERSION__` and the plugin descriptor reports it, the same
 * arrangement every other plugin package uses.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
});
