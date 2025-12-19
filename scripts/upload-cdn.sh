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

echo "Uploading Scarlett Player v${VERSION} to MinIO CDN..."

# Check required variables
if [ -z "$MINIO_ENDPOINT" ] || [ -z "$MINIO_ACCESS_KEY" ] || [ -z "$MINIO_SECRET_KEY" ] || [ -z "$MINIO_BUCKET" ]; then
    echo "Error: Missing required environment variables."
    echo "Please set: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET"
    echo ""
    echo "Example:"
    echo "  export MINIO_ENDPOINT=https://s3.example.com"
    echo "  export MINIO_ACCESS_KEY=your-access-key"
    echo "  export MINIO_SECRET_KEY=your-secret-key"
    echo "  export MINIO_BUCKET=your-bucket"
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

# Upload to versioned path (immutable, 1 year cache)
echo "Uploading to s3://${MINIO_BUCKET}/scarlett-player/v${VERSION}/..."

aws s3 cp packages/embed/dist/embed.js "s3://${MINIO_BUCKET}/scarlett-player/v${VERSION}/scarlett-player.js" \
    --endpoint-url "${MINIO_ENDPOINT}" \
    --content-type "application/javascript" \
    --cache-control "public, max-age=31536000, immutable"

aws s3 cp packages/embed/dist/embed.umd.cjs "s3://${MINIO_BUCKET}/scarlett-player/v${VERSION}/scarlett-player.umd.js" \
    --endpoint-url "${MINIO_ENDPOINT}" \
    --content-type "application/javascript" \
    --cache-control "public, max-age=31536000, immutable"

# Upload HLS chunk (find the hashed filename)
HLS_FILE=$(ls packages/embed/dist/hls-*.js 2>/dev/null | head -1)
if [ -n "$HLS_FILE" ]; then
    aws s3 cp "$HLS_FILE" "s3://${MINIO_BUCKET}/scarlett-player/v${VERSION}/hls.js" \
        --endpoint-url "${MINIO_ENDPOINT}" \
        --content-type "application/javascript" \
        --cache-control "public, max-age=31536000, immutable"
fi

# Upload to latest path (shorter cache for updates)
echo "Uploading to s3://${MINIO_BUCKET}/scarlett-player/latest/..."

aws s3 cp packages/embed/dist/embed.js "s3://${MINIO_BUCKET}/scarlett-player/latest/scarlett-player.js" \
    --endpoint-url "${MINIO_ENDPOINT}" \
    --content-type "application/javascript" \
    --cache-control "public, max-age=3600"

aws s3 cp packages/embed/dist/embed.umd.cjs "s3://${MINIO_BUCKET}/scarlett-player/latest/scarlett-player.umd.js" \
    --endpoint-url "${MINIO_ENDPOINT}" \
    --content-type "application/javascript" \
    --cache-control "public, max-age=3600"

if [ -n "$HLS_FILE" ]; then
    aws s3 cp "$HLS_FILE" "s3://${MINIO_BUCKET}/scarlett-player/latest/hls.js" \
        --endpoint-url "${MINIO_ENDPOINT}" \
        --content-type "application/javascript" \
        --cache-control "public, max-age=3600"
fi

echo ""
echo "✅ Upload complete!"
echo ""
echo "CDN URLs:"
echo "  Versioned: ${MINIO_ENDPOINT}/${MINIO_BUCKET}/scarlett-player/v${VERSION}/scarlett-player.umd.js"
echo "  Latest:    ${MINIO_ENDPOINT}/${MINIO_BUCKET}/scarlett-player/latest/scarlett-player.umd.js"
