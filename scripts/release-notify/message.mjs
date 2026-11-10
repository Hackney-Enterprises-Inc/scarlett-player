const MAX_BULLETS = 8;
const MAX_BULLET_CHARS = 200;
/** Slack rejects a section text over 3000 characters; stay safely below. */
const MAX_SECTION_CHARS = 2800;
const CDN_BASE = 'https://assets.thestreamplatform.com/scarlett-player';

/**
 * Escape the three characters Slack mrkdwn treats as control characters.
 * @param {string} text
 * @returns {string}
 */
function escapeMrkdwn(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Convert one changelog entry to mrkdwn: truncate, escape, turn markdown
 * links into `<url|text>` and inline code stays as backticks.
 * @param {string} text Entry text.
 * @returns {string}
 */
function formatEntry(text) {
  let cut = text;
  if (text.length > MAX_BULLET_CHARS) {
    // Cut on the visible text, never inside a markdown link: if the cut lands
    // inside one, back up to where that link starts.
    let end = MAX_BULLET_CHARS - 1;
    for (const m of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
      if (m.index < end && m.index + m[0].length > end) end = m.index;
    }
    cut = `${text.slice(0, end).trimEnd()}…`;
  }
  return escapeMrkdwn(cut).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<$2|$1>');
}

/**
 * Build the Slack payload for a release notification.
 * @param {object} input
 * @param {string} input.version Released version, e.g. `1.27.1`.
 * @param {{ text: string, pr?: number | null, url?: string | null }[]} input.changes Output of `collectChanges`.
 * @param {string} input.releaseUrl GitHub release page URL.
 * @param {string} input.runUrl Workflow run URL.
 * @param {string} input.repo `owner/name`, kept for callers that need it in the footer.
 * @returns {{ text: string, blocks: object[] }} `text` is the plain fallback used for notification previews.
 */
export function buildSlackMessage({ version, changes, releaseUrl, runUrl, repo }) {
  const title = `Scarlett Player v${version} released`;
  const all = changes.slice(0, MAX_BULLETS).map((change) => {
    const link = change.pr && change.url ? ` (<${change.url}|#${change.pr}>)` : '';
    return `• ${formatEntry(change.text)}${link}`;
  });
  // Escaping happens after truncation and can grow the text, so cap the joined
  // section (Slack allows 3000 chars) here, leaving room for the "more" line.
  const moreLine = (n) => `_+${n} more, see the release notes_`;
  const lines = [];
  let used = 0;
  for (const line of all) {
    const next = used + line.length + 1;
    if (next + moreLine(changes.length).length + 1 > MAX_SECTION_CHARS) break;
    lines.push(line);
    used = next;
  }
  if (changes.length > lines.length) lines.push(moreLine(changes.length - lines.length));
  const body = lines.length ? lines.join('\n') : 'No changelog entries; see release notes';

  const links = [
    `<${releaseUrl}|Release notes>`,
    `<${runUrl}|Workflow run>`,
    `<https://www.npmjs.com/package/@scarlett-player/embed/v/${version}|@scarlett-player/embed@${version}>`,
    `<${CDN_BASE}/v${version}/|CDN v${version}/>`,
  ].join(' · ');

  return {
    text: title,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: body } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: links }] },
      ...(repo ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: escapeMrkdwn(repo) }] }] : []),
    ],
  };
}
