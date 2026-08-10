/**
 * Share Plugin for Scarlett Player
 *
 * Mobile first. On a phone the button opens the OS share sheet directly when
 * the browser supports it - that is the fastest, most familiar path and it
 * carries every app the viewer already has. Everywhere else it opens an
 * in-player sheet: a bottom sheet on small screens, a popover on large ones.
 *
 * What gets shared is the **page** URL, never the media `src`. Playback URLs
 * are frequently signed, so sharing one would leak a credential and hand the
 * recipient a link that expires.
 *
 * @example
 * ```ts
 * import { createSharePlugin } from '@scarlett-player/share';
 *
 * const player = new ScarlettPlayer({
 *   container: '#player',
 *   plugins: [
 *     uiPlugin({ controls: ['play', 'volume', 'time', 'spacer', 'share', 'fullscreen'] }),
 *     createSharePlugin({ embedBaseUrl: 'https://cdn.example.com/iframe.html' }),
 *   ],
 * });
 * ```
 */

import type { IPluginAPI, Plugin, PluginType } from '@scarlett-player/core';
import type { ShareContext, SharePluginConfig, ShareTarget } from './types';
import { applyTimestamp, resolveBaseUrl, resolveTitle } from './url';
import { DEFAULT_TARGETS, resolveTargets } from './targets';
import { buildEmbedSnippet, canUseNativeShare, copyText, nativeShare } from './actions';
import { ShareSheet } from './ShareSheet';
import { ShareButton } from './ShareButton';
import { styles } from './styles';

export type { SharePluginConfig, ShareTarget, ShareContext } from './types';
export { BUILTIN_TARGETS, DEFAULT_TARGETS } from './targets';

declare module '@scarlett-player/core' {
  interface PlayerEventMap {
    /** The share sheet opened. */
    'share:opened': void;
    /** The share sheet closed without a share. */
    'share:closed': void;
    /** A share completed. */
    'share:completed': { targetId: string; url: string };
  }
}

/** Public surface, for hosts that want to drive sharing themselves. */
export interface SharePlugin extends Plugin {
  /** Share via a specific target, or open the sheet when omitted. */
  share(targetId?: string): Promise<void>;
  /** The URL that would be shared right now, timestamp included. */
  getShareUrl(): string;
  /** Close the sheet if it is open. */
  close(): void;
}

const STYLE_ID = 'sp-share-styles';

/**
 * Create a Share Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Share Plugin instance
 */
export function createSharePlugin(config: SharePluginConfig = {}): SharePlugin {
  let api: IPluginAPI | null = null;
  let sheet: ShareSheet | null = null;
  let styleEl: HTMLStyleElement | null = null;

  const configuredTargets = config.targets ?? DEFAULT_TARGETS;

  /** Snapshot everything a target needs, at the moment of sharing. */
  const buildContext = (): ShareContext => {
    const currentTime = (api?.getState('currentTime') as number | undefined) ?? 0;
    const isLive = Boolean(api?.getState('live'));
    const baseUrl = resolveBaseUrl(config);

    return {
      url: applyTimestamp(baseUrl, currentTime, isLive, config),
      title: resolveTitle(config),
      currentTime,
      isLive,
    };
  };

  const reportError = (error: unknown): void => {
    const err = error instanceof Error ? error : new Error(String(error));
    api?.logger.error('Share failed', { error: err });
    config.onError?.(err);
  };

  const reportShared = (targetId: string, url: string): void => {
    config.onShare?.(targetId, url);
    api?.emit('share:completed', { targetId, url });
  };

  /** Targets to display, minus any that cannot work in this environment. */
  const availableTargets = (context: ShareContext): ShareTarget[] =>
    resolveTargets(configuredTargets, (id) => api?.logger.warn(`Unknown share target: ${id}`)).filter(
      (target) => {
        if (target.id === 'native') {
          return canUseNativeShare();
        }
        if (target.id === 'embed') {
          return buildEmbedSnippet(context, config) !== null;
        }
        return true;
      },
    );

  const runTarget = async (target: ShareTarget, context: ShareContext): Promise<void> => {
    if (target.id === 'native') {
      const shared = await nativeShare(context);
      if (shared) {
        reportShared(target.id, context.url);
      }
      return;
    }

    if (target.id === 'copy') {
      const copied = await copyText(context.url);
      if (copied) {
        sheet?.showToast('Link copied');
        reportShared(target.id, context.url);
      } else {
        // Clipboard blocked - show the URL so it can still be copied by hand.
        sheet?.showManualCopy(context.url);
      }
      return;
    }

    if (target.id === 'embed') {
      const snippet = buildEmbedSnippet(context, config);
      if (!snippet) {
        return;
      }

      const copied = await copyText(snippet);
      if (copied) {
        sheet?.showToast('Embed code copied');
        reportShared(target.id, context.url);
      } else {
        sheet?.showManualCopy(snippet);
      }
      return;
    }

    if (target.href) {
      window.open(target.href(context), '_blank', 'noopener,noreferrer');
      reportShared(target.id, context.url);
    }
  };

  const openSheet = (): void => {
    if (!sheet) {
      return;
    }

    const context = buildContext();
    const targets = availableTargets(context);

    if (targets.length === 0) {
      api?.logger.warn('No share targets available');
      return;
    }

    sheet.show(targets);
    api?.emit('share:opened', undefined);
  };

  /**
   * What tapping the button does.
   *
   * On a phone offering the OS sheet, and with nothing custom configured,
   * go straight there - an extra in-player menu in front of the native sheet
   * is a step with no payoff. Otherwise open our own sheet.
   */
  const activate = async (): Promise<void> => {
    const hostChoseTargets = config.targets !== undefined;

    if (!hostChoseTargets && canUseNativeShare()) {
      const context = buildContext();
      try {
        const shared = await nativeShare(context);
        if (shared) {
          reportShared('native', context.url);
        }
      } catch (error) {
        reportError(error);
      }
      return;
    }

    openSheet();
  };

  return {
    id: 'share',
    name: 'Share',
    version: '1.0.0',
    type: 'feature' as PluginType,
    description: 'Native share sheet, copy link, timestamps and embed codes',

    init(pluginApi: IPluginAPI): void {
      api = pluginApi;
      api.logger.debug('Share plugin initialized');

      if (!document.getElementById(STYLE_ID)) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
      }

      sheet = new ShareSheet(api, {
        onSelect: (target) => {
          const context = buildContext();
          // Link targets close immediately; copy-style ones stay open so the
          // confirmation toast is visible against the sheet.
          if (target.id !== 'copy' && target.id !== 'embed') {
            sheet?.close();
          }
          void runTarget(target, context).catch(reportError);
        },
        onClose: () => {
          api?.emit('share:closed', undefined);
        },
      });

      // Registering does not place the button anywhere - the host opts in by
      // listing 'share' in its control layout. Done via a runtime import so a
      // headless host never needs @scarlett-player/ui installed.
      void import('@scarlett-player/ui')
        .then(({ registerControl }) => {
          registerControl('share', (controlApi) => new ShareButton(controlApi, () => void activate()));
        })
        .catch(() => {
          api?.logger.debug('@scarlett-player/ui not present, share control not registered');
        });

      api.onDestroy(() => {
        sheet?.destroy();
        sheet = null;
      });
    },

    destroy(): void {
      sheet?.destroy();
      sheet = null;
      styleEl?.remove();
      styleEl = null;
      api = null;
    },

    async share(targetId?: string): Promise<void> {
      if (!targetId) {
        await activate();
        return;
      }

      const context = buildContext();
      const target = availableTargets(context).find((t) => t.id === targetId);

      if (!target) {
        reportError(new Error(`Unknown or unavailable share target: ${targetId}`));
        return;
      }

      try {
        await runTarget(target, context);
      } catch (error) {
        reportError(error);
      }
    },

    getShareUrl(): string {
      return buildContext().url;
    },

    close(): void {
      sheet?.close();
    },
  };
}

export default createSharePlugin;
