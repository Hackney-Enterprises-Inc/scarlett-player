# Testing Guide

Quick reference for running tests in the Scarlett Player workspace.

## Run All Tests

From the workspace root:

```bash
pnpm test
```

## Run Tests by Package

```bash
# Core package
pnpm --filter @scarlett-player/core test

# Embed package (NEW)
pnpm --filter @scarlett-player/embed test

# HLS plugin
pnpm --filter @scarlett-player/hls test

# UI plugin
pnpm --filter @scarlett-player/ui test
```

## Run Tests Directly (without pnpm workspace)

```bash
# Core
cd packages/core && npx vitest run

# Embed (NEW)
cd packages/embed && npx vitest run --config vitest.config.ts

# HLS
cd packages/plugins/hls && npx vitest run --config vitest.config.ts

# UI
cd packages/plugins/ui && npx vitest run --config vitest.config.ts
```

## Watch Mode

```bash
# Watch all changes
pnpm test:watch

# Or specific package
cd packages/embed && npx vitest
```

## Coverage Reports

```bash
# With pnpm
pnpm --filter @scarlett-player/embed test:coverage

# Direct
cd packages/embed && npx vitest run --coverage
```

## New Tests Added

### @scarlett-player/embed (71 tests)

**Parser Tests** (`tests/parser.test.ts` - 43 tests)
- Data attribute parsing
- Boolean/string/number attributes
- Aspect ratio calculations
- Container styling

**Embed API Tests** (`tests/embed.test.ts` - 28 tests)
- `createEmbedPlayer()` - Create player with config
- `initElement()` - Initialize from DOM
- `initAll()` - Auto-init all players
- `create()` - Programmatic API

### @scarlett-player/hls (45 new tests)

**URL Detection Tests** (`tests/canPlay.test.ts` - 45 tests)
- .m3u8 file detection
- MIME type detection
- Non-HLS rejection
- Edge cases

## Test Results Summary

| Package | Tests | Pass | Status |
|---------|-------|------|--------|
| core    | 457   | 456  | ✅ 99.8% |
| embed   | 71    | 71   | ✅ 100% |
| hls     | 127   | 111  | ⚠️ 87.4% |
| ui      | 66    | 46   | ⚠️ 69.7% |

Total: **700+ tests** across the workspace

## Quick Test Commands

```bash
# Just run embed tests (fastest)
cd packages/embed && npx vitest run

# Run with output
cd packages/embed && npx vitest run --reporter=verbose

# Run specific test file
cd packages/embed && npx vitest run tests/parser.test.ts

# Run tests matching pattern
cd packages/embed && npx vitest run -t "parseDataAttributes"
```

## Troubleshooting

**"pnpm: command not found"**
- Install pnpm: `npm install -g pnpm`
- Or use npx: `npx pnpm test`

**"vitest: command not found"**
- Run from package directory: `cd packages/embed && npx vitest run`

**Tests fail to import modules**
- Make sure dependencies are installed: `pnpm install`
- Check that you're in the correct package directory

## CI/CD Integration

To run tests in CI:

```yaml
# GitHub Actions example
- name: Install dependencies
  run: pnpm install

- name: Run tests
  run: pnpm test

- name: Generate coverage
  run: pnpm --filter './packages/**' run test:coverage
```

## Next Steps

1. Fix failing tests in HLS and UI packages
2. Add integration tests
3. Set up coverage thresholds
4. Add E2E tests with Playwright
5. Configure pre-commit hooks to run tests
