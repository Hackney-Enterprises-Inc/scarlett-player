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
}
