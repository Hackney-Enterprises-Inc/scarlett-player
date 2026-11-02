/**
 * Independent 1.22 viewEnd wire-contract checks for the capture harness, plus
 * `startState` (the release after 1.26.0). The harness bundles the player from
 * source, so this always checks the current producer.
 *
 * Mirrors the production payload builder's field set without importing it.
 * Normal fetch and unload sendBeacon viewEnds share these required fields.
 */

/** Shared by every viewEnd, both transports. */
export const VIEW_END_REQUIRED = [
  'watchTime',
  'playTime',
  'startupTime',
  'rebufferCount',
  'rebufferDuration',
  'reconnectCount',
  'reconnectDuration',
  'avgBitrate',
  'maxBitrate',
  'qualityChanges',
  'pauseCount',
  'pauseDuration',
  'seekCount',
  'elementSeekCount',
  'errorCount',
  'warningCount',
  'qoeScore',
  'qoeVersion',
  'rebufferRatio',
  'exitType',
  'completionRate',
  'gaugeScale',
  'startState',
];

/** Live-only latency summary; absent on VOD. */
export const LATENCY_KEYS = [
  'liveLatencySamples',
  'liveLatencyMean',
  'liveLatencyP95',
  'liveLatencyMax',
  'lowLatency',
];

/** Measured hls.js interval fields; the runner checks they are absent on native MP4. */
export const SEGMENT_KEYS = [
  'segmentCount',
  'segmentBytes',
  'segmentLoadAvgMs',
  'segmentLoadMaxMs',
  'segmentErrors',
  'segmentThroughputBps',
];

/** Measured frame deltas; omitted when the element cannot report them. */
export const FRAME_KEYS = ['decodedFrames', 'droppedFrames'];

const EXIT_TYPES = new Set(['completed', 'liveEnded', 'abandoned', 'error', 'background']);

/** Why a view did or did not start playing; sent on every viewEnd by the producer that carries it. */
export const START_STATES = new Set(['played', 'awaitingTap', 'failed', 'never']);

const COUNTERS = [
  'rebufferCount',
  'reconnectCount',
  'qualityChanges',
  'pauseCount',
  'seekCount',
  'elementSeekCount',
  'errorCount',
  'warningCount',
];

const DURATIONS_MS = ['watchTime', 'playTime', 'rebufferDuration', 'reconnectDuration', 'pauseDuration'];

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function finiteOrNull(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function nonNegInt(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function nonNegFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * @param {unknown} value
 * @returns {boolean} True for a finite number within 0..100
 */
function isPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Validate type, units and nullable semantics of a 1.22 viewEnd body.
 *
 * Does not compare values across different viewing sessions.
 *
 * @param {Record<string, unknown>} body
 * @param {{ live?: boolean }} [options]
 * @returns {void}
 * @throws {Error} When a required field is missing or malformed
 */
export function assertViewEndContract(body, options = {}) {
  if (!body || typeof body !== 'object') throw new Error('viewEnd body is missing');
  const live = options.live === true;

  for (const key of VIEW_END_REQUIRED) {
    if (!(key in body)) throw new Error(`viewEnd lacks required field ${key}`);
  }

  if (body.qoeVersion !== 3) throw new Error(`qoeVersion ${JSON.stringify(body.qoeVersion)}, expected 3`);
  if (body.qoeScore !== null && !(typeof body.qoeScore === 'number' && body.qoeScore >= 0 && body.qoeScore <= 100)) {
    throw new Error(`qoeScore ${JSON.stringify(body.qoeScore)}`);
  }

  for (const key of COUNTERS) {
    if (!nonNegInt(body[key])) throw new Error(`${key} ${JSON.stringify(body[key])} is not a non-negative integer`);
  }
  for (const key of DURATIONS_MS) {
    if (!nonNegFinite(body[key])) throw new Error(`${key} ${JSON.stringify(body[key])} is not a duration in milliseconds`);
  }
  if (!finiteOrNull(body.avgBitrate)) throw new Error(`avgBitrate ${JSON.stringify(body.avgBitrate)}`);
  if (!finiteOrNull(body.maxBitrate)) throw new Error(`maxBitrate ${JSON.stringify(body.maxBitrate)}`);
  if (body.startupTime !== null && !nonNegFinite(body.startupTime)) {
    throw new Error(`startupTime ${JSON.stringify(body.startupTime)}`);
  }
  if (body.gaugeScale !== 'percent') throw new Error(`gaugeScale ${JSON.stringify(body.gaugeScale)}, expected "percent"`);
  if (body.rebufferRatio !== null && !isPercent(body.rebufferRatio)) {
    throw new Error(`rebufferRatio ${JSON.stringify(body.rebufferRatio)} is not null or a percent`);
  }
  if (!EXIT_TYPES.has(body.exitType)) throw new Error(`exitType ${JSON.stringify(body.exitType)}`);
  if (!START_STATES.has(body.startState)) throw new Error(`startState ${JSON.stringify(body.startState)} is not one of ${[...START_STATES].join(', ')}`);
  // qoeVersion 3: a view with no first frame is scored by cause, never with a
  // flattering number. It tried and failed (0), or could not be measured (null).
  if (body.startState !== 'played' && body.qoeScore !== null && body.qoeScore !== 0) {
    throw new Error(`qoeScore ${JSON.stringify(body.qoeScore)} on startState ${body.startState}: a view with no first frame scores 0 or null`);
  }
  if (body.startState === 'awaitingTap' && body.qoeScore !== null) {
    throw new Error(`qoeScore ${JSON.stringify(body.qoeScore)} on startState awaitingTap: a view waiting for a tap is not scored`);
  }
  // startupTime is measured at the first confirmed frame, which is exactly what
  // separates 'played' from every other start state
  if (body.startState === 'played' && body.startupTime === null) throw new Error('startState played but startupTime is null');
  if (body.startState !== 'played' && body.startupTime !== null) {
    throw new Error(`startState ${body.startState} but startupTime ${JSON.stringify(body.startupTime)} says a frame was shown`);
  }

  if (live) {
    if (body.completionRate !== null) throw new Error(`live completionRate ${JSON.stringify(body.completionRate)}, expected null`);
    if (typeof body.dvrTime !== 'number' || !Number.isFinite(body.dvrTime) || body.dvrTime < 0) {
      throw new Error(`live dvrTime ${JSON.stringify(body.dvrTime)}`);
    }
    // The latency summary is all-or-nothing: a live view that ended before its
    // first live:latency reading sends none of these keys (summary() is null).
    if (LATENCY_KEYS.some((key) => key in body)) {
      for (const key of LATENCY_KEYS.slice(0, 4)) {
        if (typeof body[key] !== 'number' || !Number.isFinite(body[key])) {
          throw new Error(`live ${key} ${JSON.stringify(body[key])}`);
        }
      }
      if (typeof body.lowLatency !== 'boolean') throw new Error(`live lowLatency ${JSON.stringify(body.lowLatency)}`);
    }
  } else {
    if ('dvrTime' in body) throw new Error('VOD viewEnd carries dvrTime');
    const leaked = LATENCY_KEYS.filter((key) => key in body);
    if (leaked.length) throw new Error(`VOD viewEnd carries ${leaked.join(', ')}`);
    if (body.exitType === 'completed') {
      if (body.completionRate !== 100) throw new Error(`completed completionRate ${JSON.stringify(body.completionRate)}`);
    } else if (body.completionRate !== null && !isPercent(body.completionRate)) {
      throw new Error(`completionRate ${JSON.stringify(body.completionRate)}`);
    }
  }

  if ('segmentCount' in body) {
    for (const key of SEGMENT_KEYS) {
      if (key === 'segmentThroughputBps' && !(key in body)) continue;
      if (!(key in body)) continue;
      if (!Number.isFinite(body[key]) || body[key] < 0) throw new Error(`${key} ${JSON.stringify(body[key])}`);
    }
  }

  for (const key of FRAME_KEYS) {
    if (key in body && (!Number.isFinite(body[key]) || body[key] < 0)) {
      throw new Error(`${key} ${JSON.stringify(body[key])}`);
    }
  }
}
