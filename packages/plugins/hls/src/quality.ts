/**
 * Quality Level Management Helpers
 */

import type { HLSQualityLevel, HlsLevel, HlsInstance } from './types';

/**
 * Format a quality level into a human-readable label.
 * Prefers height-based labels (1080p, 720p, etc.)
 *
 * @param level - hls.js level object
 * @returns Human-readable label like "1080p" or "720p 5.2Mbps"
 */
export function formatLevel(level: HlsLevel): string {
  // Prefer level.name if available (from manifest)
  if (level.name) {
    return level.name;
  }

  // Use height for standard labels
  if (level.height) {
    const standardLabels: Record<number, string> = {
      2160: '4K',
      1440: '1440p',
      1080: '1080p',
      720: '720p',
      480: '480p',
      360: '360p',
      240: '240p',
      144: '144p',
    };

    // Find closest standard label
    const closest = Object.keys(standardLabels)
      .map(Number)
      .sort((a, b) => Math.abs(a - level.height) - Math.abs(b - level.height))[0];

    if (Math.abs(closest - level.height) <= 20) {
      return standardLabels[closest];
    }

    return `${level.height}p`;
  }

  // Fallback to bitrate
  if (level.bitrate) {
    return formatBitrate(level.bitrate);
  }

  return 'Unknown';
}

/**
 * Format bitrate into a human-readable string.
 *
 * @param bitrate - Bitrate in bits per second
 * @returns Formatted string like "5.2 Mbps" or "800 Kbps"
 */
export function formatBitrate(bitrate: number): string {
  if (bitrate >= 1000000) {
    return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  }
  if (bitrate >= 1000) {
    return `${Math.round(bitrate / 1000)} Kbps`;
  }
  return `${bitrate} bps`;
}

/**
 * Convert hls.js levels to our quality level format.
 *
 * @param levels - Array of hls.js level objects
 * @param currentLevel - Currently active level index (-1 for auto)
 * @returns Array of HLSQualityLevel objects
 */
export function mapLevels(levels: HlsLevel[], currentLevel: number): HLSQualityLevel[] {
  return levels.map((level, index) => ({
    index,
    width: level.width || 0,
    height: level.height || 0,
    bitrate: level.bitrate || 0,
    label: formatLevel(level),
    codec: level.codecSet,
  }));
}

/**
 * Get the best quality level for a given bandwidth.
 *
 * @param levels - Available quality levels
 * @param bandwidth - Available bandwidth in bits per second
 * @param safety - Safety factor (0.8 = use 80% of bandwidth)
 * @returns Best level index
 */
export function getBestLevelForBandwidth(
  levels: HLSQualityLevel[],
  bandwidth: number,
  safety = 0.8
): number {
  const safeBandwidth = bandwidth * safety;

  // Sort by bitrate descending and find first that fits
  const sorted = [...levels].sort((a, b) => b.bitrate - a.bitrate);

  for (const level of sorted) {
    if (level.bitrate <= safeBandwidth) {
      return level.index;
    }
  }

  // Fall back to lowest quality
  return levels.length > 0 ? levels[levels.length - 1].index : -1;
}

/**
 * Find level index by height.
 *
 * @param levels - Available quality levels
 * @param height - Target height (e.g., 1080, 720)
 * @returns Level index or -1 if not found
 */
export function findLevelByHeight(levels: HLSQualityLevel[], height: number): number {
  const level = levels.find((l) => l.height === height);
  return level?.index ?? -1;
}

/**
 * Find level index closest to target height.
 *
 * @param levels - Available quality levels
 * @param targetHeight - Target height
 * @returns Closest level index
 */
export function findClosestLevel(levels: HLSQualityLevel[], targetHeight: number): number {
  if (levels.length === 0) return -1;

  let closest = levels[0];
  let minDiff = Math.abs(levels[0].height - targetHeight);

  for (const level of levels) {
    const diff = Math.abs(level.height - targetHeight);
    if (diff < minDiff) {
      minDiff = diff;
      closest = level;
    }
  }

  return closest.index;
}

/**
 * Get quality level management functions bound to an hls.js instance.
 *
 * @param hls - hls.js instance
 * @returns Object with quality management methods
 */
export function createQualityManager(hls: HlsInstance) {
  return {
    /** Get current level index (-1 = auto) */
    getCurrentLevel(): number {
      return hls.currentLevel;
    },

    /** Set quality level (-1 for auto) */
    setLevel(index: number): void {
      if (index === -1) {
        // Enable auto quality
        hls.currentLevel = -1;
      } else if (index >= 0 && index < hls.levels.length) {
        hls.currentLevel = index;
      }
    },

    /** Get all levels */
    getLevels(): HLSQualityLevel[] {
      return mapLevels(hls.levels, hls.currentLevel);
    },

    /** Check if auto quality is enabled */
    isAutoQuality(): boolean {
      return hls.autoLevelEnabled;
    },

    /** Get next level being loaded */
    getNextLevel(): number {
      return hls.nextLevel;
    },

    /** Get currently loading level */
    getLoadLevel(): number {
      return hls.loadLevel;
    },
  };
}
