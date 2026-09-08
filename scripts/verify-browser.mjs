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
 *   7. Narrow-viewport reachability (local fixture, like every scenario): on a 320px
 *      touch viewport both coarse-pointer queries match, the controls
 *      that must never move are still in the bar and inside the player, the
 *      skip buttons are in the overflow tray, the tray's adopted skip button
 *      still seeks the video, the progress bar is a 44px touch target, and the
 *      settings speed panel fits inside its bound and scrolls inside a 375x211
 *      player rather than overflowing it. Repeated at 375 and 414.
 *   8. LL-HLS: a rolling low-latency playlist assembled from the same fixture
 *      segments, sliced into 0.5s parts and served the way an LL origin serves
 *      them (blocking part delivery, blocking playlist reloads). Parts load,
 *      effective LL is reported, the edge threshold flips to GO LIVE when the
 *      viewer drifts back, and clicking it lands on the live SYNC POSITION
 *      rather than past the edge, without stalling.
 *
 * Usage:
 *   pnpm build && node demo/build.cjs
 *   python3 -m http.server 8899 --bind 127.0.0.1   # from repo root
 *   npx -y playwright@latest node scripts/verify-browser.mjs   # or: node scripts/verify-browser.mjs
 *
 * Requires the `playwright` package to be importable (with its bundled
 * Chromium installed - `npx playwright install --with-deps chromium`) and
 * ffmpeg on PATH, which scripts/hls-fixture.mjs uses to generate the local
 * HLS fixture every scenario now plays. Exits non-zero on any failed
 * assertion.
 *
 * Playwright's bundled Chromium, not `channel: 'chrome'`: a system Google
 * Chrome install is not present on CI runners, and requiring one is what kept
 * this harness out of CI.
 *
 * NOTE: no scenario touches an external origin. Every one of them plays
 * scripts/fixtures/hls/vod.m3u8 over the local server, so a run is unaffected
 * by the demo origin's availability - the 503 that produced the fragLoadError
 * diagnostics fix would have taken this harness down with it. PiP is not
 * exercised here (headless Chromium cannot enter PiP); the readiness gate is
 * covered by unit tests in @scarlett-player/ui.
 */
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ensureHlsFixture, ensureLlHlsFixture } from './hls-fixture.mjs';

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
const LL_FIXTURE = ensureLlHlsFixture();

const browser = await chromium.launch({ headless: true });

/**
 * Refuse every request that is not served by the local test server.
 *
 * Enforcement, not belt-and-braces: the assertions below are all made against
 * the local fixture now, but the demo page's own default source and poster are
 * hosted, so without this a run would still fire requests at them and a broken
 * swap would go unnoticed until the day that origin was down. Aborting instead
 * of allowing means "the harness must not need the public internet" is checked
 * on every run rather than asserted in a comment.
 *
 * @param {import('playwright').Page} page - Page to confine to 127.0.0.1
 * @returns {Promise<void>}
 */
const blockExternalOrigins = (page) =>
  page.route(/^https?:\/\//, (route) => {
    const { hostname } = new global.URL(route.request().url());
    return hostname === '127.0.0.1' || hostname === 'localhost'
      ? route.continue()
      : route.abort('failed');
  });
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
  await blockExternalOrigins(page);
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

/**
 * Point the demo's player at the local HLS fixture.
 *
 * The demo page's own default source is the hosted demo stream, so every
 * scenario that just loaded the page is playing over the public internet until
 * this runs. Driven through `window.player.load()` - the same mechanism
 * scenarios 4 and 5 already use - rather than a new hook in the demo.
 *
 * @param {import('playwright').Page} page - A page that has loaded the demo
 * @param {string} src - Manifest to load; defaults to the VOD fixture
 * @returns {Promise<void>} Resolves once the load has settled, failure included
 */
const loadFixture = async (page, src = FIXTURE_VOD) => {
  // The container div's id shadows window.player until demo.ts finishes init
  // and assigns the real instance.
  await page.waitForFunction(
    () => window.player && typeof window.player.load === 'function',
    { timeout: 30000 }
  );
  // A rejected load is a legitimate outcome here: scenario 1 calls this while
  // every manifest is routed to a 404 on purpose.
  await page.evaluate((s) => window.player.load(s).catch(() => {}), src);
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
  await blockExternalOrigins(page);
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

  // Point the player at the LOCAL fixture before the recovery leg. The failing
  // load above never left the browser (Playwright fulfilled it), but Try Again
  // reloads the current source for real, and the demo's default is the hosted
  // demo stream.
  await loadFixture(page);

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
  await blockExternalOrigins(page);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 30000 });
  await loadFixture(page);
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
    await blockExternalOrigins(page);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button.sp-play', { timeout: 30000 });
    await page.waitForSelector('video', { timeout: 30000 });
    await loadFixture(page);
    await page.waitForTimeout(1200);
    // Scrolled AFTER the settle wait, not before it. The share plugin
    // registers its control roughly 150ms after the bar first renders, and
    // the UI plugin rebuilds the bar in response, so a locator taken at the
    // first paint was detached under scrollIntoViewIfNeeded and the whole
    // harness threw. Measured on 2026-09-05: 3 of 6 runs against main's own
    // demo bundle, and 0 of 6 with this order.
    await page.locator('button.sp-play').scrollIntoViewIfNeeded();
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
  await blockExternalOrigins(page);
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

// ============================================================ SCENARIO 7
// Narrow-viewport reachability. The control bar is a single non-wrapping row of
// fixed-width items inside a host that clips, so before the responsive fit a
// 320px player rendered settings, share, cast, PiP and fullscreen past the
// clipping edge: captions and playback speed were not broken, they were
// unreachable. jsdom cannot answer any of this, because it has no layout.
{
  console.log('\n--- Scenario 7: narrow viewport reachability ---');

  /** Measure what a viewer can actually reach in the bar. */
  const reachability = (page) => page.evaluate(() => {
    const player = document.getElementById('player');
    const bar = document.querySelector('.sp-controls');
    const tray = document.querySelector('.sp-overflow-tray');
    const box = player.getBoundingClientRect();

    const inBar = (sel) => document.querySelector(sel)?.parentElement === bar;
    const insidePlayer = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();

      return r.width > 0 && r.right <= box.right + 0.5 && r.left >= box.left - 0.5;
    };

    return {
      playerWidth: Math.round(box.width),
      settings: inBar('.sp-settings') && insidePlayer('.sp-settings'),
      fullscreen: inBar('.sp-fullscreen') && insidePlayer('.sp-fullscreen'),
      play: inBar('.sp-play') && insidePlayer('.sp-play'),
      trayHasSkip: !!tray?.querySelector('.sp-skip'),
      trayButtonShown: document.querySelector('.sp-overflow')?.style.display !== 'none',
      progressHeight: Math.round(
        document.querySelector('.sp-progress-wrapper')?.getBoundingClientRect().height ?? 0
      ),
      coarse: window.matchMedia('(pointer: coarse)').matches,
      anyCoarse: window.matchMedia('(any-pointer: coarse)').matches,
    };
  });

  /**
   * Open the demo on a touch viewport with the source actually loaded.
   *
   * The wait is load-bearing, not politeness: the skip buttons hide themselves
   * while `duration` is 0, and the fit never moves a control that is hiding.
   * Measuring before the manifest lands measures a bar that is not yet full,
   * and the tray assertion below then passes or fails on network timing.
   */
  const openDemo = async (width, height) => {
    const p = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
    });
    await blockExternalOrigins(p);
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.sp-controls', { timeout: 15000 });
    await loadFixture(p);
    await p.waitForFunction(
      () => (document.querySelector('video')?.duration ?? 0) > 0,
      null,
      { timeout: 30000 }
    );

    // Then wait for the bar to stop changing. `duration > 0` says the source
    // is ready, not that the control bar has finished settling: the share
    // plugin registers its control ~150ms after the bar first renders and the
    // UI plugin rebuilds the bar in response, and the fit itself is scheduled
    // into a render frame. Measuring on the duration signal alone caught the
    // bar mid-rebuild, and the 414px leg reported the skip buttons still in
    // the bar because the overflow pass had not run yet. Scenario 3 documents
    // the same race from the other side.
    await p.waitForFunction(
      () => {
        const bar = document.querySelector('.sp-controls');
        const tray = document.querySelector('.sp-overflow-tray');
        if (!bar) return false;

        const signature = `${bar.children.length}:${tray?.children.length ?? 0}`;
        const stable = window.__barSignature === signature;
        window.__barSignature = signature;

        return stable;
      },
      null,
      { timeout: 15000, polling: 300 }
    );

    return p;
  };

  const page = await openDemo(320, 568);

  const narrow = await reachability(page);

  // A gate, not a nicety: without coarse-pointer emulation every touch
  // assertion below would pass or fail for the wrong reason. Both queries are
  // recorded because the two are not the same test and the player now reads
  // each of them: the 44px progress rule keys off `(any-pointer: coarse)`, and
  // so does the gestures plugin's 'auto' default, while `(pointer: coarse)`
  // is what says this viewport's PRIMARY pointer is a finger.
  record(
    'touch emulation reports a coarse pointer',
    narrow.coarse === true && narrow.anyCoarse === true,
    `matchMedia (pointer: coarse)=${narrow.coarse}, (any-pointer: coarse)=${narrow.anyCoarse}`
  );
  record(
    'settings and fullscreen stay reachable at 320px',
    narrow.settings && narrow.fullscreen && narrow.play,
    JSON.stringify(narrow)
  );
  record(
    'the skip buttons moved into the overflow tray at 320px',
    narrow.trayHasSkip && narrow.trayButtonShown,
    `tray skip=${narrow.trayHasSkip}, button shown=${narrow.trayButtonShown}`
  );
  record(
    'the progress bar is a 44px touch target on a coarse pointer',
    narrow.progressHeight === 44,
    `${narrow.progressHeight}px`
  );

  // The moved elements keep their own handlers: they are relocated, never
  // re-rendered or wrapped.
  //
  // Asserted through a skip button, which the check above has just proved is in
  // the tray, and through the effect it must have on the video element. The
  // control this used to click was `.sp-pip`, behind an optional chain, and
  // that could not see the defect it was written for: the check passed when no
  // PiP button was in the tray at all, PipButton catches its own request
  // failures, and clicking a control whose handler was lost raises nothing
  // either, so "no exception escaped" was true in every case.
  //
  // Either skip button is accepted. They share a fit rank, ties go to the later
  // item in layout order, so which one leaves the bar first is the fit's
  // business and not this check's.
  const SKIP_SECONDS = 10; // SkipButton's DEFAULT_SKIP_SECONDS; the demo does not override it
  const SEEK_FROM = 40;

  const trayUse = await page.evaluate(
    async ({ step, from }) => {
      const video = document.querySelector('video');

      /**
       * Wait for the playhead to reach a position, bounded the way the speed
       * panel's wait below is: a seek on an HLS source is not instant, and an
       * unbounded wait would hang the run instead of failing it.
       */
      const settleAt = async (target) => {
        for (let i = 0; i < 50; i++) {
          if (Math.abs(video.currentTime - target) < 1) return true;
          await new Promise((r) => setTimeout(r, 100));
        }

        return false;
      };

      try {
        document.querySelector('.sp-overflow__btn').click();
        const open = document
          .querySelector('.sp-overflow-tray')
          .classList.contains('sp-overflow-tray--open');

        // A known start, so a step in either direction has somewhere to land
        // whatever the demo stream happened to be doing.
        video.currentTime = from;
        const seeded = await settleAt(from);

        // No optional chain: a control missing from the tray has to fail this
        // check rather than skip it.
        const skip = document.querySelector('.sp-overflow-tray .sp-skip');
        if (!skip) {
          return { open, seeded, found: false, landed: false, threw: null };
        }

        const back = skip.classList.contains('sp-skip--backward');
        skip.click();
        const landed = await settleAt(back ? from - step : from + step);

        return {
          open,
          seeded,
          found: true,
          direction: back ? 'backward' : 'forward',
          landed,
          at: +video.currentTime.toFixed(2),
          threw: null,
        };
      } catch (e) {
        return { open: false, seeded: false, found: false, landed: false, threw: String(e) };
      }
    },
    { step: SKIP_SECONDS, from: SEEK_FROM }
  );
  record(
    'the tray opens and its adopted skip button still seeks the video',
    trayUse.open === true &&
      trayUse.seeded === true &&
      trayUse.found === true &&
      trayUse.landed === true &&
      trayUse.threw === null,
    trayUse.threw ?? JSON.stringify(trayUse)
  );

  // The speed panel is 253px (a 37px header and six 36px rows) against a 211px
  // portrait phone player, so before it was bounded the host's overflow:hidden
  // cut off its Back header and its first three speeds.
  const speed = await page.evaluate(async () => {
    const player = document.getElementById('player');
    player.style.aspectRatio = 'auto';
    player.style.width = '375px';
    player.style.height = '211px';

    // Let the plugin's ResizeObserver deliver and its coalescing frame run.
    // 100ms was not always enough for the observer's first delivery, which left
    // the variable at its pre-resize value and the check passing for the wrong
    // reason.
    await new Promise((r) => setTimeout(r, 300));

    document.querySelector('.sp-settings__btn').click();
    const rows = Array.from(document.querySelectorAll('.sp-settings-panel__row'));
    rows.find((row) => row.textContent.includes('Speed'))?.click();

    const panel = document.querySelector('.sp-settings-panel');
    const panelBox = panel.getBoundingClientRect();
    const playerBox = player.getBoundingClientRect();
    const quality = document.querySelector('.sp-quality-menu');

    return {
      playerHeight: Math.round(playerBox.height),
      maxHeight: getComputedStyle(player).getPropertyValue('--sp-menu-max-height').trim(),
      clientHeight: panel.clientHeight,
      scrollHeight: panel.scrollHeight,
      // Border box, which is the only height the host's overflow: hidden can
      // see. A max-height resolved against the content box leaves a padded
      // panel taller than its bound, so scrollHeight > clientHeight is true
      // either way and cannot tell the two apart.
      panelHeight: Math.round(panelBox.height),
      panelTop: Math.round(panelBox.top),
      playerTop: Math.round(playerBox.top),
      // Read directly, because the bounded-height assertion above cannot see a
      // content-box max-height in this demo. The sub-views set `padding: 0` and
      // are exact either way; the main view is the same element with
      // `padding: 4px 0`, and here it is at most three rows (quality, captions,
      // speed) of the 36px the stylesheet records, so it never grows past the
      // 120px floor the bound cannot go below and the 8px is never clipped.
      // border-box is what makes --sp-menu-max-height the height the host's
      // overflow: hidden actually sees.
      panelBoxSizing: getComputedStyle(panel).boxSizing,
      // Absent from this demo's layout, which asks for 'settings' and not
      // 'quality', so the check below reports that rather than failing on it.
      qualityBoxSizing: quality ? getComputedStyle(quality).boxSizing : null,
    };
  });
  record(
    'the speed panel scrolls inside a 375x211 player instead of overflowing it',
    speed.playerHeight === 211 &&
      speed.maxHeight === '139px' &&
      speed.scrollHeight > speed.clientHeight &&
      speed.clientHeight > 0 &&
      speed.panelHeight <= parseFloat(speed.maxHeight) &&
      speed.panelTop >= speed.playerTop,
    JSON.stringify(speed)
  );
  record(
    'the bounded menus resolve --sp-menu-max-height against the border box',
    speed.panelBoxSizing === 'border-box' &&
      (speed.qualityBoxSizing === null || speed.qualityBoxSizing === 'border-box'),
    speed.qualityBoxSizing === null
      ? `settings panel=${speed.panelBoxSizing}; no .sp-quality-menu in this demo layout, not checked`
      : `settings panel=${speed.panelBoxSizing}, quality menu=${speed.qualityBoxSizing}`
  );

  await page.close();

  // The same reachability at the two other phone widths that matter.
  for (const width of [375, 414]) {
    const p = await openDemo(width, 812);

    const state = await reachability(p);
    record(
      `settings and fullscreen stay reachable at ${width}px`,
      state.settings && state.fullscreen && state.play && state.trayHasSkip,
      JSON.stringify(state)
    );

    await p.close();
  }
}

// ============================================================ SCENARIO 8
// LL-HLS against a rolling low-latency playlist. The fixture segments are
// sliced into 0.5s parts on the fly and served the way a real LL origin
// serves them - the playlist advances with wall clock, a part request blocks
// until that part exists, and a blocking playlist reload (_HLS_msn/_HLS_part)
// is held until the requested part is available.
//
// Rolling rather than static on purpose: hls.js measures latency as
// `levelDetails.edge + age`, and `age` grows without bound on a playlist that
// never advances, so a fixed document would report latency climbing forever
// and nothing about the edge threshold could be asserted.
{
  console.log('\n--- Scenario 8: LL-HLS parts, latency and GO LIVE (local fixture) ---');

  const LL_PART_DURATION = LL_FIXTURE.partDuration; // 0.5s
  const LL_PARTS_PER_SEG = 4;
  const LL_SEG_DURATION = LL_PART_DURATION * LL_PARTS_PER_SEG; // 2s
  const LL_WINDOW_SEGS = 10;
  const LL_TOTAL_PARTS = LL_FIXTURE.partCount;
  const LL_TOTAL_SEGS = Math.floor(LL_TOTAL_PARTS / LL_PARTS_PER_SEG);
  // Pretend the stream has been running a while, so a joining viewer sees a
  // real DVR window instead of a two-segment playlist. Kept modest because
  // the fixture is only 60s long and the scenario spends ~40s of it.
  const LL_PRIME_SECONDS = 12;
  const LL_PART_HOLD_BACK = 1.5; // 3 x PART-TARGET, the spec minimum

  /**
   * One part, read from the fixture's 0.5s rendition.
   *
   * A real 0.5s segment on a keyframe boundary, not a byte-range slice of the
   * 2s one: hls.js appends each part into the transmuxer as its own chunk, and
   * a slice ending mid-frame produces a truncated access unit that Chromium
   * rejects with PIPELINE_ERROR_DECODE a few seconds into part-driven
   * playback. (Measured - that is exactly what the first version of this
   * scenario did.)
   */
  const partBytes = (seg, part) =>
    readFileSync(
      join(LL_FIXTURE.dir, `part${seg * LL_PARTS_PER_SEG + part}.ts`)
    );

  /**
   * The parent segment an LL playlist advertises alongside its parts.
   *
   * Byte-exactly the concatenation of its four parts, because that is what
   * they are: consecutive complete TS files off one encode. hls.js loads this
   * only when a part fails, and a mismatch there would show up as a decode
   * error rather than as the recovery it is meant to be.
   */
  const segBytes = (seg) =>
    Buffer.concat(
      Array.from({ length: LL_PARTS_PER_SEG }, (_, p) => partBytes(seg, p))
    );

  /**
   * Serve a rolling LL-HLS origin to one page.
   *
   * Each page gets its own clock, because the fixture is finite: two pages
   * sharing one would put the second one past the end of the stream.
   *
   * @param {import('playwright').Page} page - Page to serve
   * @returns {Promise<object>} Request counters plus a part-failure injector
   */
  const installLlOrigin = async (page) => {
    const llStart = Date.now();
    const counters = { partRequests: 0, segmentRequests: 0, blockingReloads: 0, dropped: 0 };
    // Part responses still owed a 404, for the edge-blip case below
    let dropParts = 0;

  /** Parts published so far, capped at the length of the fixture. */
  const publishedParts = () =>
    Math.min(
      LL_TOTAL_PARTS,
      Math.floor((LL_PRIME_SECONDS + (Date.now() - llStart) / 1000) / LL_PART_DURATION)
    );

  /** Wait (up to 4s) until the given part has been published. */
  const waitForPart = async (seg, part) => {
    const index = seg * LL_PARTS_PER_SEG + part;
    for (let i = 0; i < 80; i++) {
      if (publishedParts() > index) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  /** Build the current LL media playlist. */
  const llPlaylist = () => {
    const total = publishedParts();
    const completeSegs = Math.floor(total / LL_PARTS_PER_SEG);
    const partialParts = total % LL_PARTS_PER_SEG;
    const first = Math.max(0, completeSegs - LL_WINDOW_SEGS);

    const part = (seg, p) =>
      `#EXT-X-PART:DURATION=${LL_PART_DURATION.toFixed(5)},URI="/ll-part-${seg}-${p}.ts"` +
      (p === 0 ? ',INDEPENDENT=YES' : '');

    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:9',
      `#EXT-X-TARGETDURATION:${LL_SEG_DURATION}`,
      `#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=${LL_PART_HOLD_BACK.toFixed(1)}`,
      `#EXT-X-PART-INF:PART-TARGET=${LL_PART_DURATION.toFixed(5)}`,
      `#EXT-X-MEDIA-SEQUENCE:${first}`,
    ];

    for (let seg = first; seg < completeSegs; seg++) {
      // A real LL playlist only enumerates parts inside the hold-back window
      if (seg >= completeSegs - 2) {
        for (let p = 0; p < LL_PARTS_PER_SEG; p++) lines.push(part(seg, p));
      }
      lines.push(`#EXTINF:${LL_SEG_DURATION}.000000,`);
      lines.push(`/ll-seg-${seg}.ts`);
    }

    for (let p = 0; p < partialParts; p++) lines.push(part(completeSegs, p));
    if (completeSegs < LL_TOTAL_SEGS) {
      lines.push(`#EXT-X-PRELOAD-HINT:TYPE=PART,URI="/ll-part-${completeSegs}-${partialParts}.ts"`);
    }

    return lines.join('\n');
  };

    await page.route('**/ll-test.m3u8*', async (r) => {
      // Blocking reload: hold the response until the requested part exists,
      // which is what stops hls.js polling a stale document in a hot loop
      const url = new global.URL(r.request().url());
      // Both params have to be PRESENT: Number(null) is 0, so a plain
      // (non-blocking) playlist fetch would otherwise be counted as a blocking
      // reload and made to wait for part 0 of segment 0
      const msnParam = url.searchParams.get('_HLS_msn');
      const partParam = url.searchParams.get('_HLS_part');
      const msn = Number(msnParam);
      const partIndex = Number(partParam);
      const isBlocking =
        msnParam !== null &&
        partParam !== null &&
        Number.isFinite(msn) &&
        Number.isFinite(partIndex);
      if (isBlocking) {
        counters.blockingReloads++;
        await waitForPart(msn, partIndex);
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/vnd.apple.mpegurl',
        body: llPlaylist(),
      });
    });

    await page.route('**/ll-seg-*.ts', async (r) => {
      const match = /ll-seg-(\d+)\.ts/.exec(r.request().url());
      if (!match) return r.fulfill({ status: 404, body: 'no such segment' });
      counters.segmentRequests++;
      return r.fulfill({
        status: 200,
        contentType: 'video/mp2t',
        body: segBytes(Number(match[1])),
      });
    });

    await page.route('**/ll-part-*.ts', async (r) => {
      const match = /ll-part-(\d+)-(\d+)\.ts/.exec(r.request().url());
      if (!match) return r.fulfill({ status: 404, body: 'no such part' });

      const seg = Number(match[1]);
      const part = Number(match[2]);
      counters.partRequests++;

      // An injected edge blip: the part exists, the origin just fails to
      // serve it. Retries count against the same budget, which is the point.
      if (dropParts > 0) {
        dropParts--;
        counters.dropped++;
        return r.fulfill({ status: 404, body: 'part unavailable' });
      }

      if (!(await waitForPart(seg, part))) {
        return r.fulfill({ status: 404, body: 'part not published' });
      }
      return r.fulfill({
        status: 200,
        contentType: 'video/mp2t',
        body: partBytes(seg, part),
      });
    });

    return {
      counters,
      /**
       * Fail the next `n` part responses with a 404.
       * @param {number} n - How many responses to drop
       */
      dropNextParts: (n) => {
        dropParts = n;
      },
    };
  };

  // --- 8a: the low-latency happy path -------------------------------------
  const { page, collect } = await newTrackedPage();
  const { counters } = await installLlOrigin(page);

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 30000 });
  await page.waitForFunction(
    () => window.player && typeof window.player.load === 'function',
    { timeout: 30000 }
  );
  await page.evaluate(async () => {
    await window.player.load('http://127.0.0.1:8899/ll-test.m3u8').catch(() => {});
    await document.querySelector('video').play().catch(() => {});
  });
  await page.waitForTimeout(8000);

  const live = await page.evaluate(() => {
    const state = window.player.getState();
    const provider = window.player.getPlugin('hls-provider');
    const hls = provider?.getHlsInstance?.();
    return {
      live: state.live,
      lowLatencyMode: state.lowLatencyMode,
      liveLatency: state.liveLatency,
      liveEdge: state.liveEdge,
      seekableRange: state.seekableRange,
      info: provider?.getLiveInfo?.() ?? null,
      catchUpRate: hls?.config?.maxLiveSyncPlaybackRate ?? null,
      paused: document.querySelector('video').paused,
      t: +document.querySelector('video').currentTime.toFixed(2),
    };
  });

  record('LL playlist classified live', live.live === true, JSON.stringify(live.seekableRange));
  record(
    'parts actually requested and served',
    counters.partRequests > 0,
    `${counters.partRequests} part requests`
  );
  record(
    'blocking playlist reloads issued',
    counters.blockingReloads > 0,
    `${counters.blockingReloads} blocking reloads`
  );
  record(
    'lowLatencyMode state reports effective LL',
    live.lowLatencyMode === true,
    String(live.lowLatencyMode)
  );
  record(
    'getLiveInfo reports low latency and the manifest PART-HOLD-BACK',
    live.info?.lowLatency === true && Math.abs((live.info?.targetLatency ?? 0) - 1.5) < 0.6,
    JSON.stringify(live.info)
  );
  record(
    'latency catch-up is enabled (hls.js disables it by default)',
    live.catchUpRate === 1.1,
    String(live.catchUpRate)
  );
  record('LL playback started', !live.paused && live.t > 0, `t=${live.t}`);

  // Drift the viewer back into the DVR window. On the pre-LL tree liveEdge was
  // recomputed every timeupdate as `latency < 10`, so on a 1.5s-target stream
  // this could never flip and "GO LIVE" could never appear.
  await page.evaluate(() => {
    const state = window.player.getState();
    document.querySelector('video').currentTime = state.seekableRange.start + 2;
  });
  await page.waitForTimeout(2500);

  const behind = await page.evaluate(() => {
    const indicator = document.querySelector('.sp-live');
    return {
      liveEdge: window.player.getState().liveEdge,
      liveLatency: +window.player.getState().liveLatency.toFixed(2),
      behindClass: indicator?.classList.contains('sp-live--behind') ?? null,
      label: indicator?.textContent ?? '',
      syncPosition: window.player.getPlugin('hls-provider')?.getLiveInfo?.()?.liveSyncPosition,
      seekableEnd: window.player.getState().seekableRange?.end,
    };
  });

  record(
    'liveEdge flips to behind after drifting back',
    behind.liveEdge === false,
    `latency=${behind.liveLatency}`
  );
  record(
    'the indicator offers GO LIVE',
    behind.behindClass === true && behind.label.includes('GO LIVE'),
    `${behind.label} (behind=${behind.behindClass})`
  );

  // Click it. The target must be the provider's sync position, not the end of
  // the seekable range - which under LL is past the last loaded part.
  await page.evaluate(() => document.querySelector('.sp-live').click());
  await page.waitForTimeout(500);

  const jumped = await page.evaluate(() => ({
    t: +document.querySelector('video').currentTime.toFixed(2),
    seekableEnd: window.player.getState().seekableRange?.end,
  }));

  record(
    'GO LIVE lands at the live sync position, not past the edge',
    behind.syncPosition !== undefined &&
      Math.abs(jumped.t - behind.syncPosition) < 1.5 &&
      jumped.t <= (behind.seekableEnd ?? Infinity) + 0.1,
    JSON.stringify({ landed: jumped.t, sync: behind.syncPosition, end: behind.seekableEnd })
  );

  // ...and it must not stall there, which is the whole point of preferring
  // the sync position over seekableRange.end.
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => {
    const overlay = document.querySelector('.sp-error-overlay');
    return {
      paused: document.querySelector('video').paused,
      t: +document.querySelector('video').currentTime.toFixed(2),
      overlay: overlay?.classList.contains('sp-error-overlay--visible') ?? false,
    };
  });

  record(
    'playback continues after GO LIVE (no stall at the edge)',
    !after.paused && after.t > jumped.t && after.overlay === false,
    JSON.stringify(after)
  );

  // Waited for rather than sampled: a round trip to the back of the DVR window
  // and out again costs a rebuffer, so the position is still catching up for a
  // few seconds after the seek. What the edge threshold has to get right is
  // that it reports the edge once the player is actually there.
  const backAtEdge = await page
    .waitForFunction(() => window.player.getState().liveEdge === true, { timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  const settled = await page.evaluate(() => ({
    liveEdge: window.player.getState().liveEdge,
    liveLatency: +window.player.getState().liveLatency.toFixed(2),
    rate: document.querySelector('video').playbackRate,
  }));

  record('back at the live edge after GO LIVE', backAtEdge, JSON.stringify(settled));
  // The DVR seek above left the part window, so the whole segments the
  // playlist advertises had to be fetched and decoded. That is what proves the
  // synthesised parents really are their four parts concatenated.
  record(
    'the DVR seek played the parent segments',
    counters.segmentRequests > 0,
    `${counters.segmentRequests} parent segment requests`
  );

  const errs = await collect();
  record(
    'zero uncaught errors across the LL session',
    errs.pageErrors.length === 0,
    errs.pageErrors.slice(0, 3).join(' | ')
  );
  record(
    'zero unhandled rejections across the LL session',
    errs.rejections.length === 0,
    errs.rejections.slice(0, 3).join(' | ')
  );

  await page.close();

  // --- 8b: a part blip at the edge must not look like an outage -----------
  //
  // LL-HLS requests parts at 4x the segment rate and the part at the very edge
  // is the one most likely to miss, so the question this answers is whether a
  // routine miss can reach the viewer as an outage: a fatal error, the
  // reconnect overlay, or a stall.
  //
  // It cannot, and notably it is not the hls.js retry budget that saves it,
  // nor a fallback to the parent segment (hls.js requests none: measured).
  // A single 404 punches a `fragGap` whatever `fragLoadingMaxRetry` is set to
  // (hls.js counts fragment errors cumulatively per level, so a bigger budget
  // only delays the level switch) - measured both ways while writing this.
  // What holds is the gap handling underneath: playback rides over it, no
  // error is emitted, and the viewer sees nothing. That is the invariant.
  {
    const { page: blipPage, collect: blipCollect } = await newTrackedPage();
    const { counters: blipCounters, dropNextParts } = await installLlOrigin(blipPage);

    let sawReconnecting = false;
    let sawOverlay = false;
    const watchOverlay = setInterval(() => {
      blipPage
        .evaluate(() => {
          const overlay = document.querySelector('.sp-error-overlay');
          return {
            visible: overlay?.classList.contains('sp-error-overlay--visible') ?? false,
            reconnecting: overlay?.classList.contains('sp-error-overlay--reconnecting') ?? false,
          };
        })
        .then((s) => {
          sawOverlay = sawOverlay || s.visible;
          sawReconnecting = sawReconnecting || s.reconnecting;
        })
        .catch(() => {});
    }, 250);

    await blipPage.goto(URL, { waitUntil: 'domcontentloaded' });
    await blipPage.waitForSelector('video', { timeout: 30000 });
    await blipPage.waitForFunction(
      () => window.player && typeof window.player.load === 'function',
      { timeout: 30000 }
    );
    await blipPage.evaluate(async () => {
      await window.player.load('http://127.0.0.1:8899/ll-test.m3u8').catch(() => {});
      await document.querySelector('video').play().catch(() => {});
    });
    await blipPage.waitForTimeout(6000);

    const beforeBlip = await blipPage.evaluate(() => ({
      t: +document.querySelector('video').currentTime.toFixed(2),
      paused: document.querySelector('video').paused,
    }));
    record(
      'LL playing before the part blip',
      !beforeBlip.paused && beforeBlip.t > 0,
      `t=${beforeBlip.t}`
    );

    dropNextParts(3);
    await blipPage.waitForTimeout(9000);
    clearInterval(watchOverlay);

    const afterBlip = await blipPage.evaluate(() => ({
      t: +document.querySelector('video').currentTime.toFixed(2),
      paused: document.querySelector('video').paused,
      liveLatency: +window.player.getState().liveLatency.toFixed(2),
      errorCode: window.player.getState().error?.code ?? null,
    }));

    record(
      'part 404s at the edge were actually injected',
      blipCounters.dropped === 3,
      `${blipCounters.dropped} dropped of ${blipCounters.partRequests} part requests`
    );
    record(
      'the blip never surfaced as an error to the viewer',
      !sawOverlay && !sawReconnecting && afterBlip.errorCode === null,
      JSON.stringify({ sawOverlay, sawReconnecting, errorCode: afterBlip.errorCode })
    );
    record(
      'playback rode straight through the part blip',
      !afterBlip.paused && afterBlip.t > beforeBlip.t,
      JSON.stringify(afterBlip)
    );

    const blipErrs = await blipCollect();
    record(
      'zero uncaught errors across the part blip',
      blipErrs.pageErrors.length === 0,
      blipErrs.pageErrors.slice(0, 3).join(' | ')
    );

    await blipPage.close();
  }
}

// ============================================================ SUMMARY
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exitCode = 1;
}
await browser.close();
