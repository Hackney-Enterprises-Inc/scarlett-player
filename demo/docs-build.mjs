/**
 * Build the HTML documentation for scarlettplayer.com.
 *
 * Renders the four guides under docs/*.md into static pages beside the
 * homepage, plus a /documentation/ index:
 *
 *   docs/documentation/index.html     /documentation/
 *   docs/architecture/index.html      /architecture/       docs/architecture.md
 *   docs/plugin-authoring/index.html  /plugin-authoring/   docs/plugin-authoring.md
 *   docs/embed/index.html             /embed/              docs/embed-implementation.md
 *   docs/contributing/index.html      /contributing/       docs/contributing.md
 *
 * The Markdown stays authoritative: these pages are generated, never
 * hand-edited, and TRACKED for the same reason docs/demo/ is (Forge deploys
 * the committed tree and runs no build). Each directory is replaced wholesale
 * on every run and the output is byte-deterministic - no dates, no hashes of
 * anything but content - so an unchanged guide leaves the tree clean and the
 * release workflow's "did anything change" check stays meaningful.
 *
 * These pages are the one exception to the site's sibling rule: they link
 * the shared stylesheet and assets as `../site.css` and `../assets/...`. The
 * rule exists because `../` from the demo resolves differently on production
 * and on a local repo-root server; one level below docs/ it does not - from
 * /architecture/ it is /site.css on production and from /docs/architecture/
 * it is /docs/site.css locally, which is where the file lives in both cases.
 * So nothing is mirrored beside these pages.
 *
 * Link policy, enforced at build time (the build throws rather than ship a
 * broken link):
 *   - a link to another guide's .md becomes that guide's route, `../<slug>/`
 *   - a link to any other file or directory in the repository becomes its
 *     GitHub URL on main; the target must exist
 *   - http(s), mailto and in-page `#` links are left alone
 *   - anything else relative (a missing file, a path outside the repo, a
 *     relative image) throws
 *
 * Raw HTML in the Markdown is escaped, never passed through, and the rendered
 * body is checked against an allowlist of the tags the renderer itself emits.
 *
 * For agents, each guide is also published as Markdown beside its page
 * (docs/<slug>/index.md, linked from the page as rel=alternate), and two
 * files go at the site root: docs/llms.txt (an llmstxt.org index of the
 * guides and packages) and docs/llms-full.txt (every guide in one file).
 * The copies keep the source text and rewrite only link targets, to
 * absolute URLs, since they are read out of context. Generated and tracked
 * like the pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(REPO_ROOT, 'docs');
const SITE_ORIGIN = 'https://scarlettplayer.com';
const REPO_URL = 'https://github.com/Hackney-Enterprises-Inc/scarlett-player';
const SHARE_IMAGE = `${SITE_ORIGIN}/assets/share-1200x630.jpg`;
const SHARE_IMAGE_ALT = 'Scarlett Player key art with the Signal logo in the corner';

/** Route of the documentation index. */
const INDEX_SLUG = 'documentation';

/**
 * The guides, in reading order: the order is also each page's previous/next
 * pair and the order of the cards on the index.
 */
export const GUIDES = [
  {
    slug: 'architecture',
    file: 'architecture.md',
    nav: 'Architecture',
    title: 'Architecture | Scarlett Player',
    description:
      'How Scarlett Player is built: the core engine, plugin lifecycle and plugin API, reactive state, events, the error and reconnect model, live playback and the build.',
  },
  {
    slug: 'plugin-authoring',
    file: 'plugin-authoring.md',
    nav: 'Writing a plugin',
    title: 'Writing a Plugin | Scarlett Player',
    description:
      'Write a Scarlett Player plugin that adds its own events, state and control-bar controls without editing the core or UI packages.',
  },
  {
    slug: 'embed',
    file: 'embed-implementation.md',
    nav: 'Embed guide',
    title: 'Embed Guide | Scarlett Player',
    description:
      'How the Scarlett Player embed package is built and integrated: script tags, iframes and the JavaScript API, CDN layout, multi-tenant branding and bundle sizes.',
  },
  {
    slug: 'contributing',
    file: 'contributing.md',
    nav: 'Contributing',
    title: 'Contributing | Scarlett Player',
    description:
      'Code standards for Scarlett Player: TypeScript and TSDoc rules, plugin guidelines, testing, the git workflow and changesets, performance, security and accessibility.',
  },
];

/** Every directory this build owns under docs/, index first. */
export const DOC_ROUTES = [INDEX_SLUG, ...GUIDES.map((g) => g.slug)];

/**
 * Tags the Markdown renderer is allowed to leave in a page body. Raw HTML is
 * escaped before it gets here, so anything else means a renderer change let
 * markup through.
 */
const ALLOWED_TAGS = new Set([
  'a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'hr', 'input', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody',
  'td', 'th', 'thead', 'tr', 'ul',
]);

/**
 * Escape text for HTML element content and double-quoted attributes.
 *
 * @param {string} value - Raw text
 * @returns {string} Escaped text
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Plain text of a run of inline tokens, the way GitHub reads a heading for
 * its anchor: code spans contribute their content, markup contributes
 * nothing.
 *
 * @param {Array<object>} tokens - Inline tokens from marked
 * @returns {string} Unformatted text
 */
function plainText(tokens) {
  return (tokens ?? [])
    .map((t) => (t.tokens ? plainText(t.tokens) : t.type === 'codespan' || t.type === 'text' || t.type === 'escape' ? t.text : ''))
    .join('');
}

/**
 * GitHub-style heading slug: lower case, punctuation other than `-` and `_`
 * dropped, each space a hyphen. Matches the anchors the same file gets on
 * github.com, so a `#fragment` copied from either works on both.
 *
 * @param {string} text - Plain heading text
 * @returns {string} Slug, possibly empty
 */
function githubSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * Resolve one Markdown link target to the URL the published page uses.
 *
 * @param {string} href - The link as written in the Markdown
 * @param {string} sourceFile - Absolute path of the Markdown file holding it
 * @param {(guide: typeof GUIDES[number], hash: string) => string} [guideHref] - URL for a link to another guide; the HTML pages use the relative route, the Markdown copies an absolute .md URL
 * @returns {string} Published URL
 * @throws {Error} When a relative target is not a guide and not a file in the repository
 */
function resolveLink(href, sourceFile, guideHref = (guide, hash) => `../${guide.slug}/${hash}`) {
  if (/^(https?:|mailto:)/i.test(href) || href.startsWith('#')) {
    return href;
  }
  const [target, fragment = ''] = href.split('#');
  const hash = fragment ? `#${fragment}` : '';
  const absolute = path.resolve(path.dirname(sourceFile), decodeURIComponent(target));
  const relative = path.relative(REPO_ROOT, absolute);
  const where = `${path.relative(REPO_ROOT, sourceFile)}: link "${href}"`;

  if (relative.startsWith('..') || path.isAbsolute(relative) || /^[a-z][a-z0-9+.-]*:/i.test(target)) {
    throw new Error(`${where} points outside the repository`);
  }
  const guide = GUIDES.find((g) => path.join(DOCS, g.file) === absolute);
  if (guide) {
    return guideHref(guide, hash);
  }
  if (!fs.existsSync(absolute)) {
    throw new Error(`${where} names ${relative}, which does not exist`);
  }
  const kind = fs.statSync(absolute).isDirectory() ? 'tree' : 'blob';
  const repoPath = relative.split(path.sep).map(encodeURIComponent).join('/');
  return `${REPO_URL}/${kind}/main/${repoPath}${hash}`;
}

/**
 * Render Markdown to a page body with GitHub-style heading ids.
 *
 * A fresh Marked instance per document, so heading ids are deduplicated per
 * page (`-1`, `-2` suffixes, as GitHub does) and nothing leaks between pages.
 *
 * @param {string} markdown - Markdown source
 * @param {string} sourceFile - Absolute path it came from, for link resolution and errors
 * @returns {{html: string, h1: string, toc: Array<{id: string, html: string}>}} Body, the first H1's inner HTML (removed from the body) and the H2 outline
 * @throws {Error} On a link the policy rejects or a tag outside the allowlist
 */
export function renderMarkdown(markdown, sourceFile) {
  const used = new Map();
  const toc = [];
  let h1 = '';
  const md = new Marked({ gfm: true });

  md.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        let id = githubSlug(plainText(tokens)) || 'section';
        const seen = used.get(id) ?? 0;
        used.set(id, seen + 1);
        if (seen) id = `${id}-${seen}`;
        if (depth === 1 && !h1) {
          // The page template renders the H1 itself, above the outline.
          h1 = inner;
          return '';
        }
        if (depth === 2) toc.push({ id, html: inner });
        // The heading text is its own anchor link, unless it already holds a
        // link: anchors cannot nest.
        const body = /<a\s/.test(inner) ? inner : `<a class="anchor" href="#${id}">${inner}</a>`;
        return `<h${depth} id="${id}">${body}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = (lang ?? '').match(/^[\w+-]+/)?.[0];
        const cls = language ? ` class="language-${escapeHtml(language)}"` : '';
        // Focusable so a keyboard user can scroll a long line into view.
        return `<pre tabindex="0"><code${cls}>${escapeHtml(text)}</code></pre>\n`;
      },
      html({ text }) {
        return escapeHtml(text);
      },
      link({ href, title, tokens }) {
        const url = resolveLink(href, sourceFile);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(url)}"${titleAttr}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href }) {
        if (/^https?:/i.test(href)) {
          throw new Error(`${path.relative(REPO_ROOT, sourceFile)}: remote image "${href}" - only our own assets ship on the site`);
        }
        throw new Error(`${path.relative(REPO_ROOT, sourceFile)}: image "${href}" - guide images are not published yet`);
      },
    },
  });

  let parsed;
  try {
    parsed = md.parse(markdown);
  } catch (error) {
    // marked appends a "report this to marked" footer to anything a renderer
    // throws; these are our policy errors, not marked bugs.
    error.message = error.message.replace(/\s*Please report this to https:\/\/github\.com\/markedjs\/marked\.?\s*$/, '');
    throw error;
  }
  const html = parsed
    // Wide tables scroll inside their own box instead of widening the page.
    .replace(/<table>/g, '<div class="table-wrap" tabindex="0"><table>')
    .replace(/<\/table>/g, '</table></div>');
  assertSafe(html, sourceFile);
  return { html, h1, toc };
}

/**
 * Fail the build when a rendered body carries markup the renderer should
 * never have produced: a tag outside the allowlist, an event handler
 * attribute or a javascript: URL.
 *
 * @param {string} html - Rendered body
 * @param {string} sourceFile - Where it came from, for the error
 * @returns {void}
 * @throws {Error} Naming the first offending tag
 */
function assertSafe(html, sourceFile) {
  for (const match of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)) {
    const [tag, name, attrs] = match;
    if (!ALLOWED_TAGS.has(name.toLowerCase()) || /\son[a-z]+\s*=/i.test(attrs) || /javascript:/i.test(attrs)) {
      throw new Error(`${path.relative(REPO_ROOT, sourceFile)}: rendered markup "${tag}" is not allowed on a docs page`);
    }
  }
}

/**
 * Rebase every relative href/src in a fragment of the homepage onto a page
 * one level down: `./` becomes `../`, `demo/` becomes `../demo/`, `#start`
 * becomes `../#start`, `assets/x` becomes `../assets/x`. Absolute URLs are
 * untouched.
 *
 * @param {string} html - Markup lifted from docs/index.html
 * @returns {string} The same markup with rebased references
 */
function rebase(html) {
  return html.replace(/\b(href|src)="([^"]*)"/g, (whole, attr, value) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return whole;
    const url = new URL(value, `${SITE_ORIGIN}/`);
    return `${attr}="..${url.pathname}${url.search}${url.hash}"`;
  });
}

/**
 * Lift the header and footer from the homepage, so the docs pages share its
 * chrome without a second copy to drift: hrefs rebased one level down, the
 * version badge and release link set to `version`, and the homepage-only
 * sample-video credit dropped. documentHtml() marks the Docs nav link
 * current, per page.
 *
 * @param {string} version - Current player version, without the `v`
 * @returns {{header: string, footer: string}} Markup for the page template
 * @throws {Error} When the homepage no longer has the elements this relies on
 */
function siteChrome(version) {
  const home = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  const header = home.match(/<header class="header wrap">[\s\S]*?<\/header>/)?.[0];
  const footer = home.match(/<footer class="footer wrap">[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer || !header.includes('href="documentation/"')) {
    throw new Error('docs/index.html: header, footer or the Docs nav link (href="documentation/") not found');
  }
  const stamp = (html) =>
    html
      .replace(/(<span class="version-badge" id="version">)v[^<]*(<\/span>)/, `$1v${version}$2`)
      .replace(/(\/releases\/tag\/)v[^"]*(">)v[^<]*(<\/a>)/, `$1v${version}$2v${version}$3`);
  return {
    header: stamp(rebase(header)),
    footer: stamp(rebase(footer)).replace(/\n\s*<a href="https:\/\/peach\.blender\.org\/"[^>]*>[^<]*<\/a>/, ''),
  };
}

/**
 * The complete HTML document around a page body.
 *
 * @param {object} page
 * @param {string} page.slug - Route, without slashes
 * @param {string} page.title - <title> and og:title
 * @param {string} page.description - Meta and og description
 * @param {string} page.main - Markup inside <main>
 * @param {string} page.alternate - Relative URL of the page's Markdown twin (a guide's index.md, or llms.txt for the index)
 * @param {{header: string, footer: string}} chrome - From siteChrome()
 * @param {string} cssVersion - Stylesheet digest for the ?v= query
 * @returns {string} The document
 */
function documentHtml({ slug, title, description, main, alternate }, chrome, cssVersion) {
  const url = `${SITE_ORIGIN}/${slug}/`;
  // The Docs link IS this page on the index; on a guide it is the section
  // the page belongs to, which aria-current="true" says without claiming
  // the link points here.
  const header = chrome.header.replace(
    '<a href="../documentation/">',
    `<a href="../documentation/" aria-current="${slug === INDEX_SLUG ? 'page' : 'true'}">`
  );
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Generated by demo/docs-build.mjs from the Markdown in docs/. Do not edit. -->
  <title>${t}</title>
  <meta name="description" content="${d}">
  <link rel="canonical" href="${url}">
  <link rel="alternate" type="text/markdown" href="${alternate}" title="Markdown">
  <meta name="theme-color" content="#0b0c10">
  <link rel="icon" href="../assets/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="../assets/brand/signal-icon-on-dark.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Scarlett Player">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SHARE_IMAGE}">
  <meta property="og:image:secure_url" content="${SHARE_IMAGE}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${SHARE_IMAGE_ALT}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${SHARE_IMAGE}">
  <meta name="twitter:image:alt" content="${SHARE_IMAGE_ALT}">
  <link rel="preload" href="../assets/fonts/carter-one-400-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../assets/fonts/cantarell-400-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../site.css?v=${cssVersion}">
  <script src="https://cdn.usefathom.com/script.js" data-site="OFIAHQME" defer></script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>

  ${header}

  <main id="main" class="docs wrap">
${main}
  </main>

  ${chrome.footer}
</body>
</html>
`;
}

/**
 * The <main> content of one guide page: title, outline, body, previous/next
 * and the source link.
 *
 * @param {typeof GUIDES[number]} guide - The guide
 * @param {number} index - Its position in GUIDES
 * @returns {string} Markup
 * @throws {Error} When the guide has no H1
 */
function guideMain(guide, index) {
  const source = path.join(DOCS, guide.file);
  const { html, h1, toc } = renderMarkdown(fs.readFileSync(source, 'utf8'), source);
  if (!h1) throw new Error(`docs/${guide.file}: no H1 to title the page`);

  const prev = GUIDES[index - 1];
  const next = GUIDES[index + 1];
  const outline = toc.length
    ? `    <nav class="docs-toc" aria-labelledby="toc-heading">
      <h2 id="toc-heading">On this page</h2>
      <ol>
${toc.map((e) => `        <li><a href="#${e.id}">${e.html.replace(/<\/?a\b[^>]*>/g, '')}</a></li>`).join('\n')}
      </ol>
    </nav>
`
    : '';
  const pager = [
    prev
      ? `      <a class="prev" href="../${prev.slug}/"><span>Previous</span>${escapeHtml(prev.nav)}</a>`
      : `      <a class="prev" href="../${INDEX_SLUG}/"><span>Previous</span>All documentation</a>`,
    next
      ? `      <a class="next" href="../${next.slug}/"><span>Next</span>${escapeHtml(next.nav)}</a>`
      : `      <a class="next" href="../${INDEX_SLUG}/"><span>Next</span>All documentation</a>`,
  ].join('\n');

  return `    <p class="eyebrow"><a href="../${INDEX_SLUG}/">DOCUMENTATION</a></p>
    <h1 class="docs-title">${h1}</h1>
    <div class="docs-layout">
${outline}    <article class="prose">
${html}    </article>
    </div>
    <nav class="docs-pager" aria-label="Previous and next guide">
${pager}
    </nav>
    <p class="docs-source"><a href="${REPO_URL}/blob/main/docs/${guide.file}">Improve this guide <span aria-hidden="true">↗</span></a></p>`;
}

/**
 * The README's package table, the single source of truth for what ships:
 * the `## Packages` section up to the next heading, which must be one table
 * of `Package | Description` whose first cells are package names that exist
 * in the workspace. Each name links to the package on GitHub.
 *
 * @returns {string} Rendered table markup
 * @throws {Error} When the section is missing or malformed, or names a package the workspace lacks
 */
function packageTable() {
  const readme = path.join(REPO_ROOT, 'README.md');
  const section = fs.readFileSync(readme, 'utf8').match(/^## Packages\n([\s\S]*?)(?=^## )/m)?.[1];
  if (!section) throw new Error('README.md: no "## Packages" section');

  const rows = section.trim().split('\n');
  if (!/^\|\s*Package\s*\|\s*Description\s*\|$/.test(rows[0] ?? '') || !/^\|[-\s|]+\|$/.test(rows[1] ?? '')) {
    throw new Error('README.md: "## Packages" must be a single "| Package | Description |" table');
  }
  const body = rows.slice(2);
  if (!body.length) throw new Error('README.md: the "## Packages" table has no rows');

  const linked = body.map((row, i) => {
    const name = row.match(/^\|\s*`(@scarlett-player\/[a-z0-9-]+)`\s*\|/)?.[1];
    if (!name || row.split(/(?<!\\)\|/).length !== 4) {
      throw new Error(`README.md: "## Packages" row ${i + 1} is not "| \`@scarlett-player/<name>\` | <description> |": ${row}`);
    }
    const short = name.split('/')[1];
    const dir = [`packages/${short}`, `packages/plugins/${short}`].find((d) => {
      const manifest = path.join(REPO_ROOT, d, 'package.json');
      return fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).name === name;
    });
    if (!dir) throw new Error(`README.md: "## Packages" lists ${name}, which is not a workspace package`);
    return row.replace(`\`${name}\``, `[\`${name}\`](${dir})`);
  });

  return renderMarkdown([rows[0], rows[1], ...linked].join('\n'), readme).html;
}

/**
 * The <main> content of the /documentation/ index.
 *
 * @returns {string} Markup
 */
function indexMain() {
  const cards = GUIDES.map(
    (g, i) => `      <a class="docs-card" href="../${g.slug}/">
        <span class="story-number">${String(i + 1).padStart(2, '0')} / GUIDE</span>
        <h2>${escapeHtml(g.nav)}</h2>
        <p>${escapeHtml(g.description)}</p>
        <span class="text-link">Read the guide <span aria-hidden="true">↗</span></span>
      </a>`
  ).join('\n');

  return `    <p class="eyebrow">DOCUMENTATION</p>
    <h1 class="docs-title">Build with Scarlett Player.</h1>
    <p class="docs-lead">Guides to how the player is put together, how to extend it with your own plugins, how to embed it, and how we work on it. Start with the <a href="../#start">quick start</a> or try every option in the <a href="../demo/">playground</a>.</p>
    <div class="docs-cards">
${cards}
    </div>
    <section class="docs-packages" aria-labelledby="packages-heading">
      <h2 id="packages-heading">Packages</h2>
      <p>Every package ships at the same version. Install the core and the plugins you need.</p>
      <div class="prose">
${packageTable()}      </div>
      <p class="docs-source"><a href="${REPO_URL}#readme">Installation and quick starts in the README <span aria-hidden="true">↗</span></a></p>
    </section>`;
}

/**
 * Absolute URL of a guide's Markdown copy.
 *
 * @param {typeof GUIDES[number]} guide - The guide
 * @param {string} [hash] - Optional `#fragment`
 * @returns {string} URL
 */
function guideMarkdownUrl(guide, hash = '') {
  return `${SITE_ORIGIN}/${guide.slug}/index.md${hash}`;
}

/**
 * A guide's Markdown as published beside its page, for agents and anything
 * else that reads Markdown more easily than HTML.
 *
 * The source text is kept byte for byte except for its link targets, which
 * go through the same policy as the HTML pages but come out absolute, since
 * the copy is also concatenated into llms-full.txt and read out of context:
 * another guide becomes its absolute .md URL, a repo path its GitHub URL on
 * main. A line under the H1 names the HTML page and the source file.
 *
 * Only inline links are rewritten, found through marked's own lexer so a
 * `[x](y)` inside a code block is never touched. Reference-style link
 * definitions are refused rather than silently left relative.
 *
 * @param {typeof GUIDES[number]} guide - The guide
 * @returns {string} Markdown
 * @throws {Error} On a link the policy rejects, a reference-style definition or a missing H1
 */
function guideMarkdown(guide) {
  const source = path.join(DOCS, guide.file);
  const md = new Marked({ gfm: true });
  const tokens = md.lexer(fs.readFileSync(source, 'utf8'));
  if (Object.keys(tokens.links ?? {}).length) {
    throw new Error(`docs/${guide.file}: reference-style link definitions are not supported; use inline links`);
  }

  const out = tokens.map((token) => {
    if (token.type === 'code') return token.raw;
    let raw = token.raw;
    md.walkTokens([token], (t) => {
      if (t.type !== 'link' && t.type !== 'image') return;
      const url = resolveLink(t.href, source, (g, hash) => guideMarkdownUrl(g, hash));
      if (url !== t.href) raw = raw.split(`](${t.href}`).join(`](${url}`);
    });
    return raw;
  });

  const h1 = out.findIndex((raw, i) => tokens[i].type === 'heading' && tokens[i].depth === 1);
  if (h1 === -1) throw new Error(`docs/${guide.file}: no H1 to title the page`);
  // The line breaks after the H1 belong to the next (space) token, so the
  // note ends without one and inherits them.
  out[h1] = `${out[h1].trimEnd()}\n\n> Rendered at ${SITE_ORIGIN}/${guide.slug}/ · Source: ${REPO_URL}/blob/main/docs/${guide.file}`;
  return out.join('');
}

/**
 * The README's package rows as `[name](GitHub URL): description` list items,
 * for llms.txt. Same parse and validation as the index page's table.
 *
 * @returns {string} Markdown list
 */
function packageList() {
  const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
  const rows = readme.match(/^## Packages\n([\s\S]*?)(?=^## )/m)[1].trim().split('\n').slice(2);
  return rows
    .map((row) => {
      const [, name, description] = row.match(/^\|\s*`(@scarlett-player\/[a-z0-9-]+)`\s*\|\s*(.*?)\s*\|$/);
      const short = name.split('/')[1];
      const dir = fs.existsSync(path.join(REPO_ROOT, 'packages', short, 'package.json'))
        ? `packages/${short}`
        : `packages/plugins/${short}`;
      return `- [${name}](${REPO_URL}/tree/main/${dir}): ${description}`;
    })
    .join('\n');
}

/**
 * /llms.txt, following the llmstxt.org shape: an H1, a one-paragraph
 * summary, then H2 sections of annotated links. Points at the Markdown
 * copies, not the HTML.
 *
 * @param {string} version - Current player version
 * @returns {string} Markdown
 */
function llmsTxt(version) {
  return `# Scarlett Player

> Open-source, plugin-based video and audio player for the web, written in TypeScript: HLS adaptive streaming, native formats, WHEP live playback, captions, chapters, clips and casting, with a Vue wrapper and a CDN embed. Published to npm as @scarlett-player/* packages, all at one version (currently ${version}). MIT licensed.

Every guide below is also a web page at the same path without \`index.md\`. ${SITE_ORIGIN}/llms-full.txt holds all of them in one file.

## Docs

${GUIDES.map((g) => `- [${g.nav}](${guideMarkdownUrl(g)}): ${g.description}`).join('\n')}

## Packages

${packageList()}

## Optional

- [README](${REPO_URL}/blob/main/README.md): installation, quick starts, theming and keyboard shortcuts
- [Playground](${SITE_ORIGIN}/demo/): every scenario and option, with generated integration code
- [Source](${REPO_URL}): the pnpm monorepo
`;
}

/**
 * /llms-full.txt: llms.txt's heading and summary, then every guide's
 * Markdown copy in reading order.
 *
 * @param {string} version - Current player version
 * @param {string[]} guides - Markdown copies, in GUIDES order
 * @returns {string} Markdown
 */
function llmsFullTxt(version, guides) {
  // The H1 and summary only: llms.txt's line pointing here would be circular.
  const head = llmsTxt(version).split('\n\nEvery guide below')[0];
  return `${head}\n\n${guides.map((md) => md.trimEnd()).join('\n\n---\n\n')}\n`;
}

/**
 * Write the documentation pages, replacing each owned directory wholesale.
 *
 * @param {object} options
 * @param {string} options.version - Player version for the header badge and release link
 * @param {string} options.cssVersion - Digest of docs/site.css for the stylesheet's ?v= query
 * @param {boolean} [options.dryRun] - Render and validate everything but write nothing (the pull-request check)
 * @returns {string[]} Repo-relative paths written, or that would be: each page, each guide's index.md, llms.txt and llms-full.txt
 * @throws {Error} On any link, markup or README violation; nothing is written when any page fails
 */
export function buildDocs({ version, cssVersion, dryRun = false }) {
  const chrome = siteChrome(version);
  const pages = [
    {
      slug: INDEX_SLUG,
      title: 'Documentation | Scarlett Player',
      description:
        'Scarlett Player documentation: architecture, writing plugins, embedding the player and contributing, plus every package in the workspace.',
      main: indexMain(),
      // The index has no Markdown source of its own; llms.txt is its
      // Markdown equivalent (the guide list and the package list).
      alternate: '../llms.txt',
    },
    ...GUIDES.map((g, i) => ({
      slug: g.slug,
      title: g.title,
      description: g.description,
      main: guideMain(g, i),
      alternate: 'index.md',
      markdown: guideMarkdown(g),
    })),
  ];

  // Render everything before touching the tree, so a failure leaves the
  // previous pages in place rather than a partial set.
  const rendered = pages.map((p) => ({ ...p, html: documentHtml(p, chrome, cssVersion) }));
  const guideCopies = rendered.filter((p) => p.markdown).map((p) => p.markdown);
  const rootFiles = {
    'llms.txt': llmsTxt(version),
    'llms-full.txt': llmsFullTxt(version, guideCopies),
  };

  if (dryRun) {
    return [
      ...rendered.flatMap((p) => [`docs/${p.slug}/index.html`, ...(p.markdown ? [`docs/${p.slug}/index.md`] : [])]),
      ...Object.keys(rootFiles).map((name) => `docs/${name}`),
    ];
  }

  const written = [];
  for (const { slug, html, markdown } of rendered) {
    const dir = path.join(DOCS, slug);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    written.push(`docs/${slug}/index.html`);
    if (markdown) {
      fs.writeFileSync(path.join(dir, 'index.md'), markdown);
      written.push(`docs/${slug}/index.md`);
    }
  }
  for (const [name, text] of Object.entries(rootFiles)) {
    fs.writeFileSync(path.join(DOCS, name), text);
    written.push(`docs/${name}`);
  }
  return written;
}

// `node demo/docs-build.mjs --check`: render and validate every page without
// writing, for pull-request CI. build.cjs, which writes the pages, runs only
// on pushes to main, so without this a broken guide link or a malformed
// README package table would pass review and fail after merge.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (!process.argv.includes('--check')) {
    console.error('Usage: node demo/docs-build.mjs --check   (demo/build.cjs writes the pages)');
    process.exit(2);
  }
  const { version } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/core/package.json'), 'utf8'));
  try {
    const files = buildDocs({ version, cssVersion: 'check', dryRun: true });
    console.log(`Documentation OK: ${files.length} files render (nothing written)`);
  } catch (error) {
    console.error(`Documentation build failed: ${error.message}`);
    process.exit(1);
  }
}
