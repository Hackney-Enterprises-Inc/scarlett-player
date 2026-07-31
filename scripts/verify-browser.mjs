/**
 * Browser verification harness for Scarlett Player failure handling.
 *
 * Drives the built demo bundle in headless Chrome and asserts the
 * viewer-facing failure behaviors that jsdom cannot test:
 *
 *   1. Manifest 404 on initial load -> bounded failure, accurate message,
 *      structured error state, init() resolves, Try Again recovers.
 *   2. Mid-playback network outage -> reconnecting overlay, then automatic
 *      recovery with zero interaction and VOD position preserved.
 *   3. First-click-on-play regression (idempotent control rendering).
 *
 * Usage:
 *   pnpm build && node demo/build.cjs
 *   python3 -m http.server 8899 --bind 127.0.0.1   # from repo root
 *   npx -y playwright@latest node scripts/verify-browser.mjs   # or: node scripts/verify-browser.mjs
 *
 * Requires the `playwright` package to be importable and a local Chrome
 * (launched via channel: 'chrome'). Exits non-zero on any failed assertion.
 *
 * NOTE: uses the live demo stream (vod.thestreamplatform.com). To move this
 * into CI, swap in a local HLS fixture first.
 */
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:8899/demo/index.html';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
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

// ============================================================ SUMMARY
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exitCode = 1;
}
await browser.close();
