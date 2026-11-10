#!/usr/bin/env node
/**
 * Post a Slack notification for a finished release, once.
 *
 * Usage: node scripts/release-notify.mjs [--version <v>] [--dry-run] [--root <dir>]
 *
 * Live mode reads SLACK_RELEASE_WEBHOOK_URL (never printed), GH_TOKEN, REPO and
 * RUN_URL from the environment. --dry-run prints the payload and never reads the
 * webhook secret or touches the network. Dedupe: a `<!-- slack-notified -->`
 * marker in the GitHub release body, written after a successful send.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSlackMessage } from './release-notify/message.mjs';
import { hasMarker, withMarker } from './release-notify/marker.mjs';
import { collectChanges, findChangelogs, sectionHasBullets } from './release-notify/summary.mjs';

const DEFAULT_REPO = 'Hackney-Enterprises-Inc/scarlett-player';

/**
 * Parse CLI arguments.
 * @param {string[]} argv Arguments after the script name.
 * @returns {{ version?: string, dryRun: boolean, root?: string }}
 */
function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--version') args.version = argv[++i];
    else if (argv[i] === '--root') args.root = argv[++i];
  }
  return args;
}

/** Default command runner: returns stdout, optionally feeding stdin. */
function defaultExec(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', input: opts.input, stdio: ['pipe', 'pipe', 'pipe'] });
}

/**
 * Run the notifier. Every side effect is injectable so tests never touch the
 * network, the `gh` CLI or the real environment.
 * @param {object} [deps]
 * @param {string[]} [deps.argv] Arguments after the script name.
 * @param {Record<string, string | undefined>} [deps.env] Environment.
 * @param {typeof fetch} [deps.fetch] HTTP client used for the Slack POST.
 * @param {(cmd: string, args: string[], opts?: { input?: string }) => string} [deps.exec] Command runner (gh).
 * @param {(line: string) => void} [deps.log] Output sink.
 * @returns {Promise<number>} Process exit code: 0 sent, skipped or dry-run; 1 on a Slack or marker failure.
 */
export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  fetch: fetchImpl = globalThis.fetch,
  exec = defaultExec,
  log = console.log,
} = {}) {
  const args = parseArgs(argv);
  const root = resolve(args.root ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
  const version =
    args.version ?? JSON.parse(readFileSync(join(root, 'packages/embed/package.json'), 'utf8')).version;
  const tag = `v${version}`;
  const repo = env.REPO || DEFAULT_REPO;
  const releaseUrl = `https://github.com/${repo}/releases/tag/${tag}`;
  const runUrl = env.RUN_URL || `https://github.com/${repo}/actions`;

  const changelogs = findChangelogs(root).map((file) => readFileSync(file, 'utf8'));
  const changes = collectChanges(changelogs, version);
  const message = buildSlackMessage({ version, changes, releaseUrl, runUrl, repo });

  const readBody = () => JSON.parse(exec('gh', ['release', 'view', tag, '--repo', repo, '--json', 'body']) || '{}').body ?? '';

  if (args.dryRun) {
    if (changes.length === 0 && sectionHasBullets(changelogs, version)) {
      log(
        `::error::The ${version} changelog section has bullet entries but none could be parsed; ` +
          'the changelog format probably changed. Update scripts/release-notify/summary.mjs.',
      );
      return 1;
    }
    log(`Dry run for ${tag}: ${changes.length} change(s). Nothing is sent.`);
    log(JSON.stringify(message, null, 2));
    if (env.GH_TOKEN) {
      try {
        log(`Dedupe: release body ${hasMarker(readBody()) ? 'has' : 'does not have'} the marker.`);
      } catch {
        log('Dedupe: not checked (could not read the release).');
      }
    } else {
      log('Dedupe: not checked (no GH_TOKEN).');
    }
    return 0;
  }

  const webhook = env.SLACK_RELEASE_WEBHOOK_URL;
  if (!webhook) {
    log('::warning::SLACK_RELEASE_WEBHOOK_URL is not set; skipping the Slack release notification.');
    return 0;
  }

  let body;
  try {
    body = readBody();
  } catch (error) {
    log(`::error::Could not read release ${tag} to check the dedupe marker: ${error.message}`);
    return 1;
  }
  if (hasMarker(body)) {
    log(`Release ${tag} is already notified (marker present); nothing to send.`);
    return 0;
  }

  let response;
  try {
    response = await fetchImpl(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch (error) {
    log(
      `::error::Slack request failed (${error?.name ?? 'Error'}); the message MAY have been sent ` +
        `(Slack can process a post and the connection still drop). Check the channel before re-running: ` +
        'a re-run would post a duplicate if it arrived.',
    );
    return 1;
  }
  if (!response.ok) {
    const detail = String(await response.text().catch(() => '')).slice(0, 200);
    log(`::error::Slack responded ${response.status}: ${detail}`);
    return 1;
  }
  log(`Slack notified for ${tag}.`);

  try {
    exec('gh', ['release', 'edit', tag, '--repo', repo, '--notes-file', '-'], { input: withMarker(body) });
  } catch (error) {
    log(
      `::error::The Slack message WAS sent, but marking release ${tag} failed (${error.message}). ` +
        'Do not re-run this job: it would post a duplicate.',
    );
    return 1;
  }
  log(`Marked release ${tag} as notified.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => process.exit(code));
}
