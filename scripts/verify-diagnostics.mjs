/**
 * Browser verification script for Diagnostics Snapshots and Copy diagnostics.
 *
 * Runs headless Chromium against the built demo bundle to assert:
 *   1. Copy diagnostics button exists and copies snapshot to clipboard.
 *   2. Snapshot adheres to schemaVersion 1 with safe playbackState and providers.
 *   3. Clipboard fallback is displayed and selectable when clipboard is denied/unavailable.
 *   4. Active player switches (video -> audio) work and reset status.
 *   5. Destroyed player returns safe destroyed snapshot rather than throwing.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const DIR = resolve(fileURLToPath(import.meta.url), '../..');

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
};

// Create local static server on random port
const server = createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const filePath = join(DIR, urlPath.replace(/^\//, ''));

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((res) => server.listen(0, '127.0.0.1', res));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/demo/index.html`;

console.log(`Verifying diagnostics in browser at ${baseUrl}...`);

const browser = await chromium.launch({ headless: true });

try {
  // Test 1: Successful clipboard copy
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  await page.goto(baseUrl);

  // Open diagnostics details
  await page.evaluate(() => {
    const diag = document.getElementById('diagnostics');
    if (diag) diag.open = true;
  });

  const copyBtn = page.locator('#copy-diagnostics');
  await copyBtn.waitFor({ state: 'visible' });

  await copyBtn.click();

  const status = page.locator('#copy-diagnostics-status');
  await status.waitFor({ state: 'visible' });
  const statusText = await status.textContent();
  console.log('✓ Copy status text:', statusText);
  if (!statusText.includes('Copied')) {
    throw new Error(`Expected status to contain 'Copied', got: ${statusText}`);
  }

  const clipboardText = await page.evaluate(async () => {
    return await navigator.clipboard.readText();
  });

  const snapshot = JSON.parse(clipboardText);
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Expected schemaVersion: 1, got ${snapshot.schemaVersion}`);
  }
  if (typeof snapshot.playerVersion !== 'string') {
    throw new Error('Expected playerVersion string');
  }
  if (!snapshot.playbackState) {
    throw new Error('Expected playbackState');
  }
  console.log('✓ Verified clipboard snapshot schemaVersion: 1 and playbackState');

  // Test 2: Clipboard fallback when clipboard write fails
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => Promise.reject(new Error('Simulated clipboard permission denied')),
      },
      configurable: true,
    });
  });

  await copyBtn.click();

  const fallback = page.locator('#copy-diagnostics-fallback');
  await fallback.waitFor({ state: 'visible' });
  const fallbackHidden = await fallback.getAttribute('hidden');
  if (fallbackHidden !== null) {
    throw new Error('Expected fallback not to be hidden');
  }

  const fallbackTextarea = page.locator('#copy-diagnostics-text');
  const fallbackContent = await fallbackTextarea.inputValue();
  const fallbackJson = JSON.parse(fallbackContent);
  if (fallbackJson.schemaVersion !== 1) {
    throw new Error('Fallback JSON invalid');
  }
  console.log('✓ Verified clipboard fallback rendered and populated with JSON');

  // Test 3: Scenario change and audio role
  await page.evaluate(() => {
    const sNav = document.querySelector('[data-scenario="audio"]');
    if (sNav) sNav.click();
  });

  await page.waitForTimeout(300);

  // Status should be cleared on scenario change
  const clearedStatus = await status.textContent();
  if (clearedStatus !== '') {
    throw new Error(`Expected status to clear on scenario switch, got: ${clearedStatus}`);
  }

  // Copy on audio scenario
  await copyBtn.click();
  const audioFallbackContent = await fallbackTextarea.inputValue();
  const audioSnapshot = JSON.parse(audioFallbackContent);
  console.log('✓ Audio scenario snapshot generated successfully');

  // Test 4: Destroyed player returns destroyed state
  await page.evaluate(async () => {
    if (window.audioPlayer) {
      await window.audioPlayer.destroy();
    }
  });
  await page.waitForTimeout(100);

  await copyBtn.click();
  const destroyedContent = await fallbackTextarea.inputValue();
  const destroyedSnapshot = JSON.parse(destroyedContent);
  if (destroyedSnapshot.playbackState.playbackState !== 'destroyed') {
    throw new Error(`Expected destroyed playbackState, got: ${destroyedSnapshot.playbackState.playbackState}`);
  }
  console.log('✓ Destroyed player returns safe destroyed snapshot');

  await context.close();
  console.log('All browser diagnostics verifications PASSED!');
} finally {
  await browser.close();
  server.close();
}
