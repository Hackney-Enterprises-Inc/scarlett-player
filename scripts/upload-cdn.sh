#!/usr/bin/env bash
#
# Publish the built embed bundles to TSP Assets, the platform asset CDN at
# assets.thestreamplatform.com (the tsp-assets bucket on Backblaze B2, fronted
# by Fastly).
#
# Usage:
#   doppler run -- ./scripts/upload-cdn.sh            # version from packages/embed
#   doppler run -- ./scripts/upload-cdn.sh 1.1.1      # explicit version
#   VERIFY_ONLY=1 ./scripts/upload-cdn.sh 1.1.1       # check the CDN, no upload
#
# SKIP_VERIFY=1 uploads without the check. VERIFY_ONLY=1 skips the credential
# check and the upload and runs only the check against CDN_BASE, so it needs
# no secrets and can be pointed at any published version.
#
# Reads five values from the environment. Doppler owns all five; CI gets them
# from the GitHub secrets the Doppler sync mirrors into the repository:
#   B2_ACCESS_KEY, B2_SECRET_KEY, B2_ENDPOINT, B2_REGION, B2_BUCKET
#
# This is the single source of truth for what lands on the CDN. The release
# workflow calls this script rather than carrying its own copy of the upload
# logic, so a local publish and a CI publish cannot drift.

set -euo pipefail

CDN_BASE="${CDN_BASE:-https://assets.thestreamplatform.com/scarlett-player}"
DIST="packages/embed/dist"
VERIFY_ONLY="${VERIFY_ONLY:-0}"
SKIP_VERIFY="${SKIP_VERIFY:-0}"

if [ "$VERIFY_ONLY" = "1" ] && [ "$SKIP_VERIFY" = "1" ]; then
  echo "Error: VERIFY_ONLY=1 and SKIP_VERIFY=1 together leave nothing to do" >&2
  exit 1
fi

VERSION="${1:-$(node -p "require('./packages/embed/package.json').version")}"

# Prove the CDN is serving what we just wrote. A publish that uploads to the
# wrong bucket, or to a bucket nothing fronts, otherwise looks like a success.
#
# The check runs against the ORIGIN, not the edge. It used to fetch
# latest/embed.umd.cjs five times, 2 s apart, and require the new version in
# the body. latest/ is written with max-age=3600 (see upload() below), so any
# Fastly edge still holding the previous copy may keep serving it for up to an
# hour and the check could not pass. The v1.16.1 deploy (run 35784736238)
# failed that way after a good upload: "latest/embed.umd.cjs does not contain
# version 1.16.1 (stale cache?)". It also only read the first 512 bytes, see
# has_version().
#
# Probed on 2026-09-23: latest/embed.umd.cjs?verify=<nonce> answered HTTP 200
# with `x-cache: MISS, MISS` and `age: 0`, and the same ETag as
# v1.16.1/embed.umd.cjs. An unknown query string misses Fastly's cache and
# B2 ignores it, so the busted URL reads the origin. The versioned path has
# never been requested before its release, so its first fetch is an origin
# fetch too. B2's ETag is the MD5 of a single-part upload, and upload() writes
# both copies from the same file, so equal ETags prove latest/ at the origin
# is the file just uploaded; the version string in the versioned body proves
# that file is this release.
#
# One curl per URL with -D and -o, so status, headers and body all come from
# the same response.
verify_dir=""

# fetch <name> <url>: headers to <name>.h, body to <name>.b, curl's exit code
# to <name>.rc, prints the HTTP status. curl prints 000 itself when it never
# got a response and exits non-zero, which must not end the script before the
# status is reported; the exit code is kept because a transfer can fail AFTER
# the status line arrived (a connection cut mid-body is curl exit 18 with
# HTTP 200), and a truncated body can still carry the ETag and the version
# string. transfer_ok() is what the required fetches check.
fetch() {
  local status rc=0
  status=$(curl -sS --max-time 30 -D "${verify_dir}/$1.h" -o "${verify_dir}/$1.b" \
    -w '%{http_code}' "$2") || rc=$?
  printf '%s' "$rc" > "${verify_dir}/$1.rc"
  printf '%s' "${status:-000}"
}

# transfer_ok <name>: the whole response for that fetch arrived (curl exit 0).
transfer_ok() {
  [ "$(cat "${verify_dir}/$1.rc" 2>/dev/null)" = "0" ]
}

# transfer_rc <name>: curl's exit code for that fetch, for messages.
transfer_rc() {
  cat "${verify_dir}/$1.rc" 2>/dev/null || printf 'unknown'
}

# header <name> <lowercase header>: the last value of that header, or empty.
# awk rather than grep, which exits 1 on no match and would end the script
# under errexit + pipefail.
header() {
  awk -v key="$2" '
    { line = $0; sub(/\r$/, "", line); i = index(line, ":") }
    i && tolower(substr(line, 1, i - 1)) == key {
      value = substr(line, i + 1); sub(/^[ \t]+/, "", value); sub(/[ \t]+$/, "", value)
    }
    END { print value }
  ' "${verify_dir}/$1.h" 2>/dev/null || true
}

# Compare ETags as opaque values: drop a weak-validator prefix and the
# surrounding quotes, which an intermediary may add or strip.
etag() {
  local value
  value=$(header "$1" etag)
  value="${value#W/}"
  value="${value#\"}"
  value="${value%\"}"
  printf '%s' "$value"
}

# The whole body, for the quoted version literal the plugins carry
# (`version:"1.16.1"`). The old check read only the first 512 bytes, but the
# minified bundle has no banner: in v1.16.1/embed.umd.cjs the first
# occurrence is at byte 50327, so that check could not pass on any release
# and failed v1.15.4, v1.16.0 and v1.16.1 alike (runs 35746573265,
# 35762600914, 35784736238). grep on the file, not in a pipeline, so
# pipefail has nothing to trip on.
has_version() {
  grep -qF -- "\"${VERSION}\"" "${verify_dir}/$1.b" 2>/dev/null
}

verify() {
  verify_dir=$(mktemp -d)
  trap 'rm -rf "$verify_dir"' EXIT

  versioned_path="v${VERSION}/embed.umd.cjs"
  latest_path="latest/embed.umd.cjs"
  nonce="$(date +%s)-${RANDOM}"

  echo ""
  echo "Verifying against the origin (${CDN_BASE})..."

  status=$(fetch versioned "${CDN_BASE}/${versioned_path}")
  echo "  ${versioned_path} -> HTTP ${status}"
  if ! transfer_ok versioned; then
    echo "Error: the download of ${versioned_path} did not complete (curl exit $(transfer_rc versioned), HTTP ${status})" >&2
    exit 1
  fi
  if [ "$status" != "200" ]; then
    echo "Error: CDN did not serve ${versioned_path} (HTTP ${status})." >&2
    echo "Nothing is published at that path: the upload did not reach the bucket" >&2
    echo "${CDN_BASE} fronts, or ${VERSION} is not the version that was uploaded." >&2
    exit 1
  fi
  if ! has_version versioned; then
    echo "Error: ${versioned_path} does not contain the string \"${VERSION}\"" >&2
    exit 1
  fi
  versioned_etag=$(etag versioned)

  status=$(fetch origin "${CDN_BASE}/${latest_path}?verify=${nonce}")
  echo "  ${latest_path}?verify=${nonce} -> HTTP ${status}"
  if ! transfer_ok origin; then
    echo "Error: the download of ${latest_path} from the origin did not complete (curl exit $(transfer_rc origin), HTTP ${status})" >&2
    exit 1
  fi
  if [ "$status" != "200" ]; then
    echo "Error: CDN did not serve ${latest_path} from the origin (HTTP ${status})" >&2
    exit 1
  fi
  origin_etag=$(etag origin)

  if [ -z "$versioned_etag" ] || [ -z "$origin_etag" ]; then
    echo "Error: no ETag to compare (${versioned_path}: '${versioned_etag}', ${latest_path}: '${origin_etag}')" >&2
    exit 1
  fi
  if [ "$versioned_etag" != "$origin_etag" ]; then
    echo "Error: ${latest_path} at the origin is not v${VERSION}" >&2
    echo "  ${versioned_path} ETag: ${versioned_etag}" >&2
    echo "  ${latest_path} ETag: ${origin_etag}" >&2
    echo "The latest/ upload did not land, or a later release has replaced it." >&2
    exit 1
  fi
  echo "  origin: ${latest_path} is v${VERSION} (ETag ${origin_etag})"

  # What visitors get right now, reported and never failed on. An old copy
  # here is the max-age=3600 this script sets on latest/, working as intended.
  status=$(fetch edge "${CDN_BASE}/${latest_path}")
  age=$(header edge age)
  x_cache=$(header edge x-cache)
  if ! transfer_ok edge; then
    edge_state="download did not complete (curl exit $(transfer_rc edge)); not a failure, the origin check above passed"
  elif [ "$status" = "200" ] && has_version edge; then
    edge_state="already serves v${VERSION}"
  elif [ "$status" = "200" ]; then
    edge_state="still serves an older copy; edges turn over within 1 h (max-age=3600)"
  else
    edge_state="answered HTTP ${status}; not a failure, the origin check above passed"
  fi
  echo "  edge:   ${latest_path} -> HTTP ${status}, age ${age:--}, x-cache ${x_cache:--}"
  echo "          ${edge_state}"
}

done_message() {
  echo ""
  echo "$1 CDN URLs:"
  echo "  ${CDN_BASE}/v${VERSION}/embed.umd.cjs"
  echo "  ${CDN_BASE}/latest/embed.umd.cjs"
}

if [ "$VERIFY_ONLY" = "1" ]; then
  verify
  done_message "Verified."
  exit 0
fi

# Every required credential, checked up front. An unset value used to reach the
# AWS CLI as an empty string and fail deep in the upload with "scheme is
# missing", which says nothing about the actual problem.
missing=()
for var in B2_ACCESS_KEY B2_SECRET_KEY B2_ENDPOINT B2_REGION B2_BUCKET; do
  if [ -z "${!var:-}" ]; then
    missing+=("$var")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "Error: missing required environment variables: ${missing[*]}" >&2
  echo "" >&2
  echo "Doppler owns these. Locally, run through Doppler so they are injected:" >&2
  echo "  doppler run -- ./scripts/upload-cdn.sh" >&2
  echo "" >&2
  echo "In CI they arrive as GitHub repository secrets via the Doppler sync." >&2
  echo "A name listed above means that secret did not sync, or the workflow" >&2
  echo "step is not passing it through in its env block." >&2
  exit 1
fi

if [ ! -d "$DIST" ]; then
  echo "Error: ${DIST} not found. Run 'pnpm run build' first." >&2
  exit 1
fi

# The AWS CLI talks to B2 over its S3-compatible API. Region must match the one
# in the endpoint host (us-east-005 for s3.us-east-005.backblazeb2.com).
export AWS_ACCESS_KEY_ID="$B2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$B2_SECRET_KEY"
export AWS_DEFAULT_REGION="$B2_REGION"

# The AWS CLI began sending CRC32 integrity headers by default in v2.23 and not
# every S3-compatible backend accepts them. Only send them where the operation
# requires them. Override by exporting these before calling the script.
export AWS_REQUEST_CHECKSUM_CALCULATION="${AWS_REQUEST_CHECKSUM_CALCULATION:-when_required}"
export AWS_RESPONSE_CHECKSUM_VALIDATION="${AWS_RESPONSE_CHECKSUM_VALIDATION:-when_required}"

BASE_PATH="s3://${B2_BUCKET}/scarlett-player"

echo "Publishing Scarlett Player v${VERSION} to TSP Assets"
echo "  bucket:   ${B2_BUCKET}"
echo "  endpoint: ${B2_ENDPOINT}"
echo "  region:   ${B2_REGION}"
echo ""

# Write each file twice: an immutable versioned copy, and the rolling latest
# copy on a short TTL.
upload() {
  local src="$1"
  local dest="$2"
  local content_type="${3:-application/javascript}"

  if [ ! -f "$src" ]; then
    echo "Error: expected build artifact not found: ${src}" >&2
    exit 1
  fi

  echo "  ${dest}"

  aws s3 cp "$src" "${BASE_PATH}/v${VERSION}/${dest}" \
    --endpoint-url "${B2_ENDPOINT}" \
    --content-type "${content_type}" \
    --cache-control "public, max-age=31536000, immutable" \
    --only-show-errors

  aws s3 cp "$src" "${BASE_PATH}/latest/${dest}" \
    --endpoint-url "${B2_ENDPOINT}" \
    --content-type "${content_type}" \
    --cache-control "public, max-age=3600" \
    --only-show-errors
}

# Every bundle, chunk and stylesheet the build produced, by glob.
#
# This used to be a hand-written list of six bundles plus hls.js. Rollup emits
# a chunk per lazily imported module, so the audio build has always produced a
# SECOND chunk (the @scarlett-player/ui control registry the playlist plugin
# pulls in through a dynamic import), which the list did not name. It was named
# hls2.js by the old fixed chunkFileNames and never uploaded, so embed.audio.js
# on the CDN imported a URL that 404s. That shipped from the v1.6.0 release on
# 2026-08-11, the first release containing the dynamic import (commit 55cf252),
# and was still reproducible on 2026-09-02 against v1.6.0, v1.7.0 and latest.
# The playlist plugin catches the failed import and logs, so the audio embed
# lost its prev/next controls in silence. The chunk is now named
# embed.audio.index.js and this glob picks it up.
#
# A hand list can only ever describe the build that existed when it was
# written. The glob describes the build that just ran, and
# scripts/check-embed-chunks.mjs proves the set is internally complete before
# anything is uploaded.
#
# Source maps stay off the CDN, as before. The .map files are 2 MB and up, they
# are shipped in the npm tarball for anyone who wants them, and nothing on the
# CDN references them.
uploaded=0
for src in "${DIST}"/*.js "${DIST}"/*.cjs "${DIST}"/*.css; do
  [ -e "$src" ] || continue

  name="$(basename "$src")"

  # Source maps are excluded by the globs themselves: embed.js.map ends in
  # .map, not .js, so it is never matched.
  case "$name" in
    *.css) content_type="text/css" ;;
    *) content_type="application/javascript" ;;
  esac

  upload "$src" "$name" "$content_type"
  uploaded=$((uploaded + 1))
done

# A glob that matches nothing expands to itself, and `[ -e ]` then skips every
# iteration. Without this the script would report a cheerful success having
# uploaded nothing at all.
if [ "$uploaded" -eq 0 ]; then
  echo "Error: no .js, .cjs or .css files in ${DIST}. Run 'pnpm run build' first." >&2
  exit 1
fi

# iframe embed page
upload "packages/embed/iframe.html" "iframe.html" "text/html"

if [ "$SKIP_VERIFY" != "1" ]; then
  verify
fi

done_message "Done."
