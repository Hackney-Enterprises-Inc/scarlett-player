/**
 * Reference-counted shared stylesheets.
 *
 * Several plugins inject one `<style id="...">` per document and share it
 * across every player on the page. Without a count, the first player to be
 * destroyed removes the sheet and strips the styling from every player that is
 * still mounted - a real failure in multi-player pages and in SPAs, where one
 * player is torn down as the next mounts.
 *
 * Re-exported from `@scarlett-player/core` so every package shares one
 * implementation rather than each re-deriving the same bookkeeping.
 */

/**
 * Live claim on one stylesheet id.
 */
interface StyleClaim {
  /**
   * Bumped whenever the sheet is (re)created.
   *
   * A release only counts against the generation it was taken under. Without
   * that, a claim whose `<style>` was removed from under it - a host clearing
   * `document.head`, a test resetting the DOM - would later decrement a count
   * that belongs to a sheet it never claimed, and pull it out from under a
   * player that is still using it.
   */
  generation: number;
  /** Holders that have not released yet. */
  holders: number;
}

/**
 * Live claims per stylesheet id.
 *
 * Keyed by id rather than by element so a sheet a host injected by hand (or one
 * left behind by an older build) is adopted rather than duplicated.
 */
const claims = new Map<string, StyleClaim>();

/**
 * Release a claim on a shared stylesheet. Idempotent.
 */
export type ReleaseStyles = () => void;

/**
 * Add a shared stylesheet to the document, once, and take a claim on it.
 *
 * Injects the `<style>` on the first call for an id and reuses it afterwards.
 * The returned function gives the claim back; the element is removed only when
 * the last holder releases it.
 *
 * A no-op in a document-less environment (SSR), where the returned function is
 * safe to call anyway.
 *
 * @param id - Stylesheet id, unique per package (e.g. `sp-chapters-styles`)
 * @param css - Stylesheet text, used only when the sheet is first created
 * @returns Function releasing this holder's claim; calling it twice is harmless
 *
 * @example
 * ```ts
 * const releaseStyles = injectSharedStyles('sp-chapters-styles', styles);
 * // ...later, in destroy()
 * releaseStyles();
 * ```
 */
export function injectSharedStyles(id: string, css: string): ReleaseStyles {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const existing = document.getElementById(id);
  let claim = claims.get(id);

  // No sheet in the document means no live claim is backed by one, whoever
  // still holds a release function. Start a fresh generation and let those
  // lapse rather than counting them against the sheet about to be created.
  if (!claim || !existing) {
    claim = { generation: (claim?.generation ?? 0) + 1, holders: 0 };
    claims.set(id, claim);
  }

  claim.holders += 1;
  const { generation } = claim;

  if (!existing) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }

  let released = false;

  return () => {
    if (released) return;
    released = true;

    const current = claims.get(id);
    if (!current || current.generation !== generation) {
      // The sheet this claim was taken on is long gone.
      return;
    }

    current.holders -= 1;
    if (current.holders > 0) {
      return;
    }

    claims.delete(id);
    document.getElementById(id)?.remove();
  };
}

/**
 * Number of live holders for a stylesheet id.
 *
 * @param id - Stylesheet id
 * @returns Current holder count, 0 when the sheet is not claimed
 * @internal
 */
export function sharedStyleHolders(id: string): number {
  return claims.get(id)?.holders ?? 0;
}
