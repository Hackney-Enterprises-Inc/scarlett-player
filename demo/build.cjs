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
