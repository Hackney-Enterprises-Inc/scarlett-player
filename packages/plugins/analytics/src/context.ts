/** Privacy-minimized navigation context captured at view start. @param playerInitTime - Host epoch timestamp. @returns ViewStart-only fields. */
export function pageContext(playerInitTime?: number): Record<string, string | number> {
  const context: Record<string, string | number> = {};
  if (typeof window !== 'undefined') {
    context.pageUrl = window.location.origin + window.location.pathname;
  }
  if (typeof document !== 'undefined' && document.referrer) {
    try { context.referrerOrigin = new URL(document.referrer).origin; } catch { /* Invalid referrer: omit. */ }
  }
  if (typeof performance !== 'undefined' && Number.isFinite(performance.now())) {
    context.pageLoadToInitMs = Math.max(0, performance.now());
  }
  if (typeof playerInitTime === 'number' && Number.isFinite(playerInitTime)) {
    context.playerInitMs = Math.max(0, Date.now() - playerInitTime);
  }
  return context;
}
