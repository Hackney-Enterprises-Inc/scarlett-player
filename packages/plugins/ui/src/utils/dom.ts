/**
 * DOM utility functions
 */

/**
 * Create an HTML element with optional attributes and children.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  children?: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') {
        el.className = value;
      } else {
        el.setAttribute(key, value);
      }
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    }
  }

  return el;
}

/**
 * Create a button element with icon and aria-label.
 */
export function createButton(
  className: string,
  label: string,
  icon: string
): HTMLButtonElement {
  const btn = createElement('button', {
    className: `sp-control ${className}`,
    'aria-label': label,
    type: 'button',
  });
  // Routed through setHTML so the first update() with an unchanged icon is a
  // no-op rather than a needless rebuild of the button's contents.
  setHTML(btn, icon);
  return btn;
}

/**
 * Add click handler with optional long-press detection.
 */
export function onClick(
  el: HTMLElement,
  handler: (e: MouseEvent | TouchEvent) => void
): () => void {
  const handleClick = (e: MouseEvent) => handler(e);
  const handleTouch = (e: TouchEvent) => {
    e.preventDefault();
    handler(e);
  };

  el.addEventListener('click', handleClick);
  el.addEventListener('touchend', handleTouch);

  return () => {
    el.removeEventListener('click', handleClick);
    el.removeEventListener('touchend', handleTouch);
  };
}

/**
 * Get the video element from the container.
 */
export function getVideo(container: HTMLElement): HTMLVideoElement | null {
  return container.querySelector('video');
}

/**
 * Markup last written to each element by {@link setHTML}.
 *
 * Reading `el.innerHTML` back is not a reliable comparison: the DOM
 * re-serializes markup (attribute order, self-closing tags, injected `xmlns`
 * on SVG), so the round-tripped string rarely matches the source exactly.
 * Remembering what we assigned gives an exact check.
 */
const lastHTML = new WeakMap<Element, string>();

/**
 * Set an element's innerHTML only when the markup actually differs.
 *
 * Controls re-render on every state change (including `timeupdate` and
 * `progress`, which fire several times a second). Unconditionally assigning
 * `innerHTML` tears out and rebuilds the child nodes even when the markup is
 * identical. If that happens between a user's `mousedown` and `mouseup`, the
 * node that received the `mousedown` no longer exists and the browser never
 * dispatches a `click` — the control silently ignores the press.
 *
 * @param el - Element to update
 * @param html - Desired markup
 * @returns True when the DOM was actually written to
 */
export function setHTML(el: HTMLElement, html: string): boolean {
  if (lastHTML.get(el) === html) return false;
  el.innerHTML = html;
  lastHTML.set(el, html);
  return true;
}

/**
 * Set an attribute only when its value actually differs.
 *
 * Avoids pointless attribute mutations (and the MutationObserver /
 * accessibility-tree churn they cause) on every state change.
 *
 * @param el - Element to update
 * @param name - Attribute name
 * @param value - Desired attribute value
 * @returns True when the attribute was actually written
 */
export function setAttr(el: HTMLElement, name: string, value: string): boolean {
  if (el.getAttribute(name) === value) return false;
  el.setAttribute(name, value);
  return true;
}
