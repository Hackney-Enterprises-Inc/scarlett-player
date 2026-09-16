/**
 * Tests for the receiver-side latency estimate.
 */
import { describe, it, expect } from 'vitest';
import { estimateLatency } from '../src/latency';

const inbound = { id: 'in', type: 'inbound-rtp', kind: 'video', jitterBufferDelay: 6, jitterBufferEmittedCount: 120 };

describe('estimateLatency', () => {
  it('is the mean jitter buffer delay plus half the selected pair RTT', () => {
    const report = new Map<string, unknown>([
      ['in', inbound],
      ['t', { id: 't', type: 'transport', selectedCandidatePairId: 'p2' }],
      ['p1', { id: 'p1', type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 1 }],
      ['p2', { id: 'p2', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.04 }],
    ]);
    const estimate = estimateLatency(report);
    expect(estimate?.latency).toBeCloseTo(0.07, 10);
    expect(estimate?.jitterBufferSeconds).toBeCloseTo(0.05, 10);
    expect(estimate?.rttSeconds).toBeCloseTo(0.04, 10);
  });

  it('falls back to the nominated succeeded pair, then any succeeded pair', () => {
    const nominated = [
      inbound,
      { id: 'p1', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 1 },
      { id: 'p2', type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.1 },
    ];
    expect(estimateLatency(nominated)?.rttSeconds).toBe(0.1);

    const any = [inbound, { id: 'p1', type: 'candidate-pair', state: 'failed', currentRoundTripTime: 9 }, { id: 'p2', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.3 }];
    expect(estimateLatency(any)?.rttSeconds).toBe(0.3);
  });

  it('reads the older mediaType spelling and reports no RTT when no pair succeeded', () => {
    const report = [{ id: 'in', type: 'inbound-rtp', mediaType: 'video', jitterBufferDelay: 1, jitterBufferEmittedCount: 10 }];
    expect(estimateLatency(report)).toEqual({ latency: 0.1, jitterBufferSeconds: 0.1, rttSeconds: 0 });
  });

  it('is null before any video frame was emitted, and for audio only', () => {
    expect(estimateLatency([])).toBeNull();
    expect(estimateLatency([{ id: 'in', type: 'inbound-rtp', kind: 'video', jitterBufferDelay: 0, jitterBufferEmittedCount: 0 }])).toBeNull();
    expect(estimateLatency([{ id: 'in', type: 'inbound-rtp', kind: 'audio', jitterBufferDelay: 1, jitterBufferEmittedCount: 10 }])).toBeNull();
  });
});
