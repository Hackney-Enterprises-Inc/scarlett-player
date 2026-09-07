import { defineConfig } from 'tsup';
import pkg from './package.json';

/**
 * tsup build for @scarlett-player/clips.
 *
 * The entry points, formats and `--dts` flag live here so the build can also
 * `define` the package's own version: `src/version.ts` reads
 * `__PKG_VERSION__` and the plugin descriptor reports it, the same pattern as
 * the share package (which replaced the hand-written literals that had drifted
 * from the published versions).
 *
 * The scripts call plain `tsup` (and `tsup --watch` for dev), so this file is
 * the only place the entries and formats are written down.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
});
