/**
 * Base Control Interface
 *
 * All control components implement this interface.
 */

export interface Control {
  /** Render the control element */
  render(): HTMLElement;
  /** Update control based on current state */
  update(): void;
  /** Cleanup when control is destroyed */
  destroy(): void;
  /**
   * Whether this control currently has a popover open.
   *
   * Optional. Controls that implement it hold off the control bar's auto-hide
   * while their menu is on screen, so the bar cannot disappear out from under
   * a panel the viewer is reading.
   */
  isMenuOpen?(): boolean;
}
