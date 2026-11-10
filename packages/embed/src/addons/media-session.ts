/**
 * Scarlett Player embed addon: media session.
 *
 * Load after an embed build (`embed.js`, `embed.video.js` or `embed.audio.js`)
 * of the same version. Registers the media session plugin through
 * `ScarlettPlayer.use('mediaSession', ...)`.
 *
 * The file stem is `media-session` and the `use()` name is `mediaSession`:
 * the stem is the kebab-case package name the Laravel package builds
 * `embed.addon.<stem>` from, and the name is the `PluginCreators` key.
 *
 * There is no attribute of its own. It switches on for every audio player, and
 * for a video player that has a `data-title`, so a page that sets one gets
 * lock-screen and media-key metadata without asking for it. The 1.28 full
 * build still bundles the plugin, so loading this beside it replaces the
 * bundled copy rather than being refused; 2.0.0 removes the bundled copy. The
 * audio build keeps its own bundled copy past 2.0.0, so `use('mediaSession')`
 * beside `embed.audio.js` is refused with "already provided by this build".
 *
 * @packageDocumentation
 */

import { createMediaSessionPlugin } from '@scarlett-player/media-session';
import { registerAddon } from './runtime';

registerAddon('mediaSession', createMediaSessionPlugin);
