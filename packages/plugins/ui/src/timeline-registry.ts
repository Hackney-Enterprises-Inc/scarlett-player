/**
 * Timeline extension registry.
 *
 * The control registry lets a plugin contribute a *button*. This lets one
 * contribute an editing layer over the **playback timeline** itself - the clip
 * plugin's in/out handles are the first, and the reason it exists: a clip
 * editor with its own miniature track cannot express a 30 second selection on
 * a two hour source, and forces the viewer to pick points on a rail that is
 * not the one they were just scrubbing.
 *
 * The contract is deliberately narrow, and the direction of the dependency is
 * the point: `@scarlett-player/ui` knows nothing about clips, reads no
 * clip-specific state, and gains no `IPluginAPI` surface. It offers a
 * positioned layer over its rail plus four lifecycle calls, and an extension
 * paints into it.
 *
 * Registrations are keyed by the player container in a `WeakMap`, so two
 * players on one page never see each other's extension and a destroyed player
 * leaves nothing to collect. There is **one** active editing extension per
 * player: a second registration replaces the first, and the replaced one is
 * destroyed. The disposer returned by `registerTimelineExtension` is
 * identity-safe - it only removes the registration it made, so cleanup running
 * after a replacement cannot unmount its successor.
 *
 * ## Ordering
 *
 * Plugin init order is not guaranteed, so both orders work. Register before
 * the UI plugin builds its bar and the extension mounts as soon as the
 * progress bar attaches; register afterwards and it mounts immediately.
 *
 * @example
 * ```ts
 * const release = registerTimelineExtension(api.container, (surface) => {
 *   surface.element.appendChild(myHandles);
 *   return {
 *     update: () => reposition(surface.getRailRect()),
 *     onSeekStart: () => suspendPreview(),
 *     onSeekEnd: () => {},
 *     destroy: () => myHandles.remove(),
 *   };
 * });
 * ```
 */

/**
 * What the UI package offers an extension: a layer to paint into, the rail's
 * measured geometry, and two leases.
 */
export interface TimelineSurface {
  /**
   * The extension's own layer.
   *
   * A sibling of the `role="slider"` seek element - never inside it, so an
   * extension's controls are not swallowed by the slider's accessibility
   * semantics - positioned with exactly the horizontal geometry of the visible
   * rail and centred on it vertically. It paints above the buffer, chapter and
   * progress layers.
   *
   * The layer itself is `pointer-events: none`; give explicit hit targets
   * inside it `pointer-events: auto`, and plain presses on the rail keep
   * seeking as they always did.
   */
  element: HTMLElement;

  /**
   * The visible rail's current box, in client coordinates.
   *
   * The same box the seek slider maps a press to, so an extension mapping
   * `clientX` to a time agrees with the player's own seeking to the pixel.
   *
   * @returns The rail's bounding rectangle
   */
  getRailRect(): DOMRect;

  /**
   * Enter or leave editing mode.
   *
   * While active the control bar and progress bar are held visible (auto-hide
   * cannot take an editor off screen mid-gesture) and the timeline reserves
   * the vertical room an editor needs around the rail. Leaving restores the
   * ordinary geometry and restarts the normal hide delay.
   *
   * Independent of any control's `isMenuOpen()`: an extension opened from a
   * host's own button, in a layout with no matching control at all, still
   * holds the bar.
   *
   * @param active - Whether the extension is editing
   */
  setEditing(active: boolean): void;

  /**
   * Take or release the pointer lease.
   *
   * While active the timeline's own seeking is suppressed, so dragging an
   * extension's handle past the rail cannot also scrub the video, and the
   * hover tooltip stays out of the way.
   *
   * @param active - Whether the extension owns the current pointer
   */
  setDragging(active: boolean): void;
}

/** What an extension gives back to the UI package. */
export interface TimelineExtension {
  /**
   * Re-read geometry and repaint. Called with the progress bar's own update,
   * so an extension never has to poll or observe the rail itself.
   */
  update(): void;

  /**
   * An ordinary seek began on the timeline (mouse, touch or keyboard) - not
   * one the extension owns.
   */
  onSeekStart(): void;

  /** The ordinary seek ended, was released outside the rail, or was cancelled. */
  onSeekEnd(): void;

  /** Unmount: remove everything added to `surface.element` and drop listeners. */
  destroy(): void;
}

/**
 * Builds an extension for one player's timeline.
 *
 * @param surface - The layer, geometry and leases (see {@link TimelineSurface})
 * @returns The mounted extension
 */
export type TimelineExtensionFactory = (surface: TimelineSurface) => TimelineExtension;

/**
 * The progress bar's side of the registry.
 *
 * Implemented by `ProgressBar` and attached with {@link attachTimelineHost};
 * the registry calls it whenever the registered factory for that player
 * changes, and the host owns mounting, replacement and destruction.
 *
 * @internal
 */
export interface TimelineHost {
  /**
   * Mount a factory, replacing (and destroying) whatever was mounted before.
   *
   * @param factory - The factory to mount, or null to unmount
   */
  setFactory(factory: TimelineExtensionFactory | null): void;
}

/** One player's active registration, with the token its disposer checks. */
interface Registration {
  factory: TimelineExtensionFactory;
  token: object;
}

/** Active registrations, keyed by player container. */
const registrations = new WeakMap<HTMLElement, Registration>();

/** Mounted progress bars, keyed by player container. */
const hosts = new WeakMap<HTMLElement, TimelineHost>();

/**
 * Register the editing extension for one player's timeline.
 *
 * One extension is active per player. Registering again replaces the previous
 * one, which is destroyed; the returned disposer only ever removes the
 * registration *it* made, so a late cleanup cannot unmount a replacement.
 *
 * Works before or after the UI plugin has initialised: if the progress bar is
 * already mounted the factory runs immediately, otherwise it runs when the bar
 * attaches.
 *
 * @param owner - The player container, i.e. `api.container`
 * @param factory - Builds the extension for that player's timeline surface
 * @returns Disposer that unmounts this registration, immediately and once
 */
export function registerTimelineExtension(
  owner: HTMLElement,
  factory: TimelineExtensionFactory
): () => void {
  const token = {};
  registrations.set(owner, { factory, token });
  hosts.get(owner)?.setFactory(factory);

  return () => {
    const current = registrations.get(owner);
    // Identity check, not presence: by the time a plugin's teardown runs, a
    // newer registration may own this player, and unmounting it here would
    // take the live editor down with the dead one.
    if (!current || current.token !== token) return;
    registrations.delete(owner);
    hosts.get(owner)?.setFactory(null);
  };
}

/**
 * Drop a player's registration whatever made it.
 *
 * For a host tearing a player down wholesale; ordinary plugins use the
 * disposer they were handed.
 *
 * @param owner - The player container
 * @returns Whether a registration was removed
 */
export function unregisterTimelineExtension(owner: HTMLElement): boolean {
  if (!registrations.has(owner)) return false;
  registrations.delete(owner);
  hosts.get(owner)?.setFactory(null);
  return true;
}

/**
 * Whether a player has an editing extension registered.
 *
 * Lets a plugin feature-detect its own registration without keeping a second
 * copy of the bookkeeping.
 *
 * @param owner - The player container
 * @returns True when a factory is registered for that player
 */
export function hasTimelineExtension(owner: HTMLElement): boolean {
  return registrations.has(owner);
}

/**
 * Attach a player's progress bar to the registry.
 *
 * Mounts the registered factory straight away when there is one. The returned
 * disposer detaches only this host, so a rebuilt bar that has already attached
 * its replacement is left alone.
 *
 * @param owner - The player container
 * @param host - The progress bar's mounting side
 * @returns Disposer that detaches this host
 * @internal
 */
export function attachTimelineHost(owner: HTMLElement, host: TimelineHost): () => void {
  hosts.set(owner, host);
  const registration = registrations.get(owner);
  if (registration) host.setFactory(registration.factory);

  return () => {
    if (hosts.get(owner) === host) hosts.delete(owner);
  };
}
