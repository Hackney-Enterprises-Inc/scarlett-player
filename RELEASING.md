# Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for automated versioning and releases.

## Quick Start

### 1. Make Changes

Create a branch, make your changes, and add a changeset:

```bash
# Create a changeset describing your changes
pnpm changeset
```

This will prompt you to:
- Select which packages are affected
- Choose the bump type (patch/minor/major)
- Write a summary of the changes

### 2. Create Pull Request

Push your branch and create a PR to `main`. The CI will run tests automatically.

### 3. Merge PR

Once approved and CI passes, merge your PR.

### 4. Automated Release

When changes with changesets are merged to `main`:

1. **Changesets Action** creates a "Release PR" that:
   - Bumps all package versions
   - Updates CHANGELOGs
   - Removes consumed changeset files

2. **When you merge the Release PR**:
   - Packages are published to npm
   - CDN files uploaded to S3
   - Forge webhook triggers website deployment
   - GitHub Release is created with tags

## Manual Commands

```bash
# Add a new changeset
pnpm changeset

# Preview version bumps (dry run)
pnpm changeset status

# Apply version bumps locally (usually done by CI)
pnpm version

# Build and publish (usually done by CI)
pnpm release
```

## Required Setup

### npm Trusted Publishing (OIDC)

This project uses npm's trusted publishing, which is more secure than token-based auth.

**Already configured on npm.** No `NPM_TOKEN` secret needed!

If you need to reconfigure:
1. Go to [npmjs.com](https://www.npmjs.com) → Package Settings
2. Configure "Trusted Publishing" for GitHub Actions
3. Set workflow filename: `release.yml`
4. Set repository: `Hackney-Enterprises-Inc/scarlett-player`

### GitHub Secrets & Variables

Configure in **GitHub → Settings → Secrets and Variables → Actions**:

#### Secrets

| Secret | Description |
|--------|-------------|
| `FORGE_WEBHOOK_URL` | Laravel Forge deploy webhook URL |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_BUCKET` | MinIO bucket name |
| `MINIO_ENDPOINT` | MinIO endpoint URL (e.g., `https://s3.example.com`) |

#### Variables (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `CDN_BASE_URL` | CDN base URL for summary | `https://cdn.example.com` |

### MinIO S3 CDN Setup

The release workflow uploads the embed bundle to MinIO for CDN distribution:

```
s3://your-bucket/scarlett-player/
├── v0.1.1/                    # Versioned (immutable, 1 year cache)
│   ├── scarlett-player.js     # ES module
│   ├── scarlett-player.umd.js # UMD for <script> tags
│   └── hls.js                 # HLS.js chunk
└── latest/                    # Latest version (1 hour cache)
    ├── scarlett-player.js
    ├── scarlett-player.umd.js
    └── hls.js
```

**MinIO Policy** (minimum required permissions):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::your-bucket/scarlett-player/*"
    }
  ]
}
```

### Forge Webhook

**Getting Forge Webhook URL:**
1. Go to Laravel Forge → Your Site → Deployments
2. Copy the "Deployment Trigger URL"
3. Add as `FORGE_WEBHOOK_URL` secret in GitHub

## Version Strategy

All packages are versioned together (fixed versioning). When any package changes, all packages get the same version number. This keeps versions synchronized across:

- `@scarlett-player/core`
- `@scarlett-player/embed`
- `@scarlett-player/vue`
- `@scarlett-player/hls`
- `@scarlett-player/ui`
- `@scarlett-player/native`
- `@scarlett-player/airplay`
- `@scarlett-player/chromecast`
- `@scarlett-player/analytics`
- `@scarlett-player/playlist`
- `@scarlett-player/media-session`
- `@scarlett-player/audio-ui`

## Changeset Types

| Type | When to Use |
|------|-------------|
| `patch` | Bug fixes, documentation, internal changes |
| `minor` | New features, non-breaking changes |
| `major` | Breaking changes, API changes |

## Workflow Diagram

```
Feature Branch           main Branch              Deployments
      │                       │                        │
      │  Create PR            │                        │
      ├──────────────────────►│                        │
      │                       │                        │
      │  CI Tests ✓           │                        │
      │◄──────────────────────┤                        │
      │                       │                        │
      │  Merge PR             │                        │
      ├──────────────────────►│                        │
      │                       │                        │
      │                       │  Changesets creates    │
      │                       │  "Release PR"          │
      │                       │                        │
      │                       │  Merge Release PR      │
      │                       ├───────────────────────►│
      │                       │                        │
      │                       │     npm publish        │
      │                       │     S3 CDN upload      │
      │                       │     Forge deploy       │
      │                       │     GitHub Release     │
```

## Troubleshooting

### "No changesets found"

You need to add a changeset before the release PR can be created:

```bash
pnpm changeset
```

### npm publish fails

- Check trusted publishing is configured on npm for all packages
- Ensure package names are available on npm
- Verify workflow has `id-token: write` permission

### Forge webhook fails

- Verify `FORGE_WEBHOOK_URL` is correct
- Check Forge deployment logs
- The workflow continues even if webhook fails

### MinIO CDN upload fails

- Verify MinIO credentials are correct (`MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`)
- Check the MinIO user has `s3:PutObject` permission for the bucket
- Verify `MINIO_BUCKET` and `MINIO_ENDPOINT` secrets are set correctly
- Check the bucket exists and is accessible from GitHub Actions
- Ensure the endpoint URL includes the protocol (e.g., `https://s3.example.com`)

## CDN Usage

After release, the player is available via CDN:

```html
<!-- Full build (with subtitles, DRM, ID3 support) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/v0.1.1/embed.umd.cjs"></script>

<!-- Light build (~30% smaller, excludes subtitles/DRM/ID3) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/v0.1.1/embed.light.umd.cjs"></script>

<!-- Use latest version (always gets newest release) -->
<script src="https://assets.thestreamplatform.com/scarlett-player/latest/embed.umd.cjs"></script>

<!-- Initialize -->
<div data-scarlett-player data-src="https://example.com/video.m3u8"></div>
```

### Bundle Variants

| Variant | Size (gzip) | Features |
|---------|-------------|----------|
| `embed.umd.cjs` | ~177KB | Full hls.js with subtitles, DRM, ID3 |
| `embed.light.umd.cjs` | ~124KB | hls.js/light (no subtitles/DRM/ID3) |
