#!/bin/bash
# Upload Scarlett Player to MinIO CDN
# Usage: ./scripts/upload-cdn.sh

set -e

# Configuration
MINIO_ENDPOINT="${MINIO_ENDPOINT:-}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-}"
MINIO_BUCKET="${MINIO_BUCKET:-}"

VERSION=$(node -p "require('./packages/embed/package.json').version")

echo "Uploading Scarlett Player v${VERSION} to CDN..."

if [ -z "$MINIO_ENDPOINT" ] || [ -z "$MINIO_ACCESS_KEY" ] || [ -z "$MINIO_SECRET_KEY" ] || [ -z "$MINIO_BUCKET" ]; then
    echo "Error: Missing environment variables."
    echo "Set: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET"
    exit 1
fi

if [ ! -d "packages/embed/dist" ]; then
    echo "Error: packages/embed/dist not found. Run 'pnpm run build' first."
    exit 1
fi

export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"

BASE_PATH="s3://${MINIO_BUCKET}/scarlett-player"
DIST="packages/embed/dist"
TMP_DIR=$(mktemp -d)

# Upload gzipped file with clean name
upload() {
    local src="$1"
    local dest="$2"
    local gzipped="${TMP_DIR}/${dest}"

    # Gzip the file
    mkdir -p "$(dirname "$gzipped")"
    gzip -9 -c "$src" > "$gzipped"

    local original_size=$(wc -c < "$src" | tr -d ' ')
    local gzipped_size=$(wc -c < "$gzipped" | tr -d ' ')
    echo "  ${dest} (${gzipped_size} bytes gzipped, was ${original_size})"

    # Upload to versioned path (immutable, 1 year cache)
    aws s3 cp "$gzipped" "${BASE_PATH}/v${VERSION}/${dest}" \
        --endpoint-url "${MINIO_ENDPOINT}" \
        --content-type "application/javascript" \
        --content-encoding "gzip" \
        --cache-control "public, max-age=31536000, immutable" \
        --quiet

    # Upload to latest path (1 hour cache)
    aws s3 cp "$gzipped" "${BASE_PATH}/latest/${dest}" \
        --endpoint-url "${MINIO_ENDPOINT}" \
        --content-type "application/javascript" \
        --content-encoding "gzip" \
        --cache-control "public, max-age=3600" \
        --quiet
}

echo "Uploading to v${VERSION}/ and latest/..."

# Video players (UMD builds with clean names)
upload "${DIST}/embed.umd.cjs" "embed.js"
upload "${DIST}/embed.light.umd.cjs" "embed.light.js"
upload "${DIST}/embed.full.umd.cjs" "embed.full.js"

# Audio players
upload "${DIST}/embed.audio.umd.cjs" "embed.audio.js"
upload "${DIST}/embed.audio.light.umd.cjs" "embed.audio.light.js"

# HLS chunks (for ES module usage)
HLS_FILE=$(ls ${DIST}/hls-*.js 2>/dev/null | head -1)
if [ -n "$HLS_FILE" ]; then
    upload "$HLS_FILE" "hls.js"
fi

HLS_LIGHT_FILE=$(ls ${DIST}/hls.light-*.js 2>/dev/null | head -1)
if [ -n "$HLS_LIGHT_FILE" ]; then
    upload "$HLS_LIGHT_FILE" "hls.light.js"
fi

# Cleanup
rm -rf "$TMP_DIR"

echo ""
echo "Done! CDN URLs:"
echo "  https://assets.thestreamplatform.com/scarlett-player/latest/embed.js"
echo "  https://assets.thestreamplatform.com/scarlett-player/v${VERSION}/embed.js"
