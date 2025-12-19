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

    console.log('✅ Demo built successfully!');
    console.log('📂 Output: demo/demo.bundle.js');
    console.log('');
    console.log('To view the demo:');
    console.log('  cd demo && npx serve .');
    console.log('  Then open http://localhost:3000');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
