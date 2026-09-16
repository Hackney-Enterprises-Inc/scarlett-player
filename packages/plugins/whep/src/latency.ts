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
 */

/**
 * One estimate.
 */
export interface LatencyEstimate {
  /** The estimate in seconds: `jitterBufferSeconds + rttSeconds / 2`. */
  latency: number;
  /** Mean time a video frame spent in the jitter buffer, in seconds. */
  jitterBufferSeconds: number;
  /** Round trip on the selected candidate pair, in seconds (0 when unknown). */
  rttSeconds: number;
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
 * @returns The estimate, or `null` when no video has been emitted yet
 */
export function estimateLatency(report: Iterable<unknown>): LatencyEstimate | null {
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
  const emitted = inbound.jitterBufferEmittedCount ?? 0;
  if (emitted <= 0) return null;
  const jitterBufferSeconds = (inbound.jitterBufferDelay ?? 0) / emitted;

  let pair = selectedPairId ? pairs.find((p) => p.id === selectedPairId) : undefined;
  if (!pair) pair = pairs.find((p) => p.state === 'succeeded' && p.nominated);
  if (!pair) pair = pairs.find((p) => p.state === 'succeeded');
  const rttSeconds = pair?.currentRoundTripTime ?? 0;

  return {
    latency: jitterBufferSeconds + rttSeconds / 2,
    jitterBufferSeconds,
    rttSeconds,
  };
}
