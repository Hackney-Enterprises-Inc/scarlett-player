#!/usr/bin/env node
/**
 * Build script for the demo.
 *
 * Bundles demo/demo.ts, stamps demo/index.html with the current version and
 * the stylesheet digest, mirrors the shared site assets next to the page, and
 * publishes everything to docs/demo/, which is what scarlettplayer.com
 * serves. Everything under docs/demo/ is generated: edit demo/index.html and
 * demo/demo.ts, never the copies.
 *
 * The stylesheet and the brand/poster assets are authored ONCE, under docs/
 * (docs/site.css, docs/assets/), because the homepage there links them as
 * siblings. Every page references them as siblings too (`site.css`,
 * `assets/...`): a `../site.css` from the demo page would resolve to
 * /site.css on the production server and to /docs/site.css on a local
 * repo-root server, and neither is where the file lives. So this build
 * copies them beside each generated page - demo/ (the source route the
 * browser harness loads) and docs/demo/ (the served route) - overwriting the
 * mirrors on every run. Never hand-edit a mirror.
 *
 * It also renders the HTML documentation (demo/docs-build.mjs): the guides
 * under docs/*.md become docs/<slug>/index.html, plus a docs/documentation/
 * index, each directory regenerated wholesale and byte-for-byte deterministic.
 * Those pages sit one level below docs/ and link `../site.css` and
 * `../assets/`, which resolves to docs/ both locally and on production, so
 * they need no mirror. Generated and tracked, like docs/demo/.
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const REPO_ROOT = path.join(__dirname, '..');
const SITE_CSS = path.join(REPO_ROOT, 'docs/site.css');
const SITE_ASSETS = path.join(REPO_ROOT, 'docs/assets');

// Read version from core package.json
const corePackage = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../packages/core/package.json'), 'utf8')
);
const VERSION = corePackage.version;

/**
 * Point the demo page's script tag at the current version, as
 * demo.bundle.js?v=<version>.
 *
 * The bundle keeps a stable filename, and nginx serves it with no cache-control
 * header, so browsers fall back to heuristic caching and keep showing an old
 * build long after a release. The version query makes each release a distinct
 * URL, so a returning visitor gets the new bundle immediately.
 *
 * A no-op when the file is missing or already stamped with this version, so the
 * release workflow's "did anything change" check stays meaningful.
 *
 * Only ever called on demo/index.html, the source page. docs/demo/index.html is
 * copied from it afterwards and inherits the stamp.
 *
 * @param {string} htmlPath Absolute path to the demo index.html to rewrite.
 * @returns {void}
 */
function stampBundleVersion(htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    return;
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const stamped = html
    .replace(
      /(<script src="demo\.bundle\.js)(\?v=[^"]*)?(")/g,
      `$1?v=${VERSION}$3`
    )
    // The stylesheet is stamped with a digest of its own content rather than
    // the package version: it changes on site-only work that bumps no
    // package, and a digest is deterministic, so an unchanged stylesheet
    // leaves the page untouched.
    .replace(
      /(<link rel="stylesheet" href="site\.css)(\?v=[^"]*)?(")/g,
      `$1?v=${siteCssDigest()}$3`
    )
    // The homepage's module entry is stamped with its own digest, like the
    // stylesheet: it changes on site-only work too.
    .replace(
      /(<script type="module" src="site\/home\.js)(\?v=[^"]*)?(")/g,
      `$1?v=${fileDigest(path.join(SITE_OUT, 'home.js'))}$3`
    )
    // The header badge and the footer release link show the version without
    // JavaScript; demo.ts writes the same value at runtime.
    .replace(
      /(<span class="version-badge" id="version">)v[^<]*(<\/span>)/g,
      `$1v${VERSION}$2`
    )
    .replace(
      /(<a id="release" href="[^"]*\/releases\/tag\/)v[^"]*(">)v[^<]*(<\/a>)/g,
      `$1v${VERSION}$2v${VERSION}$3`
    );

  if (stamped !== html) {
    fs.writeFileSync(htmlPath, stamped);
    const relative = path.relative(REPO_ROOT, htmlPath);
    console.log(`🔖 Stamped ${relative} with v${VERSION}`);
  }
}

/**
 * Short content digest of docs/site.css, for the stylesheet's cache-busting
 * query. Empty when the file is missing so a stamp never fabricates a value.
 *
 * @returns {string} First 8 hex characters of the SHA-256 of the file
 */
function siteCssDigest() {
  return fileDigest(SITE_CSS);
}

/**
 * Short content digest of any generated or authored file, for a
 * cache-busting query. `missing` when the file does not exist, so a stamp
 * never fabricates a value.
 *
 * @param {string} file Absolute path
 * @returns {string} First 8 hex characters of the SHA-256 of the file
 */
function fileDigest(file) {
  if (!fs.existsSync(file)) return 'missing';
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
}

/**
 * Mirror docs/site.css and docs/assets/ next to a generated page.
 *
 * The mirrors are replaced wholesale: a file removed from docs/assets/ is
 * removed from every mirror on the next build, so the authored directory is
 * the only place the site's assets exist twice-removed. Both mirrors stay
 * tracked in git, for the same reason the bundle is - Forge deploys the
 * committed tree and runs no build.
 *
 * @param {string} dir Directory holding a generated index.html (demo/ or docs/demo/)
 * @returns {void}
 */
function mirrorSiteAssets(dir) {
  if (fs.existsSync(SITE_CSS)) {
    fs.copyFileSync(SITE_CSS, path.join(dir, 'site.css'));
  }
  if (fs.existsSync(SITE_ASSETS)) {
    const target = path.join(dir, 'assets');
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(SITE_ASSETS, target, { recursive: true });
  }
}

// demo.ts imports the packages by relative source path, but a plugin that
// reaches for a sibling by its published name - the share plugin does
// `import('@scarlett-player/ui')` to register its control - would resolve
// through node_modules to that package's dist build instead. That pulls a
// SECOND copy of the package into the bundle, and module-level state is
// not shared between the two: the share plugin registered its control on
// the dist copy's registry while the demo's control bar read the source
// copy's, so the button silently never rendered.
//
// Aliasing every scarlett package to its source entry keeps the bundle to
// one instance of each. Real consumers import by name everywhere and were
// never affected; this is a demo-build concern only. The homepage entry
// shares the map for the same reason.
const PACKAGE_ALIASES = Object.fromEntries(
  [
    ['core', 'packages/core/src/index.ts'],
    ['ui', 'packages/plugins/ui/src/index.ts'],
    ['hls', 'packages/plugins/hls/src/index.ts'],
    ['native', 'packages/plugins/native/src/index.ts'],
    ['airplay', 'packages/plugins/airplay/src/index.ts'],
    ['chromecast', 'packages/plugins/chromecast/src/index.ts'],
    ['playlist', 'packages/plugins/playlist/src/index.ts'],
    ['media-session', 'packages/plugins/media-session/src/index.ts'],
    ['audio-ui', 'packages/plugins/audio-ui/src/index.ts'],
    ['watermark', 'packages/plugins/watermark/src/index.ts'],
    ['captions', 'packages/plugins/captions/src/index.ts'],
    ['share', 'packages/plugins/share/src/index.ts'],
    ['chapters', 'packages/plugins/chapters/src/index.ts'],
    ['gestures', 'packages/plugins/gestures/src/index.ts'],
    ['clips', 'packages/plugins/clips/src/index.ts'],
    ['whep', 'packages/plugins/whep/src/index.ts'],
  ].map(([name, rel]) => [`@scarlett-player/${name}`, path.join(REPO_ROOT, rel)]),
);

/** Where the homepage entry and its chunks are emitted. Generated, tracked. */
const SITE_OUT = path.join(REPO_ROOT, 'docs/site');

/**
 * Build the homepage entry (demo/home.ts) into docs/site/.
 *
 * ESM with code splitting: docs/site/home.js is the tiny shell the page
 * loads, and the player engine only arrives as hashed chunks
 * (docs/site/chunks/*) on the first Play click. The directory is emptied
 * first so stale hashed chunks never accumulate in the tracked tree, and
 * every emitted chunk is what the release workflow has to stage - Forge
 * serves the committed tree.
 *
 * @returns {Promise<void>}
 */
async function buildHomepage() {
  const entry = path.join(__dirname, 'home.ts');
  if (!fs.existsSync(entry)) return;

  fs.rmSync(SITE_OUT, { recursive: true, force: true });
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    splitting: true,
    outdir: SITE_OUT,
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    target: 'es2020',
    // No maps: 3MB per release for a page whose debugging surface is the
    // playground bundle next door.
    sourcemap: false,
    minify: true,
    alias: PACKAGE_ALIASES,
    define: {
      'process.env.NODE_ENV': '"production"',
      '__VERSION__': JSON.stringify(VERSION),
    },
  });
  console.log('🏠 Homepage entry built to docs/site/');
}

async function build() {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'demo.ts')],
      bundle: true,
      outfile: path.join(__dirname, 'demo.bundle.js'),
      format: 'iife',
      target: 'es2020',
      sourcemap: true,
      minify: false,
      alias: PACKAGE_ALIASES,
      define: {
        'process.env.NODE_ENV': '"development"',
        '__VERSION__': JSON.stringify(VERSION),
      },
    });

    await buildHomepage();

    // Stamp the SOURCE page before copying, so docs/demo/index.html inherits
    // the version query rather than needing a second stamping pass. The
    // homepage is authored in place and stamped the same way.
    stampBundleVersion(path.join(__dirname, 'index.html'));
    stampBundleVersion(path.join(REPO_ROOT, 'docs/index.html'));

    // After the homepage is stamped: the docs pages lift its header and
    // footer, and should carry the same version and nav. ESM, hence the
    // dynamic import from this CommonJS script.
    const { buildDocs } = await import('./docs-build.mjs');
    const docsPages = buildDocs({ version: VERSION, cssVersion: siteCssDigest() });
    console.log(`📚 Documentation rendered: ${docsPages.length} files (pages, Markdown copies, llms.txt)`);

    // Publish to docs/demo/ (served by Forge at scarlettplayer.com).
    //
    // index.html is copied, not hand-maintained. It used to be the one file
    // here a human had to remember to mirror, and nobody did: by 2026-09-07 the
    // served page was missing the Analytics Log, Watermark Controls and Live
    // panels while running the freshly built bundle, because the bundle IS
    // copied on every build. Treating the page as build output rather than as
    // a second source file is what stops that recurring - edit demo/index.html
    // and this rebuild propagates it.
    //
    // The outputs stay TRACKED. Forge deploys the committed repo and runs no
    // build of its own, so anything gitignored here simply is not on the
    // server: that is the 2026-08-11 outage release.yml now guards against.
    // The source page gets the shared stylesheet and assets beside it too, so
    // the browser harness (which loads /demo/index.html) renders the real
    // site and not an unstyled page.
    mirrorSiteAssets(__dirname);

    const docsDemo = path.join(REPO_ROOT, 'docs/demo');
    if (fs.existsSync(docsDemo)) {
      for (const file of ['demo.bundle.js', 'demo.bundle.js.map', 'index.html']) {
        fs.copyFileSync(path.join(__dirname, file), path.join(docsDemo, file));
      }
      mirrorSiteAssets(docsDemo);
      console.log('✅ Demo built and published to docs/demo/');
    } else {
      console.log('✅ Demo built successfully!');
    }

    console.log(`📦 Version: ${VERSION}`);
    console.log('📂 Output: demo/demo.bundle.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
