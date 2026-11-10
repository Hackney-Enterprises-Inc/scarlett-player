import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * The two core deep paths an addon build aliases to core's own source.
 *
 * `packages/embed/src/addons/core-shim.ts` re-exports `ErrorCode` and
 * `sanitizeUrl` from them as bundled copies. `@scarlett-player/core` publishes
 * only its root subpath, so nothing resolves these through node: the same
 * anchored alias `vite.config.ts` adds for an addon build is needed here, or
 * the shim's imports fail in every test that touches it.
 */
const coreSourceAliases = [
  {
    find: /^@scarlett-player\/core\/(error-handler|utils\/url)$/,
    replacement: resolve(__dirname, '../core/src/$1.ts'),
  },
];

export default defineConfig({
  resolve: { alias: coreSourceAliases },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/**/*.d.ts'],
    },
  },
});
