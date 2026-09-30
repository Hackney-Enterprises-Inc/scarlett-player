/** Whether a browser opt-out currently suppresses this beacon. @param enabled - Host opt-in to DNT/GPC. @returns True if collection must stop. */
export function privacyOptOut(enabled: boolean | undefined): boolean {
  if (!enabled || typeof navigator === 'undefined') return false;
  return navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}
