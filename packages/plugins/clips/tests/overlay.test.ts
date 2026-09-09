/**
 * ClipOverlay tests: the editor's structure, the two stages and the breakpoints
 * that pick between them, Confirm's disabled states, the title and exact-time
 * fields, literal-text notices, the submitting and suspended freezes, focus and
 * Escape scoping, and the timeline attachment.
 *
 * The selector's own behaviour is in selector.test.ts; the plugin wiring is in
 * plugin.test.ts / scrub.test.ts.
 *
 * jsdom lays everything out at zero, which the layout code reads as "unknown"
 * and treats as `regular` - both stages on screen at once. Compact layouts are
 * exercised by giving the container a real box, which is what a real player has.
 *
 * `requestAnimationFrame` is stubbed to fire synchronously so the open deferral
 * (focus first, `--open` class) is assertible without timing races.
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
  root: HTMLElement;
  button: HTMLButtonElement;
  track: HTMLElement;
  details: HTMLElement;
  readout: HTMLElement;
  notice: HTMLElement;
  flash: HTMLElement;
  titleInput: HTMLInputElement | null;
  counter: HTMLElement | null;
  cancel: HTMLButtonElement;
  confirm: HTMLButtonElement;
  next: HTMLButtonElement;
  back: HTMLButtonElement;
  toolbarCancelBtn: HTMLButtonElement;
  setIn: HTMLButtonElement;
  setOut: HTMLButtonElement;
  preview: HTMLButtonElement;
  play: HTMLButtonElement;
  tune: HTMLButtonElement;
  timeIn: HTMLInputElement;
  timeOut: HTMLInputElement;
  callbacks: ClipOverlayCallbacks;
}

/** Overlays mounted by the current test, torn down in afterEach so their
 *  document-level keydown handlers do not leak into the next test. */
const mounted: ClipOverlay[] = [];

/** Give an element a real box; jsdom otherwise reports zeros everywhere. */
function giveBox(el: HTMLElement, width: number, height: number): void {
  el.getBoundingClientRect = () =>
    ({
      left: 0, top: 0, width, height,
      right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;
}

function setup(
  overrides: Partial<ClipOverlayOptions> = {},
  size?: { width: number; height: number }
): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  if (size) giveBox(container, size.width, size.height);
  // Stand-in for the control-bar button: the overlay must hand focus back
  // here on close (it stays visible while the editor is open - ClipButton).
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
    onSetAtPlayhead: vi.fn(),
    onPreview: vi.fn(),
    onTogglePlay: vi.fn(),
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

  const root = container.querySelector<HTMLElement>('.sp-clip-editor')!;
  const pick = <T extends HTMLElement>(selector: string): T =>
    root.querySelector<T>(selector)!;

  return {
    overlay,
    container,
    root,
    button,
    track: pick('.sp-clip-track'),
    details: pick('.sp-clip-details'),
    readout: pick('.sp-clip-readout'),
    notice: pick('.sp-clip-notice'),
    flash: pick('.sp-clip-flash'),
    titleInput: root.querySelector<HTMLInputElement>('.sp-clip-title'),
    counter: root.querySelector<HTMLElement>('.sp-clip-title-counter'),
    cancel: pick<HTMLButtonElement>('.sp-clip-btn--cancel'),
    confirm: pick<HTMLButtonElement>('.sp-clip-btn--confirm'),
    next: pick<HTMLButtonElement>('.sp-clip-tool--next'),
    back: pick<HTMLButtonElement>('.sp-clip-back'),
    toolbarCancelBtn: pick<HTMLButtonElement>('.sp-clip-tool--cancel'),
    setIn: pick<HTMLButtonElement>('.sp-clip-tool--set-in'),
    setOut: pick<HTMLButtonElement>('.sp-clip-tool--set-out'),
    preview: pick<HTMLButtonElement>('.sp-clip-tool--preview'),
    play: pick<HTMLButtonElement>('.sp-clip-tool--play'),
    tune: pick<HTMLButtonElement>('.sp-clip-tool--tune'),
    timeIn: pick<HTMLInputElement>('[data-clip-endpoint="start"]'),
    timeOut: pick<HTMLInputElement>('[data-clip-endpoint="end"]'),
    callbacks,
  };
}

/** jsdom lays the track out at zero width; 600px == 600s for drag math. */
function giveTrackBox(track: HTMLElement): void {
  giveBox(track, 600, 44);
}

function pointer(target: EventTarget, type: string, clientX: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true }));
}

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

/** Type into an exact-time field and commit it with Enter. */
function typeTime(input: HTMLInputElement, value: string): void {
  input.value = value;
  keydown(input, 'Enter');
}

afterEach(() => {
  for (const overlay of mounted.splice(0)) overlay.destroy();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('mount and structure', () => {
  it('mounts the editor with the pinned vocabulary and nonmodal region semantics', () => {
    const h = setup();
    expect(h.root.parentElement).toBe(h.container);
    expect(h.root.classList.contains('sp-clip-editor--open')).toBe(true);
    // A region, not a dialog: the range stage lives in the player's own
    // control area and the host page behind it stays usable.
    expect(h.root.getAttribute('role')).toBe('region');
    expect(h.track.querySelector('.sp-clip-track__range')).not.toBeNull();
    expect(h.root.querySelectorAll('.sp-clip-handle')).toHaveLength(2);
    expect(h.notice.getAttribute('aria-live')).toBe('polite');
    expect(h.cancel.textContent).toBe('Cancel');
    expect(h.confirm.textContent).toBe('Create clip');
  });

  it('marks the details stage as a labelled, deliberately nonmodal dialog', () => {
    const h = setup();
    expect(h.details.getAttribute('role')).toBe('dialog');
    expect(h.details.getAttribute('aria-modal')).toBe('false');
    const heading = h.root.querySelector('.sp-clip-details__title')!;
    expect(h.details.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.id).not.toBe('');
  });

  it('gives every toolbar button a full accessible name whatever the visible text', () => {
    const h = setup();
    expect(h.setIn.getAttribute('aria-label')).toBe('Set in point here');
    expect(h.setOut.getAttribute('aria-label')).toBe('Set out point here');
    expect(h.preview.getAttribute('aria-label')).toBe('Preview clip');
    expect(h.next.getAttribute('aria-label')).toBe('Next: name and create');
    expect(h.back.getAttribute('aria-label')).toBe('Back to range');
  });

  it('honors buttonLabel for the confirm button and the region name', () => {
    const h = setup({ config: { ...CONFIG, buttonLabel: 'Cut clip' } });
    expect(h.confirm.textContent).toBe('Cut clip');
    expect(h.root.getAttribute('aria-label')).toBe('Cut clip');
  });

  it('renders the duration readout as `start – end · Xs`', () => {
    const h = setup();
    expect(h.readout.textContent).toBe('1:40 – 2:10 · 30s');
  });

  it('renders the title field as an <input type="text"> with label, maxlength and placeholder', () => {
    const h = setup();
    const input = h.titleInput!;
    // The ui shortcut handler provably skips HTMLInputElement targets, so
    // Space or 'f' typed here cannot reach the player shortcuts.
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.type).toBe('text');
    expect(input.maxLength).toBe(80);
    expect(input.placeholder).toBe('Name this clip');
    const label = h.root.querySelector<HTMLLabelElement>('label.sp-clip-title-label')!;
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toBeTruthy();
  });

  it('omits the title field entirely when title: false, keeping the review stage', () => {
    const h = setup({ config: { ...CONFIG, title: false } });
    expect(h.titleInput).toBeNull();
    expect(h.counter).toBeNull();
    expect(h.root.querySelector('.sp-clip-title-label')).toBeNull();
    // The stage itself remains - it is where the times are confirmed.
    expect(h.details.isConnected).toBe(true);
    expect(h.confirm.disabled).toBe(false);
  });

  it('has no outside-click close: clicks elsewhere on the container change nothing', () => {
    const h = setup();
    h.container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(h.callbacks.onCancel).not.toHaveBeenCalled();
    expect(h.root.isConnected).toBe(true);
  });

  it('update() re-renders readout, fields and selector from new state', () => {
    const h = setup();
    h.overlay.update({ start: 250, end: 300 }, BOUNDS);
    expect(h.readout.textContent).toBe('4:10 – 5:00 · 50s');
    expect(h.timeIn.value).toBe('4:10');
    expect(h.timeOut.value).toBe('5:00');
    const endHandle = h.track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    expect(endHandle.getAttribute('aria-valuenow')).toBe('300');
  });

  it('marks the container as editing while mounted and clears it on close', () => {
    const h = setup();
    expect(h.container.classList.contains('sp-clip-editing')).toBe(true);
    h.overlay.destroy();
    expect(h.container.classList.contains('sp-clip-editing')).toBe(false);
  });
});

describe('timeline attachment', () => {
  it('moves the same selector onto the timeline layer and hides the panel rail', () => {
    const h = setup();
    const layer = document.createElement('div');
    h.container.appendChild(layer);
    const rail = document.createElement('div');
    giveBox(rail, 300, 3);

    h.overlay.attachTimeline(layer, () => rail.getBoundingClientRect());

    expect(h.overlay.isOnTimeline()).toBe(true);
    expect(h.track.parentElement).toBe(layer);
    expect(h.track.classList.contains('sp-clip-track--timeline')).toBe(true);
    expect(h.root.querySelector<HTMLElement>('.sp-clip-rail')!.hidden).toBe(true);
    // One selector, two presentations - never a second instance.
    expect(document.querySelectorAll('.sp-clip-track')).toHaveLength(1);
  });

  it('brings the selector back to the panel rail without losing the selection', () => {
    const h = setup();
    const layer = document.createElement('div');
    h.container.appendChild(layer);
    h.overlay.attachTimeline(layer, () => layer.getBoundingClientRect());
    h.overlay.update({ start: 200, end: 240 }, BOUNDS);

    h.overlay.attachTimeline(null);

    expect(h.overlay.isOnTimeline()).toBe(false);
    expect(h.track.closest('.sp-clip-rail')).not.toBeNull();
    expect(h.root.querySelector<HTMLElement>('.sp-clip-rail')!.hidden).toBe(false);
    const endHandle = h.track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    expect(endHandle.getAttribute('aria-valuenow')).toBe('240');
  });

  it('anchors the panel above the measured handle lane rather than a fixed offset', () => {
    const h = setup({}, { width: 900, height: 500 });
    const layer = document.createElement('div');
    h.container.appendChild(layer);
    const rail = document.createElement('div');
    // Rail top 60px above the container's bottom edge (500 - 440).
    rail.getBoundingClientRect = () =>
      ({ left: 0, top: 440, width: 800, height: 3, right: 800, bottom: 443, x: 0, y: 440, toJSON: () => ({}) }) as DOMRect;

    h.overlay.attachTimeline(layer, () => rail.getBoundingClientRect());
    h.overlay.syncTimelineGeometry();

    // 60 to the rail, plus the 44px IN lane and its 8px gap.
    expect(h.root.style.bottom).toBe('112px');
  });
});

describe('layout and stages', () => {
  it('treats an unmeasurable player as regular: both stages on screen', () => {
    const h = setup();
    expect(h.overlay.getLayout()).toBe('regular');
    expect(h.overlay.getStage()).toBe('range');
    expect(h.root.dataset.layout).toBe('regular');
    // With both on screen the stage buttons mean nothing.
    expect(h.next.hidden).toBe(true);
    expect(h.back.hidden).toBe(true);
    expect(h.tune.hidden).toBe(true);
  });

  it('goes compact on a narrow player even when it is tall', () => {
    const h = setup({}, { width: 420, height: 700 });
    expect(h.overlay.getLayout()).toBe('compact');
    expect(h.next.hidden).toBe(false);
    expect(h.back.hidden).toBe(false);
  });

  it('goes compact on a short player even when it is wide', () => {
    const h = setup({}, { width: 1200, height: 300 });
    expect(h.overlay.getLayout()).toBe('compact');
  });

  it('gives up the control bar below 220px and offers Play/Pause instead', () => {
    const h = setup({}, { width: 320, height: 180 });
    expect(h.overlay.getLayout()).toBe('minimal');
    expect(h.container.classList.contains('sp-clip-editing--minimal')).toBe(true);
    expect(h.play.hidden).toBe(false);

    h.play.click();
    expect(h.callbacks.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('becomes a bounded sheet below 160px, where there is no picture left to keep', () => {
    const h = setup({}, { width: 320, height: 140 });
    expect(h.overlay.getLayout()).toBe('tiny');
    expect(h.root.dataset.layout).toBe('tiny');
  });

  it('Next moves to the details stage and Back returns with everything intact', () => {
    const h = setup({}, { width: 375, height: 211 });
    typeTitle(h, 'Great save');

    h.next.click();
    expect(h.overlay.getStage()).toBe('details');
    expect(h.root.dataset.stage).toBe('details');

    h.back.click();
    expect(h.overlay.getStage()).toBe('range');
    expect(h.titleInput!.value).toBe('Great save');
    expect(h.readout.textContent).toBe('1:40 – 2:10 · 30s');
  });

  it('never submits from Next', () => {
    const h = setup({}, { width: 375, height: 211 });
    h.next.click();
    expect(h.callbacks.onConfirm).not.toHaveBeenCalled();
  });

  it('Fine tune opens the details stage focused on the chosen endpoint', () => {
    const h = setup({}, { width: 500, height: 400 });
    expect(h.overlay.getLayout()).toBe('compact');
    expect(h.tune.hidden).toBe(false);

    h.tune.click();

    expect(h.overlay.getStage()).toBe('details');
    expect(document.activeElement).toBe(h.timeIn);
  });

  it('drops Fine tune on a player that has already given up its control bar', () => {
    // Next goes to the same stage, and at 320px keeping a second route there
    // is what pushed the primary action off the right-hand edge.
    const h = setup({}, { width: 320, height: 180 });
    expect(h.tune.hidden).toBe(true);
    expect(h.next.hidden).toBe(false);
    expect(h.toolbarCancelBtn.hidden).toBe(false);
  });

  it('shortens the visible labels on a narrow player but never the accessible names', () => {
    const compact = setup({}, { width: 375, height: 211 });
    expect(compact.setIn.textContent).toBe('IN');
    expect(compact.setOut.textContent).toBe('OUT');
    expect(compact.setIn.getAttribute('aria-label')).toBe('Set in point here');
    expect(compact.setOut.getAttribute('aria-label')).toBe('Set out point here');

    const regular = setup();
    expect(regular.setIn.textContent).toBe('IN here');
    expect(regular.setOut.textContent).toBe('OUT here');
  });

  it('freezes the timeline while the details stage covers the player', () => {
    const h = setup({}, { width: 375, height: 211 });
    h.next.click();
    expect(h.track.classList.contains('sp-clip-track--frozen')).toBe(true);
    h.back.click();
    expect(h.track.classList.contains('sp-clip-track--frozen')).toBe(false);
  });

  it('leaves the handles live on a regular player, where nothing covers them', () => {
    const h = setup();
    expect(h.track.classList.contains('sp-clip-track--frozen')).toBe(false);
  });

  it('bounds the details panel to the room the player actually has', () => {
    const h = setup({}, { width: 900, height: 400 });
    expect(h.details.style.maxHeight).toBe(`${400 - 64 - 8}px`);
  });

  it('abandons a held drag on rotation, keeping the selection and title', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 300, step: 1 } }, { width: 375, height: 211 });
    typeTitle(h, 'Rotated mid-drag');
    giveTrackBox(h.track);
    const endHandle = h.track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    pointer(endHandle, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 200);

    giveBox(h.container, 640, 360);
    window.dispatchEvent(new Event('orientationchange'));

    expect(vi.mocked(h.callbacks.onDragEnd!)).toHaveBeenCalledWith(
      { start: 100, end: 200 },
      { cancelled: true }
    );
    expect(h.titleInput!.value).toBe('Rotated mid-drag');
    expect(h.readout.textContent).toBe('1:40 – 3:20 · 100s');
  });

  it('drops back to the range stage when the player grows out of compact', () => {
    const h = setup({}, { width: 375, height: 211 });
    h.next.click();
    expect(h.overlay.getStage()).toBe('details');

    giveBox(h.container, 1280, 720);
    window.dispatchEvent(new Event('resize'));

    expect(h.overlay.getLayout()).toBe('regular');
    expect(h.overlay.getStage()).toBe('range');
  });
});

describe('at-playhead and preview', () => {
  it('routes IN here / OUT here to the plugin, which owns the media clock', () => {
    const h = setup();
    h.setIn.click();
    expect(h.callbacks.onSetAtPlayhead).toHaveBeenCalledWith('start');
    h.setOut.click();
    expect(h.callbacks.onSetAtPlayhead).toHaveBeenCalledWith('end');
  });

  it('setEndpoint places an endpoint through the model and reports the move', () => {
    const h = setup();
    const landed = h.overlay.setEndpoint('end', 155);
    expect(landed).toBe(155);
    expect(h.readout.textContent).toBe('1:40 – 2:35 · 55s');
    expect(h.callbacks.onSelectionChange).toHaveBeenCalled();
  });

  it('clamps an at-playhead placement the limits refuse and flashes why', () => {
    const h = setup();
    const landed = h.overlay.setEndpoint('end', 500); // max duration is 60s
    expect(landed).toBe(160);
    expect(h.flash.textContent).toBe('Max 60s');
    expect(h.flash.classList.contains('sp-clip-flash--visible')).toBe(true);
    // Clamp, never push: the in point did not move to make room.
    expect(h.timeIn.value).toBe('1:40');
  });

  it('routes Preview to the plugin', () => {
    const h = setup();
    h.preview.click();
    expect(h.callbacks.onPreview).toHaveBeenCalledTimes(1);
  });
});

describe('exact time fields', () => {
  it('shows both endpoints as editable timestamps with a format hint', () => {
    const h = setup();
    expect(h.timeIn.value).toBe('1:40');
    expect(h.timeOut.value).toBe('2:10');
    const hint = h.root.querySelector(`#${h.timeIn.getAttribute('aria-describedby')}`);
    expect(hint!.textContent).toBe('Seconds or m:ss');
  });

  it('commits mm:ss on Enter through the model path', () => {
    const h = setup();
    typeTime(h.timeOut, '2:30');
    expect(h.readout.textContent).toBe('1:40 – 2:30 · 50s');
    expect(h.callbacks.onSelectionChange).toHaveBeenCalled();
  });

  it('accepts plain seconds and hh:mm:ss', () => {
    const h = setup({ selection: { start: 0, end: 30 }, bounds: { min: 0, max: 7200 } });
    typeTime(h.timeOut, '45');
    expect(h.timeOut.value).toBe('0:45');

    h.overlay.update({ start: 3600, end: 3630 }, { min: 0, max: 7200 });
    typeTime(h.timeOut, '1:00:50');
    expect(h.timeOut.value).toBe('1:00:50');
  });

  it('rejects malformed, negative and out-of-clock input without moving anything', () => {
    const h = setup();
    for (const bad of ['abc', '-4', '1:70', 'Infinity', '', '1:2:3:4']) {
      typeTime(h.timeOut, bad);
      expect(h.timeOut.value).toBe('2:10');
      expect(h.readout.textContent).toBe('1:40 – 2:10 · 30s');
    }
    expect(h.notice.textContent).toBe('Enter a time as seconds or m:ss');
  });

  it('commits on blur as well as Enter', () => {
    const h = setup();
    h.timeOut.value = '2:20';
    h.timeOut.dispatchEvent(new FocusEvent('blur'));
    expect(h.readout.textContent).toBe('1:40 – 2:20 · 40s');
  });

  it('Escape reverts the field to the committed selection', () => {
    const h = setup();
    h.timeOut.value = '9:99';
    keydown(h.timeOut, 'Escape');
    expect(h.timeOut.value).toBe('2:10');
    expect(h.readout.textContent).toBe('1:40 – 2:10 · 30s');
  });

  it('reverts the FOCUSED field on Escape', () => {
    // The regression: renderTimeFields() skipped any focused input, and Enter
    // and Escape are both handled with the input still focused - so the one
    // field the viewer had just acted on was the one field never re-rendered.
    // Typing requires focus, so this is the only state that happens for real.
    const h = setup();
    h.timeOut.focus();
    h.timeOut.value = '9:99';

    keydown(h.timeOut, 'Escape');

    expect(h.timeOut.value).toBe('2:10');
    expect(h.readout.textContent).toBe('1:40 – 2:10 · 30s');
  });

  it('clears a refused value out of the FOCUSED field it was typed into', () => {
    const h = setup();
    h.timeOut.focus();

    typeTime(h.timeOut, 'abc');

    expect(h.notice.textContent).toBe('Enter a time as seconds or m:ss');
    expect(h.timeOut.value).toBe('2:10');
  });

  it('shows the landed time in the FOCUSED field after a clamped commit', () => {
    // 9:00 is past the 60s maxDuration from IN, so the selector clamps it. The
    // field has to show where the endpoint actually went, not what was typed.
    const h = setup();
    h.timeOut.focus();

    typeTime(h.timeOut, '9:00');

    expect(h.timeOut.value).toBe('2:40');
    expect(h.readout.textContent).toBe('1:40 – 2:40 · 60s');
  });

  it('still leaves the OTHER field alone while it is being typed into', () => {
    const h = setup();
    h.timeIn.focus();
    h.timeIn.value = '1:4';

    // Committing OUT re-renders, and must not reach into IN mid-edit.
    h.timeOut.value = '2:20';
    h.timeOut.dispatchEvent(new FocusEvent('blur'));

    expect(h.timeIn.value).toBe('1:4');
  });

  it('does not overwrite a field while it is being typed into', () => {
    const h = setup();
    h.timeOut.focus();
    h.timeOut.value = '2:2';
    h.overlay.update({ start: 100, end: 130 }, BOUNDS);
    expect(h.timeOut.value).toBe('2:2');
  });

  it('shows fractional times when the step can produce them', () => {
    const h = setup({ config: { ...CONFIG, step: 0.5 } });
    h.overlay.update({ start: 100.5, end: 130 }, BOUNDS, { ...CONFIG, step: 0.5 });
    expect(h.timeIn.value).toBe('1:40.5');
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

describe('blocked submission', () => {
  it('refuses Create with the precise reason and keeps the selection', () => {
    const h = setup();
    h.overlay.setBlocked('Audio cannot be clipped; clips need video.');

    expect(h.confirm.disabled).toBe(true);
    expect(h.notice.textContent).toBe('Audio cannot be clipped; clips need video.');
    expect(h.notice.classList.contains('sp-clip-notice--error')).toBe(true);
    expect(h.readout.textContent).toBe('1:40 – 2:10 · 30s');
  });

  it('unblocks when the media becomes clippable again', () => {
    const h = setup();
    h.overlay.setBlocked('Live streams cannot be clipped.');
    h.overlay.setBlocked(null);
    expect(h.confirm.disabled).toBe(false);
    expect(h.notice.classList.contains('sp-clip-notice--visible')).toBe(false);
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

describe('notices and the clamp flash', () => {
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

  it('error notices persist until something replaces them', () => {
    vi.useFakeTimers();
    const h = setup();
    h.overlay.showNotice('Server failure', { type: 'error' });
    vi.advanceTimersByTime(5000);
    expect(h.notice.classList.contains('sp-clip-notice--visible')).toBe(true);
  });

  it('flashes a clamp silently, away from the live region', () => {
    vi.useFakeTimers();
    const h = setup();
    h.overlay.showClampNotice('max-duration');

    expect(h.flash.textContent).toBe('Max 60s');
    expect(h.flash.classList.contains('sp-clip-flash--visible')).toBe(true);
    // A drag pinned against a limit re-flashes on every move: announcing that
    // on every pixel is noise, so the live region is left alone.
    expect(h.flash.getAttribute('aria-hidden')).toBe('true');
    expect(h.notice.textContent).toBe('');

    vi.advanceTimersByTime(1000);
    expect(h.flash.classList.contains('sp-clip-flash--visible')).toBe(false);
  });

  it('a clamped selector drag flashes the reason for ~1s', () => {
    vi.useFakeTimers();
    const h = setup();
    giveTrackBox(h.track);
    const endHandle = h.track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    pointer(endHandle, 'pointerdown', 130);
    pointer(h.track, 'pointermove', 500); // clamped to 100 + 60 = 160
    pointer(h.track, 'pointerup', 500);

    expect(h.flash.textContent).toBe('Max 60s');
    expect(h.callbacks.onSelectionChange).toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(h.flash.classList.contains('sp-clip-flash--visible')).toBe(false);
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
  it('freezes every endpoint control while a request is in flight', () => {
    const h = setup();
    h.overlay.setSubmitting(true);

    expect(h.cancel.disabled).toBe(true);
    expect(h.confirm.disabled).toBe(true);
    expect(h.setIn.disabled).toBe(true);
    expect(h.setOut.disabled).toBe(true);
    expect(h.preview.disabled).toBe(true);
    expect(h.next.disabled).toBe(true);
    expect(h.timeIn.disabled).toBe(true);
    expect(h.timeOut.disabled).toBe(true);
    expect(h.titleInput!.disabled).toBe(true);
    // The range being submitted must not move under the request carrying it.
    expect(h.track.classList.contains('sp-clip-track--frozen')).toBe(true);
    expect(h.confirm.classList.contains('sp-clip-btn--submitting')).toBe(true);
    expect(h.confirm.querySelector('.sp-clip-spinner')).not.toBeNull();
    expect(h.confirm.textContent).toBe('');
  });

  it('restores the label and re-enables everything when the attempt fails', () => {
    const h = setup();
    h.overlay.setSubmitting(true);
    h.overlay.setSubmitting(false);
    expect(h.confirm.querySelector('.sp-clip-spinner')).toBeNull();
    expect(h.confirm.textContent).toBe('Create clip');
    expect(h.confirm.disabled).toBe(false);
    expect(h.cancel.disabled).toBe(false);
    expect(h.track.classList.contains('sp-clip-track--frozen')).toBe(false);
  });

  it('ignores Cancel/Confirm interaction while submitting', () => {
    const h = setup();
    h.overlay.setSubmitting(true);
    h.cancel.click();
    h.confirm.click();
    h.setIn.click();
    expect(h.callbacks.onCancel).not.toHaveBeenCalled();
    expect(h.callbacks.onConfirm).not.toHaveBeenCalled();
    expect(h.callbacks.onSetAtPlayhead).not.toHaveBeenCalled();
  });
});

describe('suspended by native full screen', () => {
  it('freezes the draft without discarding it, and thaws it unchanged', () => {
    const h = setup();
    typeTitle(h, 'Kept');

    h.overlay.setSuspended(true);
    expect(h.confirm.disabled).toBe(true);
    expect(h.timeIn.disabled).toBe(true);
    expect(h.track.classList.contains('sp-clip-track--frozen')).toBe(true);

    h.overlay.setSuspended(false);
    expect(h.confirm.disabled).toBe(false);
    expect(h.titleInput!.value).toBe('Kept');
    expect(h.readout.textContent).toBe('1:40 – 2:10 · 30s');
  });
});

describe('focus and keys', () => {
  it('Escape preventDefaults and cancels when focus is inside this player', () => {
    const h = setup();
    h.confirm.focus();
    const event = keydown(h.root, 'Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(h.callbacks.onCancel).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape from another player entirely', () => {
    const h = setup();
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();

    const event = keydown(other, 'Escape');

    expect(event.defaultPrevented).toBe(false);
    expect(h.callbacks.onCancel).not.toHaveBeenCalled();
  });

  it('two players never answer each other Escape', () => {
    const a = setup();
    const b = setup();
    b.confirm.focus();

    keydown(b.root, 'Escape');

    expect(b.callbacks.onCancel).toHaveBeenCalledTimes(1);
    expect(a.callbacks.onCancel).not.toHaveBeenCalled();
  });

  it('Escape on the compact details stage goes back rather than discarding the draft', () => {
    const h = setup({}, { width: 375, height: 211 });
    h.next.click();
    typeTitle(h, 'Half typed');

    keydown(h.details, 'Escape');

    expect(h.overlay.getStage()).toBe('range');
    expect(h.callbacks.onCancel).not.toHaveBeenCalled();
    expect(h.titleInput!.value).toBe('Half typed');
  });

  it('does not trap Tab on the range stage: it is nonmodal', () => {
    const h = setup({}, { width: 375, height: 211 });
    h.setIn.focus();
    const event = keydown(document, 'Tab');
    expect(event.defaultPrevented).toBe(false);
  });

  it('cycles Tab inside the compact details dialog', () => {
    const h = setup({}, { width: 375, height: 211 });
    h.next.click();
    const order = [h.back, h.timeIn, h.timeOut, h.titleInput!, h.cancel, h.confirm];

    order[order.length - 1].focus();
    const forward = keydown(document, 'Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(order[0]);

    order[0].focus();
    const backward = keydown(document, 'Tab', { shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(order[order.length - 1]);
  });

  it('focus returns to the control-bar button on close when focus was inside the player', () => {
    const h = setup();
    h.confirm.focus();
    h.overlay.destroy();
    expect(document.activeElement).toBe(h.button);
    expect(h.root.isConnected).toBe(false);
  });

  it('falls back to the player when the opener was detached by a control-bar rebuild', () => {
    const h = setup();
    h.container.tabIndex = -1;
    h.confirm.focus();
    h.button.remove();

    h.overlay.destroy();

    // Anything but <body>, which would send a keyboard user to the top of the
    // host page.
    expect(document.activeElement).toBe(h.container);
  });

  it('does not steal focus when the close came from outside the player', () => {
    const h = setup();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    h.overlay.destroy();

    expect(document.activeElement).toBe(outside);
  });
});

describe('drag pass-throughs', () => {
  it('forwards the selector drag lifecycle to the plugin', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 300, step: 1 } });
    giveTrackBox(h.track);
    const endHandle = h.track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;
    const onDragStart = vi.mocked(h.callbacks.onDragStart!);
    const onDragMove = vi.mocked(h.callbacks.onDragMove!);
    const onDragEnd = vi.mocked(h.callbacks.onDragEnd!);

    pointer(endHandle, 'pointerdown', 130);
    expect(onDragStart).toHaveBeenCalledWith('end');
    pointer(h.track, 'pointermove', 200);
    expect(onDragMove).toHaveBeenCalledWith('end', 200);
    pointer(h.track, 'pointerup', 200);
    expect(onDragEnd).toHaveBeenCalledWith({ start: 100, end: 200 }, { cancelled: false });
  });

  it('reports a cancelled drag as cancelled', () => {
    const h = setup({ config: { minDuration: 5, maxDuration: 300, step: 1 } });
    giveTrackBox(h.track);
    const endHandle = h.track.querySelector<HTMLElement>('[data-clip-handle="end"]')!;

    pointer(endHandle, 'pointerdown', 130);
    pointer(h.track, 'pointercancel', 200);

    expect(vi.mocked(h.callbacks.onDragEnd!)).toHaveBeenCalledWith(
      { start: 100, end: 130 },
      { cancelled: true }
    );
  });
});

describe('destroy', () => {
  it('unmounts, detaches the key handler and is idempotent', () => {
    const h = setup();
    h.overlay.destroy();
    h.overlay.destroy();
    expect(h.root.isConnected).toBe(false);
    const event = keydown(document, 'Escape');
    expect(event.defaultPrevented).toBe(false);
    expect(h.callbacks.onCancel).not.toHaveBeenCalled();
    expect(() => h.overlay.update(SELECTION, BOUNDS)).not.toThrow();
  });

  it('open() after destroy does not re-mount', () => {
    const h = setup();
    h.overlay.destroy();
    h.overlay.open();
    expect(h.container.querySelector('.sp-clip-editor')).toBeNull();
  });

  it('stops answering window resizes after destroy', () => {
    const h = setup({}, { width: 1280, height: 720 });
    h.overlay.destroy();
    giveBox(h.container, 320, 180);
    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
    expect(h.overlay.getLayout()).toBe('regular');
  });
});
