/**
 * Post-build guard: every chunk an embed bundle imports must exist in dist.
 *
 * Why this exists. `packages/embed/vite.config.ts` gives shared chunks stable,
 * unhashed names so the CDN can serve them from fixed paths. Until 1.7.1 that
 * was a single fixed string, `chunkFileNames: 'hls.js'`, which assumed one
 * chunk per build. The playlist plugin pulls its controls in through
 * `void import('@scarlett-player/ui')`, so the audio build produced a SECOND
 * chunk; Rollup deduplicated the fixed name to `hls2.js`, and
 * `scripts/upload-cdn.sh` uploaded a hand-written list that ended at `hls.js`.
 * So `embed.audio.js` on the CDN imported `./hls2.js`, which returned 404, and
 * the playlist plugin swallowed the failed import with a log line: the audio
 * embed lost its prev/next controls and nothing went red. That shipped from
 * the v1.6.0 release on 2026-08-11 (the dynamic import landed in commit
 * 55cf252 that same day) and was still reproducible on 2026-09-02 against
 * v1.6.0, v1.7.0 and latest.
 *
 * This is the check that would have caught it: read every JavaScript bundle in
 * `packages/embed/dist` and assert that each relative specifier it imports
 * resolves to a file that is actually there. It runs after the build, in CI.
 *
 * It cannot see the CDN, only the build output. The companion guarantee is that
 * `upload-cdn.sh` now uploads dist by glob rather than by hand list, so what
 * this script validates is exactly what gets published.
 *
 * Usage: node scripts/check-embed-chunks.mjs
 * Exit code: 0 when every reference resolves, 1 with the missing names.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(REPO_ROOT, 'packages', 'embed', 'dist');

/**
 * Every relative module specifier a bundle references.
 *
 * Covers the three forms Rollup emits: a dynamic `import("./x.js")`, a static
 * `from "./x.js"`, and a bare side-effect `import "./x.js"`. UMD output inlines
 * everything and normally yields none, which is fine: a bundle with no
 * references simply passes.
 *
 * @param {string} source - Bundle contents
 * @returns {string[]} Unique relative specifiers, in first-seen order
 */
const relativeSpecifiers = (source) => {
  const patterns = [
    /\bimport\s*\(\s*["'](\.[^"']*)["']\s*\)/g,
    /\bfrom\s*["'](\.[^"']*)["']/g,
    /\bimport\s*["'](\.[^"']*)["']/g,
  ];

  const found = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      found.add(match[1]);
    }
  }
  return [...found];
};

if (!existsSync(DIST)) {
  console.error(`Error: ${DIST} not found. Run 'pnpm --filter @scarlett-player/embed build' first.`);
  process.exit(1);
}

const bundles = readdirSync(DIST)
  .filter((name) => /\.(js|cjs)$/.test(name))
  .filter((name) => statSync(join(DIST, name)).isFile())
  .sort();

if (bundles.length === 0) {
  console.error(`Error: no .js or .cjs files in ${DIST}. The build produced nothing to check.`);
  process.exit(1);
}

const missing = [];
let checked = 0;

for (const bundle of bundles) {
  const source = readFileSync(join(DIST, bundle), 'utf8');

  for (const specifier of relativeSpecifiers(source)) {
    checked++;
    const target = resolve(DIST, specifier);
    if (!existsSync(target)) {
      missing.push({ bundle, specifier });
    }
  }
}

console.log(`Checked ${checked} chunk reference(s) across ${bundles.length} bundle(s) in packages/embed/dist`);

if (missing.length > 0) {
  console.error('');
  console.error('Missing chunks (a bundle imports a file the build did not emit):');
  for (const { bundle, specifier } of missing) {
    console.error(`  ${bundle} -> ${specifier}`);
  }
  console.error('');
  console.error('This is the hls2.js class of failure. Check chunkFileNames in');
  console.error('packages/embed/vite.config.ts: a name collision between the three');
  console.error('builds that share dist will drop or overwrite a chunk.');
  process.exit(1);
}

console.log('OK: every chunk an embed bundle imports exists in dist.');
