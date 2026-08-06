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

import { execFileSync } from 'node:child_process';
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
