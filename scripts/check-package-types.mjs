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

const packages = packageDirs()
  .map((dir) => ({ dir, manifest: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }))
  .filter(({ manifest }) => manifest.name && manifest.types);

const missing = packages.filter(({ dir, manifest }) => !existsSync(join(dir, manifest.types)));
if (missing.length > 0) {
  console.error('Declarations are missing - run `pnpm build` first:');
  for (const { manifest } of missing) console.error(`  ${manifest.name} -> ${manifest.types}`);
  process.exit(1);
}

const scratch = mkdtempSync(join(tmpdir(), 'sp-types-'));
let failed = false;

try {
  // Every package name resolves to its directory, so TypeScript reads the
  // manifest's own `types`/`exports` the way a consumer's resolver would.
  const paths = Object.fromEntries(
    packages.flatMap(({ dir, manifest }) => [
      [manifest.name, [dir]],
      [`${manifest.name}/*`, [join(dir, '*')]],
    ])
  );
  // Peer dependencies a consumer would have installed themselves.
  paths.vue = [join(ROOT, 'node_modules', 'vue')];

  for (const { manifest } of packages) {
    const file = `consumer-${manifest.name.replace(/[^a-z0-9]+/gi, '-')}.ts`;

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
