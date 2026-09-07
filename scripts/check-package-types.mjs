/**
 * Post-build guard: a consumer must be able to import every package's types.
 *
 * `check-package-artifacts.mjs` proves the file a manifest advertises exists.
 * It cannot prove the file is usable, and those are different failures.
 * `@scarlett-player/vue` shipped a `dist/index.d.ts` that existed and began
 * `import ScarlettPlayerComponent from './ScarlettPlayer.vue'` - a path the
 * package does not publish and a consumer cannot resolve without its own
 * `*.vue` shim, so every TypeScript build that imported the package broke on
 * a declaration file that was present and green in every check we had.
 *
 * So: for each workspace package with a `types` entry, write a throwaway
 * consumer that imports the package by name, and compile it with `tsc` in a
 * scratch directory with no shims, no workspace tsconfig, and `paths` pointing
 * each @scarlett-player/* name at the package directory - the resolution a real
 * consumer performs. Run it after a full build.
 *
 * `skipLibCheck` is deliberately OFF for the packages' own declarations: with
 * it on, TypeScript suppresses errors reported inside .d.ts files, which is
 * exactly where an unresolvable import shows up.
 *
 * Usage: node scripts/check-package-types.mjs
 * Exit code: 0 when every package's public types compile, 1 with the errors.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every workspace package directory.
 *
 * @returns Absolute paths to each package with a package.json
 */
function packageDirs() {
  const roots = [join(ROOT, 'packages'), join(ROOT, 'packages', 'plugins')];
  const dirs = [];

  for (const parent of roots) {
    if (!existsSync(parent)) continue;

    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const dir = join(parent, entry.name);
      if (existsSync(join(dir, 'package.json'))) dirs.push(dir);
    }
  }

  return dirs;
}

const workspacePackages = packageDirs()
  .map((dir) => ({ dir, manifest: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }))
  .filter(({ manifest }) => manifest.name);

/** Every workspace package by name, including those that publish no types. */
const byName = new Map(workspacePackages.map((pkg) => [pkg.manifest.name, pkg]));

const packages = workspacePackages.filter(({ manifest }) => manifest.types);

/**
 * What a consumer of one package can actually resolve.
 *
 * A consumer installs the package and, through it, whatever the package
 * declares - nothing else. Mapping every workspace package for every consumer
 * would hide the failure this script exists to catch: a declaration file
 * importing a sibling the manifest never declares resolves fine here and
 * breaks the moment someone installs the package on its own.
 *
 * @param name - Package under test
 * @returns Workspace names it may resolve, and the external ones it declares
 */
function dependencyClosure(name) {
  const workspace = new Set();
  const external = new Set();
  const queue = [name];

  while (queue.length > 0) {
    const current = queue.pop();
    if (workspace.has(current)) continue;
    workspace.add(current);

    const pkg = byName.get(current);
    if (!pkg) continue;

    const declared = {
      ...(pkg.manifest.dependencies ?? {}),
      ...(pkg.manifest.peerDependencies ?? {}),
    };

    for (const dep of Object.keys(declared)) {
      if (byName.has(dep)) queue.push(dep);
      else external.add(dep);
    }
  }

  return { workspace, external };
}

const missing = packages.filter(({ dir, manifest }) => !existsSync(join(dir, manifest.types)));
if (missing.length > 0) {
  console.error('Declarations are missing - run `pnpm build` first:');
  for (const { manifest } of missing) console.error(`  ${manifest.name} -> ${manifest.types}`);
  process.exit(1);
}

const scratch = mkdtempSync(join(tmpdir(), 'sp-types-'));
let failed = false;

try {
  for (const { manifest } of packages) {
    const file = `consumer-${manifest.name.replace(/[^a-z0-9]+/gi, '-')}.ts`;

    // Scoped to this consumer: the package under test plus its declared
    // dependency closure, so an undeclared sibling stays unresolvable and the
    // import fails here rather than in someone's build.
    const { workspace, external } = dependencyClosure(manifest.name);
    const paths = Object.fromEntries(
      [...workspace].flatMap((name) => {
        const dep = byName.get(name);
        if (!dep) return [];

        return [
          [name, [dep.dir]],
          [`${name}/*`, [join(dep.dir, '*')]],
        ];
      })
    );

    // Peer dependencies a consumer would have installed themselves.
    if (external.has('vue')) paths.vue = [join(ROOT, 'node_modules', 'vue')];

    writeFileSync(
      join(scratch, file),
      `import * as pkg from '${manifest.name}';\nexport const used: unknown = pkg;\n`
    );

    const config = {
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        // Third-party declarations only; the packages under test are checked.
        skipDefaultLibCheck: true,
        types: [],
        baseUrl: '.',
        paths,
      },
      include: [file],
    };
    const configFile = join(scratch, `tsconfig.${file}.json`);
    writeFileSync(configFile, JSON.stringify(config, null, 2));

    const result = spawnSync(
      process.execPath,
      [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', configFile],
      { encoding: 'utf8' }
    );

    // Only errors inside the workspace matter here: a consumer's own toolchain
    // owns whatever its copy of `vue` or the DOM lib reports.
    const errors = `${result.stdout}${result.stderr}`
      .split('\n')
      .filter((line) => line.includes('error TS'))
      .filter((line) => !line.includes(`${join(ROOT, 'node_modules')}`));

    if (errors.length > 0) {
      failed = true;
      console.error(`FAIL ${manifest.name}`);
      for (const line of errors) console.error(`  ${line.trim()}`);
    } else {
      console.log(`ok   ${manifest.name}`);
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failed) {
  console.error('\nA published declaration file does not compile for a consumer.');
  process.exit(1);
}

console.log(`\n${packages.length} package(s) expose types a consumer can import.`);
