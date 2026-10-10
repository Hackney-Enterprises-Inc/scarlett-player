import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLiveOrigin, LIVE_SEGMENTS, LIVE_SEGMENT_SECONDS, LIVE_WINDOW } from './live-origin.mjs';

describe('createLiveOrigin', () => {
  it('primes six segments with no ENDLIST on the first request', () => {
    const origin = createLiveOrigin({ now: () => 1_000_000 });
    const text = origin.playlist();
    assert.match(text, /^#EXTM3U/);
    assert.doesNotMatch(text, /EXT-X-ENDLIST/);
    assert.match(text, /EXT-X-MEDIA-SEQUENCE:0/);
    assert.equal([...text.matchAll(/#EXTINF/g)].length, LIVE_WINDOW);
    assert.match(text, /seg0\.ts/);
    assert.match(text, /seg5\.ts/);
  });

  it('keeps advancing past the 30-segment fixture with discontinuity wrapping', () => {
    let now = 1_000_000;
    const origin = createLiveOrigin({ now: () => now });
    origin.playlist();
    now += 52_000;
    const afterCap = origin.playlist();
    const published = origin.publishedCount();
    assert.ok(published > LIVE_SEGMENTS, `published ${published} should exceed ${LIVE_SEGMENTS}`);
    assert.match(afterCap, /EXT-X-DISCONTINUITY/);
    assert.match(afterCap, new RegExp(`seg${(published - 1) % LIVE_SEGMENTS}\\.ts`));
    assert.doesNotMatch(afterCap, /EXT-X-ENDLIST/);
  });

  it('sets DISCONTINUITY-SEQUENCE when the window starts after a wrap', () => {
    let now = 1_000_000;
    const origin = createLiveOrigin({ now: () => now });
    origin.playlist();
    // Far enough that the whole window sits past the first wrap.
    now += (LIVE_SEGMENTS + LIVE_WINDOW) * LIVE_SEGMENT_SECONDS * 1000;
    const text = origin.playlist();
    const first = Math.max(0, origin.publishedCount() - LIVE_WINDOW);
    assert.ok(first >= LIVE_SEGMENTS, `window start ${first} should be past the ${LIVE_SEGMENTS}-segment wrap`);
    assert.match(text, new RegExp(`EXT-X-DISCONTINUITY-SEQUENCE:${Math.floor(first / LIVE_SEGMENTS)}`));
  });

  it('fails playlist refreshes while in outage and resumes after', () => {
    const origin = createLiveOrigin({ now: () => 1_000_000 });
    origin.startOutage();
    assert.equal(origin.isOutage(), true);
    origin.endOutage();
    assert.equal(origin.isOutage(), false);
    assert.match(origin.playlist(), /#EXTM3U/);
  });

  it('freezes publication and appends ENDLIST independently of the clock', () => {
    let now = 1_000_000;
    const origin = createLiveOrigin({ now: () => now });
    origin.playlist();
    now += 4000;
    origin.finishWithEndlist();
    const frozen = origin.publishedCount();
    now += 60_000;
    const text = origin.playlist();
    assert.equal(origin.publishedCount(), frozen);
    assert.match(text, /EXT-X-ENDLIST/);
    assert.equal([...text.matchAll(/#EXTINF/g)].length, Math.min(LIVE_WINDOW, frozen));
  });

  it('reset clears clock, outage and ENDLIST separately', () => {
    const origin = createLiveOrigin({ now: () => 1_000_000 });
    origin.playlist();
    origin.startOutage();
    origin.finishWithEndlist();
    origin.reset();
    assert.equal(origin.isOutage(), false);
    assert.equal(origin.hasEndlist(), false);
    assert.equal(origin.startedAt(), null);
    assert.doesNotMatch(origin.playlist(), /EXT-X-ENDLIST/);
  });
});
