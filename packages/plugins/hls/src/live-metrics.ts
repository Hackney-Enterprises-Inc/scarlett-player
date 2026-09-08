/**
 * Live metrics: the single writer for the player's live/DVR state.
 *
 * Before this module, `liveLatency`, `liveEdge` and `seekableRange` had two
 * writers with different definitions of "latency": `hlsLevelLoaded` computed
 * an edge flag from the level details, and the `timeupdate` handler then
 * recomputed it unconditionally from `video.seekable` as `latency < 10`. Under
 * MSE the second source is wrong (`video.seekable.start(0)` stays 0 instead of
 * following the sliding window), and at a 2-4s low-latency target `< 10s` is
 * always true, so "GO LIVE" could never appear no matter how far a viewer
 * drifted. Every write of those keys now goes through {@link applyLiveMetrics},
 * so there is exactly one definition and no clobber.
 *
 * Latency truth differs by playback path:
 *
 * - **hls.js (MSE):** `hls.latency` is real wall-clock latency, computed from
 *   `EXT-X-PROGRAM-DATE-TIME` drift where the manifest carries it, measured
 *   against `hls.targetLatency` (which hls.js derives from `PART-HOLD-BACK` /
 *   `HOLD-BACK`, or from `liveSyncDuration`* config when set).
 * - **native (Safari/iOS):** there is no latency API. `video.seekable.end` is
 *   the best available stand-in for the edge, so latency is the distance to it
 *   — a buffer distance, not a measured latency. Treated as an approximation
 *   throughout, and the edge threshold is deliberately loose unless a target
 *   latency is known from a previous hls.js session on the same source.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { HlsInstance } from './types';

/**
 * The level-details fields the live path reads, as hls.js reports them on
 * `hlsLevelLoaded`.
 *
 * The LL-HLS members are the ones that decide whether a stream is *effectively*
 * low latency: a host can set `lowLatencyMode: true` against a plain live
 * manifest, and that must not produce an LL badge.
 */
export interface HlsLevelDetails {
  /** Whether the playlist is live (no EXT-X-ENDLIST) */
  live?: boolean;
  /** Total duration of the fragments in the playlist window, in seconds */
  totalduration?: number;
  /** EXT-X-TARGETDURATION, in seconds */
  targetduration?: number;
  /** Start of the sliding window, in seconds on the player timeline */
  fragmentStart?: number;
  /** End of the sliding window (live edge), in seconds on the player timeline */
  edge?: number;
  /** Fragments in the current playlist window */
  fragments?: Array<{ start?: number }>;
  /** LL-HLS: partial segments in the current window (EXT-X-PART) */
  partList?: unknown[] | null;
  /** LL-HLS: EXT-X-PART-INF PART-TARGET, in seconds */
  partTarget?: number;
  /** LL-HLS: EXT-X-SERVER-CONTROL CAN-BLOCK-RELOAD=YES */
  canBlockReload?: boolean;
  /** LL-HLS: EXT-X-SERVER-CONTROL PART-HOLD-BACK, in seconds */
  partHoldBack?: number;
  /** EXT-X-SERVER-CONTROL HOLD-BACK, in seconds */
  holdBack?: number;
}

/** A snapshot of the live state of the stream, from one source of truth. */
export interface LiveMetrics {
  /** Latency behind the live edge, in seconds */
  latency: number;
  /** Latency the stream is aiming for, in seconds */
  targetLatency: number;
  /** Whether the viewer counts as being AT the live edge (see below) */
  atEdge: boolean;
  /** DVR window on the player timeline, when it is known */
  seekableRange: { start: number; end: number } | null;
  /**
   * Whether low latency is EFFECTIVE: the manifest carries `EXT-X-PART` or
   * advertises `CAN-BLOCK-RELOAD=YES`, AND low latency was requested in the
   * plugin config. Both halves matter. A host that sets `lowLatencyMode`
   * against a plain live manifest gets no LL badge because the stream cannot
   * deliver it; a host that leaves the flag off gets none against an LL
   * manifest either, because hls.js will not load the parts.
   */
  lowLatency: boolean;
}

/** Where a {@link LiveMetrics} snapshot is measured from. */
export type LiveMetricsSource =
  | {
      /** hls.js (MSE) path: latency comes from hls.js itself */
      kind: 'hls';
      /** The live hls.js instance */
      hls: HlsInstance;
      /** Most recent level details, when one has been seen */
      details?: HlsLevelDetails | null;
      /**
       * Whether low latency was requested in the plugin config. Defaults to
       * true when omitted, so a caller that only has a manifest still gets the
       * manifest's answer.
       */
      lowLatencyRequested?: boolean;
    }
  | {
      /** Native path (Safari/iOS): latency is approximated from `seekable` */
      kind: 'media';
      /** The media element playing the live stream */
      media: HTMLMediaElement;
      /**
       * Target latency carried over from an hls.js session on the same source
       * (an AirPlay handoff). Absent on a stream that has only ever played
       * natively, where nothing reveals the manifest's hold-back.
       */
      targetLatency?: number;
      /**
       * Whether to report the stream as effectively low latency. The HLS
       * plugin never sets it on this path: native playback is a handoff, and
       * nothing is loading parts any more.
       */
      lowLatency?: boolean;
    };

/**
 * Target latency assumed when nothing better is known. Matches hls.js's own
 * fallback and the value `getLiveInfo()` reported before LL-HLS.
 */
export const DEFAULT_TARGET_LATENCY = 3;

/**
 * Floor on the edge tolerance, in seconds. A stream with a 1s part target
 * would otherwise flip to "GO LIVE" on ordinary jitter.
 */
export const MIN_EDGE_TOLERANCE = 1.5;

/**
 * Edge tolerance on the native path when no target latency is known.
 *
 * With the 3s default target this reproduces the historical `latency < 10`
 * threshold exactly. Nothing on the native path exposes the manifest's
 * hold-back, and a standard Safari live stream sits a full three target
 * durations behind `seekable.end` by design — a tight threshold there would
 * park every such viewer on a permanent "GO LIVE" button.
 */
export const NATIVE_EDGE_TOLERANCE = 7;

/** Latency/range changes smaller than this do not count as a change. */
const EPSILON = 0.05;

/**
 * Read a value that hls.js may report as `undefined`, `NaN` or `Infinity`.
 *
 * @param value - Candidate number
 * @returns The value when it is a usable finite number, else null
 */
function finite(value: number | undefined | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Derive the DVR window from level details.
 *
 * Preferred over `video.seekable` on the hls.js path: under MSE
 * `seekable.start(0)` stays 0 rather than following the sliding window, so
 * scrubbing to the start of the bar made hls.js jump back to live.
 *
 * @param details - Level details from `hlsLevelLoaded`
 * @returns The window, or null when the details carry no usable bounds
 */
function rangeFromDetails(
  details: HlsLevelDetails | null | undefined
): { start: number; end: number } | null {
  if (!details) return null;

  const start = finite(details.fragmentStart) ?? finite(details.fragments?.[0]?.start) ?? 0;
  const end = finite(details.edge) ?? finite(details.totalduration);
  if (end === null) return null;

  return { start, end };
}

/**
 * Derive the DVR window from a media element's `seekable` ranges.
 *
 * @param media - Media element
 * @returns The window, or null when the element reports no seekable range
 */
function rangeFromMedia(
  media: HTMLMediaElement | null
): { start: number; end: number } | null {
  const seekable = media?.seekable;
  if (!seekable || seekable.length === 0) return null;

  const start = seekable.start(0);
  const end = seekable.end(seekable.length - 1);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  return { start, end };
}

/**
 * Target latency implied by the manifest when hls.js has not computed one.
 *
 * LL-HLS declares `PART-HOLD-BACK`; a plain live playlist declares `HOLD-BACK`,
 * and specifies three target durations when it declares neither.
 *
 * @param details - Level details from `hlsLevelLoaded`
 * @returns The implied target latency in seconds, or null when unknown
 */
function targetFromDetails(details: HlsLevelDetails | null | undefined): number | null {
  if (!details) return null;

  const targetduration = finite(details.targetduration);

  return (
    finite(details.partHoldBack) ??
    finite(details.holdBack) ??
    (targetduration !== null ? targetduration * 3 : null)
  );
}

/**
 * Tolerance added to the target latency before a viewer counts as behind.
 *
 * `max(MIN_EDGE_TOLERANCE, partTarget ?? targetduration / 2)`: one part (or
 * half a segment) of slack, floored so a very short part target cannot make the
 * indicator twitch. This formula, with the `atEdge` comparison in
 * {@link computeLiveMetrics}, is what decides when "GO LIVE" appears.
 *
 * @param details - Level details, when known
 * @param targetLatency - Target latency, used when the details carry no durations
 * @returns Tolerance in seconds
 */
function edgeTolerance(
  details: HlsLevelDetails | null | undefined,
  targetLatency: number
): number {
  const targetduration = finite(details?.targetduration);
  const half = targetduration !== null ? targetduration / 2 : targetLatency / 2;

  return Math.max(MIN_EDGE_TOLERANCE, finite(details?.partTarget) ?? half);
}

/**
 * Measure the live state of the stream from one source.
 *
 * Call it only for live content: for VOD the numbers are meaningless and the
 * caller should not be writing live state at all.
 *
 * A viewer is AT the edge when `latency <= targetLatency + tolerance`, with the
 * tolerance from {@link edgeTolerance}.
 *
 * @param source - hls.js instance (with its latest level details) or media element
 * @returns The snapshot, or null when the source reveals nothing usable
 */
export function computeLiveMetrics(source: LiveMetricsSource): LiveMetrics | null {
  if (source.kind === 'hls') {
    const { hls, details } = source;
    const media = hls.media;

    const seekableRange = rangeFromDetails(details) ?? rangeFromMedia(media);
    const targetLatency =
      finite(hls.targetLatency) ?? targetFromDetails(details) ?? DEFAULT_TARGET_LATENCY;

    // hls.js reports measured latency; fall back to the distance to the edge
    // only before it has one (no PROGRAM-DATE-TIME yet, first playlist).
    const latency =
      finite(hls.latency) ??
      (seekableRange && media ? Math.max(0, seekableRange.end - media.currentTime) : null);
    if (latency === null && seekableRange === null) return null;

    const resolvedLatency = latency ?? 0;

    return {
      latency: resolvedLatency,
      targetLatency,
      atEdge: resolvedLatency <= targetLatency + edgeTolerance(details, targetLatency),
      seekableRange,
      // Effective LL, not requested LL: the manifest has to carry parts or
      // advertise blocking reloads, AND the host has to have asked for it.
      lowLatency:
        source.lowLatencyRequested !== false &&
        (!!details?.partList?.length || details?.canBlockReload === true),
    };
  }

  const { media } = source;
  const seekableRange = rangeFromMedia(media);
  if (!seekableRange) return null;

  const targetLatency = source.targetLatency ?? DEFAULT_TARGET_LATENCY;
  // Nothing on this path exposes the hold-back, so an unknown target latency
  // keeps the historical loose threshold rather than a tight LL one.
  const tolerance =
    source.targetLatency === undefined
      ? NATIVE_EDGE_TOLERANCE
      : Math.max(MIN_EDGE_TOLERANCE, source.targetLatency / 2);
  const latency = Math.max(0, seekableRange.end - media.currentTime);

  return {
    latency,
    targetLatency,
    atEdge: latency <= targetLatency + tolerance,
    seekableRange,
    lowLatency: source.lowLatency === true,
  };
}

/**
 * Write a metrics snapshot into player state and announce the changes.
 *
 * Writes `liveLatency`, `liveEdge`, `seekableRange` and `lowLatencyMode`, and
 * emits `live:latency`, `live:edgechange`, `live:seekablerange` and
 * `live:lowlatency` — each only when the value actually changed, so the 4Hz
 * `timeupdate` cadence does not spam the event bus with restatements. Latency
 * and the range compare with a small epsilon, because floating-point noise on
 * an otherwise idle stream is not a change.
 *
 * A null snapshot is a no-op: an unmeasurable moment must not reset state a
 * previous measurement established.
 *
 * @param api - Plugin API to write state and emit through
 * @param metrics - Snapshot from {@link computeLiveMetrics}, or null
 */
export function applyLiveMetrics(api: IPluginAPI, metrics: LiveMetrics | null): void {
  if (!metrics) return;

  const previousLatency = api.getState('liveLatency');
  if (Math.abs(previousLatency - metrics.latency) > EPSILON) {
    api.setState('liveLatency', metrics.latency);
    api.emit('live:latency', { latency: metrics.latency });
  }

  if (api.getState('liveEdge') !== metrics.atEdge) {
    api.setState('liveEdge', metrics.atEdge);
    api.emit('live:edgechange', { atEdge: metrics.atEdge });
  }

  const range = metrics.seekableRange;
  if (range) {
    const previous = api.getState('seekableRange');
    if (
      !previous ||
      Math.abs(previous.start - range.start) > EPSILON ||
      Math.abs(previous.end - range.end) > EPSILON
    ) {
      api.setState('seekableRange', { start: range.start, end: range.end });
      api.emit('live:seekablerange', { start: range.start, end: range.end });
    }
  }

  if (api.getState('lowLatencyMode') !== metrics.lowLatency) {
    api.setState('lowLatencyMode', metrics.lowLatency);
    api.emit('live:lowlatency', { enabled: metrics.lowLatency });
  }
}

/**
 * Clear every live key this module owns.
 *
 * Called from the plugin's `cleanup()`, so a source change or a provider
 * switch cannot leave the previous stream's LL badge, latency readout or DVR
 * window over the new one. `live` itself is deliberately untouched: the
 * provider switches re-enter with the same stream still playing, and
 * `getLiveInfo()` answers null while that key is false.
 *
 * @param api - Plugin API to write state through
 */
export function resetLiveMetrics(api: IPluginAPI): void {
  if (api.getState('lowLatencyMode')) {
    api.setState('lowLatencyMode', false);
    api.emit('live:lowlatency', { enabled: false });
  }

  api.setState('liveLatency', 0);
  api.setState('liveEdge', false);
  api.setState('seekableRange', null);
}
