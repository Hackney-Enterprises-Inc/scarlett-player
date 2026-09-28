/**
 * Per-load options for `ScarlettPlayer.load()`.
 */
export interface LoadOptions {
  /**
   * Play once the provider has loaded (`true`) or stay paused (`false`), for
   * this load only. Omitted, the `autoplay` state key decides, and the key is
   * never changed by this option.
   */
  autoplay?: boolean;
}
