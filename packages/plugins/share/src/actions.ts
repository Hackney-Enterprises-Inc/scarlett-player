/**
 * The three share mechanics that are not just "open a link".
 */

import type { ShareContext, SharePluginConfig } from './types';

/** Whether the browser offers the OS share sheet. */
export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Open the native share sheet.
 *
 * @returns true when shared, false when the user dismissed the sheet
 * @throws when the share genuinely failed
 */
export async function nativeShare(context: ShareContext): Promise<boolean> {
  try {
    await navigator.share({ title: context.title, url: context.url });
    return true;
  } catch (error) {
    // Dismissing the sheet rejects with AbortError. That is a choice, not a
    // failure, and must never reach onError.
    if (error instanceof Error && error.name === 'AbortError') {
      return false;
    }
    throw error;
  }
}

/**
 * Copy text to the clipboard.
 *
 * The async Clipboard API needs a secure context and is absent over plain HTTP
 * and in older WebViews - both common for embedded players - so a
 * `document.execCommand` path stays as a fallback.
 *
 * @returns true when the text reached the clipboard
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or insecure context - fall through.
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Kept off-screen rather than hidden: display:none would not be selectable,
  // and scrolling the page on focus would be visible to the viewer.
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

/**
 * Build the iframe snippet for the `embed` target.
 *
 * Returns null when no embed base URL is configured, which is how the target
 * removes itself rather than offering a broken snippet.
 */
export function buildEmbedSnippet(
  context: ShareContext,
  config: SharePluginConfig,
): string | null {
  if (config.embedSnippet) {
    return config.embedSnippet(context);
  }

  if (!config.embedBaseUrl) {
    return null;
  }

  try {
    const base = typeof window === 'undefined' ? undefined : window.location.href;
    const embedUrl = new URL(config.embedBaseUrl, base);

    // The embed shows the same moment the viewer is looking at.
    if (context.currentTime > 0 && !context.isLive) {
      embedUrl.searchParams.set('startTime', String(Math.floor(context.currentTime)));
    }

    // So a share from inside the embed points back at the real page rather
    // than at the embed itself.
    embedUrl.searchParams.set('shareUrl', context.url);

    return (
      `<iframe src="${embedUrl.toString()}" width="640" height="360" ` +
      'frameborder="0" allow="autoplay; fullscreen; picture-in-picture" ' +
      'allowfullscreen loading="lazy"></iframe>'
    );
  } catch {
    return null;
  }
}
