import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertViewEndContract, VIEW_END_REQUIRED } from './view-end-contract.mjs';

/** A 1.22 VOD fetch/unload viewEnd with every required field. */
function vodViewEnd(overrides = {}) {
  return {
    watchTime: 8000,
    playTime: 7000,
    startupTime: 400,
    rebufferCount: 0,
    rebufferDuration: 0,
    reconnectCount: 0,
    reconnectDuration: 0,
    avgBitrate: 264000,
    maxBitrate: 264000,
    qualityChanges: 1,
    pauseCount: 1,
    pauseDuration: 1200,
    seekCount: 1,
    elementSeekCount: 0,
    errorCount: 0,
    warningCount: 0,
    qoeScore: 90,
    qoeVersion: 2,
    rebufferRatio: 0,
    exitType: 'completed',
    completionRate: 100,
    gaugeScale: 'percent',
    ...overrides,
  };
}

/** A 1.22 live viewEnd. */
function liveViewEnd(overrides = {}) {
  return {
    ...vodViewEnd({
      exitType: 'liveEnded',
      completionRate: null,
      avgBitrate: 264000,
    }),
    dvrTime: 0,
    liveLatencySamples: 4,
    liveLatencyMean: 6,
    liveLatencyP95: 7,
    liveLatencyMax: 8,
    lowLatency: false,
    ...overrides,
  };
}

describe('assertViewEndContract', () => {
  it('accepts a full VOD viewEnd on either transport', () => {
    assertViewEndContract(vodViewEnd());
  });

  it('accepts a live viewEnd with latency summary and null completionRate', () => {
    assertViewEndContract(liveViewEnd(), { live: true });
  });

  it('accepts a live viewEnd that ended before its first latency reading', () => {
    const body = liveViewEnd();
    for (const key of ['liveLatencySamples', 'liveLatencyMean', 'liveLatencyP95', 'liveLatencyMax', 'lowLatency']) delete body[key];
    assertViewEndContract(body, { live: true });
  });

  it('fails a live viewEnd with a partial latency summary', () => {
    const body = liveViewEnd();
    delete body.liveLatencyP95;
    assert.throws(() => assertViewEndContract(body, { live: true }), /liveLatencyP95/);
  });

  it('accepts null bitrate fields', () => {
    assertViewEndContract(vodViewEnd({ avgBitrate: null, maxBitrate: null }));
  });

  it('fails when a required field is absent', () => {
    const { qoeVersion, ...missing } = vodViewEnd();
    assert.equal('qoeVersion' in missing, false);
    assert.throws(() => assertViewEndContract(missing), /lacks required field qoeVersion/);
  });

  it('fails the pre-1.22 unload subset that omitted QoE and counters', () => {
    const subset = {
      watchTime: 3000,
      playTime: 2500,
      startupTime: 400,
      rebufferCount: 0,
      rebufferDuration: 0,
      avgBitrate: null,
      maxBitrate: null,
      exitType: 'abandoned',
    };
    assert.throws(() => assertViewEndContract(subset), /lacks required field/);
  });

  it('fails qoeVersion other than 2', () => {
    assert.throws(() => assertViewEndContract(vodViewEnd({ qoeVersion: 1 })), /qoeVersion/);
  });

  it('fails non-finite bitrate', () => {
    assert.throws(() => assertViewEndContract(vodViewEnd({ avgBitrate: Infinity })), /avgBitrate/);
  });

  it('fails a live viewEnd with a numeric completionRate', () => {
    assert.throws(
      () => assertViewEndContract(liveViewEnd({ completionRate: 40 }), { live: true }),
      /live completionRate/
    );
  });

  it('fails VOD latency keys', () => {
    assert.throws(
      () => assertViewEndContract(vodViewEnd({ liveLatencySamples: 1 })),
      /liveLatencySamples/
    );
  });

  it('fails a viewEnd without gaugeScale', () => {
    const { gaugeScale, ...missing } = vodViewEnd();
    assert.throws(() => assertViewEndContract(missing), /lacks required field gaugeScale/);
  });

  it('fails gaugeScale ratio', () => {
    assert.throws(() => assertViewEndContract(vodViewEnd({ gaugeScale: 'ratio' })), /gaugeScale/);
  });

  it('accepts a null rebufferRatio', () => {
    assertViewEndContract(vodViewEnd({ rebufferRatio: null }));
  });

  it('fails a rebufferRatio above 100', () => {
    assert.throws(() => assertViewEndContract(vodViewEnd({ rebufferRatio: 101 })), /rebufferRatio/);
  });

  it('fails a negative rebufferRatio', () => {
    assert.throws(() => assertViewEndContract(vodViewEnd({ rebufferRatio: -1 })), /rebufferRatio/);
  });

  it('accepts a completionRate of 0.5 as a valid percent', () => {
    assertViewEndContract(vodViewEnd({ exitType: 'abandoned', completionRate: 0.5 }));
  });

  it('fails a completionRate above 100', () => {
    assert.throws(() => assertViewEndContract(vodViewEnd({ exitType: 'abandoned', completionRate: 101 })), /completionRate/);
  });

  it('fails negative counters', () => {
    assert.throws(() => assertViewEndContract(vodViewEnd({ seekCount: -1 })), /seekCount/);
  });

  it('lists every required 1.22 field', () => {
    assert.ok(VIEW_END_REQUIRED.includes('qoeVersion'));
    assert.ok(VIEW_END_REQUIRED.includes('reconnectCount'));
    assert.ok(VIEW_END_REQUIRED.includes('reconnectDuration'));
    assert.ok(VIEW_END_REQUIRED.includes('elementSeekCount'));
    assert.ok(VIEW_END_REQUIRED.includes('gaugeScale'));
  });
});
