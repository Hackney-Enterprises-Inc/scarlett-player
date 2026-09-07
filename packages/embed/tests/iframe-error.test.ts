/**
 * iframe.html error-path escaping.
 *
 * The page is served from the CDN origin and its `error.message` can carry the
 * `src` from the query string, so interpolating it into `innerHTML` was an XSS
 * on that origin. The catch block builds nodes instead.
 *
 * The handler is extracted from the shipped file rather than reimplemented
 * here: a test that restates the fix would keep passing if the page regressed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IFRAME_HTML = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'iframe.html',
);

/**
 * The body of iframe.html's `.catch((error) => { ... })` handler, as source.
 *
 * Matched from the `console.error('Failed to load Scarlett Player:'` line that
 * opens it to the closing `});` of the catch, so it moves with the file.
 */
const catchHandlerSource = (): string => {
  const html = readFileSync(IFRAME_HTML, 'utf8');
  const start = html.indexOf("console.error('Failed to load Scarlett Player:', error);");
  expect(start).toBeGreaterThan(-1);

  const end = html.indexOf('\n        });', start);
  expect(end).toBeGreaterThan(start);

  return html.slice(start, end);
};

/** Run the real handler against an error, into the current jsdom document. */
const runCatch = (error: unknown): void => {
  // eslint-disable-next-line no-new-func
  new Function('error', catchHandlerSource())(error);
};

describe('iframe.html error rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div>previous content</div>';
  });

  it('does not execute markup carried in the error message', () => {
    runCatch(new Error('<img src=x onerror=alert(1)>'));

    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('still shows the heading and the message text', () => {
    runCatch(new Error('Network request failed'));

    expect(document.querySelector('h1')?.textContent).toBe('Error Loading Player');
    expect(document.querySelector('p')?.textContent).toBe('Network request failed');
  });

  it('replaces whatever was on the page', () => {
    runCatch(new Error('boom'));

    expect(document.body.textContent).not.toContain('previous content');
  });

  it('survives an error with no message', () => {
    runCatch({});

    expect(document.querySelector('p')?.textContent).toBe('Unknown error');
  });

  it('never interpolates the message into innerHTML', () => {
    // The defect, asserted against the source: the old handler wrote
    // `document.body.innerHTML = \`...${error.message}...\``. Matching the
    // assignment rather than the bare word, since the comment naming the fix
    // legitimately mentions it.
    expect(catchHandlerSource()).not.toMatch(/innerHTML\s*=/);
  });
});
