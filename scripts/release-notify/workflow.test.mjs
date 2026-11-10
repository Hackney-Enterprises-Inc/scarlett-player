import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const release = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');

/** Text of a top-level job block (from `  <name>:` to the next top-level job or EOF). */
function jobBlock(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `  ${name}:`);
  assert.notEqual(start, -1, `job ${name} not found`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('release.yml notify job', () => {
  const notify = jobBlock(release, 'notify');

  it('needs release and cdn', () => {
    assert.match(notify, /^ {4}needs: \[release, cdn\]$/m);
  });

  it('runs only after a successful, published release and CDN deploy', () => {
    assert.match(notify, /always\(\)/);
    assert.match(notify, /needs\.release\.result == 'success'/);
    assert.match(notify, /needs\.release\.outputs\.published == 'true'/);
    assert.match(notify, /needs\.cdn\.result == 'success'/);
  });

  it('checks out the release tag without persisting credentials', () => {
    assert.match(notify, /ref: v\$\{\{ needs\.release\.outputs\.version \}\}/);
    assert.match(notify, /persist-credentials: false/);
  });

  it('reads the webhook only through the secrets context', () => {
    const hits = notify.match(/SLACK_RELEASE_WEBHOOK_URL/g) ?? [];
    assert.ok(hits.length >= 1);
    assert.match(notify, /SLACK_RELEASE_WEBHOOK_URL: \$\{\{ secrets\.SLACK_RELEASE_WEBHOOK_URL \}\}/);
  });

  it('references the webhook secret only in the notify job, nowhere else in release.yml or ci.yml (16 P3)', () => {
    const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
    assert.ok(!/SLACK_RELEASE_WEBHOOK_URL/.test(ci), 'ci.yml must not mention the webhook secret');
    const outside = release.replace(notify, '');
    // comments may name the secret; no non-comment line outside notify may.
    const code = outside.split('\n').filter((l) => !/^\s*#/.test(l));
    assert.ok(!code.some((l) => /SLACK_RELEASE_WEBHOOK_URL/.test(l)), 'secret leaked outside notify job');
    const webhookRefs = notify.match(/secrets\.[A-Z_]*SLACK[A-Z_]*/g) ?? [];
    assert.deepEqual(webhookRefs, ['secrets.SLACK_RELEASE_WEBHOOK_URL']);
    assert.equal((notify.match(/\$\{\{[^}]*SLACK_RELEASE_WEBHOOK_URL[^}]*\}\}/g) ?? []).length, 1);
  });

  it('runs the notify script with the version', () => {
    assert.match(notify, /node scripts\/release-notify\.mjs --version/);
  });
});

describe('release job contract', () => {
  it('keeps the outputs cdn and notify read', () => {
    const job = jobBlock(release, 'release');
    assert.match(job, /^ {6}version: /m);
    assert.match(job, /^ {6}published: /m);
  });
});

describe('no webhook literal in the repo', () => {
  it('has no Slack webhook host string under .github/ or scripts/', () => {
    const needle = ['hooks', 'slack', 'com'].join('.');
    const offenders = [...walk(join(root, '.github')), ...walk(join(root, 'scripts'))].filter((file) =>
      readFileSync(file, 'utf8').includes(needle),
    );
    assert.deepEqual(offenders, []);
  });
});
