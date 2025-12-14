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
  btn.innerHTML = icon;
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
