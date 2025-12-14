/**
 * @scarlett-player/vue - Vue 3 component wrapper for Scarlett Player
 *
 * Provides a Vue 3 component that wraps the Scarlett Player core.
 * Supports Composition API, TypeScript, and reactive props.
 *
 * @packageDocumentation
 */

import ScarlettPlayerComponent from './ScarlettPlayer.vue';
import type { Plugin } from '@vue/runtime-core';

// Export the component
export { ScarlettPlayerComponent };
export default ScarlettPlayerComponent;

// Export composables
export { useScarlettPlayer } from './composables/useScarlettPlayer';

// Re-export core types for convenience
export type {
  ScarlettPlayer,
  PlayerOptions,
  QualityLevel,
  Plugin as ScarlettPlugin,
  PluginType,
  EventName,
  EventPayload,
  StateStore,
  PlaybackState,
  MediaType,
} from '@scarlett-player/core';

// Vue plugin installation (optional)
export const ScarlettPlayerPlugin: Plugin = {
  install(app) {
    app.component('ScarlettPlayer', ScarlettPlayerComponent);
  },
};
