#!/usr/bin/env node
/**
 * Scoped browser verification for the keyboard help lane (SCAR-DX-3).
 *
 * Companion to scripts/verify-browser.mjs (which stays coordinator-owned):
 * this one covers only what the keyboard-help change added, in real Chromium,
 * with rectangles measured rather than jsdom-asserted:
 *
 *   1. `?` opens the shortcut dialog before any media exists: a labelled
 *      role=dialog, aria-modal, rendered inside the player container.
 *   2. The optional `keyboard-help` bar control renders in a custom layout and
 *      opens the same dialog; Escape returns focus to the button that opened
 *      it, and to the container when `?` opened it.
 *   3. Tab and Shift+Tab stay inside the open dialog; Escape closes it.
 *   4. While the dialog is open, m/f/k/c and digits perform no media action -
 *      no mute, no fullscreen request, no play, no seek, no track command.
 *   5. Typing into an editable field inside the player is left alone: digits
 *      do not seek and `?` does not open.
 *   6. Digits 0-9 seek to a share of a real element's duration, one
 *      `playback:seeking` event per key, and never implicitly play.
 *   7. The dialog stays usable at 1280x900, at a 390px phone viewport and on a
 *      390x211 short player: the panel fits inside the player's rectangle, the
 *      close button stays inside the viewport, and the body scrolls when the
 *      list is taller than the bound.
 *
 * Self-contained on purpose: it serves the repo root from its own 127.0.0.1
 * server on port 8898 (never the shared 8899), generates its own 30s MP4
 * fixture under scripts/fixtures/keyboard/ (gitignored, like every generated
 * fixture), and drives a page that imports the BUILT package dists the way a
 * consumer does. No demo files are touched and no external origin is
 * contacted.
 *
 * Usage:
 *   pnpm --filter @scarlett-player/core --filter @scarlett-player/ui \
 *     --filter @scarlett-player/native run build
 *   node scripts/verify-keyboard.mjs
 *
 * Requires the `playwright` package with its bundled Chromium. Exits non-zero
 * on any failed assertion.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8898;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const FIXTURE_MP4 = join(REPO_ROOT, 'scripts/fixtures/keyboard/vod.mp4');

/** Seconds of synthetic video the fixture carries; the seek math reads it. */
const FIXTURE_SECONDS = 30;

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
};

/**
 * Generate the MP4 fixture once, like scripts/hls-fixture.mjs does for HLS.
 *
 * @returns {void}
 */
const ensureMp4Fixture = () => {
  if (existsSync(FIXTURE_MP4)) return;
  mkdirSync(dirname(FIXTURE_MP4), { recursive: true });
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `testsrc=size=320x180:rate=30:duration=${FIXTURE_SECONDS}`,
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    FIXTURE_MP4,
  ]);
};

/**
 * The page under test. Mounts exactly one player with the optional
 * keyboard-help control, mirroring a consumer's import of the built dists.
 *
 * @param {string} base origin to import the package dists from
 * @returns {string} HTML document
 */
const pageHtml = () => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 24px; background: #222; }
  #player { width: 640px; height: 360px; background: #000; }
</style></head>
<body>
<div id="player"></div>
<script type="importmap">
{
  "imports": {
    "@scarlett-player/core": "/packages/core/dist/index.js",
    "@scarlett-player/ui": "/packages/plugins/ui/dist/index.js",
    "@scarlett-player/native": "/packages/plugins/native/dist/index.js"
  }
}
</script>
<script type="module">
  import { createPlayer } from '@scarlett-player/core';
  import { uiPlugin } from '@scarlett-player/ui';
  import { createNativePlugin } from '@scarlett-player/native';

  const params = new URLSearchParams(location.search);
  const el = document.getElementById('player');
  if (params.get('w')) el.style.width = params.get('w') + 'px';
  if (params.get('h')) el.style.height = params.get('h') + 'px';

  window.seekEvents = [];
  window.trackEvents = [];
  window.fullscreenRequests = 0;
  // Counted, then denied: the suppression assertions only need to know the
  // shortcut never reached the API.
  el.requestFullscreen = () => {
    window.fullscreenRequests++;
    return Promise.reject(new Error('denied by the keyboard harness'));
  };

  const player = await createPlayer({
    container: el,
    plugins: [
      createNativePlugin(),
      uiPlugin({ controls: ['play', 'keyboard-help', 'spacer', 'fullscreen'] }),
    ],
  });
  window.player = player;
  player.on('playback:seeking', (e) => window.seekEvents.push(e.time));
  player.on('track:text', (e) => window.trackEvents.push(e.trackId));
  window.ready = true;
</script>
</body></html>`;

/**
 * Serve the repo root plus the synthetic test page, confined to the loopback.
 *
 * @returns {Promise<import('node:http').Server>} the started server
 */
const startServer = () =>
  new Promise((started) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new globalThis.URL(req.url, ORIGIN);

        if (url.pathname === '/keyboard.html') {
          res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
          res.end(pageHtml());
          return;
        }

        const file = resolve(REPO_ROOT, `.${url.pathname}`);
        if (!file.startsWith(REPO_ROOT)) {
          res.writeHead(403);
          res.end('forbidden');
          return;
        }

        const types = {
          '.js': 'text/javascript',
          '.cjs': 'text/javascript',
          '.html': 'text/html',
          '.css': 'text/css',
          '.mp4': 'video/mp4',
          '.m3u8': 'application/vnd.apple.mpegurl',
          '.ts': 'video/mp2t',
        };
        const type = types[url.pathname.slice(url.pathname.lastIndexOf('.'))] ?? 'application/octet-stream';

        // Range requests, because a media element served without them is not
        // seekable in Chromium: the seekable range stays empty and every
        // currentTime write clamps back to zero, silently. python3's
        // http.server (the shared harness) answers them; so does this one.
        const range = req.headers.range;
        if (range && type.startsWith('video/')) {
          const size = statSync(file).size;
          const match = /bytes=(\d*)-(\d*)/.exec(range);
          const start = match?.[1] ? Number.parseInt(match[1], 10) : 0;
          const end = Math.min(match?.[2] ? Number.parseInt(match[2], 10) : size - 1, size - 1);
          const buffer = Buffer.alloc(end - start + 1);
          const fd = openSync(file, 'r');
          try {
            readSync(fd, buffer, 0, buffer.length, start);
          } finally {
            closeSync(fd);
          }
          res.writeHead(206, {
            'content-type': type,
            'content-range': `bytes ${start}-${end}/${size}`,
            'accept-ranges': 'bytes',
            'content-length': buffer.length,
          });
          res.end(buffer);
          return;
        }

        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes' });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(PORT, '127.0.0.1', () => started(server));
  });

/**
 * Open a tracked page: every uncaught error and unhandled rejection is kept
 * and asserted empty at the end of the run.
 *
 * @param {import('playwright').Browser} browser
 * @param {{width: number, height: number}} viewport
 * @param {string} size player size as w/h query params
 * @returns {Promise<{page: import('playwright').Page, errors: {pageErrors: string[], rejections: string[]}, collect: () => Promise<{pageErrors: string[], rejections: string[]}>}>}
 */
const openPage = async (browser, viewport, size = '') => {
  const page = await browser.newPage({ viewport });
  // Nothing may leave the loopback, enforced rather than asserted.
  await page.route(/^https?:\/\//, (route) => {
    const { hostname } = new globalThis.URL(route.request().url());
    return hostname === '127.0.0.1' || hostname === 'localhost'
      ? route.continue()
      : route.abort('failed');
  });
  const errors = { pageErrors: [], rejections: [] };
  page.on('pageerror', (err) => errors.pageErrors.push(String(err)));
  await page.addInitScript(() => {
    window.__unhandledRejections = [];
    window.addEventListener('unhandledrejection', (e) => {
      window.__unhandledRejections.push(String(e.reason));
    });
  });
  const collect = async () => {
    errors.rejections = await page.evaluate(() => window.__unhandledRejections ?? []);
    return errors;
  };
  await page.goto(`${ORIGIN}/keyboard.html${size}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ready === true, { timeout: 30000 });
  return { page, errors, collect };
};

/**
 * State of the dialog and the media element in one evaluate round trip.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<object>}
 */
const snapshot = (page) =>
  page.evaluate(() => {
    const dialog = document.querySelector('.sp-kbd-help');
    const panel = document.querySelector('.sp-kbd-help__panel');
    const body = document.querySelector('.sp-kbd-help__body');
    const close = document.querySelector('.sp-kbd-help__close');
    const container = document.getElementById('player');
    const video = document.querySelector('video');
    return {
      dialogOpen: !!dialog,
      role: dialog?.getAttribute('role') ?? null,
      ariaModal: dialog?.getAttribute('aria-modal') ?? null,
      ariaLabel: dialog?.getAttribute('aria-label') ?? null,
      active: document.activeElement?.className || document.activeElement?.tagName || '',
      activeIsClose: document.activeElement === close,
      activeIsContainer: document.activeElement === container,
      insideContainer: !!dialog && container.contains(dialog),
      panel: panel ? panel.getBoundingClientRect().toJSON() : null,
      bodyScroll: body ? { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight } : null,
      closeRect: close ? close.getBoundingClientRect().toJSON() : null,
      containerRect: container.getBoundingClientRect().toJSON(),
      muted: video?.muted ?? null,
      paused: video?.paused ?? null,
      t: video ? +video.currentTime.toFixed(2) : null,
      duration: video ? video.duration : null,
      seeks: window.seekEvents.length,
      tracks: window.trackEvents.length,
      fullscreenRequests: window.fullscreenRequests,
    };
  });

/**
 * Whether one rectangle sits inside another, with a half-pixel tolerance for
 * sub-pixel layout rounding.
 *
 * @param {object} inner DOMRect-ish JSON
 * @param {object} outer DOMRect-ish JSON
 * @returns {boolean}
 */
const rectInside = (inner, outer) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;

ensureMp4Fixture();

const browser = await chromium.launch({ headless: true });
const server = await startServer();

try {
  // =========================================================== desktop
  console.log('\n--- Desktop 1280x900 ---');
  const desktop = await openPage(browser, { width: 1280, height: 900 });
  const page = desktop.page;

  // The optional control is in the bar, not the default layout's job.
  const helpButton = await page.$('.sp-kbd-help-btn');
  record('keyboard-help control renders in the bar', !!helpButton);
  record(
    'control is labelled',
    (await helpButton?.getAttribute('aria-label')) === 'Keyboard shortcuts'
  );

  // 1. `?` opens before any media exists.
  await page.evaluate(() => document.getElementById('player').focus());
  await page.keyboard.press('?');
  let s = await snapshot(page);
  record('`?` opens the dialog before media exists', s.dialogOpen === true);
  record('dialog is a labelled modal', s.role === 'dialog' && s.ariaModal === 'true' && s.ariaLabel === 'Keyboard shortcuts', `${s.role}/${s.ariaModal}/${s.ariaLabel}`);
  record('dialog renders inside the player container', s.insideContainer === true);
  record('focus starts inside the dialog', s.activeIsClose === true);
  record('panel fits inside the player', !!s.panel && rectInside(s.panel, s.containerRect));
  await page.keyboard.press('Escape');
  s = await snapshot(page);
  record('Escape closes the pre-media dialog', s.dialogOpen === false);

  // Load the media once; the rest of the desktop run asserts against a real
  // element.
  await page.evaluate(
    (src) => window.player.load(src),
    `${ORIGIN}/scripts/fixtures/keyboard/vod.mp4`
  );
  await page.waitForFunction(() => {
    const v = document.querySelector('video');
    return v && v.readyState >= 1 && Number.isFinite(v.duration) && v.duration > 0;
  }, { timeout: 30000 });

  // 2. The full dialog lifecycle with an invoking focus to restore. Focused,
  // never clicked: a real click would start playback, and the suppression
  // assertions below need a paused element.
  await page.focus('.sp-play');
  await page.keyboard.press('?');
  s = await snapshot(page);
  record('`?` opens the dialog with media loaded', s.dialogOpen === true);
  record('focus starts inside the dialog', s.activeIsClose === true);

  // 3. Tab / Shift+Tab stay inside.
  await page.keyboard.press('Tab');
  s = await snapshot(page);
  record('Tab stays inside the dialog', s.activeIsClose === true && s.dialogOpen === true);
  await page.keyboard.press('Shift+Tab');
  s = await snapshot(page);
  record('Shift+Tab stays inside the dialog', s.activeIsClose === true && s.dialogOpen === true);

  // 4. Media shortcuts stand down while the dialog owns focus.
  const beforeSuppression = await snapshot(page);
  await page.keyboard.press('m');
  await page.keyboard.press('f');
  await page.keyboard.press('k');
  await page.keyboard.press('c');
  await page.keyboard.press('3');
  s = await snapshot(page);
  record('m does not mute while help is open', s.muted === false, `muted=${s.muted}`);
  record('f requests no fullscreen while help is open', s.fullscreenRequests === beforeSuppression.fullscreenRequests);
  record('k does not play while help is open', s.paused === true, `paused=${s.paused}`);
  record('c and digits issue no commands while help is open', s.seeks === beforeSuppression.seeks && s.tracks === beforeSuppression.tracks);
  record('the element did not move while help was open', Math.abs(s.t - beforeSuppression.t) < 0.01, `t=${s.t}`);

  // Escape closes and restores the invoking focus (the play button).
  await page.keyboard.press('Escape');
  s = await snapshot(page);
  record('Escape closes the dialog', s.dialogOpen === false);
  record(
    'focus returns to the invoking control',
    s.active === 'sp-control sp-play' || s.active.includes('sp-play'),
    s.active
  );

  // 2b. Opening from the keyboard-help control restores focus to it.
  await page.click('.sp-kbd-help-btn');
  s = await snapshot(page);
  record('the control opens the dialog', s.dialogOpen === true);
  await page.keyboard.press('Escape');
  s = await snapshot(page);
  record(
    'focus returns to the control that opened it',
    s.active === 'sp-control sp-kbd-help-btn' || s.active.includes('sp-kbd-help-btn'),
    s.active
  );

  // 5. Editable fields keep their keys.
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'kbd-test-input';
    input.style.position = 'absolute';
    input.style.bottom = '0px';
    document.getElementById('player').appendChild(input);
    input.focus();
  });
  await page.keyboard.press('5');
  await page.keyboard.press('?');
  s = await snapshot(page);
  record('digits typed into an input do not seek', s.seeks === 0, `seeks=${s.seeks} t=${s.t}`);
  record('? typed into an input does not open help', s.dialogOpen === false);
  await page.evaluate(() => {
    document.getElementById('kbd-test-input').remove();
    document.getElementById('player').focus();
  });

  // 6. Digits against a real element, one event per key.
  await page.keyboard.press('5');
  s = await snapshot(page);
  record(
    'digit 5 seeks once to half the duration',
    s.seeks === 1 && s.t > 0 && Math.abs(s.t - FIXTURE_SECONDS / 2) < 0.5,
    `seeks=${s.seeks} t=${s.t}`
  );
  record('the seek does not implicitly play', s.paused === true);

  await page.keyboard.press('9');
  s = await snapshot(page);
  record(
    'digit 9 seeks to 90%, one more event',
    s.seeks === 2 && Math.abs(s.t - (FIXTURE_SECONDS * 9) / 10) < 0.5,
    `seeks=${s.seeks} t=${s.t}`
  );

  // The window.player tracks the media the whole run; no error so far.
  const desktopErrors = await desktop.collect();
  record(
    'no uncaught errors or rejections (desktop)',
    desktopErrors.pageErrors.length === 0 && desktopErrors.rejections.length === 0,
    `${desktopErrors.pageErrors.join('; ')} ${desktopErrors.rejections.join('; ')}`
  );
  await page.close();

  // =========================================================== phone
  console.log('\n--- Phone 390x844, player 390x211 (short) ---');
  const phone = await openPage(
    browser,
    { width: 390, height: 844 },
    `?w=390&h=211`
  );
  const phonePage = phone.page;
  await phonePage.evaluate(() => document.getElementById('player').focus());
  await phonePage.keyboard.press('?');
  s = await snapshot(phonePage);
  record('dialog opens on the phone viewport', s.dialogOpen === true);
  record('panel fits inside the short player', !!s.panel && rectInside(s.panel, s.containerRect),
    JSON.stringify(s.panel));
  record(
    'close button stays reachable inside the viewport',
    !!s.closeRect &&
      s.closeRect.width > 0 &&
      s.closeRect.x >= 0 &&
      s.closeRect.y >= 0 &&
      s.closeRect.x + s.closeRect.width <= 390 &&
      s.closeRect.y + s.closeRect.height <= 844
  );
  record(
    'close button meets the 44x44 control target',
    !!s.closeRect && s.closeRect.width >= 44 && s.closeRect.height >= 44,
    JSON.stringify(s.closeRect && { width: s.closeRect.width, height: s.closeRect.height })
  );
  const scrolls = await phonePage.evaluate(() => {
    const body = document.querySelector('.sp-kbd-help__body');
    if (!body) return { overflows: false, scrolls: false };
    body.scrollTop = 10;
    return { overflows: body.scrollHeight > body.clientHeight, scrolls: body.scrollTop > 0 };
  });
  record('the list scrolls inside its bound on a short player',
    scrolls.overflows === true && scrolls.scrolls === true,
    JSON.stringify(scrolls));

  await phonePage.keyboard.press('Escape');
  const phoneErrors = await phone.collect();
  record(
    'no uncaught errors or rejections (phone)',
    phoneErrors.pageErrors.length === 0 && phoneErrors.rejections.length === 0,
    `${phoneErrors.pageErrors.join('; ')} ${phoneErrors.rejections.join('; ')}`
  );
  await phonePage.close();
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  process.exitCode = 1;
}
