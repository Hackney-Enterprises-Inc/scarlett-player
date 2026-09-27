/**
 * Scarlett Player embed addon: chapters.
 *
 * Load after a video-capable embed build (`embed.js` or `embed.video.js`) of
 * the same version. Registers the chapters plugin through
 * `ScarlettPlayer.use('chapters', ...)`, which enables `data-chapters`.
 *
 * @packageDocumentation
 */

import { createChaptersPlugin } from '@scarlett-player/chapters';
import { registerAddon } from './runtime';

registerAddon('chapters', createChaptersPlugin);
