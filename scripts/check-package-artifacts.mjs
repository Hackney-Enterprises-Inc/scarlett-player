/**
 * Post-build guard: every file a package manifest promises must exist on disk.
 *
 * Why this exists. `@scarlett-player/embed@1.7.0` was published with
 * `types: ./dist/index.d.ts` and a `types` condition on each of `.`, `./video`
 * and `./audio`, and `npm pack --dry-run` on that tarball lists 20 files and
 * not one `.d.ts`. The embed build runs `tsc` and then three Vite builds into
 * the same directory, and the first Vite build had `emptyOutDir: true`, so it
 * deleted the declarations `tsc` had just emitted. Nothing failed: the build
 * was green and the publish was green. What a consumer sees depends on its own
 * settings, measured against a package with a missing `types` target on
 * TypeScript 5.9.3, 2026-09-02: with `noImplicitAny` on (what `strict` gives
 * you) the import does not compile, error TS7016; with it off the module is
 * typed `any` and nothing is reported at all.
 *
 * So: read every workspace package's manifest, collect `types`, `main`,
 * `module` and every string leaf of `exports`, and assert each one resolves to
 * a real file. Run it after a full build and before publishing.
 *
 * A package with none of those fields (or no build output to promise) passes
 * trivially. This checks that what the manifest advertises exists, not that it
 * is correct or complete.
 *
 * Usage: node scripts/check-package-artifacts.mjs
 * Exit code: 0 when every advertised path exists, 1 with the missing ones.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Workspace directory globs, read from pnpm-workspace.yaml.
 *
 * Parsed by hand rather than with a YAML dependency: the file is a single
 * `packages:` key with a list of quoted strings, and this script has to be
 * runnable from a bare checkout in CI before anything is installed.
 *
 * @returns {string[]} Glob patterns relative to the repo root
 */
const workspaceGlobs = () => {
  const file = join(REPO_ROOT, 'pnpm-workspace.yaml');
  if (!existsSync(file)) {
    console.error(`Error: ${file} not found; cannot enumerate workspace packages.`);
    process.exit(1);
  }

  const globs = [];
  let in_packages = false;

  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (/^packages:\s*$/.test(raw)) {
      in_packages = true;
      continue;
    }
    if (in_packages) {
      const item = raw.match(/^\s+-\s*['"]?([^'"#]+?)['"]?\s*$/);
      if (item) {
        globs.push(item[1]);
        continue;
      }
      // A non-indented, non-list line ends the packages block.
      if (raw.trim() !== '' && !/^\s/.test(raw)) break;
    }
  }

  return globs;
};

/**
 * Expand a glob whose only wildcard is `*` standing for one path segment.
 *
 * That is the entire vocabulary pnpm-workspace.yaml uses here
 * (`packages/*`, `packages/plugins/*`), so a full glob engine would be a
 * dependency bought for nothing.
 *
 * @param {string} pattern - Glob relative to the repo root
 * @returns {string[]} Existing directories the pattern matches
 */
const expandGlob = (pattern) => {
  let matches = [REPO_ROOT];

  for (const segment of pattern.split('/')) {
    const next = [];
    for (const dir of matches) {
      if (segment === '*') {
        if (!existsSync(dir)) continue;
        for (const entry of readdirSync(dir)) {
          const candidate = join(dir, entry);
          if (statSync(candidate).isDirectory()) next.push(candidate);
        }
      } else {
        const candidate = join(dir, segment);
        if (existsSync(candidate) && statSync(candidate).isDirectory()) next.push(candidate);
      }
    }
    matches = next;
  }

  return matches;
};

/**
 * Every advertised path in a manifest, tagged with the field it came from.
 *
 * `exports` is walked recursively because conditions nest arbitrarily
 * (`exports['.'].import`, and subpaths below that). Array forms are walked too.
 * Non-string leaves and non-relative strings are ignored: only a path the
 * package claims to ship is checkable here.
 *
 * @param {Record<string, unknown>} manifest - Parsed package.json
 * @returns {{ field: string, path: string }[]} Advertised paths
 */
const advertisedPaths = (manifest) => {
  const paths = [];

  for (const field of ['types', 'typings', 'main', 'module']) {
    if (typeof manifest[field] === 'string') {
      paths.push({ field, path: manifest[field] });
    }
  }

  const walkExports = (node, trail) => {
    if (typeof node === 'string') {
      paths.push({ field: trail, path: node });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walkExports(item, `${trail}[${index}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        walkExports(value, `${trail}["${key}"]`);
      }
    }
  };

  if (manifest.exports !== undefined) walkExports(manifest.exports, 'exports');

  return paths.filter((entry) => entry.path.startsWith('.'));
};

const packageDirs = [...new Set(workspaceGlobs().flatMap(expandGlob))]
  .filter((dir) => existsSync(join(dir, 'package.json')))
  .sort();

if (packageDirs.length === 0) {
  console.error('Error: no workspace packages found. Check pnpm-workspace.yaml.');
  process.exit(1);
}

const missing = [];
let checked = 0;

for (const dir of packageDirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const name = manifest.name || relative(REPO_ROOT, dir);

  for (const { field, path } of advertisedPaths(manifest)) {
    checked++;
    if (!existsSync(join(dir, path))) {
      missing.push({ name, field, path });
    }
  }
}

console.log(`Checked ${checked} advertised path(s) across ${packageDirs.length} workspace package(s)`);

if (missing.length > 0) {
  console.error('');
  console.error('Missing build artifacts (a manifest points at a file that is not on disk):');
  for (const { name, field, path } of missing) {
    console.error(`  ${name}  ${field} -> ${path}`);
  }
  console.error('');
  console.error('Run a full build first. If the build ran, a step is deleting output another');
  console.error('step emitted: see the emptyOutDir comment in packages/embed/vite.config.ts.');
  process.exit(1);
}

console.log('OK: every path a workspace manifest advertises exists on disk.');
