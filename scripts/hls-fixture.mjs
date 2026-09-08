/**
 * Local HLS fixture generator for the browser verification harness.
 *
 * Produces two renditions of the same 60 seconds of test video under
 * scripts/fixtures/hls/, using ffmpeg:
 *
 *   - a 30-segment (2s each) low-bitrate rendition (vod.m3u8 + seg0..29.ts).
 *     The harness's live-refresh scenario reuses those segments behind an
 *     intercepted live-style playlist, so no separate live fixture is needed.
 *   - a 120-part (0.5s each) rendition under ll/ for the LL-HLS scenario.
 *
 * The LL parts are REAL 0.5s segments, each starting on a keyframe, rather
 * than byte-range slices of the 2s segments. That distinction is not
 * cosmetic: hls.js appends each part into the transmuxer as its own chunk,
 * and a slice that ends mid-frame produces a truncated access unit, which
 * Chromium rejects with PIPELINE_ERROR_DECODE after a few seconds of
 * part-driven playback. Because each part is a complete TS file on a
 * keyframe boundary, four consecutive parts CONCATENATE to exactly the 2s
 * parent segment the LL playlist advertises - which is what lets the harness
 * synthesise parent segments without a third ffmpeg pass.
 *
 * The output directory is gitignored; run this script (or let
 * verify-browser.mjs run it automatically) to regenerate. Requires ffmpeg
 * on PATH.
 *
 * Usage: node scripts/hls-fixture.mjs
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'hls');
const MANIFEST = join(FIXTURE_DIR, 'vod.m3u8');
const LL_DIR = join(FIXTURE_DIR, 'll');
const LL_MANIFEST = join(LL_DIR, 'parts.m3u8');

/** Seconds of test video both renditions are generated from. */
const FIXTURE_SECONDS = 60;

/** Duration of one LL part, in seconds. */
export const LL_PART_DURATION = 0.5;

/**
 * Fail with an actionable message when ffmpeg is missing.
 *
 * Checked before the real call so a missing ffmpeg reports what to install
 * rather than surfacing as a raw ENOENT spawn error from execFileSync.
 * Nothing provides ffmpeg for free: the ubuntu-24.04 runner image no longer
 * ships one (ci.yml installs it explicitly before calling this), and a
 * developer machine may not have it either. Playwright's bundled ffmpeg does
 * not count - it lives under ~/.cache/ms-playwright and is never on PATH.
 *
 * @throws {Error} When ffmpeg is not on PATH
 */
function requireFfmpeg() {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.error) {
    throw new Error(
      'ffmpeg is not on PATH, so the local HLS fixture cannot be generated. ' +
        'Install it (macOS: `brew install ffmpeg`, Debian/Ubuntu: ' +
        '`apt-get install -y ffmpeg`) and re-run.'
    );
  }
}

/**
 * Generate the fixture unless it already exists.
 *
 * @returns {string} Absolute path to the generated manifest
 * @throws {Error} When ffmpeg is unavailable or generation fails
 */
export function ensureHlsFixture() {
  if (existsSync(MANIFEST)) return MANIFEST;

  requireFfmpeg();

  mkdirSync(FIXTURE_DIR, { recursive: true });
  console.log('Generating local HLS fixture (ffmpeg, ~60s of test video)...');

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
      '-t', '60',
      // Keyframe every 2s (60 frames at 30fps) so segments split on the
      // requested hls_time boundary instead of x264's default cadence
      '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '200k', '-pix_fmt', 'yuv420p',
      '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
      '-c:a', 'aac', '-b:a', '48k',
      '-hls_time', '2',
      '-hls_list_size', '0',
      '-hls_segment_filename', join(FIXTURE_DIR, 'seg%d.ts'),
      MANIFEST,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );

  console.log(`HLS fixture ready at ${FIXTURE_DIR}`);
  return MANIFEST;
}

/**
 * Generate the LL-HLS part rendition unless it already exists.
 *
 * Same source and encoder settings as {@link ensureHlsFixture}, re-segmented
 * at the part duration with a keyframe on every part boundary.
 *
 * @returns {{ dir: string, partCount: number, partDuration: number }}
 *          Where the parts live, how many there are, and how long each is
 * @throws {Error} When ffmpeg is unavailable or generation fails
 */
export function ensureLlHlsFixture() {
  if (!existsSync(LL_MANIFEST)) {
    requireFfmpeg();

    mkdirSync(LL_DIR, { recursive: true });
    console.log('Generating local LL-HLS part fixture (ffmpeg, 0.5s parts)...');

    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
        '-t', String(FIXTURE_SECONDS),
        // A keyframe every 0.5s (15 frames at 30fps) so every part starts on
        // one and is independently decodable, which is what INDEPENDENT=YES
        // in the generated playlist asserts.
        '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '200k', '-pix_fmt', 'yuv420p',
        '-g', '15', '-keyint_min', '15', '-sc_threshold', '0',
        '-c:a', 'aac', '-b:a', '48k',
        '-hls_time', String(LL_PART_DURATION),
        '-hls_list_size', '0',
        '-hls_segment_filename', join(LL_DIR, 'part%d.ts'),
        LL_MANIFEST,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] }
    );

    console.log(`LL-HLS part fixture ready at ${LL_DIR}`);
  }

  const partCount = readdirSync(LL_DIR).filter((name) => /^part\d+\.ts$/.test(name)).length;

  return { dir: LL_DIR, partCount, partDuration: LL_PART_DURATION };
}

// Allow running directly: node scripts/hls-fixture.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureHlsFixture();
  ensureLlHlsFixture();
}
