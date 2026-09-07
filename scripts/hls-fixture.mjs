/**
 * Local HLS fixture generator for the browser verification harness.
 *
 * Produces a 60-second, 30-segment (2s each) low-bitrate VOD rendition at
 * scripts/fixtures/hls/ (vod.m3u8 + seg0..29.ts) using ffmpeg. The
 * harness's live-refresh scenario reuses the same segments behind an
 * intercepted live-style playlist, so no separate live fixture is needed.
 *
 * The output directory is gitignored; run this script (or let
 * verify-browser.mjs run it automatically) to regenerate. Requires ffmpeg
 * on PATH.
 *
 * Usage: node scripts/hls-fixture.mjs
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'hls');
const MANIFEST = join(FIXTURE_DIR, 'vod.m3u8');

/**
 * Generate the fixture unless it already exists.
 *
 * @returns {string} Absolute path to the generated manifest
 * @throws {Error} When ffmpeg is unavailable or generation fails
 */
export function ensureHlsFixture() {
  if (existsSync(MANIFEST)) return MANIFEST;

  // Checked before the real call so a missing ffmpeg reports what to install
  // rather than surfacing as a raw ENOENT spawn error from execFileSync.
  // Nothing provides ffmpeg for free: the ubuntu-24.04 runner image no longer
  // ships one (ci.yml installs it explicitly before calling this), and a
  // developer machine may not have it either. Playwright's bundled ffmpeg does
  // not count - it lives under ~/.cache/ms-playwright and is never on PATH.
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.error) {
    throw new Error(
      'ffmpeg is not on PATH, so the local HLS fixture cannot be generated. ' +
        'Install it (macOS: `brew install ffmpeg`, Debian/Ubuntu: ' +
        '`apt-get install -y ffmpeg`) and re-run.'
    );
  }

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

// Allow running directly: node scripts/hls-fixture.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureHlsFixture();
}
