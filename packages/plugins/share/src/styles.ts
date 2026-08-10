/**
 * Share sheet styles.
 *
 * Mobile first: the base rules describe the bottom sheet, which is the layout
 * phones get, and a single min-width query promotes it to a popover on larger
 * screens. Sizes are in px to stay independent of the host page's font size -
 * the player is frequently embedded in someone else's CSS.
 */

export const styles = `
.sp-share-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  transition: opacity 180ms ease;
  z-index: 30;
}
.sp-share-backdrop--open { opacity: 1; }

.sp-share-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 31;
  background: #1c1c1e;
  color: #fff;
  border-radius: 14px 14px 0 0;
  padding: 8px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -6px 28px rgba(0, 0, 0, 0.45);
  transform: translateY(100%);
  transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
  max-height: 80%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.sp-share-sheet--open { transform: translateY(0); }

/* Grab handle - the affordance that says "this drags/dismisses" on a phone. */
.sp-share-grip {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.3);
  margin: 4px auto 10px;
}

.sp-share-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  padding: 0 8px 8px;
  margin: 0;
}

.sp-share-targets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.sp-share-target {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  /* 44px is the WCAG 2.5.5 floor; 72px is a comfortable thumb target. */
  min-height: 72px;
  min-width: 44px;
  padding: 10px 6px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 120ms ease, transform 120ms ease;
}
.sp-share-target:active { transform: scale(0.94); background: rgba(255, 255, 255, 0.14); }
.sp-share-target:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
@media (hover: hover) {
  .sp-share-target:hover { background: rgba(255, 255, 255, 0.1); }
}

.sp-share-target svg {
  width: 24px;
  height: 24px;
  display: block;
}

.sp-share-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.sp-share-label {
  line-height: 1.2;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Copy confirmation, announced politely to assistive tech. */
.sp-share-toast {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%) translateY(8px);
  z-index: 32;
  background: rgba(28, 28, 30, 0.95);
  color: #fff;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 10px 16px;
  border-radius: 20px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
}
.sp-share-toast--visible { opacity: 1; transform: translateX(-50%) translateY(0); }

/* Fallback when the clipboard is unavailable: show the URL to copy by hand. */
.sp-share-fallback {
  display: flex;
  gap: 8px;
  padding: 8px;
}
.sp-share-fallback input {
  flex: 1;
  min-width: 0;
  /* 16px keeps iOS Safari from zooming the viewport on focus. */
  font-size: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

@media (min-width: 640px) {
  .sp-share-backdrop { background: rgba(0, 0, 0, 0.25); }

  .sp-share-sheet {
    left: auto;
    right: 12px;
    bottom: 64px;
    width: 320px;
    border-radius: 12px;
    padding: 10px;
    transform: translateY(8px) scale(0.98);
    opacity: 0;
    transition: opacity 140ms ease, transform 140ms ease;
    max-height: 60%;
  }
  .sp-share-sheet--open { transform: translateY(0) scale(1); opacity: 1; }

  .sp-share-grip { display: none; }
  .sp-share-targets { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .sp-share-backdrop,
  .sp-share-sheet,
  .sp-share-target,
  .sp-share-toast {
    transition: none;
  }
}
`;
