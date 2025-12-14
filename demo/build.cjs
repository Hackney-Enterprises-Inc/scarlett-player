#!/usr/bin/env node
/**
 * Build script for the demo
 */

const esbuild = require('esbuild');
const path = require('path');

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
