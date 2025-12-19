/**
 * Scarlett Player - Audio Embed Package
 *
 * Optimized for audio streaming: podcasts, music, live audio.
 * Includes: HLS, Audio UI, Media Session, Playlist
 *
 * @packageDocumentation
 */

import { initAll, create } from './embed-audio';

export type { AudioEmbedConfig } from './embed-audio';
export { createAudioPlayer, initElement, initAll, create, parseAudioDataAttributes } from './embed-audio';

const VERSION = '0.1.2-audio';

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

// Expose on window
if (typeof window !== 'undefined') {
  (window as any).ScarlettAudio = ScarlettAudioAPI;
}

// Auto-initialize on DOMContentLoaded
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
