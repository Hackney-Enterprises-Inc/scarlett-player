#!/usr/bin/env node
/**
 * Build script for the demo
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
 * Point a demo page's script tag at the current version, as demo.bundle.js?v=<version>.
 *
 * The bundle keeps a stable filename, and nginx serves it with no cache-control
 * header, so browsers fall back to heuristic caching and keep showing an old
 * build long after a release. The version query makes each release a distinct
 * URL, so a returning visitor gets the new bundle immediately.
 *
 * A no-op when the file is missing or already stamped with this version, so the
 * release workflow's "did anything change" check stays meaningful.
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

    // Copy to docs/demo/ (served by Forge at scarlettplayer.com)
    const docsDemo = path.join(__dirname, '../docs/demo');
    if (fs.existsSync(docsDemo)) {
      fs.copyFileSync(
        path.join(__dirname, 'demo.bundle.js'),
        path.join(docsDemo, 'demo.bundle.js')
      );
      fs.copyFileSync(
        path.join(__dirname, 'demo.bundle.js.map'),
        path.join(docsDemo, 'demo.bundle.js.map')
      );
      console.log('✅ Demo built and copied to docs/demo/');
    } else {
      console.log('✅ Demo built successfully!');
    }

    stampBundleVersion(path.join(__dirname, 'index.html'));
    stampBundleVersion(path.join(docsDemo, 'index.html'));

    console.log(`📦 Version: ${VERSION}`);
    console.log('📂 Output: demo/demo.bundle.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
