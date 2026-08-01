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

# Full build (default, includes everything)
upload "${DIST}/embed.js" "embed.js"
upload "${DIST}/embed.umd.cjs" "embed.umd.cjs"

# Video-only build (lightweight)
upload "${DIST}/embed.video.js" "embed.video.js"
upload "${DIST}/embed.video.umd.cjs" "embed.video.umd.cjs"

# Audio-only build
upload "${DIST}/embed.audio.js" "embed.audio.js"
upload "${DIST}/embed.audio.umd.cjs" "embed.audio.umd.cjs"

# HLS chunk (dynamically loaded by the ESM builds)
upload "${DIST}/hls.js" "hls.js"

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
