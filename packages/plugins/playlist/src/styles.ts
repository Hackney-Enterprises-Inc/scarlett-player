/**
 * Playlist control styles.
 *
 * Injected once per document, and only when the plugin initialises, so a
 * headless host that never renders controls pays nothing for them.
 */

const STYLE_ID = 'sp-playlist-styles';

export const styles = `
.sp-playlist-skip[disabled] {
  opacity: 0.4;
  cursor: default;
}

.sp-playlist {
  position: relative;
  display: inline-flex;
}

.sp-playlist__button svg,
.sp-playlist-skip svg {
  width: 20px;
  height: 20px;
}

.sp-playlist__panel {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 240px;
  max-width: 320px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 8px;
  background: rgba(20, 20, 20, 0.96);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.sp-playlist__panel[hidden] {
  display: none;
}

.sp-playlist__item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sp-playlist__item:hover,
.sp-playlist__item:focus-visible {
  background: rgba(255, 255, 255, 0.12);
}

.sp-playlist__item--active {
  background: rgba(255, 255, 255, 0.08);
}

.sp-playlist__item--active .sp-playlist__title {
  font-weight: 600;
}

.sp-playlist__position {
  flex: 0 0 auto;
  min-width: 18px;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  line-height: 18px;
}

.sp-playlist__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sp-playlist__title {
  font-size: 13px;
  line-height: 18px;
}

.sp-playlist__artist {
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  line-height: 16px;
}

@media (max-width: 480px) {
  .sp-playlist__panel {
    min-width: 200px;
    max-width: 76vw;
  }
}
`;

/**
 * Add the playlist stylesheet to the document, once.
 *
 * @returns The style element, or null when it was already present
 */
export function injectStyles(): HTMLStyleElement | null {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
    return null;
  }

  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = styles;
  document.head.appendChild(el);

  return el;
}
