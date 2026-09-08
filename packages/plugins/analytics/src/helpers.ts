/**
 * Analytics Plugin Helper Functions
 *
 * Utility functions for environment detection, ID generation, and metrics calculation.
 */

import type { BrowserInfo, OSInfo, DeviceType } from './types';

/**
 * Generate a unique ID for tracking.
 * Format: timestamp-random
 *
 * @returns Unique ID string
 */
export function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
}

/**
 * Get or create session ID (persists in sessionStorage).
 * Session ID persists across page loads in the same browsing session.
 *
 * @returns Session ID
 */
export function getSessionId(): string {
  const STORAGE_KEY = 'sp_session_id';

  try {
    let sessionId = sessionStorage.getItem(STORAGE_KEY);
    if (!sessionId) {
      sessionId = generateId();
      sessionStorage.setItem(STORAGE_KEY, sessionId);
    }
    return sessionId;
  } catch (error) {
    // SessionStorage not available (privacy mode, etc.)
    // Generate ephemeral ID
    return generateId();
  }
}

/**
 * Get or create anonymous viewer ID (persists in localStorage).
 * Viewer ID persists across sessions for the same browser.
 *
 * @returns Viewer ID
 */
export function getAnonymousViewerId(): string {
  const STORAGE_KEY = 'sp_viewer_id';

  try {
    let viewerId = localStorage.getItem(STORAGE_KEY);
    if (!viewerId) {
      viewerId = generateId();
      localStorage.setItem(STORAGE_KEY, viewerId);
    }
    return viewerId;
  } catch (error) {
    // LocalStorage not available
    // Fall back to session storage
    try {
      let viewerId = sessionStorage.getItem(STORAGE_KEY);
      if (!viewerId) {
        viewerId = generateId();
        sessionStorage.setItem(STORAGE_KEY, viewerId);
      }
      return viewerId;
    } catch {
      // No storage available - generate ephemeral ID
      return generateId();
    }
  }
}

/**
 * Detect browser information from user agent.
 *
 * @returns Browser info
 */
export function getBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent;

  // Edge (must check before Chrome since Edge includes "Chrome")
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    return {
      name: 'Edge',
      version: match ? match[1] : undefined,
    };
  }

  // Chrome
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return {
      name: 'Chrome',
      version: match ? match[1] : undefined,
    };
  }

  // Safari (must check after Chrome)
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    return {
      name: 'Safari',
      version: match ? match[1] : undefined,
    };
  }

  // Firefox
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return {
      name: 'Firefox',
      version: match ? match[1] : undefined,
    };
  }

  // Opera
  if (ua.includes('OPR/') || ua.includes('Opera/')) {
    const match = ua.match(/(?:OPR|Opera)\/(\d+)/);
    return {
      name: 'Opera',
      version: match ? match[1] : undefined,
    };
  }

  return { name: 'Unknown' };
}

/**
 * Detect operating system information from user agent.
 *
 * @returns OS info
 */
export function getOSInfo(): OSInfo {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  // Windows
  if (ua.includes('Windows')) {
    if (ua.includes('Windows NT 10.0')) return { name: 'Windows', version: '10' };
    if (ua.includes('Windows NT 6.3')) return { name: 'Windows', version: '8.1' };
    if (ua.includes('Windows NT 6.2')) return { name: 'Windows', version: '8' };
    if (ua.includes('Windows NT 6.1')) return { name: 'Windows', version: '7' };
    return { name: 'Windows' };
  }

  // macOS
  if (ua.includes('Mac OS X')) {
    const match = ua.match(/Mac OS X (\d+)[._](\d+)/);
    return {
      name: 'macOS',
      version: match ? `${match[1]}.${match[2]}` : undefined,
    };
  }

  // iOS
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    const match = ua.match(/OS (\d+)[._](\d+)/);
    return {
      name: 'iOS',
      version: match ? `${match[1]}.${match[2]}` : undefined,
    };
  }

  // Android
  if (ua.includes('Android')) {
    const match = ua.match(/Android (\d+(?:\.\d+)?)/);
    return {
      name: 'Android',
      version: match ? match[1] : undefined,
    };
  }

  // Linux
  if (ua.includes('Linux') || platform.includes('Linux')) {
    return { name: 'Linux' };
  }

  // Chrome OS
  if (ua.includes('CrOS')) {
    return { name: 'ChromeOS' };
  }

  return { name: 'Unknown' };
}

/**
 * Detect device type.
 *
 * @returns Device type
 */
export function getDeviceType(): DeviceType {
  const ua = navigator.userAgent;

  // TV devices
  if (
    ua.includes('TV') ||
    ua.includes('PlayStation') ||
    ua.includes('Xbox') ||
    ua.includes('SmartTV')
  ) {
    return 'tv';
  }

  // Tablets
  if (
    ua.includes('iPad') ||
    (ua.includes('Android') && !ua.includes('Mobile')) ||
    ua.includes('Tablet')
  ) {
    return 'tablet';
  }

  // Mobile
  if (
    ua.includes('Mobile') ||
    ua.includes('iPhone') ||
    ua.includes('iPod') ||
    (ua.includes('Android') && ua.includes('Mobile'))
  ) {
    return 'mobile';
  }

  // Default to desktop
  return 'desktop';
}

/**
 * Get screen size string.
 *
 * @returns Screen size (e.g., "1920x1080")
 */
export function getScreenSize(): string {
  return `${window.screen.width}x${window.screen.height}`;
}

/**
 * Get player element size.
 *
 * @param container - Player container element
 * @returns Player size (e.g., "1280x720")
 */
export function getPlayerSize(container: HTMLElement | null): string {
  if (!container) {
    return `${window.innerWidth}x${window.innerHeight}`;
  }

  const rect = container.getBoundingClientRect();
  return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
}

/**
 * Get network connection type (if available).
 *
 * @returns Connection type or 'unknown'
 */
export function getConnectionType(): string {
  // NetworkInformation API
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (conn) {
    return conn.effectiveType || conn.type || 'unknown';
  }

  return 'unknown';
}

/**
 * Calculate Quality of Experience (QoE) score.
 * Score ranges from 0-100 based on multiple factors.
 *
 * @param params - QoE calculation parameters
 * @returns QoE score (0-100)
 */
export function calculateQoEScore(params: {
  startupTime: number | null;
  rebufferDuration: number;
  watchTime: number;
  maxBitrate: number;
  exitType: string | null;
  errorCount: number;
}): number {
  const {
    startupTime,
    rebufferDuration,
    watchTime,
    maxBitrate,
    exitType,
    errorCount,
  } = params;

  // 1. Startup Score (25% weight)
  let startupScore = 100;
  if (startupTime !== null) {
    if (startupTime < 1000) startupScore = 100;
    else if (startupTime < 2000) startupScore = 85;
    else if (startupTime < 4000) startupScore = 70;
    else if (startupTime < 8000) startupScore = 50;
    else startupScore = 30;
  }

  // 2. Smoothness Score (30% weight) - based on rebuffer ratio
  let smoothnessScore = 100;
  if (watchTime > 0) {
    const rebufferRatio = (rebufferDuration / watchTime) * 100;
    if (rebufferRatio < 0.1) smoothnessScore = 100;
    else if (rebufferRatio < 1) smoothnessScore = 85;
    else if (rebufferRatio < 2) smoothnessScore = 70;
    else if (rebufferRatio < 5) smoothnessScore = 50;
    else smoothnessScore = 30;
  }

  // 3. Success Score (30% weight)
  let successScore = 100;
  if (exitType === 'error') {
    successScore = 0;
  } else if (errorCount > 0) {
    // Penalize for non-fatal errors
    successScore = Math.max(0, 100 - errorCount * 10);
  }

  // 4. Quality Score (15% weight) - based on max bitrate achieved
  let qualityScore = 80; // Default
  if (maxBitrate > 4000000) qualityScore = 100; // 4K
  else if (maxBitrate > 2000000) qualityScore = 90; // 1080p
  else if (maxBitrate > 1000000) qualityScore = 75; // 720p
  else if (maxBitrate > 500000) qualityScore = 60; // 480p
  else if (maxBitrate > 0) qualityScore = 40; // Low quality

  // Calculate weighted average
  const qoeScore =
    successScore * 0.30 +
    startupScore * 0.25 +
    smoothnessScore * 0.30 +
    qualityScore * 0.15;

  return Math.round(qoeScore);
}

/**
 * Summary of the live latency observed over a session.
 */
export interface LiveLatencySummary {
  /** Number of latency readings taken */
  liveLatencySamples: number;
  /** Mean latency across the session, in seconds (2 decimal places) */
  liveLatencyMean: number;
  /** 95th percentile latency, in seconds (2 decimal places) */
  liveLatencyP95: number;
  /** Highest latency seen, in seconds (2 decimal places) */
  liveLatencyMax: number;
  /** Whether the stream was ever EFFECTIVELY low latency */
  lowLatency: boolean;
}

/** Histogram bucket width in seconds. */
const LATENCY_BUCKET_SECONDS = 0.25;

/** Latency above this is clamped into the final bucket (seconds). */
const LATENCY_MAX_SECONDS = 120;

/**
 * Accumulate live latency readings into a session summary.
 *
 * A live session emits `live:latency` at the `timeupdate` cadence, roughly
 * 4Hz, so an hour-long stream produces ~14,000 readings. Keeping them would
 * make the plugin's memory grow with watch time, and keeping only the last N
 * would silently turn the "session p95" into a "last two minutes p95" -
 * precisely the wrong answer for the question live latency telemetry exists
 * to answer ("did LL hold for this viewer, or only at the end?").
 *
 * So readings go into a fixed histogram: 0.25s buckets to two minutes, plus an
 * overflow bucket. Constant memory, whole-session percentiles, and a
 * resolution finer than any target latency worth shipping.
 *
 * @returns A sampler with `add()` and `summary()`
 */
export function createLatencySampler(): {
  add: (latency: number) => void;
  markLowLatency: () => void;
  summary: () => LiveLatencySummary | null;
} {
  const bucketCount = Math.ceil(LATENCY_MAX_SECONDS / LATENCY_BUCKET_SECONDS) + 1;
  const buckets = new Uint32Array(bucketCount);
  let count = 0;
  let sum = 0;
  let max = 0;
  let sawLowLatency = false;

  return {
    /**
     * Record one latency reading.
     *
     * @param latency - Latency behind the live edge, in seconds
     */
    add(latency: number): void {
      if (!Number.isFinite(latency) || latency < 0) return;

      count++;
      sum += latency;
      if (latency > max) max = latency;

      const index = Math.min(
        bucketCount - 1,
        Math.floor(latency / LATENCY_BUCKET_SECONDS)
      );
      buckets[index]!++;
    },

    /**
     * Mark the session as having been effectively low latency.
     *
     * Sticky: a stream that was LL for part of a view is reported as LL,
     * because "was this an LL session" is the question the flag answers.
     */
    markLowLatency(): void {
      sawLowLatency = true;
    },

    /**
     * Summarise the readings so far.
     *
     * @returns The summary, or null when no reading was ever taken (VOD)
     */
    summary(): LiveLatencySummary | null {
      if (count === 0) return null;

      // Rank-based p95: the first bucket whose cumulative count reaches the
      // 95th sample. Reported at the bucket's upper edge, so the figure is
      // never optimistic.
      const target = Math.ceil(count * 0.95);
      let cumulative = 0;
      let p95 = max;
      for (let i = 0; i < bucketCount; i++) {
        cumulative += buckets[i]!;
        if (cumulative >= target) {
          p95 = Math.min(max, (i + 1) * LATENCY_BUCKET_SECONDS);
          break;
        }
      }

      const round = (value: number) => Math.round(value * 100) / 100;

      return {
        liveLatencySamples: count,
        liveLatencyMean: round(sum / count),
        liveLatencyP95: round(p95),
        liveLatencyMax: round(max),
        lowLatency: sawLowLatency,
      };
    },
  };
}

/**
 * Check if running in development environment.
 *
 * @returns True if in development
 */
export function isDevelopment(): boolean {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('.local')
  );
}

/**
 * Safe JSON stringify with error handling.
 *
 * @param data - Data to stringify
 * @returns JSON string or empty object
 */
export function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    return '{}';
  }
}

/**
 * Clamp a number between min and max.
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format bytes to human-readable string.
 *
 * @param bytes - Bytes value
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format bitrate to human-readable string.
 *
 * @param bps - Bits per second
 * @returns Formatted string (e.g., "2.5 Mbps")
 */
export function formatBitrate(bps: number): string {
  if (bps === 0) return '0 bps';

  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(bps) / Math.log(k));

  return `${parseFloat((bps / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format milliseconds to human-readable duration.
 *
 * @param ms - Milliseconds
 * @returns Formatted string (e.g., "1m 30s")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Check if a URL uses the HTTPS protocol.
 *
 * @param url - The URL string to evaluate
 * @returns True if the URL resolves to the HTTPS protocol, false otherwise
 */
export function isHttpsUrl(url: string): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return false;
  }
  try {
    const base = typeof window !== 'undefined' && window.location?.href
      ? window.location.href
      : undefined;
    const parsed = base ? new URL(url, base) : new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

