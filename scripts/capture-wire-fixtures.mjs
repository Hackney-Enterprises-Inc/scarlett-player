/**
 * Wire-fixture capture harness (SCAR-TOOL-5).
 *
 * Records the exact HTTP requests the REAL analytics and clips transports
 * send - bodies, headers, query strings - from headless Chromium, checks them
 * against the wire contract the Laravel package (hei/laravel-scarlett-player)
 * builds against, and writes one JSON file per (event, transport, variant).
 * Those files are the package's test fixtures; they belong to the package, not
 * to this repo. Plan: .docs/plans/wire-fixtures-and-embed-attributes.md, Part A.
 *
 * Runtime shape, all on 127.0.0.1 and ephemeral ports:
 *
 *   - Page origin, plain HTTP: serves the repo root (the HLS fixture, the page
 *     under scripts/wire-capture/), the page bundle from the run's temp
 *     directory at /__wire/page.js, and POST /api/scarlett/clips as the
 *     same-origin clips recorder. The first submission for a clientRequestId
 *     answers 500 and the second 202, which yields a genuine retry fixture.
 *   - Beacon origin, HTTPS with a certificate generated at run time by
 *     openssl: the analytics recorder. HTTPS is not optional. The plugin
 *     attaches X-API-Key (fetch) and ?api_key= (unload sendBeacon) ONLY to an
 *     https beaconUrl, so a plain-HTTP recorder would produce fixtures with no
 *     key at all. It answers the preflight with the exact page origin and
 *     Access-Control-Allow-Credentials: true, without which the credentialed
 *     unload sendBeacon is silently dropped.
 *
 * Scenarios, each in a fresh browser context (fresh viewId, viewerId and
 * session): full session, unload, destroy, fatal error, clip create + retry,
 * and a live stream abandoned by navigation (the latency summary keys).
 * The assertions below run before anything is written; a failure exits
 * non-zero and writes nothing, because a fixture set that contradicts the
 * contract is worse than none.
 *
 * Usage:
 *   node scripts/capture-wire-fixtures.mjs [--out=<dir>] [--smoke] [--batch]
 *
 *   --out    Output directory. Default:
 *            ../packages/laravel-scarlett-player/tests/Fixtures/wire/<version>/
 *            resolved from the repo root, <version> being the analytics
 *            package's own. Refuses an existing directory: captures are
 *            versioned evidence, never replaced in place.
 *   --smoke  Write to a temp directory instead, print the manifest, exit.
 *            What CI runs on a push to main.
 *   --batch  Also capture the opt-in batch envelope against the local recorder.
 *            Laravel v0.3.0 rejects batches; this is NOT an ingest test.
 *
 *   WIRE_DEBUG=1 in the environment also lists every request received.
 *
 * Requires Playwright's bundled Chromium (`npx playwright install chromium`),
 * ffmpeg on PATH (scripts/hls-fixture.mjs generates the local playlist) and
 * openssl on PATH (the beacon origin's certificate). Starts its own servers;
 * no :8899 server is needed. Nothing is written into the repo except the
 * gitignored HLS fixture under scripts/fixtures/hls/.
 */

import { Buffer } from 'node:buffer';
import { spawnSync, execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { ensureHlsFixture } from './hls-fixture.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireFromRoot = createRequire(join(REPO_ROOT, 'package.json'));

/** Every payload's playerVersion must equal this; it also names the output directory. */
const PLAYER_VERSION = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages/plugins/analytics/package.json'), 'utf8')
).version;

const API_KEY = 'wire-capture-key';
const WIRE_TOKEN = 'per-beacon';
const CSRF_TOKEN = 'wire-csrf-token';
const CUSTOM_DIMENSIONS = { tenant: 'wire', planTier: 'free', experiment: 42, beta: true };

/** Present on the ended viewEnd; absent from the unload viewEnd (the plan's two-variant table). */
const VIEW_END_SHARED = ['watchTime', 'playTime', 'startupTime', 'rebufferCount', 'rebufferDuration', 'avgBitrate', 'maxBitrate', 'exitType'];
const VIEW_END_FETCH_ONLY = ['qoeScore', 'rebufferRatio', 'qualityChanges', 'pauseCount', 'pauseDuration', 'seekCount', 'errorCount', 'completionRate'];

/** Every live heartbeat and live viewEnd carries these; no VOD beacon carries any. */
const LATENCY_KEYS = ['liveLatencySamples', 'liveLatencyMean', 'liveLatencyP95', 'liveLatencyMax', 'lowLatency'];

/** Headers that describe the connection, not the request; dropped from fixtures. */
const HOP_BY_HOP = new Set(['host', 'connection', 'content-length']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.json': 'application/json',
};

// ---------------------------------------------------------------------------
// CLI and prerequisites
// ---------------------------------------------------------------------------

/**
 * Parse the command line.
 *
 * @param {string[]} argv - Arguments after the script path
 * @returns {{ out: string, smoke: boolean, batch: boolean }}
 * @throws {Error} On an unknown flag
 */
function parseArgs(argv) {
  const opts = {
    out: resolve(REPO_ROOT, '..', 'packages/laravel-scarlett-player/tests/Fixtures/wire', PLAYER_VERSION),
    smoke: false,
    batch: false,
  };
  for (const arg of argv) {
    if (arg === '--smoke') opts.smoke = true;
    else if (arg === '--batch') opts.batch = true;
    else if (arg.startsWith('--out=')) opts.out = resolve(process.cwd(), arg.slice('--out='.length));
    else throw new Error(`Unknown argument ${arg}. Usage: node scripts/capture-wire-fixtures.mjs [--out=<dir>] [--smoke] [--batch]`);
  }
  return opts;
}

/**
 * Fail early, with what to install, when a tool the run needs is missing.
 *
 * @returns {Promise<import('playwright').BrowserType>} Playwright's chromium
 * @throws {Error} Naming the missing prerequisite and how to install it
 */
async function checkPrerequisites() {
  for (const [tool, args, hint] of [
    ['ffmpeg', ['-version'], 'macOS: `brew install ffmpeg`, Debian/Ubuntu: `apt-get install -y ffmpeg`'],
    ['openssl', ['version'], 'macOS: `brew install openssl`, Debian/Ubuntu: `apt-get install -y openssl`'],
  ]) {
    if (spawnSync(tool, args, { stdio: 'ignore' }).error) {
      throw new Error(`${tool} is not on PATH. Install it (${hint}) and re-run.`);
    }
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('The `playwright` package is not importable. Run `pnpm install` at the repo root.');
  }
  if (!existsSync(chromium.executablePath())) {
    throw new Error("Playwright's Chromium is not installed. Run `npx playwright install chromium` and re-run.");
  }
  return chromium;
}

// ---------------------------------------------------------------------------
// Build: certificate and page bundle, both into the run's temp directory
// ---------------------------------------------------------------------------

/**
 * Generate a throwaway self-signed certificate for https://127.0.0.1.
 *
 * @param {string} dir - Temp directory to write key.pem and cert.pem into
 * @returns {{ key: Buffer, cert: Buffer }}
 */
function makeCertificate(dir) {
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', keyPath, '-out', certPath,
    '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1',
  ], { stdio: 'ignore' });
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

/**
 * Bundle scripts/wire-capture/page.ts against the package sources.
 *
 * The demo's alias recipe (demo/build.cjs PACKAGE_ALIASES), but with
 * `__PKG_VERSION__` defined: every package's version.ts reads that, and the
 * demo's `__VERSION__` define would leave playerVersion at '0.0.0-dev'. One
 * value serves all of them because the fixed Changesets group keeps every
 * package at the same version. `ui` is aliased only so clips' dynamic
 * `import('@scarlett-player/ui')` resolves at bundle time; with `ui: 'none'`
 * it never runs.
 *
 * @param {string} outfile - Where to write the IIFE bundle
 * @returns {Promise<void>}
 */
async function bundlePage(outfile) {
  const esbuild = requireFromRoot('esbuild');
  const alias = Object.fromEntries(
    [
      ['core', 'packages/core/src/index.ts'],
      ['hls', 'packages/plugins/hls/src/index.ts'],
      ['analytics', 'packages/plugins/analytics/src/index.ts'],
      ['clips', 'packages/plugins/clips/src/index.ts'],
      ['ui', 'packages/plugins/ui/src/index.ts'],
      ['native', 'packages/plugins/native/src/index.ts'],
    ].map(([name, rel]) => [`@scarlett-player/${name}`, join(REPO_ROOT, rel)])
  );
  await esbuild.build({
    entryPoints: [join(REPO_ROOT, 'scripts/wire-capture/page.ts')],
    bundle: true,
    outfile,
    format: 'iife',
    target: 'es2020',
    sourcemap: false,
    minify: false,
    logLevel: 'warning',
    alias,
    define: {
      'process.env.NODE_ENV': '"production"',
      __PKG_VERSION__: JSON.stringify(PLAYER_VERSION),
    },
  });
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

/**
 * A one-variant master playlist over the fixture's media playlist.
 *
 * scripts/fixtures/hls/vod.m3u8 is a media playlist, so hls.js would build
 * its one level with no bitrate or resolution and the qualityChange fixture
 * would carry zeros. Declaring them here gives that fixture the shape a real
 * ladder produces without touching the shared fixture generator.
 */
const MASTER_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-STREAM-INF:BANDWIDTH=264000,RESOLUTION=320x180',
  '/scripts/fixtures/hls/vod.m3u8',
  '',
].join('\n');

/** Segments in the fixture's vod.m3u8, 2 s each. */
const LIVE_SEGMENTS = 30;
const LIVE_SEGMENT_SECONDS = 2;
/** Segments in the sliding window, and how far into the stream a viewer joins. */
const LIVE_WINDOW = 6;
const LIVE_PRIME_SECONDS = 12;

/** The live origin's clock: set by the first playlist request of each run of scenarioLive. */
const liveClock = { startedAt: null };

/**
 * A rolling live media playlist over the fixture's 2 s segments.
 *
 * No ENDLIST, a sliding window and a media sequence that advances with the
 * clock, so hls.js classifies it live and the HLS plugin emits `live:latency`.
 * Standard latency, not LL: the wire question is which keys a live beacon
 * carries, and `lowLatency: false` is as much a fixture as `true` would be.
 * Served by the page server rather than a Playwright route (see segmentHold).
 *
 * @returns {string} The playlist as of now
 */
function livePlaylist() {
  liveClock.startedAt ??= Date.now();
  const elapsed = LIVE_PRIME_SECONDS + (Date.now() - liveClock.startedAt) / 1000;
  const published = Math.min(LIVE_SEGMENTS, Math.floor(elapsed / LIVE_SEGMENT_SECONDS));
  const first = Math.max(0, published - LIVE_WINDOW);
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${LIVE_SEGMENT_SECONDS}`,
    `#EXT-X-MEDIA-SEQUENCE:${first}`,
  ];
  for (let i = first; i < published; i++) {
    lines.push(`#EXTINF:${LIVE_SEGMENT_SECONDS.toFixed(6)},`, `/scripts/fixtures/hls/seg${i}.ts`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Segment responses parked while the runner starves the buffer.
 *
 * Held in the server rather than with Playwright's page.route: installing
 * ANY route turns on request interception, and with it Playwright answers
 * CORS preflights itself, so the beacon recorder never sees an OPTIONS and
 * the unload sendBeacon never arrives (measured 2026-09-27).
 */
const segmentHold = {
  active: false,
  /** @type {Array<() => void>} */
  parked: [],
  start() {
    this.active = true;
  },
  release() {
    this.active = false;
    this.parked.splice(0).forEach((resume) => resume());
  },
};

/** Everything either recorder received, in arrival order. */
const records = [];

/** Which scenario the runner is driving; stamped on every record. */
let currentScenario = null;

/**
 * Read a request body to a string.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Snapshot a request the way a fixture stores it.
 *
 * Headers are lower-cased (Node already does) and kept in full except the
 * hop-by-hop ones. A JSON body is parsed; anything else is kept as text.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {string} rawBody
 * @param {'beacon'|'page'} origin - Which recorder received it
 * @returns {object} The record, also pushed onto `records`
 */
function record(req, rawBody, origin) {
  const url = new URL(req.url, 'http://placeholder');
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(name)) headers[name] = value;
  }
  let body = rawBody === '' ? null : rawBody;
  if (rawBody !== '' && (headers['content-type'] ?? '').includes('application/json')) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Kept as text; the assertions will flag a beacon that is not JSON
    }
  }
  const entry = {
    origin,
    scenario: currentScenario,
    receivedAt: new Date().toISOString(),
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers,
    body,
  };
  records.push(entry);
  return entry;
}

/**
 * Start the HTTPS beacon recorder.
 *
 * @param {{ key: Buffer, cert: Buffer }} tls
 * @param {() => string} pageOrigin - Resolved per request; the page server starts second
 * @returns {Promise<{ server: import('node:https').Server, origin: string }>}
 */
async function startBeaconServer(tls, pageOrigin) {
  const server = createHttpsServer(tls, async (req, res) => {
    const raw = await readBody(req);
    record(req, raw, 'beacon');
    // The EXACT origin, never '*': the unload sendBeacon is credentialed, and
    // a wildcard with credentials fails CORS and the beacon is lost silently.
    res.setHeader('Access-Control-Allow-Origin', pageOrigin());
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Wire-Token');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    res.writeHead(204);
    res.end();
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, origin: `https://127.0.0.1:${server.address().port}` };
}

/**
 * Start the page origin: static repo root, the bundle, and the clips recorder.
 *
 * @param {string} bundlePath - The page bundle in the temp directory
 * @returns {Promise<{ server: import('node:http').Server, origin: string }>}
 */
async function startPageServer(bundlePath, nativePath) {
  /** Attempts per clientRequestId: the first fails, the rest succeed. */
  const clipAttempts = new Map();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://placeholder');

    if (url.pathname === '/api/scarlett/clips') {
      const raw = await readBody(req);
      const entry = record(req, raw, 'page');
      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end();
        return;
      }
      const key = entry.body?.clientRequestId ?? '';
      const attempt = (clipAttempts.get(key) ?? 0) + 1;
      clipAttempts.set(key, attempt);
      entry.status = attempt === 1 ? 500 : 202;
      res.writeHead(entry.status, { 'Content-Type': 'application/json' });
      if (attempt === 1) {
        res.end(JSON.stringify({ message: 'Simulated failure' }));
      } else {
        const uuid = randomUUID();
        res.end(JSON.stringify({ uuid, statusUrl: `/api/scarlett/clips/${uuid}` }));
      }
      return;
    }

    if (url.pathname === '/__wire/master.m3u8') {
      res.writeHead(200, { 'Content-Type': MIME['.m3u8'], 'Cache-Control': 'no-store' });
      res.end(MASTER_PLAYLIST);
      return;
    }

    if (url.pathname === '/__wire/live.m3u8') {
      res.writeHead(200, { 'Content-Type': MIME['.m3u8'], 'Cache-Control': 'no-store' });
      res.end(livePlaylist());
      return;
    }

    if (segmentHold.active && /^\/scripts\/fixtures\/hls\/seg\d+\.ts$/.test(url.pathname)) {
      await new Promise((resume) => segmentHold.parked.push(resume));
    }

    const file =
      url.pathname === '/__wire/page.js'
        ? bundlePath
        : url.pathname === '/__wire/native.mp4'
          ? nativePath
        : resolve(REPO_ROOT, `.${decodeURIComponent(url.pathname)}`);
    if (file !== bundlePath && file !== nativePath && !file.startsWith(REPO_ROOT + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

// ---------------------------------------------------------------------------
// Scenario helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Poll until `predicate` is truthy.
 *
 * @param {() => unknown | Promise<unknown>} predicate
 * @param {number} timeoutMs
 * @param {string} label - What was awaited, for the timeout message
 * @returns {Promise<unknown>} The truthy value
 * @throws {Error} On timeout
 */
async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
    await sleep(100);
  }
}

/** Any request the page tried to make off 127.0.0.1. */
const externalRequests = [];

/** Beacon POSTs of one scenario, in arrival order. */
const beaconsOf = (scenario) =>
  records.filter((r) => r.origin === 'beacon' && r.method === 'POST' && r.scenario === scenario);

/** The wire event name a beacon carries. */
const eventOf = (r) => (r.body && typeof r.body === 'object' ? r.body.event : undefined);

/**
 * The transport a beacon arrived on.
 *
 * sendBeacon cannot set headers, so an unload beacon is the one POST that
 * has the key in its query and no X-API-Key header.
 */
const transportOf = (r) => (!r.headers['x-api-key'] && r.query.api_key !== undefined ? 'sendBeacon' : 'fetch');

/**
 * Open the page in a fresh context and wait for the player.
 *
 * @param {import('playwright').Browser} browser
 * @param {string} pageOrigin
 * @param {string} beaconOrigin
 * @param {string} [src] - Playlist path; the page defaults to the fixture
 * @param {'vod'|'live'} [video] - Which videoId/videoTitle the beacons carry
 * @param {string} [mode] - Additional capture mode (privacy, native or batch)
 * @returns {Promise<{ context: import('playwright').BrowserContext, page: import('playwright').Page, pageErrors: string[] }>}
 */
async function openPlayer(browser, pageOrigin, beaconOrigin, src, video = 'vod', mode) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  // Nothing may leave 127.0.0.1, as in verify-browser.mjs, but enforced by
  // the launch's --host-resolver-rules rather than a route (see
  // segmentHold for why no route may be installed). Every request is still
  // checked here, so an external one fails the run instead of passing quietly.
  context.on('request', (request) => {
    const { hostname } = new URL(request.url());
    if (/^https?:/.test(request.url()) && hostname !== '127.0.0.1') externalRequests.push(request.url());
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const query = new URLSearchParams({ beacon: beaconOrigin, src: src ?? '/__wire/master.m3u8', video });
  if (mode) query.set(mode, '1');
  await page.goto(`${pageOrigin}/scripts/wire-capture/index.html?${query}`);
  await page.waitForFunction(() => window.wire !== undefined);
  const initError = await page.evaluate(async () => {
    await window.wire.ready;
    return window.wire.initError;
  });
  if (initError) throw new Error(`createPlayer rejected: ${initError}`);
  return { context, page, pageErrors };
}

/** Start playback through core, the way a host's own play button would. */
const play = (page) => page.evaluate(() => window.wire.player.play());

/** Wait until the element is actually playing past `minTime`. */
const waitPlaying = (page, minTime = 0.5, timeoutMs = 15000) =>
  waitFor(
    () =>
      page.evaluate((t) => {
        const s = window.wire.player.getState();
        return s.playing && s.currentTime >= t;
      }, minTime),
    timeoutMs,
    `playback past ${minTime}s`
  );

/**
 * Seek and wait for the seek to settle.
 *
 * @param {import('playwright').Page} page
 * @param {number} time
 */
async function seekTo(page, time) {
  await page.evaluate((t) => window.wire.player.seek(t), time);
  await waitFor(
    () =>
      page.evaluate((t) => {
        const s = window.wire.player.getState();
        return !s.seeking && Math.abs(s.currentTime - t) < 2.5;
      }, time),
    15000,
    `seek to ${time}s`
  );
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * Scenario 1: a full session that ends on `ended`.
 *
 * @returns {Promise<{ notes: object }>} What the page reported for the tripwire and rebuffer
 */
async function scenarioFullSession(browser, pageOrigin, beaconOrigin) {
  const { context, page, pageErrors } = await openPlayer(browser, pageOrigin, beaconOrigin);
  const notes = { pageErrors };
  try {
    await play(page);
    await waitPlaying(page);
    await waitFor(
      () => beaconsOf('full-session').filter((r) => eventOf(r) === 'heartbeat').length >= 3,
      15000,
      'three heartbeats'
    );

    await seekTo(page, 20);
    await waitPlaying(page, 20.5);
    await page.evaluate(() => window.wire.player.pause());
    await sleep(1200);
    await play(page);
    await waitPlaying(page, 21.5);

    // Starve the buffer: park every segment response until a NEW
    // rebufferStart arrives (or 12 s pass), then release them. The page's hls
    // config keeps only ~4 s ahead, so parked segments run playback dry
    // within seconds. Counted from here because a rebufferStart can already
    // exist: before 1.18 analytics took core's playback:play for the first
    // frame and counted the startup buffering as a rebuffer.
    const rebuffersBefore = beaconsOf('full-session').filter((r) => eventOf(r) === 'rebufferStart').length;
    notes.startupRebuffer = rebuffersBefore > 0;
    segmentHold.start();
    try {
      await waitFor(
        () => beaconsOf('full-session').filter((r) => eventOf(r) === 'rebufferStart').length > rebuffersBefore,
        12000,
        'rebufferStart'
      );
      notes.rebuffer = 'stalled';
    } catch {
      notes.rebuffer = 'no stall: the buffer rode out 12 s of held segments';
    } finally {
      segmentHold.release();
    }
    if (notes.rebuffer === 'stalled') {
      await waitFor(
        () => beaconsOf('full-session').filter((r) => eventOf(r) === 'rebufferEnd').length > rebuffersBefore,
        15000,
        'rebufferEnd'
      ).catch(() => {
        notes.rebuffer = 'stalled, but playback did not resume within 15 s';
      });
    }

    await page.evaluate(() =>
      window.wire.analytics.trackEvent('wireCustom', { chapter: 'intro', score: 7, flagged: false })
    );

    const duration = await page.evaluate(() => window.wire.player.getState().duration);
    await page.evaluate((t) => window.wire.player.seek(t), duration - 1.5);
    await waitFor(
      () => beaconsOf('full-session').some((r) => eventOf(r) === 'viewEnd'),
      20000,
      'viewEnd on ended'
    );
    await sleep(500);

    Object.assign(
      notes,
      await page.evaluate(() => ({
        qualityChangeCount: window.wire.qualityChangeCount,
        qualityChanges: window.wire.qualityChanges,
        qualities: window.wire.player.getQualities().map(({ id, bitrate, width, height }) => ({ id, bitrate, width, height })),
        segments: window.wire.segments,
      }))
    );
  } finally {
    await context.close();
  }
  return { notes };
}

/** Scenario 2: the viewer navigates away mid-playback. */
async function scenarioUnload(browser, pageOrigin, beaconOrigin) {
  const { context, page, pageErrors } = await openPlayer(browser, pageOrigin, beaconOrigin);
  try {
    await play(page);
    await waitPlaying(page);
    await sleep(3000);
    await page.goto('about:blank');
    // The unload beacon (and its preflight) leave after the page is gone
    await sleep(2000);
  } finally {
    await context.close();
  }
  return { notes: { pageErrors } };
}

/** Scenario 3: the host destroys the player mid-playback. */
async function scenarioDestroy(browser, pageOrigin, beaconOrigin) {
  const { context, page, pageErrors } = await openPlayer(browser, pageOrigin, beaconOrigin);
  try {
    await play(page);
    await waitPlaying(page);
    await sleep(3000);
    await page.evaluate(() => window.wire.player.destroy());
    await waitFor(
      () => beaconsOf('destroy').some((r) => eventOf(r) === 'viewEnd'),
      5000,
      'viewEnd on destroy'
    );
  } finally {
    await context.close();
  }
  return { notes: { pageErrors } };
}

/** Scenario 4: the playlist 404s and playback fails fatally. */
async function scenarioError(browser, pageOrigin, beaconOrigin) {
  const { context, page, pageErrors } = await openPlayer(
    browser,
    pageOrigin,
    beaconOrigin,
    '/scripts/fixtures/hls/missing.m3u8'
  );
  const notes = { pageErrors };
  try {
    await play(page).catch(() => {});
    // Wait for the fatal on the BUS first, so a missing beacon is reported as
    // what it is (the bus carried an error analytics did not send) rather
    // than as a timeout.
    await waitFor(
      () => page.evaluate(() => window.wire.busErrors.some((e) => e.fatal)),
      45000,
      'a fatal error on the player bus'
    );
    notes.busErrors = await page.evaluate(() => window.wire.busErrors);
    await waitFor(
      () => beaconsOf('error').some((r) => eventOf(r) === 'error' && r.body.fatal === true),
      3000,
      'a fatal error beacon'
    ).catch(() => {});
    // A fatal error is followed by a viewEnd when the plugin sends one
    await sleep(1500);
  } finally {
    await context.close();
  }
  return { notes };
}

/** Scenario 5: a clip whose first submission fails and whose retry succeeds. */
async function scenarioClip(browser, pageOrigin, beaconOrigin) {
  const { context, page, pageErrors } = await openPlayer(browser, pageOrigin, beaconOrigin);
  const notes = { pageErrors };
  try {
    await play(page);
    await waitPlaying(page);
    notes.afterFailure = await page.evaluate(async () => {
      const { clips } = window.wire;
      clips.open();
      clips.setRange(10, 25);
      clips.setTitle('The knockout');
      await clips.commit();
      return { open: clips.isOpen() };
    });
    notes.afterRetry = await page.evaluate(async () => {
      const { clips } = window.wire;
      await clips.commit();
      return { open: clips.isOpen() };
    });
  } finally {
    await context.close();
  }
  return { notes };
}

/**
 * Scenario 6: a live stream the viewer abandons by navigating away.
 *
 * Yields the live heartbeat and the live unload viewEnd, the two beacons that
 * carry the latency summary. Navigates to about:blank like scenario 2.
 */
async function scenarioLive(browser, pageOrigin, beaconOrigin) {
  liveClock.startedAt = null;
  const { context, page, pageErrors } = await openPlayer(browser, pageOrigin, beaconOrigin, '/__wire/live.m3u8', 'live');
  const notes = { pageErrors };
  try {
    await play(page);
    await waitPlaying(page);
    await waitFor(
      () =>
        beaconsOf('live').filter((r) => eventOf(r) === 'heartbeat' && r.body.liveLatencySamples > 0).length >= 2,
      15000,
      'two heartbeats with latency readings'
    );
    notes.state = await page.evaluate(() => {
      const s = window.wire.player.getState();
      return { live: s.live, liveLatency: s.liveLatency, lowLatencyMode: s.lowLatencyMode };
    });
    await page.goto('about:blank');
    await sleep(2000);
  } finally {
    await context.close();
  }
  return { notes };
}

/** Anonymous view context and a dropped event, through the real transport. */
async function scenarioPrivacy(browser, pageOrigin, beaconOrigin) {
  const { context, page, pageErrors } = await openPlayer(browser, pageOrigin, beaconOrigin, undefined, 'vod', 'privacy');
  try {
    await page.evaluate(() => {
      window.wire.analytics.trackEvent('wireDropped');
      window.wire.analytics.trackEvent('wirePrivacy', { source: 'harness' });
    });
    await waitFor(() => beaconsOf('privacy').some((r) => eventOf(r) === 'custom:wirePrivacy'), 5000, 'privacy custom event');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
      window.wire.analytics.trackEvent('wireDntSuppressed');
    });
    await sleep(200);
  } finally {
    await context.close();
  }
  return { notes: { pageErrors } };
}

/** Native MP4 has no provider-level media:segment event or fabricated measurements. */
async function scenarioNative(browser, pageOrigin, beaconOrigin) {
  const { context, page, pageErrors } = await openPlayer(browser, pageOrigin, beaconOrigin, '/__wire/native.mp4', 'vod', 'native');
  let segments = [];
  try {
    await play(page);
    await waitPlaying(page, 0.2);
    await waitFor(() => beaconsOf('native').some((r) => eventOf(r) === 'heartbeat'), 5000, 'native heartbeat');
    segments = await page.evaluate(() => window.wire.segments);
  } finally {
    await context.close();
  }
  return { notes: { pageErrors, segments } };
}

/** Opt-in batch envelope, recorded only when --batch was requested. */
async function scenarioBatch(browser, pageOrigin, beaconOrigin) {
  const { context, page, pageErrors } = await openPlayer(browser, pageOrigin, beaconOrigin, undefined, 'vod', 'batch');
  try {
    await page.evaluate(() => window.wire.analytics.trackEvent('wireBatch', { source: 'harness' }));
    await page.evaluate(() => window.wire.player.destroy());
    await waitFor(() => beaconsOf('batch').some((r) => r.body?.batch === 1), 5000, 'batch POST');
  } finally {
    await context.close();
  }
  return { notes: { pageErrors } };
}

const SCENARIOS = [
  ['full-session', scenarioFullSession],
  ['unload', scenarioUnload],
  ['destroy', scenarioDestroy],
  ['error', scenarioError],
  ['clip', scenarioClip],
  ['live', scenarioLive],
  ['privacy', scenarioPrivacy],
  ['native', scenarioNative],
];

// ---------------------------------------------------------------------------
// Fixture selection
// ---------------------------------------------------------------------------

/** A wire event name as a file-name part: `custom:wireCustom` -> `custom-wireCustom`. */
const fileSafe = (event) => event.replace(/[^A-Za-z0-9_-]/g, '-');

/**
 * Pick the fixtures out of the records.
 *
 * @returns {{ fixtures: Map<string, { meta: object, record: object }>, absent: Array<{ file: string, reason: string }> }}
 */
function selectFixtures(scenarioNotes, includeBatch) {
  const fixtures = new Map();
  const absent = [];

  const put = (file, rec, meta) => {
    if (rec) fixtures.set(file, { meta, record: rec });
  };
  const beaconFixture = (scenario, event, { pick = 'first', variant, required = true, reason } = {}) => {
    const matches = beaconsOf(scenario).filter((r) => eventOf(r) === event);
    const rec = pick === 'last' ? matches.at(-1) : matches[0];
    const transport = rec ? transportOf(rec) : variant === 'unload' ? 'sendBeacon' : 'fetch';
    const file = `${fileSafe(event)}.${transport}${variant ? `.${variant}` : ''}.json`;
    if (rec) put(file, rec, { event, transport, variant: variant ?? null, scenario });
    else absent.push({ file, required, reason: reason ?? `no ${event} beacon arrived in scenario ${scenario}` });
  };

  // Scenario 1
  for (const event of ['viewStart', 'playRequest', 'videoStart', 'seeking', 'pause', 'qualityChange', 'custom:wireCustom']) {
    beaconFixture('full-session', event);
  }
  beaconFixture('full-session', 'heartbeat', { pick: 'last' });
  for (const event of ['rebufferStart', 'rebufferEnd']) {
    // The last: before 1.18 the first could be the startup buffering, which
    // analytics counted as a rebuffer (see scenarioFullSession).
    beaconFixture('full-session', event, {
      pick: 'last',
      required: false,
      reason: `best effort: ${scenarioNotes['full-session']?.rebuffer ?? 'scenario did not run'}`,
    });
  }
  beaconFixture('full-session', 'viewEnd', { variant: 'ended' });
  const preflight = records.find(
    (r) => r.origin === 'beacon' && r.method === 'OPTIONS' && r.scenario === 'full-session'
  );
  if (preflight) put('preflight.options.json', preflight, { event: null, transport: 'preflight', variant: null, scenario: 'full-session' });
  else absent.push({ file: 'preflight.options.json', required: true, reason: 'no preflight arrived in scenario full-session' });

  // Scenarios 2-4
  beaconFixture('unload', 'viewEnd', { variant: 'unload' });
  beaconFixture('destroy', 'viewEnd', { variant: 'destroy' });
  const busErrors = scenarioNotes.error?.busErrors ?? [];
  beaconFixture('error', 'error', {
    reason: busErrors.length
      ? `the bus carried ${busErrors.length} error event(s) (${busErrors
          .map((e) => `${e.code} fatal=${e.fatal} instanceof Error=${e.isError}`)
          .join('; ')}) but no error beacon was sent`
      : 'no error beacon arrived in scenario error',
  });
  beaconFixture('error', 'viewEnd', {
    variant: 'error',
    reason: 'the plugin sent no viewEnd after the fatal error',
  });

  // Scenario 5
  const clipPosts = records.filter((r) => r.origin === 'page' && r.scenario === 'clip' && r.method === 'POST');
  for (const [i, name] of ['create', 'retry'].entries()) {
    const file = `clip.${name}.json`;
    if (clipPosts[i]) put(file, clipPosts[i], { event: 'clip', transport: 'fetch', variant: name, scenario: 'clip', status: clipPosts[i].status });
    else absent.push({ file, required: true, reason: `clip submission ${i + 1} never arrived` });
  }

  // Scenario 6
  beaconFixture('live', 'viewStart', { variant: 'live' });
  beaconFixture('live', 'heartbeat', { pick: 'last', variant: 'live' });
  beaconFixture('live', 'viewEnd', { variant: 'live-unload' });

  beaconFixture('privacy', 'viewStart', { variant: 'anonymous' });
  beaconFixture('privacy', 'custom:wirePrivacy', { variant: 'anonymous' });
  beaconFixture('native', 'heartbeat', { variant: 'native' });
  if (includeBatch) {
    const batchPost = beaconsOf('batch').find((r) => r.body?.batch === 1);
    if (batchPost) put('batch.fetch.json', batchPost, { event: null, transport: 'fetch', variant: 'batch', scenario: 'batch' });
    else absent.push({ file: 'batch.fetch.json', required: true, reason: 'no batch envelope arrived' });
  }

  return { fixtures, absent };
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Check the captured requests against the wire contract.
 *
 * @returns {Array<{ name: string, ok: boolean, detail?: string }>}
 */
function runAssertions(fixtures, absent, scenarioNotes, includeBatch) {
  const results = [];
  const check = (name, fn) => {
    try {
      const detail = fn();
      results.push({ name, ok: true, ...(typeof detail === 'string' ? { detail } : {}) });
    } catch (error) {
      results.push({ name, ok: false, detail: error.message });
    }
  };
  const fail = (message) => {
    throw new Error(message);
  };
  const beacons = records.filter((r) => r.origin === 'beacon' && r.method === 'POST' && r.scenario !== 'batch');
  const body = (file) => fixtures.get(file)?.record.body;

  check('every required fixture was captured', () => {
    const missing = absent.filter((a) => a.required);
    if (missing.length) fail(missing.map((a) => `${a.file}: ${a.reason}`).join('; '));
  });

  check('no request left 127.0.0.1', () => {
    if (externalRequests.length) fail(externalRequests.join(', '));
  });

  check('every beacon body is JSON with playerVersion and playerName', () => {
    for (const r of beacons) {
      if (!r.body || typeof r.body !== 'object') fail(`non-JSON beacon body in ${r.scenario}`);
      if (r.body.playerVersion !== PLAYER_VERSION) fail(`${r.body.event} in ${r.scenario}: playerVersion ${r.body.playerVersion}, expected ${PLAYER_VERSION}`);
      if (r.body.playerName !== 'scarlett-player') fail(`${r.body.event}: playerName ${r.body.playerName}`);
    }
    return `${beacons.length} beacons`;
  });

  check('every beacon has a positive integer beaconSeq, starting at 1 and increasing per view in timestamp/beaconSeq order', () => {
    const views = new Map();
    for (const r of beacons) {
      const b = r.body;
      if (!b || typeof b.viewId !== 'string' || !b.viewId) fail(`${eventOf(r)} (${r.scenario}): missing viewId`);
      if (!Number.isSafeInteger(b.beaconSeq) || b.beaconSeq < 1) {
        fail(`${eventOf(r)} (${r.scenario}): invalid beaconSeq ${JSON.stringify(b.beaconSeq)}`);
      }
      if (typeof b.timestamp !== 'number' || !Number.isFinite(b.timestamp)) {
        fail(`${eventOf(r)} (${r.scenario}): invalid timestamp ${JSON.stringify(b.timestamp)}`);
      }
      if (!views.has(b.viewId)) views.set(b.viewId, []);
      views.get(b.viewId).push(b);
    }
    if (!views.size) fail('no beacon views captured');
    for (const [viewId, view] of views) {
      // Requests (including async-header fetches and unload sendBeacon) may
      // arrive out of order. Validate the payload order, never recorder order.
      view.sort((a, b) => a.timestamp - b.timestamp || a.beaconSeq - b.beaconSeq);
      if (view[0].event !== 'viewStart' || view[0].beaconSeq !== 1) {
        fail(`${viewId}: first beacon is ${view[0].event} with beaconSeq ${view[0].beaconSeq}, expected viewStart/1`);
      }
      for (let i = 1; i < view.length; i++) {
        if (view[i].beaconSeq <= view[i - 1].beaconSeq) {
          fail(`${viewId}: beaconSeq ${view[i].beaconSeq} (${view[i].event}) did not increase from ${view[i - 1].beaconSeq}`);
        }
      }
    }
    return `${beacons.length} beacons across ${views.size} views (including custom events and unload)`;
  });

  check('seeking beacons carry player/element seekSource; the core seek to 20s is player', () => {
    let seeks = 0;
    for (const r of beacons) {
      if (eventOf(r) === 'seeking') {
        seeks++;
        if (r.body.seekSource !== 'player' && r.body.seekSource !== 'element') {
          fail(`seeking (${r.scenario}): invalid seekSource ${JSON.stringify(r.body.seekSource)}`);
        }
      } else if ('seekSource' in r.body) {
        fail(`${eventOf(r)} (${r.scenario}): seekSource is only expected on seeking`);
      }
    }
    if (!seeks) fail('no seeking beacons captured');
    // The runner uses core seek(), not UI/native controls. Validate the known
    // request rather than the first selected seeking fixture: HLS may also
    // seek the element internally before the runner requests its first seek.
    if (!beaconsOf('full-session').some((r) => eventOf(r) === 'seeking' && r.body.seekTo === 20 && r.body.seekSource === 'player')) {
      fail('core seek to 20s lacks a seeking beacon with seekSource player');
    }
    return `${seeks} seeking beacons`;
  });

  check('fetch beacons carry X-API-Key and X-Wire-Token; the unload beacon carries neither, and api_key in the query', () => {
    for (const r of beacons) {
      if (transportOf(r) === 'fetch') {
        if (r.headers['x-api-key'] !== API_KEY) fail(`${eventOf(r)} (${r.scenario}): x-api-key ${r.headers['x-api-key']}`);
        if (r.headers['x-wire-token'] !== WIRE_TOKEN) fail(`${eventOf(r)} (${r.scenario}): x-wire-token ${r.headers['x-wire-token']}`);
        if (r.query.api_key !== undefined) fail(`${eventOf(r)} (${r.scenario}): fetch beacon has api_key in the query`);
      }
    }
    const unload = fixtures.get('viewEnd.sendBeacon.unload.json')?.record;
    if (!unload) fail('no unload sendBeacon captured');
    if (unload.headers['x-api-key'] || unload.headers['x-wire-token']) fail('unload beacon carried a custom header');
    if (unload.query.api_key !== API_KEY) fail(`unload beacon api_key ${unload.query.api_key}`);
  });

  check('the preflight named x-api-key in access-control-request-headers', () => {
    const pre = fixtures.get('preflight.options.json')?.record;
    if (!pre) fail('no preflight captured');
    const named = (pre.headers['access-control-request-headers'] ?? '').toLowerCase().split(/\s*,\s*/);
    if (!named.includes('x-api-key')) fail(`access-control-request-headers: ${pre.headers['access-control-request-headers']}`);
  });

  check('viewEnd unload is the field subset; viewEnd ended has every field', () => {
    const unload = body('viewEnd.sendBeacon.unload.json');
    const ended = body('viewEnd.fetch.ended.json');
    if (!unload || !ended) fail('a viewEnd variant is missing');
    for (const key of VIEW_END_SHARED) {
      if (!(key in unload)) fail(`unload lacks ${key}`);
      if (!(key in ended)) fail(`ended lacks ${key}`);
    }
    for (const key of VIEW_END_FETCH_ONLY) {
      if (key in unload) fail(`unload has ${key}, which the unload path does not send`);
      if (!(key in ended)) fail(`ended lacks ${key}`);
    }
    if (ended.exitType !== 'completed') fail(`ended exitType ${ended.exitType}`);
  });

  check('videoStart.startupTime is above zero on VOD (play request to first frame, SCAR-ANALYTICS-4)', () => {
    const start = beaconsOf('full-session').find((r) => eventOf(r) === 'videoStart')?.body;
    if (!start) fail('no videoStart in full-session');
    // Until 1.18 the request and the "first frame" were the same handler, so
    // this was always about 0 whatever the viewer actually waited.
    if (!(typeof start.startupTime === 'number' && start.startupTime > 0)) {
      fail(`startupTime ${JSON.stringify(start.startupTime)}`);
    }
    return `${start.startupTime} ms`;
  });

  check('a fatal error sends an error beacon with errorCode, then a viewEnd with exitType error', () => {
    const error = body('error.fetch.json');
    const viewEnd = body('viewEnd.fetch.error.json');
    if (!error || !viewEnd) fail('error or its viewEnd missing');
    if (error.fatal !== true) fail(`error.fatal ${error.fatal}`);
    for (const key of ['errorType', 'errorMessage', 'errorCode']) {
      if (error[key] === undefined || error[key] === null || error[key] === '') fail(`error lacks ${key}`);
    }
    if (!['access', 'network', 'media', 'source', 'playback', 'player', 'unknown'].includes(error.errorCategory)) fail(`errorCategory ${error.errorCategory}`);
    if (error.errorSeverity !== 'fatal') fail(`errorSeverity ${error.errorSeverity}`);
    if (error.httpStatus !== undefined && (!Number.isInteger(error.httpStatus) || error.httpStatus < 100)) fail(`httpStatus ${error.httpStatus}`);
    for (const key of ['mediaErrorCode', 'attempts']) if (key in error && (!Number.isFinite(error[key]) || error[key] < 0)) fail(`${key} ${error[key]}`);
    for (const key of ['retriesExhausted', 'reconnectExhausted', 'timedOut']) if (key in error && typeof error[key] !== 'boolean') fail(`${key} ${error[key]}`);
    if ('url' in error || 'detail' in error || /[?#]wire-secret/.test(error.errorMessage)) fail('error leaked a raw URL/detail');
    if (viewEnd.exitType !== 'error') fail(`viewEnd exitType ${viewEnd.exitType}`);
    if (viewEnd.fatalErrorCategory !== error.errorCategory || !Number.isInteger(viewEnd.warningCount)) fail('fatal category/warning count mismatch');
  });

  check('QoE v2 on scored heartbeat and fetch viewEnd, absent from unload subset', () => {
    for (const r of beacons.filter((r) => ['heartbeat', 'viewEnd'].includes(eventOf(r)) && transportOf(r) === 'fetch')) {
      if (r.body.qoeVersion !== 2 || (r.body.qoeScore !== null && !(typeof r.body.qoeScore === 'number' && r.body.qoeScore >= 0 && r.body.qoeScore <= 100))) fail(`${eventOf(r)} (${r.scenario}): invalid QoE v2`);
    }
    for (const r of beacons.filter((r) => eventOf(r) === 'viewEnd' && transportOf(r) === 'sendBeacon')) {
      if ('qoeVersion' in r.body || 'qoeScore' in r.body) fail('unload carries QoE fetch-only fields');
    }
  });

  check('anonymous viewStart has sanitized context and beforeSend drop does not consume a sequence', () => {
    const start = body('viewStart.fetch.anonymous.json');
    const custom = body('custom-wirePrivacy.fetch.anonymous.json');
    if (!start || !custom) fail('anonymous fixtures missing');
    if (start.anonymous !== true || custom.anonymous !== true || start.beaconSeq !== 1) fail('anonymous IDs/sequence incorrect');
    const seq = beaconsOf('privacy').map((r) => r.body.beaconSeq).sort((a, b) => a - b);
    if (seq.some((n, i) => n !== i + 1)) fail(`dropped event consumed a beaconSeq: ${seq}`);
    if (start.pageUrl !== new URL(start.pageUrl).origin + new URL(start.pageUrl).pathname || !start.pageUrl.endsWith('/scripts/wire-capture/index.html')) fail(`unsafe pageUrl ${start.pageUrl}`);
    if (!Number.isFinite(start.pageLoadToInitMs) || !Number.isFinite(start.playerInitMs) || start.playerInitMs < 0) fail('missing viewStart timing context');
    if ('referrerOrigin' in start) fail('unexpected referrerOrigin on direct navigation');
    if (beaconsOf('privacy').some((r) => eventOf(r) === 'custom:wireDropped')) fail('beforeSend did not drop event');
    if (beaconsOf('privacy').some((r) => eventOf(r) === 'custom:wireDntSuppressed')) fail('DNT did not suppress event');
    for (const r of beacons.filter((r) => eventOf(r) !== 'viewStart')) {
      if (['pageUrl', 'referrerOrigin', 'pageLoadToInitMs', 'playerInitMs'].some((key) => key in r.body)) fail(`${eventOf(r)} (${r.scenario}) leaked viewStart context`);
    }
  });

  check('hls.js emits measured segment values; native MP4 emits none', () => {
    const segments = scenarioNotes['full-session']?.segments;
    if (!segments?.length) fail('no media:segment on hls.js playback');
    for (const s of segments) {
      if (!['main', 'audio', 'subtitle'].includes(s.kind) || typeof s.ok !== 'boolean'
        || !Number.isFinite(s.durationMs) || s.durationMs < 0 || !Number.isFinite(s.bytes) || s.bytes < 0) fail(`invalid segment ${JSON.stringify(s)}`);
    }
    if (!segments.some((s) => s.ok && s.bytes > 0 && s.durationMs > 0)) fail('no successful segment with positive measured values');
    if (scenarioNotes.native?.segments?.length) fail(`native MP4 emitted ${scenarioNotes.native.segments.length} segments`);
    if (!body('heartbeat.fetch.native.json')) fail('native heartbeat missing');
    return `${segments.length} measured hls.js segments; native MP4 none`;
  });

  check('hls.js interval beacons carry segment aggregates; native MP4 omits them', () => {
    const keys = ['segmentCount', 'segmentBytes', 'segmentLoadAvgMs', 'segmentLoadMaxMs', 'segmentThroughputBps', 'segmentErrors'];
    const vod = beaconsOf('full-session').filter((r) => ['heartbeat', 'viewEnd'].includes(eventOf(r)));
    const measured = vod.filter((r) => r.body.segmentCount > 0);
    if (!measured.length) fail('no hls.js interval beacon carries measured segment aggregates');
    for (const r of measured) {
      for (const key of keys) if (!Number.isFinite(r.body[key]) || r.body[key] < 0) fail(`${eventOf(r)} has invalid ${key}: ${r.body[key]}`);
      if (r.body.segmentBytes <= 0 || r.body.segmentLoadMaxMs < r.body.segmentLoadAvgMs) fail('invalid hls.js segment interval');
    }
    for (const r of beaconsOf('native')) {
      if (keys.some((key) => key in r.body)) fail(`native ${eventOf(r)} fabricated segment metrics`);
    }
    return `${measured.length} measured interval beacons`;
  });

  if (includeBatch) check('opt-in batch envelope preserves event order and uses fetch auth', () => {
    const posts = beaconsOf('batch');
    const events = posts.flatMap((r) => r.body?.events ?? []);
    if (!posts.length || posts.some((r) => r.body?.batch !== 1 || !Number.isFinite(r.body.sentAt) || !Array.isArray(r.body.events) || Buffer.byteLength(JSON.stringify(r.body)) > 60000)) fail('invalid batch envelope/size or a single-event POST');
    if (!events.some((e) => e.event === 'custom:wireBatch') || !events.some((e) => e.event === 'viewEnd')) fail('batch missing custom event or final viewEnd');
    for (let i = 1; i < events.length; i++) if (events[i].beaconSeq <= events[i - 1].beaconSeq) fail('batch event sequence out of order');
    for (const r of posts) if (r.headers['x-api-key'] !== API_KEY || r.headers['x-wire-token'] !== WIRE_TOKEN) fail('batch fetch auth missing');
  });

  check('custom dimensions sit at the top level of every beacon, types intact', () => {
    for (const r of beacons) {
      for (const [key, value] of Object.entries(CUSTOM_DIMENSIONS)) {
        if (r.body[key] !== value) fail(`${eventOf(r)} (${r.scenario}): ${key} = ${JSON.stringify(r.body[key])}`);
      }
    }
  });

  check('clip create and retry share clientRequestId and body (capturedAt aside), VOD fields, CSRF header', () => {
    const create = fixtures.get('clip.create.json')?.record;
    const retry = fixtures.get('clip.retry.json')?.record;
    if (!create || !retry) fail('clip create or retry missing');
    if (create.status !== 500 || retry.status !== 202) fail(`statuses ${create.status}/${retry.status}, expected 500/202`);
    const a = create.body;
    const b = retry.body;
    if (!a?.clientRequestId || a.clientRequestId !== b?.clientRequestId) fail(`clientRequestId ${a?.clientRequestId} vs ${b?.clientRequestId}`);
    // capturedAt is minted per attempt (clips buildRange runs on every
    // commit), so a retry is identical in everything but that timestamp.
    const strip = ({ capturedAt, ...rest }) => JSON.stringify(rest);
    if (strip(a) !== strip(b)) fail('bodies differ beyond capturedAt');
    if (Date.parse(b.capturedAt) < Date.parse(a.capturedAt)) fail('retry capturedAt precedes create');
    for (const c of [a, b]) {
      if (c.duration !== c.endTime - c.startTime) fail(`duration ${c.duration} != ${c.endTime} - ${c.startTime}`);
      if (c.isLive !== false) fail(`isLive ${c.isLive}`);
      for (const key of ['seekableStart', 'seekableEnd', 'startDate', 'endDate']) {
        if (c[key] !== null) fail(`${key} is ${c[key]}, expected null on VOD`);
      }
    }
    for (const r of [create, retry]) {
      if (r.headers['x-csrf-token'] !== CSRF_TOKEN) fail(`x-csrf-token ${r.headers['x-csrf-token']}`);
    }
    const notes = scenarioNotes.clip ?? {};
    if (notes.afterFailure?.open !== true) fail('selector closed after the failed submission');
    if (notes.afterRetry?.open !== false) fail('selector still open after the successful retry');
  });

  check('live heartbeat and live unload viewEnd carry isLive and the latency summary; no VOD beacon has latency keys', () => {
    const state = scenarioNotes.live?.state;
    if (state?.live !== true) fail(`player state live ${state?.live}`);
    const heartbeat = body('heartbeat.fetch.live.json');
    const unload = fixtures.get('viewEnd.sendBeacon.live-unload.json')?.record;
    if (!heartbeat || !unload) fail('live heartbeat or live unload viewEnd missing');
    if (transportOf(unload) !== 'sendBeacon') fail(`live unload viewEnd arrived by ${transportOf(unload)}`);
    for (const [name, b] of [['heartbeat', heartbeat], ['viewEnd', unload.body]]) {
      if (b.isLive !== true) fail(`live ${name} isLive ${b.isLive}`);
      if (b.videoId !== 'wire-fixture-live') fail(`live ${name} videoId ${b.videoId}`);
      for (const key of LATENCY_KEYS.slice(0, 4)) {
        if (typeof b[key] !== 'number' || !Number.isFinite(b[key])) fail(`live ${name} ${key} = ${JSON.stringify(b[key])}`);
      }
      // The live playlist is standard latency (see livePlaylist), so true
      // would mean the stream was misclassified, not a valid alternative.
      if (b.lowLatency !== false) fail(`live ${name} lowLatency = ${JSON.stringify(b.lowLatency)}, expected false`);
      if (!(b.liveLatencySamples > 0)) fail(`live ${name} liveLatencySamples ${b.liveLatencySamples}`);
    }
    for (const key of VIEW_END_SHARED) if (!(key in unload.body)) fail(`live unload lacks ${key}`);
    for (const key of VIEW_END_FETCH_ONLY) if (key in unload.body) fail(`live unload has ${key}`);
    if (unload.body.exitType !== 'abandoned') fail(`live unload exitType ${unload.body.exitType}`);
    for (const r of beacons.filter((b) => b.scenario !== 'live')) {
      const leaked = LATENCY_KEYS.filter((key) => key in r.body);
      if (leaked.length) fail(`${eventOf(r)} (${r.scenario}) carries ${leaked.join(', ')} on VOD`);
    }
    return `latency mean ${heartbeat.liveLatencyMean}s over ${heartbeat.liveLatencySamples} readings, lowLatency ${heartbeat.lowLatency}`;
  });

  check('isLive is null on every viewStart, then false on VOD and true on live (SCAR-ANALYTICS-6)', () => {
    const ran = [...new Set(beacons.map((r) => r.scenario))];
    for (const scenario of ran) {
      const start = beaconsOf(scenario).find((r) => eventOf(r) === 'viewStart');
      if (!start) fail(`no viewStart in ${scenario}`);
      if (start.body.isLive !== null) fail(`viewStart (${scenario}) isLive ${JSON.stringify(start.body.isLive)}, expected null`);
    }
    const firstFrame = (scenario) => beaconsOf(scenario).find((r) => eventOf(r) === 'videoStart')?.body;
    if (firstFrame('full-session')?.isLive !== false) fail(`VOD videoStart isLive ${JSON.stringify(firstFrame('full-session')?.isLive)}`);
    if (body('viewEnd.fetch.ended.json')?.isLive !== false) fail(`VOD ended viewEnd isLive ${JSON.stringify(body('viewEnd.fetch.ended.json')?.isLive)}`);
    if (firstFrame('live')?.isLive !== true) fail(`live videoStart isLive ${JSON.stringify(firstFrame('live')?.isLive)}`);
    return `${ran.length} viewStart null`;
  });

  check('heartbeat watchTime and rebufferCount never decrease (sanity)', () => {
    const beats = beaconsOf('full-session').filter((r) => eventOf(r) === 'heartbeat').map((r) => r.body)
      .sort((a, b) => a.timestamp - b.timestamp || a.beaconSeq - b.beaconSeq);
    for (let i = 1; i < beats.length; i++) {
      if (beats[i].watchTime < beats[i - 1].watchTime) fail(`watchTime fell at heartbeat ${i}`);
      if (beats[i].rebufferCount < beats[i - 1].rebufferCount) fail(`rebufferCount fell at heartbeat ${i}`);
    }
    return `${beats.length} heartbeats`;
  });

  check('every bus quality:change produced a qualityChange beacon matching a level (SCAR-HLS-3 tripwire)', () => {
    const notes = scenarioNotes['full-session'] ?? {};
    const sent = beaconsOf('full-session').filter((r) => eventOf(r) === 'qualityChange');
    if (!notes.qualityChangeCount) fail('no quality:change heard on the bus');
    if (sent.length !== notes.qualityChangeCount) {
      fail(`${notes.qualityChangeCount} quality:change on the bus (${JSON.stringify(notes.qualityChanges)}), ${sent.length} qualityChange beacons`);
    }
    for (const r of sent) {
      const { bitrate, width, height } = r.body;
      if (!notes.qualities.some((q) => q.bitrate === bitrate && q.width === width && q.height === height)) {
        fail(`beacon ${JSON.stringify({ bitrate, width, height })} matches no level in ${JSON.stringify(notes.qualities)}`);
      }
    }
    return `${sent.length} of ${notes.qualityChangeCount}`;
  });

  return results;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Write the fixtures, the scenario-1 sequence and the manifest.
 *
 * @param {string} outDir
 * @param {object} context - Versions and results for the manifest
 * @returns {object} The manifest
 */
function writeOutput(outDir, { fixtures, absent, assertions, chromiumVersion, capturedAt, scenarioNotes }) {
  mkdirSync(dirname(outDir), { recursive: true });
  // Exclusive creation, even if another run created this version after the
  // early CLI check. Never mutate captured evidence or PROVENANCE.md.
  mkdirSync(outDir);

  const provenance = {
    player: PLAYER_VERSION,
    capturedAt,
    harness: 'scripts/capture-wire-fixtures.mjs',
    chromium: chromiumVersion,
    node: process.version,
  };
  const requestOf = (r) => ({
    method: r.method,
    path: r.path,
    query: r.query,
    headers: r.headers,
    body: r.body,
  });

  const written = [];
  for (const [file, { meta, record: r }] of [...fixtures].sort(([a], [b]) => a.localeCompare(b))) {
    const out = {
      fixture: { ...provenance, ...meta, receivedAt: r.receivedAt },
      request: requestOf(r),
      ...(r.status !== undefined ? { response: { status: r.status } } : {}),
    };
    writeFileSync(join(outDir, file), `${JSON.stringify(out, null, 2)}\n`);
    written.push(file);
  }

  const sequence = beaconsOf('full-session').map((r) => ({
    receivedAt: r.receivedAt,
    event: eventOf(r),
    transport: transportOf(r),
    request: requestOf(r),
  }));
  writeFileSync(
    join(outDir, '_session.sequence.json'),
    `${JSON.stringify({ fixture: { ...provenance, scenario: 'full-session' }, beacons: sequence }, null, 2)}\n`
  );
  written.push('_session.sequence.json');

  const manifest = {
    ...provenance,
    files: [...written, 'manifest.json'],
    absent: absent.map(({ file, required, reason }) => ({ file, required, reason })),
    assertions,
    scenarios: Object.fromEntries(
      Object.entries(scenarioNotes).map(([name, notes]) => [
        name,
        {
          beacons: beaconsOf(name).length,
          pageErrors: notes.pageErrors ?? [],
          ...(notes.rebuffer ? { rebuffer: notes.rebuffer, startupRebuffer: notes.startupRebuffer } : {}),
          // isLive per event as first sent. viewStart leaves before any
          // manifest is parsed, so it is null on every scenario (asserted in
          // runAssertions); later beacons carry the classification.
          isLiveByEvent: Object.fromEntries(beaconsOf(name).reverse().map((r) => [eventOf(r), r.body.isLive])),
          ...(name === 'full-session' ? { segments: notes.segments ?? [] } : {}),
          ...(name === 'native' ? { segments: notes.segments ?? [] } : {}),
        },
      ])
    ),
  };
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
if (!opts.smoke && existsSync(opts.out)) {
  console.error(`${opts.out} exists. Choose a new --out directory; captured evidence is never overwritten.`);
  process.exit(1);
}

const chromium = await checkPrerequisites();
ensureHlsFixture();

const workDir = mkdtempSync(join(tmpdir(), 'scarlett-wire-'));
const bundlePath = join(workDir, 'page.js');
const nativePath = join(workDir, 'native.mp4');
let exitCode = 1;
let browser;
let beaconServer;
let pageServer;

try {
  const tls = makeCertificate(workDir);
  await bundlePage(bundlePath);
  execFileSync('ffmpeg', ['-y', '-i', join(REPO_ROOT, 'scripts/fixtures/hls/seg0.ts'), '-c', 'copy', '-movflags', '+faststart', nativePath], { stdio: 'ignore' });

  let pageOrigin = '';
  const beacon = await startBeaconServer(tls, () => pageOrigin);
  beaconServer = beacon.server;
  const pageSrv = await startPageServer(bundlePath, nativePath);
  pageServer = pageSrv.server;
  pageOrigin = pageSrv.origin;

  browser = await chromium.launch({
    headless: true,
    args: [
      // REQUIRED, not belt-and-braces: with only the context's
      // ignoreHTTPSErrors, headless Chromium drops the unload sendBeacon to
      // the self-signed origin entirely - not even its preflight arrives
      // (measured 2026-09-27, Playwright 1.62.1). sendBeacon runs outside
      // the page's fetch stack, which the context flag does not reach.
      '--ignore-certificate-errors',
      // The external-origin guard: every hostname fails to resolve, so only
      // the 127.0.0.1 IP literal is reachable.
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      // play() through core without a user gesture
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const chromiumVersion = browser.version();
  const capturedAt = new Date().toISOString();

  const scenarioNotes = {};
  const failures = [];
  for (const [name, run] of [...SCENARIOS, ...(opts.batch ? [['batch', scenarioBatch]] : [])]) {
    currentScenario = name;
    const started = Date.now();
    try {
      const { notes } = await run(browser, pageOrigin, beacon.origin);
      scenarioNotes[name] = notes;
      console.log(`  ok   ${name} (${((Date.now() - started) / 1000).toFixed(1)}s, ${beaconsOf(name).length} beacons)`);
    } catch (error) {
      scenarioNotes[name] = { error: error.message };
      failures.push(`${name}: ${error.message}`);
      console.log(`  FAIL ${name}: ${error.message}`);
    }
    // Stragglers from a closed context are still attributed to it
    await sleep(300);
  }
  currentScenario = null;
  if (process.env.WIRE_DEBUG) {
    for (const r of records) {
      console.log(`[debug] ${r.scenario} ${r.origin} ${r.method} ${r.path} ${eventOf(r) ?? ''} ${r.body?.fatal ?? ''} ${r.body?.errorType ?? ''} ${r.body?.errorMessage ?? ''}`);
    }
    console.log('[debug] notes', JSON.stringify(scenarioNotes));
  }

  const { fixtures, absent } = selectFixtures(scenarioNotes, opts.batch);
  const assertions = runAssertions(fixtures, absent, scenarioNotes, opts.batch);
  for (const failure of failures) assertions.unshift({ name: 'scenario ran', ok: false, detail: failure });

  console.log('');
  for (const a of assertions) console.log(`  ${a.ok ? 'ok  ' : 'FAIL'} ${a.name}${a.detail ? ` - ${a.detail}` : ''}`);

  if (assertions.some((a) => !a.ok)) {
    console.error('\nAssertions failed; nothing written.');
  } else {
    const outDir = opts.smoke ? join(mkdtempSync(join(tmpdir(), 'scarlett-wire-smoke-')), PLAYER_VERSION) : opts.out;
    const manifest = writeOutput(outDir, { fixtures, absent, assertions, chromiumVersion, capturedAt, scenarioNotes });
    if (opts.smoke) {
      console.log(`\nSmoke run passed. Manifest (${join(outDir, 'manifest.json')}):\n`);
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.log(`\n${manifest.files.length} files written to ${relative(process.cwd(), outDir) || '.'}`);
    }
    exitCode = 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  await browser?.close();
  beaconServer?.close();
  pageServer?.close();
  rmSync(workDir, { recursive: true, force: true });
}

process.exit(exitCode);
