/**
 * Scarlett Player Embed Package - Light Build
 *
 * Uses hls.js/light for ~35% smaller bundle size.
 * The light build excludes: subtitles, ID3 tags, and DRM/EME support.
 *
 * @packageDocumentation
 */

import type { ScarlettPlayerGlobal } from './types';
import { initAll, create } from './embed-light';

// Export types for TypeScript users
export type { EmbedConfig, EmbedPlayerOptions, ScarlettPlayerGlobal } from './types';
export { createEmbedPlayer, initElement, initAll, create } from './embed-light';
export { parseDataAttributes, applyContainerStyles, aspectRatioToPercent } from './parser';

// Package version
const VERSION = '0.1.0-light';

/**
 * Global API exposed as window.ScarlettPlayer
 */
const ScarlettPlayerAPI: ScarlettPlayerGlobal = {
  create,
  initAll,
  version: VERSION,
};

// Expose on window
if (typeof window !== 'undefined') {
  window.ScarlettPlayer = ScarlettPlayerAPI;
}

/**
 * Auto-initialize on DOMContentLoaded
 */
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAll();
    });
  } else {
    // DOM already loaded, initialize immediately
    initAll();
  }
}

export default ScarlettPlayerAPI;
