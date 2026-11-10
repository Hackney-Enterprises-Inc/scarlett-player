/**
 * Scarlett Player embed addon: analytics.
 *
 * Load after an embed build (`embed.js`, `embed.video.js` or `embed.audio.js`)
 * of the same version. Registers the analytics plugin through
 * `ScarlettPlayer.use('analytics', ...)`, which enables
 * `data-analytics-beacon-url` and `create({ analytics })`.
 *
 * Works beside every build and on every player type. The 1.28 full build still
 * bundles the plugin, so loading this beside it replaces the bundled copy
 * rather than being refused; 2.0.0 removes the bundled copy.
 *
 * Load it BEFORE the players are created. An addon registered after
 * `DOMContentLoaded` only reaches players built from then on, and a player
 * built without it never sends a beacon: the loss is invisible, apart from a
 * drop in view counts.
 *
 * @packageDocumentation
 */

import { createAnalyticsPlugin } from '@scarlett-player/analytics';
import { registerAddon } from './runtime';

registerAddon('analytics', createAnalyticsPlugin);
