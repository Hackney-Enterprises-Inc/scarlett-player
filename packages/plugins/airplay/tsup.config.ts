import { defineConfig } from 'tsup';
import pkg from './package.json';

/**
 * tsup build for @scarlett-player/airplay.
 *
 * The entry points, formats and `--dts` flag used to be CLI flags duplicated
 * across the package.json `build` and `dev` scripts. They live here now so the
 * build can also `define` the package's own version: `src/version.ts` reads
 * `__PKG_VERSION__` and the plugin descriptor reports it, replacing the
 * hand-written '1.0.0' that had drifted from the published 1.7.0.
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
