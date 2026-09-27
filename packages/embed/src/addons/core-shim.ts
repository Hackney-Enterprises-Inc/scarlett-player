/**
 * Stand-in for `@scarlett-player/core` inside an addon build.
 *
 * `vite.config.ts` aliases the bare specifier to this file when
 * `BUILD_ADDON` is set. The chapters and clips plugins import exactly one
 * run-time value from core, `injectSharedStyles`; every other core import of
 * theirs is type-only and erased before aliasing. A new run-time import in
 * either plugin fails the addon build here ("is not exported"), which is the
 * point: it has to be added to `AddonRuntime` first.
 */

import type { injectSharedStyles as InjectSharedStyles } from '@scarlett-player/core';
import { runtime } from './runtime';

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
