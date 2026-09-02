#!/usr/bin/env bash
#
# Publish the built embed bundles to TSP Assets, the platform asset CDN at
# assets.thestreamplatform.com (the tsp-assets bucket on Backblaze B2, fronted
# by Fastly).
#
# Usage:
#   doppler run -- ./scripts/upload-cdn.sh            # version from packages/embed
#   doppler run -- ./scripts/upload-cdn.sh 1.1.1      # explicit version
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

VERSION="${1:-$(node -p "require('./packages/embed/package.json').version")}"

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

# Prove the CDN is serving what we just wrote. A publish that uploads to the
# wrong bucket, or to a bucket nothing fronts, otherwise looks like a success.
if [ "${SKIP_VERIFY:-0}" != "1" ]; then
  echo ""
  echo "Verifying..."
  for path in "v${VERSION}/embed.umd.cjs" "latest/embed.umd.cjs"; do
    status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "${CDN_BASE}/${path}")
    echo "  ${path} -> ${status}"
    if [ "$status" != "200" ]; then
      echo "Error: CDN did not serve ${path} (HTTP ${status})" >&2
      exit 1
    fi
  done
fi

echo ""
echo "Done. CDN URLs:"
echo "  ${CDN_BASE}/v${VERSION}/embed.umd.cjs"
echo "  ${CDN_BASE}/latest/embed.umd.cjs"
