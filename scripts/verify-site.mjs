/**
 * Real-browser verification for the scarlettplayer.com pages.
 *
 * Companion to scripts/verify-browser.mjs, which covers playback. This one
 * covers the site around the player: every route renders without horizontal
 * overflow from a 320px phone to a 1440px desktop, in every scenario the demo
 * can be deep-linked to, and every asset a page references is served from
 * the tree that gets deployed.
 *
 * Routes, on a local repo-root server at :8899:
 *
 *   /docs/        the authored homepage (docs/index.html)
 *   /docs/demo/   the generated demo, which production serves at /demo/
 *   /demo/        the source demo, the route verify-browser.mjs drives
 *
 * Checks, per route:
 *
 *   1. The page answers 200 and links its stylesheet as a sibling,
 *      `<route>site.css`. Every page references site.css and assets/ as
 *      siblings, and demo/build.cjs mirrors both beside each generated page.
 *      A `../site.css` from /demo/index.html would resolve to /site.css and
 *      never be requested, so the source route would render unstyled (review
 *      finding, 2026-09-19); this is the check that makes that impossible.
 *   2. Zero document horizontal overflow at 320/375/390/414/768/1024/1440.
 *      On the demo routes that is asserted for every scenario hash (#hls
 *      #mp4 #audio #audio-mini #whep #custom #playground #clips), switched
 *      in-page the way the scenario nav and Back/Forward do, and again with
 *      each hash loaded directly at phone width.
 *   3. Player placement on the demo routes' default scenario: at 390x844 the
 *      player's top is <= 280px and the whole player is on screen; at
 *      1440x900 the whole player is on screen without scrolling. Both are
 *      acceptance criteria of the redesign.
 *   4. Every <link rel=stylesheet>, <link rel*=icon>, <link rel=preload>,
 *      <img src>/<img srcset>, <source srcset>, video poster,
 *      og:image/twitter:image, and CSS url()
 *      or @import target (from linked sheets, <style> blocks and style=""
 *      attributes), collected across every scenario and viewport, answers
 *      200 with a non-empty body from the local server. An asset on any
 *      other origin fails outright: only our own imagery ships, and this
 *      harness must not need the public internet. og:image is an absolute
 *      production URL by nature, so it is mapped through the production
 *      route map (scarlettplayer.com/demo/ is docs/demo/, everything else is
 *      docs/) rather than assumed to live under a local /docs/ prefix.
 *   5. No uncaught exception on any route while switching scenarios, and no
 *      HLS manifest, segment or demo bundle requested by the homepage's
 *      initial load.
 *
 * Usage:
 *   pnpm build && node demo/build.cjs
 *   python3 -m http.server 8899 --bind 127.0.0.1   # from repo root
 *   node scripts/verify-site.mjs
 *
 * Requires the `playwright` package with its bundled Chromium installed
 * (`npx playwright install --with-deps chromium`), exactly as
 * verify-browser.mjs does. No other dependency: assets are fetched with
 * Node's own fetch.
 *
 * Exits 1 on any failed check and 2 when it cannot run at all (no server on
 * :8899). It fails loudly rather than skipping: a route that does not
 * answer, a page that links no stylesheet, a player that never initialises,
 * or a hash that cannot be measured is a FAIL with the route, viewport and
 * hash in its name, never an empty pass.
 *
 * Every request a page makes to an origin other than 127.0.0.1 is aborted,
 * as verify-browser.mjs does. The demo's sample streams are hosted, so the
 * player shows its network-error overlay under this harness; that is
 * expected and is not what these checks look at.
 */
import { Buffer } from 'node:buffer';
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:8899';

/** Production origin, for the og:image route map in check 4. */
const PRODUCTION_ORIGIN = 'https://scarlettplayer.com';

/** Every scenario the demo can be deep-linked to, canonical forms and aliases. */
const DEMO_HASHES = ['#hls', '#mp4', '#audio', '#audio-mini', '#whep', '#custom', '#playground', '#clips'];

/**
 * The routes under test.
 *
 * `hashes` is what the route is driven through for the overflow checks; the
 * homepage has no scenario routing, so it is measured once per viewport as
 * loaded. `player` marks the routes that must initialise `window.player`
 * and meet the placement criteria.
 */
const ROUTES = [
  { path: '/docs/', name: 'homepage', hashes: [''], player: false },
  { path: '/docs/demo/', name: 'generated demo', hashes: DEMO_HASHES, player: true },
  { path: '/demo/', name: 'source demo', hashes: DEMO_HASHES, player: true },
];

/** Widths the redesign must not overflow at, each with a plausible height. */
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

/** The two viewports the player-placement criteria are written against. */
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/** Lowest the player's top edge may sit on a 390x844 phone, in CSS px. */
const MAX_PHONE_PLAYER_TOP = 280;

/** The player container every harness drives; the redesign preserves the id. */
const PLAYER_SELECTOR = '#player';

/** How long a hash switch gets to settle before the layout is measured. */
const SETTLE_MS = 300;

/**
 * How long a demo route gets to initialise window.player after load.
 *
 * Nothing here waits on the network (every off-box request is aborted), so
 * this only has to cover script parse and plugin init on a slow runner.
 */
const PLAYER_TIMEOUT_MS = 20000;

/** Requests the homepage's initial load must never make. */
const HOMEPAGE_FORBIDDEN = /\.m3u8(\?|$)|\.ts(\?|$)|\.m4s(\?|$)|\.mp4(\?|$)|demo\.bundle\.js/;

const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/g;
const CSS_IMPORT_RE = /@import\s+(?!url\()["']([^"']+)["']/g;

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
};

/**
 * Fetch one URL from the local server and describe the answer.
 *
 * Redirects are not followed: a 301 from `assets` to `assets/` is a page
 * referencing a directory, which is a mistake even when it happens to land.
 *
 * @param {string} url - Absolute URL on the local server
 * @returns {Promise<{status: number, length: number, type: string, text: string, error?: string}>}
 */
const fetchLocal = async (url) => {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const body = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') ?? '';
    return {
      status: res.status,
      length: body.length,
      type,
      text: /css|text|html/.test(type) ? body.toString('utf8') : '',
    };
  } catch (error) {
    return {
      status: 0,
      length: 0,
      type: '',
      text: '',
      error: String(error?.cause?.message ?? error?.message ?? error),
    };
  }
};

/**
 * Every url() and @import target in a piece of CSS, resolved against `base`.
 *
 * @param {string} css - Stylesheet text, a <style> block or a style="" value
 * @param {string} base - URL the relative references resolve against
 * @returns {string[]} Absolute URLs, data:/blob:/fragment references dropped
 */
const cssReferences = (css, base) => {
  const refs = [];
  const push = (raw) => {
    const value = (raw ?? '').trim();
    if (!value || /^(data|blob|javascript):/.test(value) || value.startsWith('#')) {
      return;
    }
    try {
      refs.push(new URL(value, base).href);
    } catch {
      refs.push(value);
    }
  };
  for (const match of css.matchAll(CSS_URL_RE)) {
    push(match[1] ?? match[2] ?? match[3]);
  }
  for (const match of css.matchAll(CSS_IMPORT_RE)) {
    push(match[1]);
  }
  return refs;
};

/**
 * Map a production URL onto the local server, or return null when the URL
 * is on neither origin.
 *
 * Production serves docs/ at the root and docs/demo/ at /demo/. A page's
 * relative references never need this; it exists for og:image and friends,
 * which are absolute by nature.
 *
 * @param {string} url - Absolute URL
 * @returns {string|null} The equivalent local URL, or null
 */
const toLocal = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin === ORIGIN) {
    return parsed.href;
  }
  if (parsed.origin === PRODUCTION_ORIGIN) {
    // /demo/ and everything else both land under docs/; the distinction is
    // spelled out because the deployed /demo/ is the GENERATED docs/demo/.
    return `${ORIGIN}/docs${parsed.pathname}${parsed.search}`;
  }
  return null;
};

/**
 * Open a page confined to the local server that records uncaught exceptions.
 *
 * @param {import('playwright').Browser} browser - The shared browser
 * @param {{width: number, height: number}} viewport - Initial viewport
 * @returns {Promise<{page: import('playwright').Page, pageErrors: string[], requests: string[]}>}
 */
const openPage = async (browser, viewport) => {
  const page = await browser.newPage({ viewport });
  await page.route(/^https?:\/\//, (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === '127.0.0.1' || hostname === 'localhost'
      ? route.continue()
      : route.abort('failed');
  });
  const pageErrors = [];
  const requests = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('request', (req) => requests.push(req.url()));
  return { page, pageErrors, requests };
};

/**
 * Let a hash switch or a resize settle before the layout is read.
 *
 * @param {import('playwright').Page} page - Page to wait on
 * @returns {Promise<void>}
 */
const settle = async (page) => {
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
};

/**
 * Wait for the demo to hand over `window.player`.
 *
 * The container div's id shadows window.player until demo.ts finishes init
 * and assigns the real instance, so a function-typed `load` is the signal.
 *
 * @param {import('playwright').Page} page - A page that has loaded a demo route
 * @returns {Promise<boolean>} Whether it initialised within the timeout
 */
const waitForPlayer = async (page) => {
  try {
    await page.waitForFunction(
      () => window.player && typeof window.player.load === 'function',
      { timeout: PLAYER_TIMEOUT_MS }
    );
    return true;
  } catch {
    return false;
  }
};

/**
 * Switch scenario in-page, the way the scenario nav and Back/Forward do.
 *
 * @param {import('playwright').Page} page - Page on a demo route
 * @param {string} hash - Scenario hash; '' leaves the URL alone
 * @returns {Promise<void>}
 */
const goHash = async (page, hash) => {
  if (hash) {
    await page.evaluate((h) => {
      location.hash = h;
    }, hash);
  }
  await settle(page);
};

/**
 * Measure document overflow, naming the widest offenders when there is any.
 *
 * Compared against `clientWidth` rather than `innerWidth` on purpose: both
 * exclude a vertical scrollbar, so a `100vw` element that overflows by the
 * scrollbar's width in a real browser is reported here too.
 *
 * @param {import('playwright').Page} page - Page to measure
 * @returns {Promise<{width: number, limit: number, offenders: string[]}>}
 */
const measureOverflow = (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const limit = doc.clientWidth;
    const width = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0);
    if (width <= limit) {
      return { width, limit, offenders: [] };
    }
    const describe = (el) => {
      const cls =
        typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
          : '';
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}`;
    };
    const offenders = [...document.querySelectorAll('body *')]
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.right > limit + 0.5)
      .sort((a, b) => b.rect.right - a.rect.right)
      .slice(0, 6)
      .map(({ el, rect }) => `${describe(el)} right=${Math.round(rect.right)}`);
    return { width, limit, offenders };
  });

/**
 * Where the player container sits in the viewport.
 *
 * @param {import('playwright').Page} page - Page on a demo route
 * @returns {Promise<{found: boolean, top: number, bottom: number, height: number, viewportHeight: number}>}
 */
const playerRect = (page) =>
  page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) {
      return { found: false, top: 0, bottom: 0, height: 0, viewportHeight: innerHeight };
    }
    const rect = el.getBoundingClientRect();
    return {
      found: true,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      viewportHeight: innerHeight,
    };
  }, PLAYER_SELECTOR);

/**
 * Every asset reference in the current document, resolved to absolute URLs.
 *
 * Attributes are read rather than resolved properties so that every srcset
 * candidate is collected, not just the one the current viewport picked.
 *
 * @param {import('playwright').Page} page - Page to read
 * @returns {Promise<Array<{url: string, what: string}>>}
 */
const collectAssets = (page) =>
  page.evaluate(() => {
    const found = new Map();
    const add = (raw, what) => {
      const value = (raw ?? '').trim();
      if (!value || /^(data|blob|javascript):/.test(value) || value.startsWith('#')) {
        return;
      }
      let abs = value;
      try {
        abs = new URL(value, document.baseURI).href;
      } catch {
        // Left as written so the fetch below reports it as unparseable.
      }
      if (!found.has(abs)) {
        found.set(abs, what);
      }
    };
    const srcsetUrls = (srcset) =>
      (srcset ?? '')
        .split(',')
        .map((candidate) => candidate.trim().split(/\s+/)[0])
        .filter(Boolean);
    const cssRefs = (css) => {
      const refs = [];
      const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/g;
      for (const match of (css ?? '').matchAll(re)) {
        refs.push(match[1] ?? match[2] ?? match[3]);
      }
      return refs;
    };

    document
      .querySelectorAll('link[rel~="stylesheet"]')
      .forEach((el) => add(el.getAttribute('href'), '<link rel=stylesheet>'));
    document
      .querySelectorAll('link[rel*="icon"]')
      .forEach((el) => add(el.getAttribute('href'), `<link rel="${el.getAttribute('rel')}">`));
    // A preload names the same font the stylesheet does, in a second place
    // that can drift on its own: a wrong href here is a wasted request and a
    // console warning in production, never a visible failure.
    document
      .querySelectorAll('link[rel~="preload"][href]')
      .forEach((el) => add(el.getAttribute('href'), `<link rel=preload as=${el.getAttribute('as') ?? '?'}>`));
    document.querySelectorAll('img').forEach((el) => {
      add(el.getAttribute('src'), '<img src>');
      srcsetUrls(el.getAttribute('srcset')).forEach((u) => add(u, '<img srcset>'));
    });
    document
      .querySelectorAll('source[srcset]')
      .forEach((el) => srcsetUrls(el.getAttribute('srcset')).forEach((u) => add(u, '<source srcset>')));
    document.querySelectorAll('video').forEach((el) => add(el.getAttribute('poster'), 'video poster'));
    document
      .querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')
      .forEach((el) => add(el.getAttribute('content'), `<meta ${el.getAttribute('property') ?? el.getAttribute('name')}>`));
    document
      .querySelectorAll('style')
      .forEach((el) => cssRefs(el.textContent).forEach((u) => add(u, '<style> url()')));
    document
      .querySelectorAll('[style]')
      .forEach((el) => cssRefs(el.getAttribute('style')).forEach((u) => add(u, 'style="" url()')));

    return [...found].map(([url, what]) => ({ url, what }));
  });

// ============================================================ PREFLIGHT
// The server has to be there before anything is a real result. A refused
// connection is a setup problem, reported as one, not as 25 failed checks.
{
  const probe = await fetchLocal(`${ORIGIN}/`);
  if (probe.status === 0) {
    console.error(`Cannot reach ${ORIGIN}: ${probe.error}`);
    console.error('Serve the repository root first: python3 -m http.server 8899 --bind 127.0.0.1');
    process.exit(2);
  }
}

const browser = await chromium.launch({ headless: true });

/** Assets to fetch after every route has been driven: url -> {what, routes}. */
const assets = new Map();
const noteAsset = (route, { url, what }) => {
  const entry = assets.get(url) ?? { what, routes: new Set() };
  entry.routes.add(route.path);
  assets.set(url, entry);
};

try {
  for (const route of ROUTES) {
    const url = `${ORIGIN}${route.path}`;
    console.log(`\n--- ${route.name}: ${route.path} ---`);

    // ---- 1. The page answers, and links its stylesheet as a sibling.
    const head = await fetchLocal(url);
    record(`[${route.path}] page answers 200`, head.status === 200, `status ${head.status}${head.error ? ' ' + head.error : ''}`);
    if (head.status !== 200) {
      // Nothing below can be measured against a page that is not there, and
      // every check it would have produced is a failure, not a skip.
      record(`[${route.path}] overflow, placement and asset checks`, false, 'page not served');
      continue;
    }

    const { page, pageErrors, requests } = await openPage(browser, VIEWPORTS[0]);
    const firstHash = route.hashes[0];
    // 'load', not verify-browser's 'domcontentloaded': a layout read before
    // the stylesheet and the images have arrived measures an unstyled page.
    await page.goto(`${url}${firstHash}`, { waitUntil: 'load' });

    let playerReady = false;
    if (route.player) {
      playerReady = await waitForPlayer(page);
      record(`[${route.path}] window.player initialised`, playerReady, playerReady ? '' : `not within ${PLAYER_TIMEOUT_MS}ms`);
    } else {
      // The homepage must stay light: no stream, no segments, no demo bundle
      // until the viewer asks for the player.
      await settle(page);
      const forbidden = requests.filter((r) => HOMEPAGE_FORBIDDEN.test(r));
      record(
        `[${route.path}] initial load requests no HLS manifest, segment or demo bundle`,
        forbidden.length === 0,
        forbidden.slice(0, 5).join(', ')
      );
    }

    // Compared without the query: the build stamps a cache-busting ?v= onto
    // the href, and it is the path that has to resolve beside the page.
    const stylesheets = (await collectAssets(page)).filter((a) => a.what === '<link rel=stylesheet>');
    const sibling = `${url}site.css`;
    record(
      `[${route.path}] links site.css as a sibling (${route.path}site.css)`,
      stylesheets.some((a) => a.url.split('?')[0] === sibling),
      stylesheets.length ? stylesheets.map((a) => a.url).join(', ') : 'no <link rel=stylesheet> on the page'
    );

    // ---- 2. No horizontal overflow, every viewport x every scenario.
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await settle(page);
      for (const hash of route.hashes) {
        await goHash(page, hash);
        const label = `[${route.path} ${viewport.width}px${hash ? ' ' + hash : ''}]`;
        const overflow = await measureOverflow(page);
        record(
          `${label} no horizontal overflow`,
          overflow.width <= overflow.limit,
          overflow.width <= overflow.limit
            ? ''
            : `scrollWidth ${overflow.width} > ${overflow.limit}: ${overflow.offenders.join('; ')}`
        );
        (await collectAssets(page)).forEach((a) => noteAsset(route, a));
      }
    }

    // ---- 3. Player placement on the default scenario.
    if (route.player) {
      await page.setViewportSize(PHONE);
      await goHash(page, DEMO_HASHES[0]);
      const phone = await playerRect(page);
      record(
        `[${route.path} ${PHONE.width}x${PHONE.height} ${DEMO_HASHES[0]}] player top <= ${MAX_PHONE_PLAYER_TOP}px and fully on screen`,
        phone.found && phone.height > 0 && phone.top >= 0 && phone.top <= MAX_PHONE_PLAYER_TOP && phone.bottom <= phone.viewportHeight,
        phone.found ? `top ${phone.top}, bottom ${phone.bottom}, height ${phone.height}` : `${PLAYER_SELECTOR} not found`
      );

      await page.setViewportSize(DESKTOP);
      await goHash(page, DEMO_HASHES[0]);
      const desktop = await playerRect(page);
      record(
        `[${route.path} ${DESKTOP.width}x${DESKTOP.height} ${DEMO_HASHES[0]}] whole player visible without scrolling`,
        desktop.found && desktop.height > 0 && desktop.top >= 0 && desktop.bottom <= desktop.viewportHeight,
        desktop.found ? `top ${desktop.top}, bottom ${desktop.bottom}, height ${desktop.height}` : `${PLAYER_SELECTOR} not found`
      );
    }

    // ---- 5. Nothing threw while all of that happened.
    record(`[${route.path}] no uncaught exceptions`, pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    await page.close();

    // ---- 2b. Each scenario loaded directly, at phone width. A direct link
    // and a refresh go through the controller's initial render, which is
    // not the same path as an in-page switch. Not attempted when the route
    // could not initialise its player once: that is already a failure
    // above, and eight more timeouts would only delay the verdict.
    if (route.player && !playerReady) {
      record(`[${route.path}] direct-load checks for every scenario`, false, 'not run: window.player never initialised on this route');
    }
    if (route.player && playerReady) {
      for (const hash of route.hashes) {
        const direct = await openPage(browser, PHONE);
        await direct.page.goto(`${url}${hash}`, { waitUntil: 'load' });
        const ready = await waitForPlayer(direct.page);
        await settle(direct.page);
        const overflow = await measureOverflow(direct.page);
        record(
          `[${route.path} ${PHONE.width}px ${hash} direct load] player initialised and no horizontal overflow`,
          ready && overflow.width <= overflow.limit && direct.pageErrors.length === 0,
          [
            ready ? '' : 'player did not initialise',
            overflow.width <= overflow.limit ? '' : `scrollWidth ${overflow.width} > ${overflow.limit}: ${overflow.offenders.join('; ')}`,
            direct.pageErrors.length ? `uncaught: ${direct.pageErrors[0]}` : '',
          ].filter(Boolean).join('; ')
        );
        (await collectAssets(direct.page)).forEach((a) => noteAsset(route, a));
        await direct.page.close();
      }
    }
  }

  // ============================================================ ASSETS
  // 4. Everything any page referenced, fetched from the local server. Linked
  // stylesheets are read for their own url() and @import references, which
  // join the queue, so a background image three sheets deep is checked too.
  console.log('\n--- assets referenced by the pages ---');
  const queue = [...assets.entries()];
  const seen = new Set(queue.map(([url]) => url));
  while (queue.length) {
    const [url, { what, routes }] = queue.shift();
    const where = [...routes].join(' ');
    const local = toLocal(url);
    if (!local) {
      record(`${what} ${url} (${where})`, false, 'not served from the local tree - only our own assets may be referenced');
      continue;
    }

    const res = await fetchLocal(local);
    const ok = res.status === 200 && res.length > 0;
    record(
      `${what} ${url} (${where})`,
      ok,
      ok ? `${res.length} bytes` : `status ${res.status}${res.error ? ' ' + res.error : ''}${res.status === 200 ? ', empty body' : ''}`
    );

    if (ok && (what === '<link rel=stylesheet>' || /css/.test(res.type))) {
      for (const ref of cssReferences(res.text, local)) {
        if (!seen.has(ref)) {
          seen.add(ref);
          queue.push([ref, { what: `css url() in ${new URL(local).pathname}`, routes }]);
        }
      }
    }
  }
  record('at least one asset was referenced and checked', assets.size > 0, `${assets.size} distinct references`);
} finally {
  await browser.close();
}

// ============================================================ SUMMARY
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exitCode = 1;
}
