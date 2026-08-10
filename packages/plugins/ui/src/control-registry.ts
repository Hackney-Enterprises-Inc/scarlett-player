/**
 * Custom control registry.
 *
 * The built-in controls are created by a switch in the UI plugin. Anything a
 * plugin package contributes is registered here instead, so a control-bar
 * button no longer requires editing this package.
 *
 * The registry is module-level and therefore shared by every player instance on
 * the page. That matches how plugin packages register — once, at import time or
 * in `init()` — and the factory receives the per-instance `IPluginAPI`, so the
 * controls themselves stay properly scoped to their player.
 */

import type { ControlFactory } from './types';

/** Registered custom control factories, keyed by slot id. */
const registry = new Map<string, ControlFactory>();

/** Notified when a registration happens, so a mounted UI can rebuild. */
const listeners = new Set<(id: string) => void>();

/**
 * Register a control factory under a slot id.
 *
 * The id only takes effect for players whose layout lists it — registering
 * alone never adds a button anywhere. Hosts opt controls in through
 * `uiPlugin({ controls: [...] })`.
 *
 * Registering an id that already exists replaces the factory and re-notifies,
 * which keeps hot-reload workable.
 *
 * @param id - Slot id, conventionally the plugin's own name
 * @param factory - Builds the control for a given player
 *
 * @example
 * ```ts
 * registerControl('share', (api) => new ShareButton(api));
 * ```
 */
export function registerControl(id: string, factory: ControlFactory): void {
  registry.set(id, factory);

  for (const listener of listeners) {
    listener(id);
  }
}

/**
 * Remove a registered control factory.
 *
 * Players already showing the control keep their existing instance until they
 * rebuild; this only stops future ones being created.
 *
 * @param id - Slot id to remove
 * @returns Whether a factory was registered under that id
 */
export function unregisterControl(id: string): boolean {
  return registry.delete(id);
}

/**
 * Look up a registered factory.
 *
 * @param id - Slot id
 * @returns The factory, or null when nothing is registered for that id
 */
export function getControlFactory(id: string): ControlFactory | null {
  return registry.get(id) ?? null;
}

/**
 * Observe registrations.
 *
 * Plugin init order is not guaranteed, so a control can be registered after the
 * UI plugin has already built its control bar. The UI plugin subscribes to this
 * and rebuilds when a newly registered id appears in its layout.
 *
 * @param listener - Called with the id on each registration
 * @returns Unsubscribe function
 * @internal
 */
export function onControlRegistered(listener: (id: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Clear all registrations and listeners.
 *
 * Test-support only — the registry is module-level, so without this a
 * registration in one test leaks into the next.
 *
 * @internal
 */
export function resetControlRegistry(): void {
  registry.clear();
  listeners.clear();
}
