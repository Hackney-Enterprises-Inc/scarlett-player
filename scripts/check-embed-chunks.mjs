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
 * The second assertion guards the naming rule itself. `chunkFileNames` prefixes
 * every chunk with its build name and leaves exactly two names unprefixed,
 * `hls.js` and `hls.light.js`, because those are shared on purpose. A third
 * unprefixed name in the three-build dist means the prefixing regressed, and
 * the next build to emit the same name would silently overwrite it: the file
 * would still exist, so the import check above would still pass. That is the
 * failure this catches and the first one cannot.
 *
 * The two are complementary and neither is the byte check: whether two builds
 * write the SAME bytes to a shared name is settled at build time by
 * `guardSharedChunks()` in `packages/embed/vite.config.ts`.
 *
 * It cannot see the CDN, only the build output. The companion guarantee is that
 * `upload-cdn.sh` now uploads dist by glob rather than by hand list, so what
 * this script validates is exactly what gets published.
 *
 * Usage: node scripts/check-embed-chunks.mjs (after a full three-build
 * `pnpm --filter @scarlett-player/embed build`, which is what the expected set
 * of unprefixed chunks describes)
 * Exit code: 0 when every reference resolves and the unprefixed set matches,
 * 1 with the offending names.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(REPO_ROOT, 'packages', 'embed', 'dist');

/**
 * The `lib.fileName` base of each build, which is also the prefix
 * `chunkFileNames` puts on that build's chunks. Every file the three builds
 * write is expected to start with one of these, apart from SHARED_CHUNKS.
 */
const BUILD_BASE_NAMES = ['embed', 'embed.video', 'embed.audio'];

/**
 * The chunk names `chunkFileNames` deliberately leaves unprefixed, kept in
 * step with SHARED_CHUNK_NAMES in packages/embed/vite.config.ts. `hls.js` is
 * the full hls.js bundle the full and video builds both emit; `hls.light.js`
 * is the audio build's lighter one.
 */
const SHARED_CHUNKS = ['hls.js', 'hls.light.js'];

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

// Second assertion: the unprefixed names in dist are exactly the shared ones.
const unprefixed = bundles.filter(
  (name) => !BUILD_BASE_NAMES.some((base) => name.startsWith(`${base}.`))
);
const unexpected = unprefixed.filter((name) => !SHARED_CHUNKS.includes(name));
const absent = SHARED_CHUNKS.filter((name) => !unprefixed.includes(name));

console.log(
  `Checked ${unprefixed.length} unprefixed chunk file(s) in packages/embed/dist: ${unprefixed.join(', ') || 'none'}`
);

if (unexpected.length > 0 || absent.length > 0) {
  console.error('');
  console.error('Unprefixed chunks in dist are not the expected set:');
  for (const name of unexpected) {
    console.error(`  unexpected: ${name}`);
  }
  for (const name of absent) {
    console.error(`  missing: ${name}`);
  }
  console.error('');
  console.error('chunkFileNames in packages/embed/vite.config.ts gives every chunk its');
  console.error('build prefix and leaves only the shared hls chunks unprefixed. An extra');
  console.error('unprefixed name is the next silent overwrite between the three builds');
  console.error('that share dist. A missing one usually means only part of the build ran:');
  console.error('rerun pnpm --filter @scarlett-player/embed build.');
  process.exit(1);
}

console.log('OK: the only unprefixed chunks in dist are hls.js and hls.light.js.');
