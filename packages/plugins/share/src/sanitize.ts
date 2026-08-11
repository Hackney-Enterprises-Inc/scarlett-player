/**
 * Icon sanitisation.
 *
 * `buttonIcon` is host configuration, not viewer input, so this is not the
 * primary defence against anything. It exists because config has a way of
 * becoming data: an integrator wires the icon to a CMS field or a tenant
 * theme, and now markup from somewhere else lands in `innerHTML`.
 *
 * Checking that the string "looks like an SVG" would be worse than nothing,
 * because `<svg onload="...">` passes that check. This strips what actually
 * executes instead: non-SVG elements, event handler attributes, and script
 * URLs.
 */

/**
 * SVG elements an icon legitimately needs. Anything outside this list is
 * dropped rather than escaped, so a stray `<script>` or `<foreignObject>`
 * (which can host arbitrary HTML) never reaches the document.
 */
const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'rect',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'use',
  'symbol',
  'title',
  'desc',
]);

/**
 * Strip anything executable from an icon.
 *
 * @param markup - Inline SVG supplied by the host
 * @returns Safe markup, or null when the input contains no usable SVG
 */
export function sanitizeIcon(markup: string): string | null {
  if (typeof markup !== 'string' || markup.trim() === '') {
    return null;
  }

  if (typeof DOMParser === 'undefined') {
    return null;
  }

  // Parsed as HTML rather than XML on purpose: hand-written icons are often not
  // well-formed XML, and rejecting them over an unquoted attribute would push
  // integrators back towards passing raw markup some other way.
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  const svg = doc.body.querySelector('svg');

  if (!svg) {
    return null;
  }

  for (const element of Array.from(svg.querySelectorAll('*'))) {
    if (!ALLOWED_ELEMENTS.has(element.nodeName.toLowerCase())) {
      element.remove();
      continue;
    }

    stripDangerousAttributes(element);
  }

  stripDangerousAttributes(svg);

  return svg.outerHTML;
}

/**
 * Remove event handlers and script URLs from one element.
 *
 * @param element - Element to clean in place
 */
function stripDangerousAttributes(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();

    // Covers onclick, onload, onerror and every other handler in one rule,
    // rather than a list that goes stale as the platform adds events.
    if (name.startsWith('on')) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === 'href' || name === 'xlink:href' || name === 'src') {
      const value = attribute.value.replace(/\s+/g, '').toLowerCase();

      if (value.startsWith('javascript:') || value.startsWith('data:text/html')) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}
