#!/bin/bash
# Upload Scarlett Player to MinIO CDN
# Usage: ./scripts/upload-cdn.sh

set -e

# Configuration - set these environment variables or edit directly
MINIO_ENDPOINT="${MINIO_ENDPOINT:-}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-}"
MINIO_BUCKET="${MINIO_BUCKET:-}"

# Get version from package.json
VERSION=$(node -p "require('./packages/embed/package.json').version")

echo "Uploading Scarlett Player v${VERSION} to CDN..."

# Check required variables
if [ -z "$MINIO_ENDPOINT" ] || [ -z "$MINIO_ACCESS_KEY" ] || [ -z "$MINIO_SECRET_KEY" ] || [ -z "$MINIO_BUCKET" ]; then
    echo "Error: Missing required environment variables."
    echo "Please set: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET"
    exit 1
fi

# Check if dist exists
if [ ! -d "packages/embed/dist" ]; then
    echo "Error: packages/embed/dist not found. Run 'pnpm run build' first."
    exit 1
fi

# Set AWS credentials for MinIO
export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"

BASE_PATH="s3://${MINIO_BUCKET}/scarlett-player"

# Upload a file to both versioned and latest paths
upload() {
    local src="$1"
    local dest="$2"
    echo "  ${dest}"

    # Versioned (immutable, 1 year cache)
    aws s3 cp "$src" "${BASE_PATH}/v${VERSION}/${dest}" \
        --endpoint-url "${MINIO_ENDPOINT}" \
        --content-type "application/javascript" \
        --cache-control "public, max-age=31536000, immutable" \
        --quiet

    # Latest (1 hour cache)
    aws s3 cp "$src" "${BASE_PATH}/latest/${dest}" \
        --endpoint-url "${MINIO_ENDPOINT}" \
        --content-type "application/javascript" \
        --cache-control "public, max-age=3600" \
        --quiet
}

echo "Uploading to v${VERSION}/ and latest/..."

# Default build
upload "packages/embed/dist/embed.js" "embed.js"
upload "packages/embed/dist/embed.umd.cjs" "embed.umd.cjs"

# Light build
upload "packages/embed/dist/embed.light.js" "embed.light.js"
upload "packages/embed/dist/embed.light.umd.cjs" "embed.light.umd.cjs"

# Full build
upload "packages/embed/dist/embed.full.js" "embed.full.js"
upload "packages/embed/dist/embed.full.umd.cjs" "embed.full.umd.cjs"

# Audio build
upload "packages/embed/dist/embed.audio.js" "embed.audio.js"
upload "packages/embed/dist/embed.audio.umd.cjs" "embed.audio.umd.cjs"

# Audio-Light build
upload "packages/embed/dist/embed.audio.light.js" "embed.audio.light.js"
upload "packages/embed/dist/embed.audio.light.umd.cjs" "embed.audio.light.umd.cjs"

# HLS chunks
HLS_FILE=$(ls packages/embed/dist/hls-*.js 2>/dev/null | head -1)
if [ -n "$HLS_FILE" ]; then
    upload "$HLS_FILE" "hls.js"
fi

HLS_LIGHT_FILE=$(ls packages/embed/dist/hls.light-*.js 2>/dev/null | head -1)
if [ -n "$HLS_LIGHT_FILE" ]; then
    upload "$HLS_LIGHT_FILE" "hls.light.js"
fi

echo ""
echo "Done! Uploaded to:"
echo "  /scarlett-player/v${VERSION}/"
echo "  /scarlett-player/latest/"
