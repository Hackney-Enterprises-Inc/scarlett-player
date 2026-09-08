#!/usr/bin/env node
/**
 * Build script for the demo.
 *
 * Bundles demo/demo.ts, stamps demo/index.html with the current version, and
 * publishes all three files to docs/demo/, which is what scarlettplayer.com
 * serves. Everything under docs/demo/ is generated: edit demo/index.html and
 * demo/demo.ts, never the copies.
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

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
  const stamped = html.replace(
    /(<script src="demo\.bundle\.js)(\?v=[^"]*)?(")/g,
    `$1?v=${VERSION}$3`
  );

  if (stamped !== html) {
    fs.writeFileSync(htmlPath, stamped);
    const relative = path.relative(path.join(__dirname, '..'), htmlPath);
    console.log(`🔖 Stamped ${relative} with v${VERSION}`);
  }
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
      // never affected; this is a demo-build concern only.
      alias: Object.fromEntries(
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
        ].map(([name, rel]) => [
          `@scarlett-player/${name}`,
          path.join(__dirname, '..', rel),
        ]),
      ),
      define: {
        'process.env.NODE_ENV': '"development"',
        '__VERSION__': JSON.stringify(VERSION),
      },
    });

    // Stamp the SOURCE page before copying, so docs/demo/index.html inherits
    // the version query rather than needing a second stamping pass.
    stampBundleVersion(path.join(__dirname, 'index.html'));

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
    const docsDemo = path.join(__dirname, '../docs/demo');
    if (fs.existsSync(docsDemo)) {
      for (const file of ['demo.bundle.js', 'demo.bundle.js.map', 'index.html']) {
        fs.copyFileSync(path.join(__dirname, file), path.join(docsDemo, file));
      }
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
