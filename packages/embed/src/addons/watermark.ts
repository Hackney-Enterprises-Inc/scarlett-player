/**
 * Scarlett Player embed addon: watermark.
 *
 * Load after an embed build (`embed.js` or `embed.video.js`) of the same
 * version. Registers the watermark plugin through
 * `ScarlettPlayer.use('watermark', ...)`.
 *
 * There is no data attribute: the overlay is reachable only through
 * `ScarlettPlayer.create({ watermark })`, so only programmatic hosts are
 * affected. The 1.28 full and video builds still bundle the plugin, so loading
 * this beside either replaces the bundled copy rather than being refused;
 * 2.0.0 removes the bundled copies.
 *
 * A missing watermark is a content-protection loss, so a build without it
 * reports it as an error rather than a warning.
 *
 * @packageDocumentation
 */

import { createWatermarkPlugin } from '@scarlett-player/watermark';
import { registerAddon } from './runtime';

registerAddon('watermark', createWatermarkPlugin);
