/**
 * Chapters plugin styles.
 *
 * Injected once per document. Sizes are in px so the panel stays put regardless
 * of the host page's font size, matching the rest of the player chrome.
 */

export const styles = `
.sp-chapters {
  position: relative;
  display: inline-flex;
}

.sp-chapters__button svg {
  width: 20px;
  height: 20px;
}

.sp-chapters__panel {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 260px;
  max-width: 340px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 8px;
  background: rgba(20, 20, 20, 0.96);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.sp-chapters__panel[hidden] {
  display: none;
}

.sp-chapters__item {
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

.sp-chapters__item:hover,
.sp-chapters__item:focus-visible {
  background: rgba(255, 255, 255, 0.12);
}

.sp-chapters__item--active {
  background: rgba(255, 255, 255, 0.08);
}

.sp-chapters__item--active .sp-chapters__label {
  font-weight: 600;
}

.sp-chapters__time {
  flex: 0 0 auto;
  min-width: 46px;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  line-height: 18px;
}

.sp-chapters__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sp-chapters__label {
  font-size: 13px;
  line-height: 18px;
}

.sp-chapters__subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  line-height: 16px;
}

@media (max-width: 480px) {
  .sp-chapters__panel {
    min-width: 200px;
    max-width: 76vw;
  }
}
`;
