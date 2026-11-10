/**
 * Scarlett Player embed addon: playlist.
 *
 * Load after an embed build (`embed.js`, `embed.video.js` or `embed.audio.js`)
 * of the same version. Registers the playlist plugin through
 * `ScarlettPlayer.use('playlist', ...)`, which enables `data-playlist`.
 *
 * Works beside every build and on every player type. The 1.28 full build still
 * bundles the plugin, so loading this beside it replaces the bundled copy
 * rather than being refused; 2.0.0 removes the bundled copy. The audio build
 * keeps its own bundled copy past 2.0.0, so `use('playlist')` beside
 * `embed.audio.js` is refused with "already provided by this build".
 *
 * Without it, a `data-playlist` embed still plays: the player falls back to
 * the first item's `src`. What is lost is navigation and advance.
 *
 * @packageDocumentation
 */

import { createPlaylistPlugin } from '@scarlett-player/playlist';
import { registerAddon } from './runtime';

registerAddon('playlist', createPlaylistPlugin);
