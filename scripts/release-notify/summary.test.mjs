import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectChanges, extractVersionSection, findChangelogs } from './summary.mjs';

const REPO = 'https://github.com/Hackney-Enterprises-Inc/scarlett-player';
const prefix = (n, sha) =>
  `[#${n}](${REPO}/pull/${n}) [\`${sha}\`](${REPO}/commit/${sha}0000) Thanks [@alexhackney](https://github.com/alexhackney)! - `;

const CORE = `# @scarlett-player/core

## 1.27.1

### Patch Changes

- ${prefix(144, '3881dc4')}Source URLs and the poster URL in load and Chromecast logs are now sanitized.

## 1.27.0

### Minor Changes

- ${prefix(143, '2da2572')}Add a \`playback:blocked\` event.

### Patch Changes

- ${prefix(143, '2da2572')}The error beacon carries \`stalled: true\`.
`;

const HLS = `# @scarlett-player/hls

## 1.27.1

### Patch Changes

- ${prefix(144, '3881dc4')}The hls.js library load is retried once.

- ${prefix(144, '3881dc4')}Native HLS live streams now report \`live: false\` once the stream ends,
  as hls.js does.

- ${prefix(144, '3881dc4')}On iOS/Safari, repeat failures are only logged.

## 1.27.0

### Minor Changes

- ${prefix(143, '2da2572')}A playback stall now ends in a fatal error.
`;

const EMBED = `# Changelog

## 1.27.1

### Patch Changes

- Updated dependencies [[\`3881dc4\`](${REPO}/commit/3881dc4)]:
  - @scarlett-player/core@1.27.1

## 1.27.0

### Patch Changes

- Updated dependencies [[\`2da2572\`](${REPO}/commit/2da2572)]:
  - @scarlett-player/core@1.27.0
`;

describe('extractVersionSection', () => {
  it('stops at the next version heading', () => {
    const section = extractVersionSection(CORE, '1.27.1');
    assert.match(section, /sanitized/);
    assert.doesNotMatch(section, /playback:blocked/);
  });

  it('returns an empty string for an unknown version', () => {
    assert.equal(extractVersionSection(CORE, '9.9.9'), '');
  });

  it('does not match 1.27.1 inside 1.27.10', () => {
    assert.equal(extractVersionSection('## 1.27.10\n\n- x\n', '1.27.1'), '');
  });
});

describe('collectChanges', () => {
  it('returns the 4 unique entries for 1.27.1, drops "Updated dependencies", keeps PR #144 links', () => {
    const changes = collectChanges([CORE, HLS, EMBED, CORE], '1.27.1');
    assert.equal(changes.length, 4);
    assert.ok(changes.every((c) => c.level === 'Patch'));
    assert.ok(changes.every((c) => c.pr === 144));
    assert.ok(changes.every((c) => c.url === `${REPO}/pull/144`));
    assert.ok(changes.every((c) => !/Updated dependencies/.test(c.text)));
    assert.ok(changes.every((c) => !/Thanks/.test(c.text)));
  });

  it('joins a wrapped bullet into one line', () => {
    const changes = collectChanges([HLS], '1.27.1');
    assert.ok(changes.some((c) => c.text.endsWith('live: false` once the stream ends, as hls.js does.')));
  });

  it('excludes bullets from other versions', () => {
    const changes = collectChanges([CORE, HLS], '1.27.1');
    assert.ok(!changes.some((c) => /playback:blocked|stall/.test(c.text)));
  });

  it('orders Major, then Minor, then Patch', () => {
    const changes = collectChanges([CORE, HLS], '1.27.0');
    assert.deepEqual(
      changes.map((c) => c.level),
      ['Minor', 'Minor', 'Patch'],
    );
  });

  it('de-duplicates the same text across files', () => {
    assert.equal(collectChanges([CORE, CORE], '1.27.1').length, 1);
  });

  it('returns [] when nothing matches', () => {
    assert.deepEqual(collectChanges([EMBED], '1.27.1'), []);
  });
});

describe('findChangelogs', () => {
  it('finds packages/*/ and packages/plugins/*/ changelogs only', () => {
    const root = mkdtempSync(join(tmpdir(), 'rn-'));
    for (const dir of ['packages/core', 'packages/plugins/hls', 'packages/plugins/empty']) {
      mkdirSync(join(root, dir), { recursive: true });
    }
    writeFileSync(join(root, 'packages/core/CHANGELOG.md'), 'a');
    writeFileSync(join(root, 'packages/plugins/hls/CHANGELOG.md'), 'b');
    writeFileSync(join(root, 'CHANGELOG.md'), 'index');
    const found = findChangelogs(root).map((p) => p.replace(root, ''));
    assert.deepEqual(found.sort(), ['/packages/core/CHANGELOG.md', '/packages/plugins/hls/CHANGELOG.md']);
  });
});
