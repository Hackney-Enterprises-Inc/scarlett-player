/**
 * Scarlett Player embed addon: clips.
 *
 * Load after a video-capable embed build (`embed.js` or `embed.video.js`) of
 * the same version. Registers the clips plugin through
 * `ScarlettPlayer.use('clips', ...)`, which enables `data-clips-endpoint`
 * (together with `data-clips-csrf="meta"`).
 *
 * @packageDocumentation
 */

import { createClipsPlugin } from '@scarlett-player/clips';
import { registerAddon } from './runtime';

registerAddon('clips', createClipsPlugin);
