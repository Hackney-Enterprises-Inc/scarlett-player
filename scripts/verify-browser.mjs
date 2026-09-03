/**
 * Browser verification harness for Scarlett Player failure handling.
 *
 * Drives the built demo bundle in headless Chrome and asserts the
 * viewer-facing failure behaviors that jsdom cannot test:
 *
 *   1. Manifest 404 on initial load -> bounded failure, accurate message,
 *      structured error state, init() resolves, Try Again recovers. Also the
 *      poster contract, which only a real element can answer: the demo passes
 *      a poster, so before any click the video element must carry it and be
 *      paused, and setPoster('') must clear the attribute.
 *   2. Mid-playback network outage -> reconnecting overlay, then automatic
 *      recovery with zero interaction and VOD position preserved.
 *   3. First-click-on-play regression (idempotent control rendering).
 *   4. Load churn + destroy mid-append against a LOCAL fixture with the
 *      real transmuxer worker: zero uncaught errors or unhandled
 *      rejections (the detached-ArrayBuffer / Sentry 2BR class).
 *   5. Malformed live playlist refreshes (error page mid-stream): playback
 *      survives on the previous playlist and recovers, zero uncaught
 *      errors (the undefined-segments / Sentry 2D8 class).
 *   6. The built embed UMD, loaded the way a CDN consumer loads it: the
 *      window.ScarlettPlayer global keeps its shape and reports the embed
 *      package's own version. Pins output.exports:
 *      'named' in packages/embed/vite.config.ts, which silences Rollup's
 *      mixed-exports warning but could just as easily have moved the API
 *      behind window.ScarlettPlayer.default and broken every embed on the
 *      web without a single test noticing.
 *
 * Usage:
 *   pnpm build && node demo/build.cjs
 *   python3 -m http.server 8899 --bind 127.0.0.1   # from repo root
 *   npx -y playwright@latest node scripts/verify-browser.mjs   # or: node scripts/verify-browser.mjs
 *
 * Requires the `playwright` package to be importable, a local Chrome
 * (launched via channel: 'chrome'), and ffmpeg on PATH (scenarios 4-5
 * auto-generate a local HLS fixture via scripts/hls-fixture.mjs).
 * Exits non-zero on any failed assertion.
 *
 * NOTE: scenarios 1-3 still use the live demo stream
 * (vod.thestreamplatform.com); scenarios 4-5 are fully local. PiP is not
 * exercised here (headless Chrome cannot enter PiP); the readiness gate
 * is covered by unit tests in @scarlett-player/ui.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ensureHlsFixture } from './hls-fixture.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The version @scarlett-player/embed is published at, read from its manifest.
 *
 * Read rather than written down because the whole point of the check below is
 * that the number a viewer sees is the package's own. Every version constant in
 * this repo used to be hand-written and every one had drifted: the CDN's
 * latest/embed.umd.cjs answered window.ScarlettPlayer.version === '0.5.3' while
 * the package published at 1.7.0 (measured 2026-09-02).
 */
const EMBED_VERSION = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages/embed/package.json'), 'utf8')
).version;

const URL = 'http://127.0.0.1:8899/demo/index.html';
const FIXTURE_VOD = 'http://127.0.0.1:8899/scripts/fixtures/hls/vod.m3u8';
const FIXTURE_SEG = (i) => `http://127.0.0.1:8899/scripts/fixtures/hls/seg${i}.ts`;
const EMBED_UMD = 'http://127.0.0.1:8899/packages/embed/dist/embed.umd.cjs';
const EMBED_DIST = 'http://127.0.0.1:8899/packages/embed/dist/';

ensureHlsFixture();

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
};

/**
 * Open a page that counts uncaught exceptions and unhandled rejections.
 * The absorbed error classes must never reach either channel.
 */
const newTrackedPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
  return { page, errors, collect };
};

const state = (page) => page.evaluate(() => {
  const v = document.querySelector('video');
  const ov = document.querySelector('.sp-error-overlay');
  return {
    overlay: ov?.classList.contains('sp-error-overlay--visible') ?? false,
    reconnecting: ov?.classList.contains('sp-error-overlay--reconnecting') ?? false,
    msg: ov?.querySelector('.sp-error-overlay__message')?.textContent ?? '',
    paused: v?.paused ?? true,
    t: v ? +v.currentTime.toFixed(2) : -1,
    srcIsBlob: (v?.src || '').startsWith('blob:'),
    playbackState: window.player?.getState?.().playbackState,
    errorCode: window.player?.getState?.().error?.code ?? null,
  };
});

// ============================================================ SCENARIO 1
// Manifest 404 on initial load: must terminate with an accurate message,
// a visible overlay, and a resolved init(). No permanent spinner.
{
  console.log('\n--- Scenario 1: manifest 404 on initial load ---');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/*.m3u8', (r) => r.fulfill({ status: 404, body: 'nope' }));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sp-error-overlay', { timeout: 30000 });
  await page.waitForTimeout(14000); // let all 3 retries + backoff exhaust

  const s = await state(page);
  record('overlay shown after failed load', s.overlay === true, s.msg);
  record('message is network-specific (not generic)', s.msg.includes('trouble connecting'), s.msg);
  record('error state populated with structured code', s.errorCode === 'MEDIA_NETWORK_ERROR', String(s.errorCode));
  record('playbackState is error (not stuck loading)', s.playbackState === 'error', String(s.playbackState));

  // Poster, before anything is clicked. The demo passes one, so the element
  // must be showing it while paused: this is the only check that proves the
  // provider actually wrote the attribute onto a real media element.
  const poster = await page.evaluate(() => {
    const v = document.querySelector('video');
    return { poster: v?.getAttribute('poster') ?? null, paused: v?.paused ?? null };
  });
  record(
    'poster attribute set before playback',
    typeof poster.poster === 'string' && poster.poster.length > 0,
    String(poster.poster)
  );
  record('video is paused while the poster shows', poster.paused === true, String(poster.paused));

  // setPoster('') clears it on the live element. Before the providers
  // subscribed to poster state, this call changed state and nothing else.
  //
  // This scenario runs the DEMO BUNDLE, which is committed and rebuilt by CI on
  // main, so on a branch it can predate the core that added setPoster(). The
  // absent method is reported as a failure with the command that fixes it, and
  // never skipped: a missing setPoster() is exactly the regression this check
  // exists to catch when the bundle is current.
  const cleared = await page.evaluate(() => {
    if (typeof window.player?.setPoster !== 'function') return { missing: true, poster: null };
    window.player.setPoster('');
    return { missing: false, poster: document.querySelector('video')?.getAttribute('poster') ?? null };
  });
  record(
    'setPoster("") clears the attribute',
    cleared.missing === false && cleared.poster === '',
    cleared.missing
      ? 'window.player.setPoster is not a function: the demo bundle predates core 1.7.1. Rebuild it with `node demo/build.cjs` and re-run, then leave the bundle uncommitted.'
      : JSON.stringify(cleared.poster)
  );

  const initSettles = await page.evaluate(async () => {
    if (!window.player) return 'no player';
    return await Promise.race([
      window.player.init().then(() => 'resolved'),
      new Promise((res) => setTimeout(() => res('hung'), 8000)),
    ]);
  });
  record('init() settles (no permanent hang)', initSettles === 'resolved', initSettles);

  // Now the manifest comes back: Try Again must actually recover
  await page.unroute('**/*.m3u8');
  await page.locator('.sp-error-overlay__retry').click();
  await page.waitForTimeout(8000);
  const s2 = await state(page);
  record('Try Again recovers once network is healthy', s2.overlay === false && s2.srcIsBlob, JSON.stringify({ overlay: s2.overlay, blob: s2.srcIsBlob, t: s2.t }));
  await page.close();
}

// ============================================================ SCENARIO 2
// Mid-playback outage that ends: the player must reconnect BY ITSELF and
// resume without the viewer touching anything.
{
  console.log('\n--- Scenario 2: transient outage self-heals ---');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => document.querySelector('video').play());
  await page.waitForTimeout(3000);

  const before = await state(page);
  record('playing normally before outage', !before.paused && before.t > 0, `t=${before.t}`);

  // Total outage long enough to exhaust the in-band retry budget
  await page.route(/\.(ts|m4s|mp4|m3u8)(\?|$)/, (r) => r.abort('failed'));

  // Capture position the moment the overlay first appears: that is where the
  // viewer actually was when the player declared the error.
  await page.waitForSelector('.sp-error-overlay--visible', { timeout: 45000 });
  const atFailure = await state(page);
  record('overlay appears during outage', atFailure.overlay === true, atFailure.msg);

  await page.waitForTimeout(6000); // let reconnecting state engage
  const during = await state(page);
  record('overlay shows reconnecting state', during.reconnecting === true, `msg="${during.msg}"`);

  // Network restored: expect auto-recovery with zero interaction
  await page.unroute(/\.(ts|m4s|mp4|m3u8)(\?|$)/);
  const positionAtFailure = atFailure.t;
  await page.waitForTimeout(25000);
  const after = await state(page);
  record('auto-reconnect resumed playback (no clicks)', after.overlay === false && !after.paused, JSON.stringify({ overlay: after.overlay, paused: after.paused, t: after.t }));
  record(
    'VOD position preserved across reconnect',
    positionAtFailure > 5 && after.t >= positionAtFailure - 5,
    `failed at ${positionAtFailure}s, resumed at ${after.t}s`
  );
  await page.close();
}

// ============================================================ SCENARIO 3
// First-click regression: the original complaint stays fixed.
{
  console.log('\n--- Scenario 3: first-click regression ---');
  let dropped = 0;
  for (let run = 1; run <= 6; run++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button.sp-play', { timeout: 30000 });
    await page.locator('button.sp-play').scrollIntoViewIfNeeded();
    await page.waitForSelector('video', { timeout: 30000 });
    await page.waitForTimeout(1200);
    const b = await page.locator('button.sp-play').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(140);
    await page.mouse.up();
    await page.waitForTimeout(900);
    const paused = await page.evaluate(() => document.querySelector('video').paused);
    if (paused) dropped++;
    await page.close();
  }
  record('first click works on fresh loads', dropped === 0, `${dropped}/6 dropped`);
}

// ============================================================ SCENARIO 4
// Load churn + destroy mid-append against the local fixture, with the real
// transmuxer worker and MSE pipeline. This is the browser-level version of
// the jsdom lifecycle tests: superseding loads while segments are in
// flight and destroying mid-append must produce ZERO uncaught errors and
// ZERO unhandled rejections (the detached-ArrayBuffer class).
{
  console.log('\n--- Scenario 4: load churn + destroy mid-append (local fixture) ---');
  const { page, collect } = await newTrackedPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 30000 });
  // The container div's id shadows window.player until demo.ts finishes
  // init and assigns the real instance
  await page.waitForFunction(
    () => window.player && typeof window.player.load === 'function',
    { timeout: 30000 }
  );

  await page.evaluate(async (src) => {
    await window.player.load(src);
    await document.querySelector('video').play().catch(() => {});
  }, FIXTURE_VOD);
  await page.waitForTimeout(2500); // segments appending

  const playing = await page.evaluate(() => !document.querySelector('video').paused);
  record('fixture playback started', playing, '');

  // Interleave superseding loads mid-append, then destroy with work in flight
  await page.evaluate(async (src) => {
    const p = window.player;
    for (let i = 0; i < 5; i++) {
      p.load(`${src}?churn=${i}`).catch(() => {});
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 1500));
    p.load(src).catch(() => {});
    await new Promise((r) => setTimeout(r, 400)); // destroy mid-load
    await p.destroy?.();
    // Clear the demo page's reference the way a real integrator does, so
    // its 250ms stats poller stops calling into the destroyed instance
    // (getState() on a destroyed player throws by design)
    window.player = null;
  }, FIXTURE_VOD);
  await page.waitForTimeout(2000);

  const errs = await collect();
  record(
    'zero uncaught errors during churn + destroy',
    errs.pageErrors.length === 0,
    errs.pageErrors.slice(0, 3).join(' | ')
  );
  record(
    'zero unhandled rejections during churn + destroy',
    errs.rejections.length === 0,
    errs.rejections.slice(0, 3).join(' | ')
  );
  await page.close();
}

// ============================================================ SCENARIO 5
// Malformed live playlist refresh: a "live" stream (no ENDLIST, playlist
// re-fetched continuously) starts returning an HTML error page mid-stream.
// The player must keep playing off the previous playlist, never dead-end,
// and recover once the endpoint returns real playlists again.
{
  console.log('\n--- Scenario 5: malformed live playlist refresh (local fixture) ---');
  const { page, collect } = await newTrackedPage();

  // Live-style playlist over the whole fixture window (a stalled-but-valid
  // live stream that hls.js keeps refreshing)
  const livePlaylist = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:2',
    '#EXT-X-MEDIA-SEQUENCE:0',
    ...Array.from({ length: 30 }, (_, i) => `#EXTINF:2.000000,\n${FIXTURE_SEG(i)}`),
  ].join('\n');

  let mode = 'valid';
  let garbage_refreshes = 0;
  await page.route('**/live-test.m3u8', (r) => {
    if (mode === 'garbage') {
      garbage_refreshes++;
      return r.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>',
      });
    }
    return r.fulfill({
      status: 200,
      contentType: 'application/vnd.apple.mpegurl',
      body: livePlaylist,
    });
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 30000 });
  await page.waitForFunction(
    () => window.player && typeof window.player.load === 'function',
    { timeout: 30000 }
  );
  await page.evaluate(async () => {
    await window.player.load('http://127.0.0.1:8899/live-test.m3u8');
    await document.querySelector('video').play().catch(() => {});
  });
  await page.waitForTimeout(6000);

  const before = await state(page);
  record('live fixture playing before corruption', !before.paused && before.t > 0, `t=${before.t}`);

  // The refresh endpoint starts serving an error page
  mode = 'garbage';
  await page.waitForTimeout(6000);
  const during = await state(page);
  record('garbage refreshes actually served', garbage_refreshes > 0, `${garbage_refreshes} refreshes`);
  record(
    'viewer not dead-ended during garbage refreshes (playing or reconnecting)',
    (!during.paused && !during.overlay) || during.reconnecting === true,
    JSON.stringify({ paused: during.paused, overlay: during.overlay, reconnecting: during.reconnecting })
  );

  // Endpoint recovers
  mode = 'valid';
  await page.waitForTimeout(10000);
  const after = await state(page);
  record(
    'playback healthy after refresh endpoint recovers',
    !after.paused && after.overlay === false,
    JSON.stringify({ paused: after.paused, overlay: after.overlay, t: after.t })
  );

  const errs = await collect();
  record(
    'zero uncaught errors across malformed refreshes',
    errs.pageErrors.length === 0,
    errs.pageErrors.slice(0, 3).join(' | ')
  );
  record(
    'zero unhandled rejections across malformed refreshes',
    errs.rejections.length === 0,
    errs.rejections.slice(0, 3).join(' | ')
  );
  await page.close();
}

// ============================================================ SCENARIO 6
// The built embed UMD, loaded from a <script> tag the way every CDN embed
// loads it. Each entry assigns its API object to window.ScarlettPlayer inside
// the module body AND default-exports it, so Rollup warned about mixed
// exports. output.exports: 'named' silences that; these checks are what stop a
// future config change from quietly moving the whole API behind
// window.ScarlettPlayer.default, which no unit test can see (the embed tests
// mock core and never load a bundle).
{
  console.log('\n--- Scenario 6: built embed UMD global surface ---');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Same origin as the bundle, so the script tag is not a cross-origin load.
  await page.goto(EMBED_DIST, { waitUntil: 'domcontentloaded' });

  let loadError = '';
  try {
    await page.addScriptTag({ url: EMBED_UMD });
  } catch (e) {
    loadError = String(e);
  }
  record('built embed UMD loads in a browser', loadError === '', loadError);

  const api = await page.evaluate(() => {
    const sp = window.ScarlettPlayer;
    return {
      defined: !!sp,
      createType: typeof sp?.create,
      initAllType: typeof sp?.initAll,
      availableTypes: sp?.availableTypes ?? null,
      version: sp?.version ?? null,
      // A 'default' key here means the named/default mix leaked into the global
      hasDefaultWrapper: !!sp && typeof sp.default === 'object',
    };
  });

  record('window.ScarlettPlayer is defined by the UMD bundle', api.defined === true, JSON.stringify(api));
  record(
    'ScarlettPlayer.create is a function (not behind .default)',
    api.createType === 'function' && api.hasDefaultWrapper === false,
    `create=${api.createType}, default wrapper=${api.hasDefaultWrapper}`
  );
  record(
    'ScarlettPlayer.availableTypes is present',
    Array.isArray(api.availableTypes) && api.availableTypes.length > 0,
    JSON.stringify(api.availableTypes)
  );
  record('ScarlettPlayer.initAll is a function', api.initAllType === 'function', api.initAllType);
  // The version the global reports is the only thing support can read off a
  // page to tell which build a viewer is running, and it was a hand-written
  // literal until this release: the CDN's latest/embed.umd.cjs still answered
  // '0.5.3' on 2026-09-02 while the package published at 1.7.0. It comes from
  // packages/embed/package.json through the vite.config.ts define now, and
  // nothing but a real browser load can prove the define survived the bundle.
  record(
    'ScarlettPlayer.version is the embed package version',
    api.version === EMBED_VERSION,
    `global=${api.version}, package.json=${EMBED_VERSION}`
  );

  await page.close();
}

// ============================================================ SUMMARY
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exitCode = 1;
}
await browser.close();
