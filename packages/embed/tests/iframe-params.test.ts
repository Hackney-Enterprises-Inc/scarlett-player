/**
 * iframe.html query-string parsing.
 *
 * The page builds its player config from `window.location.search`. The block
 * is extracted from the shipped file rather than restated here, so a test
 * cannot keep passing after the page regresses.
 *
 * Anchors: the block starts at `const params = new URLSearchParams(` and ends
 * just before the `// Share button.` comment that opens the share-url block.
 * Everything between them is config building that reads only `params`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IFRAME_HTML = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'iframe.html',
);

const START_ANCHOR = 'const params = new URLSearchParams(';
const END_ANCHOR = '// Share button.';

const configBlockSource = (): string => {
  const html = readFileSync(IFRAME_HTML, 'utf8');
  const start = html.indexOf(START_ANCHOR);
  expect(start).toBeGreaterThan(-1);

  const end = html.indexOf(END_ANCHOR, start);
  expect(end).toBeGreaterThan(start);

  return html.slice(start, end);
};

/** Run the real config block against a query string and return its config. */
const parse = (search: string): Record<string, unknown> => {
  // eslint-disable-next-line no-new-func
  return new Function('window', `${configBlockSource()}; return config;`)({
    location: { search },
  });
};

describe('iframe.html query parameters', () => {
  describe('big-play-button', () => {
    it('false turns it off', () => {
      expect(parse('?src=x&big-play-button=false').bigPlayButton).toBe(false);
    });

    it('0 turns it off', () => {
      expect(parse('?src=x&big-play-button=0').bigPlayButton).toBe(false);
    });

    it('true keeps it on', () => {
      expect(parse('?src=x&big-play-button=true').bigPlayButton).toBe(true);
    });

    it('is left unset when absent', () => {
      expect('bigPlayButton' in parse('?src=x')).toBe(false);
    });
  });

  describe('keyboard', () => {
    it('false turns shortcuts off', () => {
      expect(parse('?src=x&keyboard=false').keyboard).toBe(false);
    });

    it('0 turns shortcuts off', () => {
      expect(parse('?keyboard=0').keyboard).toBe(false);
    });

    it('true keeps shortcuts on', () => {
      expect(parse('?keyboard=true').keyboard).toBe(true);
    });

    it('is left unset when absent, so the ui plugin default applies', () => {
      expect('keyboard' in parse('?src=x')).toBe(false);
    });
  });
});
