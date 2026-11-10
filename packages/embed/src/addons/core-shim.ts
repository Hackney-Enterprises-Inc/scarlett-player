/**
 * Stand-in for `@scarlett-player/core` inside an addon build.
 *
 * `vite.config.ts` aliases the bare specifier to this file when
 * `BUILD_ADDON` is set. The chapters and clips plugins import exactly one
 * run-time value from core, `injectSharedStyles`; every other core import of
 * theirs is type-only and erased before aliasing. A new run-time import in
 * either plugin fails the addon build here ("is not exported"), which is the
 * point: it has to be added to `AddonRuntime` first.
 *
 * Two of the five 1.28 addons need a pure value rather than a run-time
 * function: analytics reads `ErrorCode` and playlist reads `sanitizeUrl`.
 * Neither is stateful, so both are bundled copies re-exported from core's own
 * source through the deep specifiers `vite.config.ts` aliases for an addon
 * build only. They must stay copies rather than delegates through
 * `runtime()`: analytics evaluates `Object.values(ErrorCode)` while its module
 * loads, which is before `registerAddon()` can report a load-order problem, so
 * a lazy delegate would throw and take the whole addon down with it.
 *
 * The rule above still holds: any new STATEFUL run-time import from core in
 * one of these plugins fails the addon build until it is added to
 * `AddonRuntime`.
 */

import type { injectSharedStyles as InjectSharedStyles } from '@scarlett-player/core';
import { runtime } from './runtime';

/** Core's `ErrorCode` enum, a pure module copied into the addon bundle. */
export { ErrorCode } from '@scarlett-player/core/error-handler';
/** Core's `sanitizeUrl` helper, a pure module copied into the addon bundle. */
export { sanitizeUrl } from '@scarlett-player/core/utils/url';

/**
 * The embed's `injectSharedStyles`, resolved at call time.
 *
 * @param args - Forwarded unchanged
 * @returns Whatever the embed's `injectSharedStyles` returns
 * @throws {Error} When no embed with addon support is loaded
 */
export function injectSharedStyles(
  ...args: Parameters<typeof InjectSharedStyles>
): ReturnType<typeof InjectSharedStyles> {
  return runtime().injectSharedStyles(...args);
}
