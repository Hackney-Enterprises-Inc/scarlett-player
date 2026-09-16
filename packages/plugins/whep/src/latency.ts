/**
 * The receiver-side latency estimate.
 *
 * WebRTC exposes no glass-to-glass clock. What `getStats()` can see is how
 * long the browser held video in its jitter buffer before emitting it, and
 * the round trip to the server on the selected candidate pair. The sum of
 * the buffer delay and half the round trip is the receiver's share of the
 * delay: it says nothing about the encoder, the server's tap, or the
 * publisher's uplink, and it is labelled an estimate everywhere it appears.
 * An end-to-end number needs a clock burned into the picture.
 *
 * The jitter buffer counters are cumulative since the connection came up,
 * so a single read yields the mean over the whole session and a network
 * that was fine for ten minutes and bad for the last one reads as fine.
 * The poll therefore hands each call the counters it saw last time, and
 * the estimate covers the frames emitted since then.
 */

/**
 * The cumulative counters one estimate was read from, handed back to the
 * next call so it can measure only the frames emitted in between.
 */
export interface LatencySample {
  /** Total seconds every emitted video frame spent in the jitter buffer. */
  jitterBufferDelay: number;
  /** Total video frames emitted from the jitter buffer. */
  jitterBufferEmittedCount: number;
}

/**
 * One estimate.
 */
export interface LatencyEstimate {
  /** The estimate in seconds: `jitterBufferSeconds + rttSeconds / 2`. */
  latency: number;
  /**
   * Mean time a video frame spent in the jitter buffer, in seconds, over
   * the frames emitted since the previous sample (or since the connection
   * came up, when there was no previous sample).
   */
  jitterBufferSeconds: number;
  /** Round trip on the selected candidate pair, in seconds (0 when unknown). */
  rttSeconds: number;
  /** The counters this estimate was read from; pass to the next call. */
  sample: LatencySample;
}

/**
 * The stats fields this module reads, spelled out because `RTCStats` is
 * typed as its base shape and the per-type fields are looked up by name.
 */
interface StatsEntry {
  type: string;
  id?: string;
  kind?: string;
  mediaType?: string;
  jitterBufferDelay?: number;
  jitterBufferEmittedCount?: number;
  currentRoundTripTime?: number;
  state?: string;
  nominated?: boolean;
  selectedCandidatePairId?: string;
}

/**
 * Reduce a stats report to a latency estimate.
 *
 * @param report - The `RTCPeerConnection.getStats()` result
 * @param previous - The sample the last call returned, or `null` for the
 *   first read; the estimate then covers only the frames emitted since it
 * @returns The estimate, or `null` when no video frame has been emitted
 *   (since `previous`, when one was given) so the last value should stand
 */
export function estimateLatency(
  report: Iterable<unknown>,
  previous: LatencySample | null = null
): LatencyEstimate | null {
  let inbound: StatsEntry | null = null;
  let selectedPairId: string | undefined;
  const pairs: StatsEntry[] = [];

  for (const raw of report) {
    // A real report iterates values; a Map's default iterator yields
    // [key, value] pairs, which a test may pass. Accept both.
    const entry = (Array.isArray(raw) ? raw[1] : raw) as StatsEntry | undefined;
    if (!entry || typeof entry !== 'object') continue;
    switch (entry.type) {
      case 'inbound-rtp':
        if ((entry.kind ?? entry.mediaType) === 'video') inbound = entry;
        break;
      case 'transport':
        if (entry.selectedCandidatePairId) selectedPairId = entry.selectedCandidatePairId;
        break;
      case 'candidate-pair':
        pairs.push(entry);
        break;
    }
  }

  if (!inbound) return null;
  const sample: LatencySample = {
    jitterBufferDelay: inbound.jitterBufferDelay ?? 0,
    jitterBufferEmittedCount: inbound.jitterBufferEmittedCount ?? 0,
  };

  // A counter that went backwards is a new SSRC (the server restarted the
  // track); measure from the start again rather than against stale totals.
  const base =
    previous && previous.jitterBufferEmittedCount <= sample.jitterBufferEmittedCount
      ? previous
      : { jitterBufferDelay: 0, jitterBufferEmittedCount: 0 };
  const emitted = sample.jitterBufferEmittedCount - base.jitterBufferEmittedCount;
  if (emitted <= 0) return null;
  const jitterBufferSeconds = (sample.jitterBufferDelay - base.jitterBufferDelay) / emitted;

  let pair = selectedPairId ? pairs.find((p) => p.id === selectedPairId) : undefined;
  if (!pair) pair = pairs.find((p) => p.state === 'succeeded' && p.nominated);
  if (!pair) pair = pairs.find((p) => p.state === 'succeeded');
  const rttSeconds = pair?.currentRoundTripTime ?? 0;

  return {
    latency: jitterBufferSeconds + rttSeconds / 2,
    jitterBufferSeconds,
    rttSeconds,
    sample,
  };
}
