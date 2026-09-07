/**
 * Custom control registry.
 *
 * The built-in controls are created by a switch in the UI plugin. Anything a
 * plugin package contributes is registered here instead, so a control-bar
 * button no longer requires editing this package.
 *
 * Registrations are either global or scoped to one player.
 *
 * A global registration is the right shape for a stateless factory: it is made
 * once, and the factory receives the per-instance `IPluginAPI`, so the controls
 * it builds are already scoped to their player.
 *
 * A factory that closes over its own plugin instance - a chapter list, a
 * playlist panel - must NOT be global. Every player registering one overwrote
 * the last, so a rebuild in player A handed it player B's control, and the two
 * players drove one element. Those registrations pass `owner`, the player's
 * container, and the UI plugin only ever looks up factories owned by its own
 * container (falling back to the global ones).
 */

import type { ControlFactory } from './types';

/** Options controlling how far a registration reaches. */
export interface RegisterControlOptions {
  /**
   * Player container the registration belongs to.
   *
   * Omit for a stateless factory that any player may use. Pass `api.container`
   * whenever the factory closes over per-player state.
   */
  owner?: HTMLElement;
}

/** Registered control factories with no owner, keyed by slot id. */
const globalRegistry = new Map<string, ControlFactory>();

/** Registered control factories scoped to one player container. */
const scopedRegistries = new Map<HTMLElement, Map<string, ControlFactory>>();

/** Notified when a registration happens, so a mounted UI can rebuild. */
const listeners = new Set<(id: string, owner?: HTMLElement) => void>();

/**
 * Register a control factory under a slot id.
 *
 * The id only takes effect for players whose layout lists it - registering
 * alone never adds a button anywhere. Hosts opt controls in through
 * `uiPlugin({ controls: [...] })`.
 *
 * Registering an id that already exists in the same scope replaces the factory
 * and re-notifies, which keeps hot-reload workable.
 *
 * @param id - Slot id, conventionally the plugin's own name
 * @param factory - Builds the control for a given player
 * @param options - Pass `{ owner: api.container }` when the factory closes over
 *   per-player state, so a second player cannot take it over
 *
 * @example
 * ```ts
 * // Stateless: any player may build one.
 * registerControl('share', (api) => new ShareButton(api));
 *
 * // Closes over this plugin instance: scope it to the player.
 * registerControl('chapters', () => list, { owner: api.container });
 * ```
 */
export function registerControl(
  id: string,
  factory: ControlFactory,
  options: RegisterControlOptions = {}
): void {
  const { owner } = options;

  if (owner) {
    let scoped = scopedRegistries.get(owner);
    if (!scoped) {
      scoped = new Map();
      scopedRegistries.set(owner, scoped);
    }
    scoped.set(id, factory);
  } else {
    globalRegistry.set(id, factory);
  }

  for (const listener of listeners) {
    listener(id, owner);
  }
}

/**
 * Remove a registered control factory.
 *
 * Players already showing the control keep their existing instance until they
 * rebuild; this only stops future ones being created.
 *
 * @param id - Slot id to remove
 * @param options - Pass the same `owner` the registration used
 * @returns Whether a factory was registered in that scope under that id
 */
export function unregisterControl(id: string, options: RegisterControlOptions = {}): boolean {
  const { owner } = options;

  if (!owner) {
    return globalRegistry.delete(id);
  }

  const scoped = scopedRegistries.get(owner);
  if (!scoped) {
    return false;
  }

  const removed = scoped.delete(id);
  if (scoped.size === 0) {
    scopedRegistries.delete(owner);
  }

  return removed;
}

/**
 * Drop every registration a player made.
 *
 * Called from a plugin's `destroy()` so a torn-down player leaves nothing
 * behind that a later player could pick up.
 *
 * @param owner - The player container the registrations were scoped to
 * @returns Number of factories removed
 */
export function unregisterControlsFor(owner: HTMLElement): number {
  const removed = scopedRegistries.get(owner)?.size ?? 0;
  scopedRegistries.delete(owner);

  return removed;
}

/**
 * Look up a registered factory.
 *
 * A factory this player owns wins over a global one of the same id, so a
 * per-instance control is never served another player's closure.
 *
 * @param id - Slot id
 * @param owner - The looking-up player's container, when it has one
 * @returns The factory, or null when nothing is registered for that id
 */
export function getControlFactory(id: string, owner?: HTMLElement): ControlFactory | null {
  if (owner) {
    const scoped = scopedRegistries.get(owner)?.get(id);
    if (scoped) {
      return scoped;
    }
  }

  return globalRegistry.get(id) ?? null;
}

/**
 * Observe registrations.
 *
 * Plugin init order is not guaranteed, so a control can be registered after the
 * UI plugin has already built its control bar. The UI plugin subscribes to this
 * and rebuilds when a newly registered id appears in its layout.
 *
 * @param listener - Called with the id, and the owner when the registration was
 *   scoped to one player
 * @returns Unsubscribe function
 * @internal
 */
export function onControlRegistered(
  listener: (id: string, owner?: HTMLElement) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Clear all registrations and listeners.
 *
 * Test-support only - the registry is module-level, so without this a
 * registration in one test leaks into the next.
 *
 * @internal
 */
export function resetControlRegistry(): void {
  globalRegistry.clear();
  scopedRegistries.clear();
  listeners.clear();
}
