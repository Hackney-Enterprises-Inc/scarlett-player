/**
 * Scarlett Player Embed Package - Full Build
 *
 * All plugins included: HLS, UI, Analytics, Playlist, Media Session
 *
 * @packageDocumentation
 */

import type { ScarlettPlayerGlobal } from './types';
import { initAll, create } from './embed-full';

export type { EmbedConfig, EmbedPlayerOptions, ScarlettPlayerGlobal } from './types';
export { createEmbedPlayer, initElement, initAll, create } from './embed-full';
export { parseDataAttributes, applyContainerStyles, aspectRatioToPercent } from './parser';

const VERSION = '0.1.2-full';

const ScarlettPlayerAPI: ScarlettPlayerGlobal = {
  create,
  initAll,
  version: VERSION,
};

if (typeof window !== 'undefined') {
  window.ScarlettPlayer = ScarlettPlayerAPI;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAll();
    });
  } else {
    initAll();
  }
}

export default ScarlettPlayerAPI;
