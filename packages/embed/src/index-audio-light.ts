/**
 * Scarlett Player - Audio Embed Package (Light)
 *
 * Optimized for audio streaming with smaller bundle size.
 * Uses hls.js/light for ~30% smaller bundle.
 *
 * @packageDocumentation
 */

import { initAll, create } from './embed-audio-light';

export type { AudioEmbedConfig } from './embed-audio-light';
export { createAudioPlayer, initElement, initAll, create, parseAudioDataAttributes } from './embed-audio-light';

const VERSION = '0.1.2-audio-light';

interface ScarlettAudioGlobal {
  create: typeof create;
  initAll: typeof initAll;
  version: string;
}

const ScarlettAudioAPI: ScarlettAudioGlobal = {
  create,
  initAll,
  version: VERSION,
};

if (typeof window !== 'undefined') {
  (window as any).ScarlettAudio = ScarlettAudioAPI;
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

export default ScarlettAudioAPI;
