/**
 * Stand-in for `@scarlett-player/ui` inside an addon build.
 *
 * The UI control registry is a module-level `Map`, so an addon carrying its
 * own copy of the UI package would register its control where the embed's bar
 * never looks. These delegate to the embed's own registry instead. The
 * chapters and clips plugins reach the UI package only through a dynamic
 * `import('@scarlett-player/ui')` and take exactly these two functions from it.
 */

import { runtime, type RegisterControl, type UnregisterControl } from './runtime';

/**
 * The embed's `registerControl`, resolved at call time.
 *
 * @param args - Forwarded unchanged
 * @throws {Error} When no embed with addon support is loaded
 */
export function registerControl(...args: Parameters<RegisterControl>): void {
  runtime().registerControl(...args);
}

/**
 * The embed's `unregisterControl`, resolved at call time.
 *
 * @param args - Forwarded unchanged
 * @returns Whether a registration was removed
 * @throws {Error} When no embed with addon support is loaded
 */
export function unregisterControl(...args: Parameters<UnregisterControl>): boolean {
  return runtime().unregisterControl(...args);
}
