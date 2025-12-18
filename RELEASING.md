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

### GitHub Secret: Forge Webhook

Configure in **GitHub → Settings → Secrets → Actions**:

| Secret | Description |
|--------|-------------|
| `FORGE_WEBHOOK_URL` | Laravel Forge deploy webhook URL |

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

## Changeset Types

| Type | When to Use |
|------|-------------|
| `patch` | Bug fixes, documentation, internal changes |
| `minor` | New features, non-breaking changes |
| `major` | Breaking changes, API changes |

## Workflow Diagram

```
Feature Branch           main Branch              npm + Forge
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
