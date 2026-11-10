import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlackMessage } from './message.mjs';
import { hasMarker, withMarker, MARKER } from './marker.mjs';

const base = {
  version: '1.27.1',
  releaseUrl: 'https://github.com/o/r/releases/tag/v1.27.1',
  runUrl: 'https://github.com/o/r/actions/runs/1/attempts/1',
  repo: 'o/r',
};
const change = (text, n = 144) => ({ level: 'Patch', text, pr: n, url: `https://github.com/o/r/pull/${n}` });
const flat = (msg) => JSON.stringify(msg);

describe('buildSlackMessage', () => {
  it('has a header, a plain-text fallback and the four links', () => {
    const msg = buildSlackMessage({ ...base, changes: [change('Fixed a thing')] });
    assert.equal(msg.text, 'Scarlett Player v1.27.1 released');
    assert.equal(msg.blocks[0].type, 'header');
    assert.match(msg.blocks[0].text.text, /Scarlett Player v1\.27\.1 released/);
    const json = flat(msg);
    assert.ok(json.includes(base.releaseUrl));
    assert.ok(json.includes(base.runUrl));
    assert.ok(json.includes('@scarlett-player/embed@1.27.1'));
    assert.ok(json.includes('/v1.27.1/'));
  });

  it('truncates to 8 bullets and adds a "+N more" line', () => {
    const changes = Array.from({ length: 11 }, (_, i) => change(`Change ${i}`, 100 + i));
    const json = flat(buildSlackMessage({ ...base, changes }));
    assert.ok(json.includes('Change 7'));
    assert.ok(!json.includes('Change 8'));
    assert.ok(json.includes('+3 more'));
  });

  it('truncates a long bullet to about 200 characters', () => {
    const json = flat(buildSlackMessage({ ...base, changes: [change('x'.repeat(500))] }));
    assert.ok(!json.includes('x'.repeat(250)));
    assert.ok(json.includes('…'));
  });

  it('escapes & < > and converts markdown links to mrkdwn', () => {
    const msg = buildSlackMessage({
      ...base,
      changes: [change('A <b> & [docs](https://example.com/x) link')],
    });
    const json = flat(msg);
    assert.ok(json.includes('&lt;b&gt; &amp; <https://example.com/x|docs> link'));
  });

  it('keeps the section text within the Slack limit after escaping (16-F3)', () => {
    const changes = Array.from({ length: 8 }, (_, i) => change('&'.repeat(199) + i, 100 + i));
    const msg = buildSlackMessage({ ...base, changes });
    const section = msg.blocks.find((b) => b.type === 'section');
    assert.ok(section.text.text.length <= 3000, `section is ${section.text.text.length} chars`);
    assert.match(section.text.text, /\+\d+ more/);
  });

  it('never cuts a markdown link in half when truncating (16 P3)', () => {
    const text = `${'x'.repeat(190)} [docs](https://example.com/a/very/long/path/that/goes/on) tail`;
    const json = flat(buildSlackMessage({ ...base, changes: [change(text)] }));
    assert.ok(!json.includes('](https'), 'raw markdown link leaked');
    assert.ok(!/\[docs\]/.test(json));
  });

  it('says so when there are no changelog entries', () => {
    const json = flat(buildSlackMessage({ ...base, changes: [] }));
    assert.ok(json.includes('No changelog entries; see release notes'));
  });
});

describe('marker', () => {
  it('detects and appends the marker once', () => {
    assert.equal(hasMarker('notes'), false);
    const marked = withMarker('notes');
    assert.ok(marked.includes(MARKER));
    assert.equal(hasMarker(marked), true);
    assert.equal(withMarker(marked), marked);
    assert.equal(MARKER, '<!-- slack-notified -->');
  });

  it('tolerates a null body', () => {
    assert.equal(hasMarker(null), false);
    assert.ok(hasMarker(withMarker(null)));
  });
});
