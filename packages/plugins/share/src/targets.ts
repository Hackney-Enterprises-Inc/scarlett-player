/**
 * Built-in share targets.
 *
 * `native` and `copy` are handled by the plugin itself. Everything else is a
 * link built from the resolved context.
 */

import type { ShareContext, ShareTarget } from './types';

/**
 * 24px icons on a 0 0 24 24 viewBox, matching @scarlett-player/ui.
 * Brand marks are simplified glyphs, not official logos.
 */
export const icons: Record<string, string> = {
  native:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  copy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  embed:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.1 8.1L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.6-8.7L1.7 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0ZM.2 8.3h4.6V24H.2V8.3Zm7.6 0h4.4v2.1h.1a4.8 4.8 0 0 1 4.3-2.4c4.6 0 5.4 3 5.4 6.9V24h-4.6v-7.6c0-1.8 0-4.1-2.5-4.1s-2.9 2-2.9 4V24H7.8V8.3Z"/></svg>',
  whatsapp:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Zm5.1 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6a11 11 0 0 1-4.2-3.8c-.3-.5-.7-1.2-.7-2 0-.8.4-1.2.6-1.4.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.6c0 .1.1.3 0 .4l-.3.4-.2.3c-.1.1-.2.2 0 .5.2.3.7 1.1 1.4 1.8.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.1.1.5-.1 1Z"/></svg>',
  telegram:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.6 20c-.2 1.1-.9 1.4-1.8.9l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.1l-4.8-1.5c-1-.3-1-1 .2-1.5l18.9-7.3c.9-.3 1.6.2 1.4 1.5Z"/></svg>',
  reddit:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a2.1 2.1 0 0 0-3.6-1.5 10.4 10.4 0 0 0-5.4-1.7l.9-4.2 3 .6a1.8 1.8 0 1 0 .2-1.2l-3.6-.8a.6.6 0 0 0-.7.5L11.7 8.8a10.4 10.4 0 0 0-5.5 1.7A2.1 2.1 0 1 0 3.6 14a4 4 0 0 0 0 .6c0 3.1 3.7 5.6 8.4 5.6s8.4-2.5 8.4-5.6a4 4 0 0 0 0-.6A2.1 2.1 0 0 0 22 12ZM7.9 13.5a1.5 1.5 0 1 1 1.5 1.5 1.5 1.5 0 0 1-1.5-1.5Zm8.3 4.1a5.6 5.6 0 0 1-4.2 1.3 5.6 5.6 0 0 1-4.2-1.3.5.5 0 0 1 .7-.7 4.7 4.7 0 0 0 3.5 1 4.7 4.7 0 0 0 3.5-1 .5.5 0 1 1 .7.7Zm-.6-2.6a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5Z"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
};

const encode = encodeURIComponent;

/**
 * Targets available by id. `native` and `copy` carry no `href` - the plugin
 * intercepts them.
 */
export const BUILTIN_TARGETS: Record<string, ShareTarget> = {
  native: { id: 'native', label: 'Share', icon: icons.native },
  copy: { id: 'copy', label: 'Copy link', icon: icons.copy },
  embed: { id: 'embed', label: 'Embed', icon: icons.embed },

  x: {
    id: 'x',
    label: 'X',
    icon: icons.x,
    href: (c: ShareContext) => `https://x.com/intent/tweet?url=${encode(c.url)}&text=${encode(c.title)}`,
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    icon: icons.facebook,
    href: (c: ShareContext) => `https://www.facebook.com/sharer/sharer.php?u=${encode(c.url)}`,
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: icons.linkedin,
    href: (c: ShareContext) => `https://www.linkedin.com/sharing/share-offsite/?url=${encode(c.url)}`,
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: icons.whatsapp,
    href: (c: ShareContext) => `https://api.whatsapp.com/send?text=${encode(`${c.title} ${c.url}`)}`,
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    icon: icons.telegram,
    href: (c: ShareContext) => `https://t.me/share/url?url=${encode(c.url)}&text=${encode(c.title)}`,
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    icon: icons.reddit,
    href: (c: ShareContext) => `https://www.reddit.com/submit?url=${encode(c.url)}&title=${encode(c.title)}`,
  },
  email: {
    id: 'email',
    label: 'Email',
    icon: icons.email,
    href: (c: ShareContext) => `mailto:?subject=${encode(c.title)}&body=${encode(c.url)}`,
  },
};

/** Offered when the host configures nothing. */
export const DEFAULT_TARGETS = ['native', 'copy', 'embed'];

/**
 * Turn the configured list into concrete targets, dropping unknown ids.
 *
 * @param configured - Ids or inline target definitions
 * @param onUnknown - Called with any id that does not resolve
 */
export function resolveTargets(
  configured: Array<string | ShareTarget>,
  onUnknown?: (id: string) => void,
): ShareTarget[] {
  const resolved: ShareTarget[] = [];

  for (const entry of configured) {
    if (typeof entry !== 'string') {
      resolved.push({ ...entry, icon: entry.icon ?? icons[entry.id] });
      continue;
    }

    const builtin = BUILTIN_TARGETS[entry];
    if (builtin) {
      resolved.push(builtin);
    } else {
      onUnknown?.(entry);
    }
  }

  return resolved;
}
