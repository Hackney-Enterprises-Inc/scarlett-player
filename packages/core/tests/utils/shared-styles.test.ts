/**
 * Shared stylesheet reference counting (PR-2.2 / SP-18).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { injectSharedStyles, sharedStyleHolders } from '../../src/utils/shared-styles';

const ID = 'sp-test-styles';
const CSS = '.sp-test { color: red; }';

describe('injectSharedStyles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('injects the sheet once for the first holder', () => {
    const release = injectSharedStyles(ID, CSS);

    const el = document.getElementById(ID);
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe(CSS);
    expect(sharedStyleHolders(ID)).toBe(1);

    release();
  });

  it('reuses the sheet for a second holder', () => {
    const releaseA = injectSharedStyles(ID, CSS);
    const releaseB = injectSharedStyles(ID, CSS);

    expect(document.querySelectorAll(`#${ID}`)).toHaveLength(1);
    expect(sharedStyleHolders(ID)).toBe(2);

    releaseA();
    releaseB();
  });

  it('keeps the sheet until the last holder releases', () => {
    const releaseA = injectSharedStyles(ID, CSS);
    const releaseB = injectSharedStyles(ID, CSS);

    releaseA();
    expect(document.getElementById(ID)).not.toBeNull();

    releaseB();
    expect(document.getElementById(ID)).toBeNull();
    expect(sharedStyleHolders(ID)).toBe(0);
  });

  it('ignores a repeated release', () => {
    const releaseA = injectSharedStyles(ID, CSS);
    const releaseB = injectSharedStyles(ID, CSS);

    releaseA();
    releaseA();
    releaseA();

    expect(document.getElementById(ID)).not.toBeNull();

    releaseB();
    expect(document.getElementById(ID)).toBeNull();
  });

  it('starts a fresh generation when the sheet was removed externally', () => {
    const stale = injectSharedStyles(ID, CSS);

    // A host clearing document.head, or an SPA route teardown.
    document.getElementById(ID)?.remove();

    const release = injectSharedStyles(ID, CSS);
    expect(document.getElementById(ID)).not.toBeNull();
    expect(sharedStyleHolders(ID)).toBe(1);

    // The lapsed claim must not decrement the new sheet's count.
    stale();
    expect(document.getElementById(ID)).not.toBeNull();

    release();
    expect(document.getElementById(ID)).toBeNull();
  });
});
