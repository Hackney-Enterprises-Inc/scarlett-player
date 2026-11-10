import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../release-notify.mjs';
import { MARKER } from './marker.mjs';

// Fake webhook assembled at runtime so no webhook-shaped literal sits in the repo.
const FAKE_URL = ['https:', '', 'chat.example.test', 'T000', 'B000', 'SECRETVALUE'].join('/');
const REPO = 'https://github.com/o/r';

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'rn-cli-'));
  mkdirSync(join(root, 'packages/core'), { recursive: true });
  writeFileSync(
    join(root, 'packages/core/CHANGELOG.md'),
    `# core\n\n## 1.2.3\n\n### Patch Changes\n\n- [#9](${REPO}/pull/9) [\`abc\`](${REPO}/commit/abc) Thanks [@a](https://github.com/a)! - Fixed it.\n`,
  );
  return root;
}

function harness({ env = {}, execImpl, fetchImpl, extra = [] } = {}) {
  const logs = [];
  const fetchCalls = [];
  const execCalls = [];
  const root = makeRoot();
  const run = (argv) =>
    main({
      argv: [...argv, '--root', root, ...extra],
      env,
      log: (line) => logs.push(String(line)),
      fetch: async (url, init) => {
        fetchCalls.push({ url, init });
        return fetchImpl ? fetchImpl(url, init) : { ok: true, status: 200, text: async () => 'ok' };
      },
      exec: (cmd, args, opts) => {
        execCalls.push({ cmd, args, opts });
        return execImpl ? execImpl(cmd, args, opts) : JSON.stringify({ body: 'Release notes' });
      },
    });
  return { run, logs, fetchCalls, execCalls, root };
}

const LIVE_ENV = { SLACK_RELEASE_WEBHOOK_URL: FAKE_URL, GH_TOKEN: 'tok', REPO: 'o/r', RUN_URL: 'https://run' };

describe('release-notify --dry-run', () => {
  it('prints the payload, never calls fetch and never reads the webhook secret', async () => {
    const env = new Proxy(
      { GH_TOKEN: '' },
      {
        get(target, key) {
          if (key === 'SLACK_RELEASE_WEBHOOK_URL') throw new Error('secret was read');
          return target[key];
        },
      },
    );
    const h = harness({ env });
    const code = await h.run(['--dry-run', '--version', '1.2.3']);
    assert.equal(code, 0);
    assert.equal(h.fetchCalls.length, 0);
    assert.equal(h.execCalls.length, 0);
    const out = h.logs.join('\n');
    assert.match(out, /Fixed it/);
    assert.match(out, /not checked/);
  });

  it('exits non-zero when the section has bullets but none parse (16-F4)', async () => {
    const h = harness();
    writeFileSync(
      join(h.root, 'packages/core/CHANGELOG.md'),
      '# core\n\n## 1.2.3\n\n### Fixes\n\n- Something was fixed\n',
    );
    const code = await h.run(['--dry-run', '--version', '1.2.3']);
    assert.equal(code, 1);
    assert.match(h.logs.join('\n'), /::error::/);
  });

  it('still exits 0 when the version is simply absent from every changelog', async () => {
    const h = harness();
    assert.equal(await h.run(['--dry-run', '--version', '9.9.9']), 0);
  });

  it('checks the marker only when GH_TOKEN is set', async () => {
    const h = harness({ env: { GH_TOKEN: 'tok' } });
    await h.run(['--dry-run', '--version', '1.2.3']);
    assert.equal(h.execCalls.length, 1);
    assert.equal(h.fetchCalls.length, 0);
  });
});

describe('release-notify live path (stubbed fetch)', () => {
  it('sends once, then marks the release', async () => {
    const h = harness({ env: LIVE_ENV });
    const code = await h.run(['--version', '1.2.3']);
    assert.equal(code, 0);
    assert.equal(h.fetchCalls.length, 1);
    assert.equal(h.fetchCalls[0].url, FAKE_URL);
    assert.equal(h.fetchCalls[0].init.method, 'POST');
    const payload = JSON.parse(h.fetchCalls[0].init.body);
    assert.match(payload.text, /v1\.2\.3/);
    const edit = h.execCalls.find((c) => c.args.includes('edit'));
    assert.ok(edit, 'gh release edit was called');
    assert.ok(edit.opts.input.includes(MARKER));
    assert.ok(!h.logs.join('\n').includes(FAKE_URL));
  });

  it('skips the send when the marker is already present', async () => {
    const h = harness({
      env: LIVE_ENV,
      execImpl: () => JSON.stringify({ body: `notes\n${MARKER}` }),
    });
    const code = await h.run(['--version', '1.2.3']);
    assert.equal(code, 0);
    assert.equal(h.fetchCalls.length, 0);
    assert.match(h.logs.join('\n'), /already notified/);
  });

  it('exits 1 on a Slack 500 without leaking the webhook URL', async () => {
    const h = harness({
      env: LIVE_ENV,
      fetchImpl: () => ({ ok: false, status: 500, text: async () => 'server_error' }),
    });
    const code = await h.run(['--version', '1.2.3']);
    assert.equal(code, 1);
    const out = h.logs.join('\n');
    assert.match(out, /500/);
    assert.match(out, /server_error/);
    assert.ok(!out.includes(FAKE_URL));
    assert.ok(!out.includes('SECRETVALUE'));
    assert.ok(!h.execCalls.some((c) => c.args.includes('edit')), 'must not mark after a failed send');
  });

  it('says the message MAY have been sent after a network failure (16-F2)', async () => {
    const h = harness({
      env: LIVE_ENV,
      fetchImpl: () => {
        throw new TypeError('socket hang up');
      },
    });
    const code = await h.run(['--version', '1.2.3']);
    assert.equal(code, 1);
    const out = h.logs.join('\n');
    assert.match(out, /may have been sent/i);
    assert.match(out, /check the channel/i);
    assert.ok(!/was not sent/i.test(out));
    assert.ok(!out.includes('SECRETVALUE'));
  });

  it('warns and exits 0 when the secret is missing', async () => {
    const h = harness({ env: { GH_TOKEN: 'tok' } });
    const code = await h.run(['--version', '1.2.3']);
    assert.equal(code, 0);
    assert.equal(h.fetchCalls.length, 0);
    assert.match(h.logs.join('\n'), /::warning::/);
  });

  it('exits 1 saying the message WAS sent when marking fails', async () => {
    const h = harness({
      env: LIVE_ENV,
      execImpl: (cmd, args) => {
        if (args.includes('edit')) throw new Error('gh exploded');
        return JSON.stringify({ body: 'notes' });
      },
    });
    const code = await h.run(['--version', '1.2.3']);
    assert.equal(code, 1);
    assert.equal(h.fetchCalls.length, 1);
    assert.match(h.logs.join('\n'), /WAS sent/);
  });
});
