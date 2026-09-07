/**
 * ClipOverlay tests - the plan's "UI" acceptance items that belong to the
 * panel (Escape + focus return, Confirm disabled states, the title field,
 * Enter-to-confirm, literal-text notices, submitting chrome, the focus trap)
 * plus the drag callback pass-throughs. The selector's own behavior is in
 * selector.test.ts; the plugin wiring is in plugin.test.ts / scrub.test.ts.
 *
 * `requestAnimationFrame` is stubbed to fire synchronously so the open
 * deferral (focus first, `--open` class) is assertible without timing races.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ClipOverlay } from '../src/ClipOverlay';
import type { ClipOverlayCallbacks, ClipOverlayOptions } from '../src/ClipOverlay';
import type { ClipSelection, RangeBounds } from '../src/range';
import type { ClipsPluginConfig } from '../src/types';

const BOUNDS: RangeBounds = { min: 0, max: 600 };
/** A valid selection under the default config: 30s inside 0..600. */
const SELECTION: ClipSelection = { start: 100, end: 130 };
const CONFIG: ClipsPluginConfig = { minDuration: 5, maxDuration: 60, step: 1 };

interface Harness {
  overlay: ClipOverlay;
  container: HTMLElement;
  panel: HTMLElement;
  button: HTMLButtonElement;
  track: HTMLElement;
  readout: HTMLElement;
  notice: HTMLElement;
  titleInput: HTMLInputElement | null;
  counter: HTMLElement | null;
  cancel: HTMLButtonElement;
  confirm: HTMLButtonElement;
  callbacks: ClipOverlayCallbacks;
}

function setup(overrides: Partial<ClipOverlayOptions> = {}): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  // Stand-in for the control-bar button: the overlay must hand focus back
  // here on close (it stays visible while the panel is open - ClipButton).
  const button = document.createElement('button');
  container.appendChild(button);

  const callbacks: ClipOverlayCallbacks = {
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onTitleChange: vi.fn(),
    onSelectionChange: vi.fn(),
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn(),
  };

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });

  const options: ClipOverlayOptions = {
    container,
    selection: SELECTION,
    bounds: BOUNDS,
    config: CONFIG,
    getReturnFocus: () => button,
    ...overrides,
    callbacks: { ...callbacks, ...overrides.callbacks },
  };
  const overlay = new ClipOverlay(options);
  mounted.push(overlay);
  overlay.open();

  const panel = container.querySelector<HTMLElement>('.sp-clip-panel')!;
  return {
    overlay,
    container,
    panel,
    button,
    track: panel.querySelector<HTMLElement>('.sp-clip-track')!,
    readout: panel.querySelector<HTMLElement>('.sp-clip-readout')!,
    notice: panel.querySelector<HTMLElement>('.sp-clip-notice')!,
    titleInput: panel.querySelector<HTMLInputElement>('.sp-clip-title'),
    counter: panel.querySelector<HTMLElement>('.sp-clip-title-counter'),
    cancel: panel.querySelector<HTMLButtonElement>('.sp-clip-btn--cancel')!,
    confirm: panel.querySelector<HTMLButtonElement>('.sp-clip-btn--confirm')!,
    callbacks,
  };
}

/** jsdom lays the track out at zero width; 600px == 600s for drag math. */
function giveTrackBox(track: HTMLElement): void {
  track.getBoundingClientRect = () =>
    ({
      left: 0, top: 0, width: 600, height: 44,
      right: 600, bottom: 44, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;
}

function pointer(target: EventTarget, type: string, clientX: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true }));
}

/** Overlays mounted by the current test, torn down in afterEach so their
 *  document-level keydown traps do not leak into the next test. */
const mounted: ClipOverlay[] = [];

function keydown(target: EventTarget, key: string, init: { shiftKey?: boolean } = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    shiftKey: init.shiftKey ?? false,
  });
  target.dispatchEvent(event);
  return event;
}

function typeTitle(h: Harness, value: string): void {
  const input = h.titleInput!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
  for (const overlay of mounted.splice(0)) overlay.destroy();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('mount and structure', () => {
  it('mounts the panel with the pinned vocabulary, open class and dialog semantics', () => {
    const h = setup();
    expect(h.panel.parentElement).toBe(h.container);
    expect(h.panel.classList.contains('sp-clip-panel--open')).toBe(true);
    expect(h.panel.getAttribute('role')).toBe('dialog');
    expect(h.track.querySelector('.sp-clip-track__range')).not.toBeNull();
    expect(h.panel.querySelectorAll('.sp-clip-handle')).toHaveLength(2);
    expect(h.notice.getAttribute('aria-live')).toBe('polite');
    expect(h.panel.querySelector('.sp-clip-actions')).not.toBeNull();
    // Default labels: 'Cancel' and 'Create clip' (buttonLabel overrides it).
    expect(h.cancel.textContent).toBe('Cancel');
    expect(h.confirm.textContent).toBe('Create clip');
  });

  it('honors buttonLabel for the confirm button', () => {
    const h = setup({ config: { ...CONFIG, buttonLabel: 'Cut clip' } });
    expect(h.confirm.textContent).toBe('Cut clip');
    expect(h.panel.getAttribute('aria-label')).toBe('Cut clip');
  });

  it('renders the duration readout as `start – end · Xs`', () => {
    const h = setup();
    // formatTime: 100 -> '1:40', 130 -> '2:10'.
    expect(h.readout.textContent).toBe('1:40 – 2:10 · 30s');
  });

  it('renders the title field as an <input type="text"> with label, maxlength and placeholder', () => {
    const h = setup();
    const input = h.titleInput!;
    // The ui shortcut handler provably skips HTMLInputElement targets
    // (ui/src/index.ts:953-962), so Space/'f' typed here cannot reach the
    // player shortcuts - which is exactly what this element type buys.
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.type).toBe('text');
    expect(input.maxLength).toBe(80);
    expect(input.placeholder).toBe('Name this clip');
    const label = h.panel.querySelector<HTMLLabelElement>('label.sp-clip-title-label')!;
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toBeTruthy();
  });

  it('omits the title field entirely when title: false', () => {
    const h = setup({ config: { ...CONFIG, title: false } });
    expect(h.titleInput).toBeNull();
    expect(h.counter).toBeNull();
    expect(h.panel.querySelector('.sp-clip-title-label')).toBeNull();
    expect(h.confirm.disabled).toBe(false);
  });

  it('has no outside-click close: clicks elsewhere on the container change nothing', () => {
    const h = setup();
    h.container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(h.callbacks.onCancel).not.toHaveBeenCalled();
    expect(h.panel.isConnected).toBe(true);
  });

  it('update() re-renders readout and selector from new state', () => {
    const h = setup();
    h.overlay.update({ start: 250, end: 300 }, BOUNDS);
    expect(h.readout.textContent).toBe('4:10 – 5:00 · 50s');
    const endHandle = h.track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    expect(endHandle.getAttribute('aria-valuenow')).toBe('300');
  });
});

describe('Confirm validity', () => {
  it('disables Confirm for a too-short selection and re-enables on a valid update', () => {
    const h = setup({ selection: { start: 100, end: 103 } });
    expect(h.confirm.disabled).toBe(true);
    h.overlay.update(SELECTION, BOUNDS);
    expect(h.confirm.disabled).toBe(false);
  });

  it('disables Confirm for a too-long selection', () => {
    const h = setup({ selection: { start: 100, end: 200 } });
    expect(h.confirm.disabled).toBe(true);
  });

  it('disables Confirm for a required title left empty, enables on input', () => {
    const h = setup({ config: { ...CONFIG, title: { required: true } } });
    expect(h.confirm.disabled).toBe(true);
    typeTitle(h, 'Game-winning goal');
    expect(h.confirm.disabled).toBe(false);
  });

  it('disables Confirm when the title exceeds maxLength', () => {
    const h = setup({ config: { ...CONFIG, title: { maxLength: 10 } } });
    typeTitle(h, 'x'.repeat(11));
    expect(h.confirm.disabled).toBe(true);
    typeTitle(h, 'x'.repeat(10));
    expect(h.confirm.disabled).toBe(false);
  });

  it('Cancel click routes to onCancel', () => {
    const h = setup();
    h.cancel.click();
    expect(h.callbacks.onCancel).toHaveBeenCalledTimes(1);
  });

  it('Confirm click routes to onConfirm only when valid', () => {
    const h = setup();
    h.confirm.click();
    expect(h.callbacks.onConfirm).toHaveBeenCalledTimes(1);

    const invalid = setup({ selection: { start: 100, end: 103 } });
    invalid.confirm.click();
    expect(invalid.callbacks.onConfirm).not.toHaveBeenCalled();
  });
});

describe('title field', () => {
  it('keeps a live length/max counter and reports keystrokes raw', () => {
    const h = setup();
    expect(h.counter!.textContent).toBe('0/80');
    typeTitle(h, 'Goal');
    expect(h.counter!.textContent).toBe('4/80');
    expect(h.callbacks.onTitleChange).toHaveBeenCalledWith('Goal');
    // Mid-word typing keeps its spaces: the overlay forwards the raw value.
    typeTitle(h, 'Big goal');
    expect(h.titleInput!.value).toBe('Big goal');
  });

  it('setTitle() writes the field from outside and refreshes the counter', () => {
    const h = setup();
    h.overlay.setTitle('Host set this');
    expect(h.titleInput!.value).toBe('Host set this');
    expect(h.counter!.textContent).toBe('13/80');
    expect(h.callbacks.onTitleChange).not.toHaveBeenCalled();
  });

  it('Enter confirms when valid and no-ops when invalid, preventDefault either way', () => {
    const h = setup();
    const valid = keydown(h.titleInput!, 'Enter');
    expect(valid.defaultPrevented).toBe(true);
    expect(h.callbacks.onConfirm).toHaveBeenCalledTimes(1);

    const invalid = setup({ config: { ...CONFIG, title: { required: true } } });
    const event = keydown(invalid.titleInput!, 'Enter');
    expect(event.defaultPrevented).toBe(true);
    expect(invalid.callbacks.onConfirm).not.toHaveBeenCalled();
  });
});

describe('notice slot', () => {
  it('renders a server message containing markup as literal TEXT', () => {
    const h = setup();
    const markup = '<img src=x onerror=alert(1)>';
    h.overlay.showNotice(markup, { type: 'error' });
    // textContent only: exact literal string, zero injected nodes.
    expect(h.notice.textContent).toBe(markup);
    expect(h.notice.querySelector('img')).toBeNull();
    expect(h.notice.classList.contains('sp-clip-notice--visible')).toBe(true);
    expect(h.notice.classList.contains('sp-clip-notice--error')).toBe(true);
  });

  it('error notices persist; auto-hide notices (clamp flashes) clear on schedule', () => {
    vi.useFakeTimers();
    const h = setup();
    h.overlay.showNotice('Server failure', { type: 'error' });
    vi.advanceTimersByTime(5000);
    expect(h.notice.classList.contains('sp-clip-notice--visible')).toBe(true);

    h.overlay.showClampNotice('max-duration');
    expect(h.notice.textContent).toBe('Max 60s');
    expect(h.notice.classList.contains('sp-clip-notice--error')).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(h.notice.classList.contains('sp-clip-notice--visible')).toBe(false);
  });

  it('a clamped selector move flashes the reason for ~1s', () => {
    vi.useFakeTimers();
    const h = setup();
    giveTrackBox(h.track);
    pointer(h.track, 'pointerdown', 130); // nearer the end handle (30 vs 170)
    pointer(h.track, 'pointermove', 500); // end requested 500, clamped to 100 + 60 = 160
    pointer(h.track, 'pointerup', 500);
    expect(h.notice.textContent).toBe('Max 60s');
    expect(h.notice.classList.contains('sp-clip-notice--visible')).toBe(true);
    expect(h.callbacks.onSelectionChange).toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(h.notice.classList.contains('sp-clip-notice--visible')).toBe(false);
  });

  it('hideNotice() clears the slot', () => {
    const h = setup();
    h.overlay.showNotice('something');
    h.overlay.hideNotice();
    expect(h.notice.textContent).toBe('');
    expect(h.notice.classList.contains('sp-clip-notice--visible')).toBe(false);
  });
});

describe('submitting state', () => {
  it('disables both buttons and puts a spinner on Confirm while in flight', () => {
    const h = setup();
    h.overlay.setSubmitting(true);
    expect(h.cancel.disabled).toBe(true);
    expect(h.confirm.disabled).toBe(true);
    expect(h.confirm.classList.contains('sp-clip-btn--submitting')).toBe(true);
    expect(h.confirm.querySelector('.sp-clip-spinner')).not.toBeNull();
    expect(h.confirm.textContent).toBe(''); // label swapped for the spinner
  });

  it('restores the label and re-enables buttons when the attempt fails', () => {
    const h = setup();
    h.overlay.setSubmitting(true);
    h.overlay.setSubmitting(false);
    expect(h.confirm.querySelector('.sp-clip-spinner')).toBeNull();
    expect(h.confirm.textContent).toBe('Create clip');
    expect(h.confirm.disabled).toBe(false);
    expect(h.cancel.disabled).toBe(false);
  });

  it('ignores Cancel/Confirm interaction while submitting', () => {
    const h = setup();
    h.overlay.setSubmitting(true);
    h.cancel.click();
    h.confirm.click();
    expect(h.callbacks.onCancel).not.toHaveBeenCalled();
    expect(h.callbacks.onConfirm).not.toHaveBeenCalled();
  });
});

describe('keyboard: trap and Escape', () => {
  it('Escape preventDefaults and cancels', () => {
    const h = setup();
    const event = keydown(h.panel, 'Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(h.callbacks.onCancel).toHaveBeenCalledTimes(1);
  });

  it('Tab and Shift+Tab cycle the panel focusables and never escape', () => {
    const h = setup();
    const handles = h.panel.querySelectorAll<HTMLElement>('.sp-clip-handle');
    const order = [handles[0], handles[1], h.titleInput!, h.cancel, h.confirm];

    order[order.length - 1].focus();
    const forward = keydown(document, 'Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(order[0]);

    order[0].focus();
    const backward = keydown(document, 'Tab', { shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(order[order.length - 1]);

    // A middle step still lands on the neighbour.
    h.titleInput!.focus();
    keydown(document, 'Tab');
    expect(document.activeElement).toBe(h.cancel);
  });

  it('focus returns to the control-bar button on close when focus was inside the panel', () => {
    const h = setup();
    h.confirm.focus();
    h.overlay.destroy();
    expect(document.activeElement).toBe(h.button);
    expect(h.panel.isConnected).toBe(false);
  });

  it('does not steal focus back when the close came from outside the panel', () => {
    const h = setup();
    h.button.focus();
    h.overlay.destroy();
    expect(document.activeElement).toBe(h.button);
  });

  it('skips a return-focus target the UI has detached', () => {
    const h = setup();
    h.confirm.focus();
    h.button.remove(); // control-bar rebuild detached the old button
    expect(() => h.overlay.destroy()).not.toThrow();
    expect(document.activeElement).not.toBe(h.button);
  });
});

describe('drag pass-throughs', () => {
  it('forwards the selector drag lifecycle to the plugin (task 3.5 wiring)', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 300, step: 1 } });
    giveTrackBox(h.track);
    const onDragStart = vi.mocked(h.callbacks.onDragStart!);
    const onDragMove = vi.mocked(h.callbacks.onDragMove!);
    const onDragEnd = vi.mocked(h.callbacks.onDragEnd!);

    pointer(h.track, 'pointerdown', 130);
    expect(onDragStart).toHaveBeenCalledWith('end');
    pointer(h.track, 'pointermove', 200);
    expect(onDragMove).toHaveBeenCalledWith('end', 200);
    pointer(h.track, 'pointerup', 200);
    expect(onDragEnd).toHaveBeenCalledWith({ start: 100, end: 200 });
  });
});

describe('destroy', () => {
  it('unmounts, detaches the trap and is idempotent', () => {
    const h = setup();
    h.overlay.destroy();
    h.overlay.destroy();
    expect(h.panel.isConnected).toBe(false);
    const event = keydown(document, 'Escape');
    expect(event.defaultPrevented).toBe(false);
    expect(h.callbacks.onCancel).not.toHaveBeenCalled();
    expect(() => h.overlay.update(SELECTION, BOUNDS)).not.toThrow();
  });

  it('open() after destroy does not re-mount', () => {
    const h = setup();
    h.overlay.destroy();
    h.overlay.open();
    expect(h.container.querySelector('.sp-clip-panel')).toBeNull();
  });
});
