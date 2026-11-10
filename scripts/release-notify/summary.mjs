import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LEVEL_ORDER = ['Major', 'Minor', 'Patch'];

/**
 * Text of one version's section of a changesets CHANGELOG: from `## <version>`
 * up to (not including) the next `## ` heading.
 * @param {string} changelogText Full CHANGELOG.md text.
 * @param {string} version Exact version, e.g. `1.27.1`.
 * @returns {string} The section body, or '' when the version is absent.
 */
export function extractVersionSection(changelogText, version) {
  const lines = changelogText.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

/**
 * Strip the `[#n](url) [`sha`](url) Thanks [@x](url)! - ` prefix that
 * @changesets/changelog-github puts on every entry.
 * @param {string} bullet Bullet text without the leading `- `.
 * @returns {{ text: string, pr: number | null, url: string | null }}
 */
function parseBullet(bullet) {
  let rest = bullet;
  let pr = null;
  let url = null;
  const prMatch = rest.match(/^\[#(\d+)\]\(([^)\s]+)\)\s*/);
  if (prMatch) {
    pr = Number(prMatch[1]);
    url = prMatch[2];
    rest = rest.slice(prMatch[0].length);
  }
  rest = rest.replace(/^\[`[0-9a-f]+`\]\([^)\s]+\)\s*/, '');
  rest = rest.replace(/^Thanks \[@[^\]]+\]\([^)\s]*\)!\s*/, '');
  rest = rest.replace(/^-\s+/, '');
  return { text: rest.trim(), pr, url };
}

/**
 * Parse one section into level-tagged bullets. Wrapped bullets (indented
 * continuation lines) are joined with a single space; nested bullets and
 * "Updated dependencies" entries are dropped.
 * @param {string} section Output of {@link extractVersionSection}.
 * @returns {{ level: string, text: string, pr: number | null, url: string | null }[]}
 */
function parseSection(section) {
  const out = [];
  let level = null;
  let current = null;
  const flush = () => {
    if (current !== null && level) {
      const parsed = parseBullet(current);
      if (parsed.text) out.push({ level, ...parsed });
    }
    current = null;
  };
  for (const line of section.split('\n')) {
    const heading = line.match(/^### (\w+) Changes\s*$/);
    if (heading) {
      flush();
      level = heading[1];
      continue;
    }
    if (line.startsWith('### ')) {
      flush();
      level = null;
      continue;
    }
    if (line.startsWith('- ')) {
      flush();
      current = line.slice(2);
    } else if (current !== null && /^\s+\S/.test(line) && !/^\s+- /.test(line)) {
      current += ` ${line.trim()}`;
    } else if (line.trim() === '') {
      flush();
    }
  }
  flush();
  return out.filter((c) => !/^Updated dependencies/i.test(c.text));
}

/**
 * Collect the unique, user-facing changes for a version across many
 * changelogs. The same changeset text appears in several packages, so entries
 * are de-duplicated by their stripped text. Result is ordered Major, Minor,
 * Patch, keeping first-seen order within a level.
 * @param {string[]} changelogs Full text of each CHANGELOG.md.
 * @param {string} version Exact version, e.g. `1.27.1`.
 * @returns {{ level: string, text: string, pr: number | null, url: string | null }[]}
 */
export function collectChanges(changelogs, version) {
  const seen = new Set();
  const all = [];
  for (const text of changelogs) {
    for (const change of parseSection(extractVersionSection(text, version))) {
      if (seen.has(change.text)) continue;
      seen.add(change.text);
      all.push(change);
    }
  }
  const rank = (level) => {
    const i = LEVEL_ORDER.indexOf(level);
    return i === -1 ? LEVEL_ORDER.length : i;
  };
  return all
    .map((change, index) => ({ change, index }))
    .sort((a, b) => rank(a.change.level) - rank(b.change.level) || a.index - b.index)
    .map(({ change }) => change);
}

/**
 * Whether any changelog has real top-level bullets (not "Updated dependencies")
 * in the version's section. Used to tell "nothing to report" from "the format
 * changed and the parser found nothing".
 * @param {string[]} changelogs Full text of each CHANGELOG.md.
 * @param {string} version Exact version, e.g. `1.27.1`.
 * @returns {boolean}
 */
export function sectionHasBullets(changelogs, version) {
  return changelogs.some((text) =>
    extractVersionSection(text, version)
      .split('\n')
      .some((line) => /^[-*] \S/.test(line) && !/^[-*] Updated dependencies/i.test(line)),
  );
}

/**
 * Paths of every package CHANGELOG: `packages/*` and `packages/plugins/*`.
 * Plain readdir, no glob dependency.
 * @param {string} root Repository root.
 * @returns {string[]} Absolute paths of existing CHANGELOG.md files.
 */
export function findChangelogs(root) {
  const found = [];
  for (const base of [join(root, 'packages'), join(root, 'packages', 'plugins')]) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      const dir = join(base, entry);
      if (!statSync(dir).isDirectory()) continue;
      const file = join(dir, 'CHANGELOG.md');
      if (existsSync(file)) found.push(file);
    }
  }
  return found;
}
