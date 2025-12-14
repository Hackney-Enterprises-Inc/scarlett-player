/**
 * Scarlett Player Embed Package
 *
 * Standalone, CDN-ready player that can be used without npm/bundlers.
 * Supports both declarative (data attributes) and programmatic (JavaScript API) usage.
 *
 * @packageDocumentation
 */

import type { ScarlettPlayerGlobal } from './types';
import { initAll, create } from './embed';

// Export types for TypeScript users
export type { EmbedConfig, EmbedPlayerOptions, ScarlettPlayerGlobal } from './types';
export { createEmbedPlayer, initElement, initAll, create } from './embed';
export { parseDataAttributes, applyContainerStyles, aspectRatioToPercent } from './parser';

// Package version
const VERSION = '0.1.0';

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
