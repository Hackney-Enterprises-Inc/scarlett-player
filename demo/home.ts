/**
 * Homepage entry (docs/index.html), built to docs/site/home.js.
 *
 * Deliberately small. The showcase's poster, heading and links are static
 * HTML, so the page reads fully without JavaScript; this module only
 *
 * 1. upgrades the poster's play affordance so the first click lazy-loads the
 *    player chunk and starts the sample,
 * 2. runs the Embed / TypeScript / Vue tabs on the Get started card, and
 * 3. copies the visible snippet, with a selection fallback when the
 *    Clipboard API is denied.
 *
 * Nothing here imports the player. The engine arrives through
 * `import('./home-player')` on the first Play click, so the homepage's
 * initial load fetches no HLS manifest, no segment and no player code (plan
 * Part B section 10 item 2; Part D performance criteria).
 */

import type { HomePlayerSession } from './home-player';

type ShowcaseState = 'idle' | 'loading' | 'ready' | 'playing' | 'failed';

/** Wire the showcase: poster, play affordance and the deferred player. */
function setupShowcase(): void {
  const showcase = document.getElementById('showcase');
  const poster = document.getElementById('showcase-poster');
  const posterImage = showcase?.querySelector<HTMLImageElement>('.poster-image') ?? null;
  const play = document.getElementById('showcase-play');
  const status = document.getElementById('showcase-status');
  const mount = document.getElementById('home-player');
  const src = showcase?.dataset.src;
  if (!showcase || !poster || !play || !mount || !src) return;

  const posterUrl = showcase.dataset.poster;
  let state: ShowcaseState = 'idle';
  let session: HomePlayerSession | null = null;

  const setStatus = (text: string): void => {
    if (status) status.textContent = text;
  };

  const setBusy = (busy: boolean): void => {
    play.setAttribute('aria-busy', String(busy));
    poster.classList.toggle('is-loading', busy);
  };

  /** Playback is running: the poster has done its job. */
  const revealPlayer = (): void => {
    state = 'playing';
    poster.hidden = true;
    if (posterImage) posterImage.hidden = true;
    showcase.classList.add('is-playing');
  };

  /** Ask the element to play; a rejection leaves the poster for a second click. */
  const attemptPlay = async (): Promise<void> => {
    if (!session) return;
    try {
      setStatus('');
      await session.play();
    } catch {
      // The gesture that started the load expired before the manifest
      // arrived (Safari, and Chrome without prior interaction), so the
      // browser refused. The engine is ready: the next click plays directly.
      state = 'ready';
      setBusy(false);
      play.setAttribute('aria-label', 'Tap to play');
      poster.classList.add('is-ready');
      setStatus('Ready. Press play to start.');
    }
  };

  const loadAndPlay = async (): Promise<void> => {
    state = 'loading';
    setBusy(true);
    setStatus('Loading the player…');
    try {
      const { mountHomePlayer } = await import('./home-player');
      session = await mountHomePlayer(mount, { src, poster: posterUrl });
      session.onFirstPlaying(revealPlayer);
      state = 'ready';
      await attemptPlay();
    } catch {
      // Chunk or manifest failed. The affordance is still a link to the
      // playground, so the next click simply follows it.
      state = 'failed';
      session = null;
      setBusy(false);
      poster.classList.add('is-failed');
      play.setAttribute('aria-label', 'The sample could not load. Open the playground');
      setStatus('The sample could not load here. Open the playground to try again.');
    }
  };

  play.addEventListener('click', (event) => {
    if (state === 'failed') return; // follow the link to the playground
    event.preventDefault();
    if (state === 'loading' || state === 'playing') return;
    if (state === 'ready') {
      void attemptPlay();
      return;
    }
    void loadAndPlay();
  });

  window.addEventListener('pagehide', () => {
    void session?.destroy();
  });
}

/** Show a short status message; the element is a polite live region. */
function notify(message: string): void {
  const toast = document.querySelector<HTMLElement>('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(Number(toast.dataset.timer));
  toast.dataset.timer = String(
    window.setTimeout(() => toast.classList.remove('visible'), 3500),
  );
}

/** Select the visible snippet's text so a viewer can copy it by keyboard. */
function selectText(node: Node): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Tabs and Copy on the Get started code card. */
function setupCodeCard(): void {
  const tablist = document.querySelector<HTMLElement>('.code-tabs[role=tablist]');
  if (!tablist) return;
  const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role=tab]'));
  const panels = tabs.map((tab) =>
    document.getElementById(tab.getAttribute('aria-controls') ?? ''),
  );
  const copy = tablist.querySelector<HTMLButtonElement>('[data-copy]');
  if (tabs.length === 0) return;

  let selected = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));

  const select = (index: number, focus: boolean): void => {
    selected = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      const on = i === selected;
      tab.classList.toggle('selected', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = panels[i];
      if (panel) panel.hidden = !on;
    });
    if (focus) tabs[selected]?.focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, false));
  });

  tablist.addEventListener('keydown', (event) => {
    const keys: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowLeft: selected - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined || !(event.target as HTMLElement).matches('[role=tab]')) return;
    event.preventDefault();
    select(next, true);
  });

  if (copy) {
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      const panel = panels[selected];
      if (!panel) return;
      const text = panel.textContent ?? '';
      try {
        await navigator.clipboard.writeText(text);
        notify('Example copied.');
      } catch {
        selectText(panel);
        notify('Copy is blocked here. The example is selected: press Ctrl+C or ⌘C.');
      }
    });
  }
}

setupShowcase();
setupCodeCard();
