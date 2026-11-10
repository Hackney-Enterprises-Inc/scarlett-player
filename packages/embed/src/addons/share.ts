/**
 * Scarlett Player embed addon: share.
 *
 * Load after a video-capable embed build (`embed.js` or `embed.video.js`) of
 * the same version. Registers the share plugin through
 * `ScarlettPlayer.use('share', ...)`, which enables `data-share-url` (with
 * `data-embed-base-url` for the embed snippet target).
 *
 * Video only: the share control registers into `@scarlett-player/ui`'s
 * registry, and the audio UIs render a fixed template with no registry to
 * register into. The 1.28 full and video builds still bundle the plugin, so
 * loading this beside either replaces the bundled copy rather than being
 * refused; 2.0.0 removes the bundled copies.
 *
 * @packageDocumentation
 */

import { createSharePlugin } from '@scarlett-player/share';
import { registerAddon } from './runtime';

registerAddon('share', createSharePlugin);
