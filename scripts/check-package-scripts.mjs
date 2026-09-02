/**
 * Guard: every workspace package must declare a `typecheck` and a `test` script.
 *
 * The root scripts fan out with `pnpm --filter './packages/**' run <name>`, and
 * pnpm SKIPS a matched package that has no such script, silently and with exit
 * code 0. On 2026-09-02 that meant `pnpm typecheck` covered 7 of the 17
 * packages: ten plugins had no `typecheck` script, so CI's typecheck step was
 * passing vacuously and 60 type errors (one of them in shipped source, the
 * untyped `hls.js/light` import) had accumulated behind it. Nothing in the
 * toolchain could report that, because a skipped package looks exactly like a
 * clean one.
 *
 * This check closes that hole from the other side: it enumerates the workspace
 * itself and fails when a package is missing either script, so adding a new
 * package without wiring it into the gates is a build failure rather than a
 * silent gap.
 *
 * Usage: node scripts/check-package-scripts.mjs
 * Exit codes: 0 when every package declares both scripts, 1 otherwise.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Scripts every workspace package has to declare. */
const REQUIRED_SCRIPTS = ['typecheck', 'test'];

/**
 * Read the workspace globs out of pnpm-workspace.yaml.
 *
 * Hand-parsed rather than pulled through a YAML dependency: the file is a
 * single `packages:` key holding a flat list of quoted strings, and the guard
 * has to keep working in a bare checkout before any install.
 *
 * @param {string} yamlPath - Absolute path to pnpm-workspace.yaml
 * @returns {string[]} The glob patterns, in file order, `!` exclusions included
 * @throws {Error} When the file has no `packages:` list
 */
export function readWorkspaceGlobs(yamlPath) {
  const lines = readFileSync(yamlPath, 'utf8').split('\n');
  const globs = [];
  let inPackages = false;

  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;

    const item = line.match(/^\s+-\s*(.+?)\s*$/);
    if (!item) {
      // A non-indented, non-empty line ends the list.
      if (line.trim() !== '' && !/^\s/.test(line)) break;
      continue;
    }
    globs.push(item[1].replace(/^['"]|['"]$/g, ''));
  }

  if (globs.length === 0) {
    throw new Error(`No 'packages:' list found in ${yamlPath}`);
  }
  return globs;
}

/**
 * Expand one workspace glob to the directories it matches.
 *
 * Supports the two wildcards pnpm globs actually use here: `*` for a single
 * path segment and `**` for any depth. Missing directories expand to nothing,
 * which is deliberate: a glob whose directory has been deleted must not break
 * the guard (the workspace file carried `packages/presets/*`, a glob over empty
 * placeholder directories, from 2025-12-14 until 2026-09-02).
 *
 * @param {string} root - Absolute repo root
 * @param {string} glob - A single pattern, e.g. `packages/plugins/*`
 * @returns {string[]} Absolute directory paths
 */
export function expandGlob(root, glob) {
  const segments = glob.split('/').filter((segment) => segment !== '');

  /**
   * @param {string} dir - Directory reached so far
   * @param {number} index - Index of the segment to match next
   * @returns {string[]} Absolute directory paths
   */
  const walk = (dir, index) => {
    if (index === segments.length) return [dir];
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];

    const segment = segments[index];
    if (segment === '**') {
      const here = walk(dir, index + 1);
      const deeper = readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
        .flatMap((entry) => walk(join(dir, entry.name), index));
      return [...here, ...deeper];
    }
    if (segment.includes('*')) {
      const pattern = new RegExp(`^${segment.split('*').map(escapeRegExp).join('[^/]*')}$`);
      return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
        .filter((entry) => pattern.test(entry.name))
        .flatMap((entry) => walk(join(dir, entry.name), index + 1));
    }
    return walk(join(dir, segment), index + 1);
  };

  return walk(root, 0);
}

/**
 * Escape the regular expression metacharacters in a literal glob fragment.
 *
 * @param {string} value - Literal fragment
 * @returns {string} Escaped fragment
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find every workspace package directory holding a package.json.
 *
 * A glob prefixed with `!` removes its matches, matching pnpm's own semantics.
 *
 * @param {string} root - Absolute repo root
 * @returns {string[]} Absolute package directories, sorted and deduplicated
 */
export function findWorkspacePackages(root) {
  const globs = readWorkspaceGlobs(join(root, 'pnpm-workspace.yaml'));
  const included = new Set();
  const excluded = new Set();

  for (const glob of globs) {
    const negated = glob.startsWith('!');
    const target = negated ? excluded : included;
    for (const dir of expandGlob(root, negated ? glob.slice(1) : glob)) {
      if (existsSync(join(dir, 'package.json'))) target.add(dir);
    }
  }

  return [...included].filter((dir) => !excluded.has(dir)).sort();
}

/**
 * Check every workspace package for the required scripts.
 *
 * @param {string} root - Absolute repo root
 * @returns {{ name: string, dir: string, missing: string[] }[]} One entry per offending package
 */
export function findPackagesMissingScripts(root) {
  const offenders = [];

  for (const dir of findWorkspacePackages(root)) {
    const manifestPath = join(dir, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const scripts = manifest.scripts ?? {};
    const missing = REQUIRED_SCRIPTS.filter(
      (name) => typeof scripts[name] !== 'string' || scripts[name].trim() === ''
    );
    if (missing.length > 0) {
      offenders.push({
        name: manifest.name ?? relative(root, dir),
        dir: relative(root, dir),
        missing,
      });
    }
  }

  return offenders;
}

const packages = findWorkspacePackages(REPO_ROOT);
const offenders = findPackagesMissingScripts(REPO_ROOT);

if (offenders.length > 0) {
  console.error(
    `check-package-scripts: ${offenders.length} of ${packages.length} workspace packages are missing a required script.\n`
  );
  for (const offender of offenders) {
    console.error(`  ${offender.name} (${offender.dir}): missing ${offender.missing.join(', ')}`);
  }
  console.error(
    `\nEvery package needs ${REQUIRED_SCRIPTS.map((name) => `"${name}"`).join(' and ')} in its package.json "scripts".`
  );
  console.error(
    'Without them `pnpm --filter ./packages/** run <script>` skips the package and the gate passes without checking it.'
  );
  process.exit(1);
}

console.log(
  `check-package-scripts: ${packages.length} workspace packages, all declaring ${REQUIRED_SCRIPTS.join(' and ')}.`
);
