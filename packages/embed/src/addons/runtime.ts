/**
 * The contract between an embed build and the addon bundles loaded beside it.
 *
 * An addon (`embed.addon.chapters`, `embed.addon.clips`) is a separately built
 * file, so anything it imported for itself would be a second copy. That is
 * harmless for most code and fatal for one thing: the UI control registry in
 * `@scarlett-player/ui` is a module-level `Map`, so a plugin carrying its own
 * copy registers its control into a registry the embed's control bar never
 * reads, and the button never renders. The addon builds therefore alias the
 * three run-time functions they need (`core-shim.ts`, `ui-shim.ts`) to the
 * embed's own instances, which the embed publishes as
 * `window.ScarlettPlayer.addonRuntime`.
 *
 * This module is compiled into BOTH sides: the embed uses the types and
 * `ADDON_NAMES`; the addons use `runtime()` and `registerAddon()`. It must not
 * import anything at run time from `@scarlett-player/core` or
 * `@scarlett-player/ui`, because in an addon build those resolve to the shims,
 * which resolve through this module.
 */

import type { Plugin, injectSharedStyles } from '@scarlett-player/core';
import { PKG_VERSION } from '../version';

/** The plugin names an addon may register through `ScarlettPlayer.use()`. */
export const ADDON_NAMES = ['chapters', 'clips'] as const;

/** A plugin name an addon may register. */
export type AddonName = (typeof ADDON_NAMES)[number];

/** A plugin creator as an addon hands it to `use()`. */
export type AddonCreator = (config: any) => Plugin;

/**
 * `registerControl` as `@scarlett-player/ui` declares it, restated so the
 * embed's declarations do not depend on the UI package's (the audio build
 * does not ship it).
 */
export type RegisterControl = (
  id: string,
  factory: (api: any) => any,
  options?: { owner?: HTMLElement }
) => void;

/** `unregisterControl` as `@scarlett-player/ui` declares it. */
export type UnregisterControl = (id: string, options?: { owner?: HTMLElement }) => boolean;

/**
 * The embed's own instances of the functions an addon needs. Frozen.
 * For addon bundles only; not a public API for host code.
 */
export interface AddonRuntime {
  /** The embed package version, without the build's `-video` / `-audio` suffix. */
  readonly version: string;
  readonly injectSharedStyles: typeof injectSharedStyles;
  readonly registerControl: RegisterControl;
  readonly unregisterControl: UnregisterControl;
}

/** The slice of `window.ScarlettPlayer` an addon relies on. */
interface AddonHost {
  version?: string;
  use?: (name: AddonName, creator: AddonCreator) => void;
  addonRuntime?: AddonRuntime;
}

/**
 * The embed global, when one is on the page.
 *
 * @returns `window.ScarlettPlayer`, or undefined outside a browser or before the embed loads
 */
function host(): AddonHost | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { ScarlettPlayer?: AddonHost }).ScarlettPlayer;
}

/**
 * The embed's addon runtime, resolved at call time.
 *
 * The shims call this on every use rather than once at module evaluation, so
 * the order in which the embed and an addon evaluate matters only at `use()`
 * time, which `registerAddon()` guards.
 *
 * @returns The embed's frozen addon runtime
 * @throws {Error} When no embed with addon support is loaded on the page
 */
export function runtime(): AddonRuntime {
  const rt = host()?.addonRuntime;
  if (!rt) {
    throw new Error(
      '[ScarlettPlayer] addon runtime not found: an embed addon ran without ' +
      'window.ScarlettPlayer.addonRuntime. Load embed.js (or embed.video.js) before the addon.'
    );
  }
  return rt;
}

/**
 * Register an addon's plugin creator with the embed on the page.
 *
 * Refuses, with a console error and without registering, when the embed has
 * not loaded yet or was built from a different package version than the
 * addon (a `latest/` file cached beside a newer one is how that happens).
 *
 * @param name - The plugin name to register
 * @param creator - The plugin creator the addon bundles
 * @param addonVersion - The version the addon was built from
 * @returns True when the creator was handed to `use()`
 */
export function registerAddon(
  name: AddonName,
  creator: AddonCreator,
  addonVersion: string = PKG_VERSION
): boolean {
  const file = `embed.addon.${name}`;
  const embed = host();

  if (!embed) {
    console.error(`[ScarlettPlayer] ${file} loaded before the embed; load embed.js first`);
    return false;
  }

  const embedVersion = embed.addonRuntime?.version;
  if (typeof embed.use !== 'function' || embedVersion !== addonVersion) {
    console.error(
      `[ScarlettPlayer] ${file} ${addonVersion} refused: the embed on this page is ` +
      `${embedVersion ?? embed.version ?? 'unknown'}${embedVersion ? '' : ' (no addon support)'}. ` +
      'Load the embed and its addons from the same version, both from v<version>/ or both from latest/.'
    );
    return false;
  }

  embed.use(name, creator);
  return true;
}
