# Scarlett Player - Development Guidelines

**Last Updated**: September 2, 2026

Companion documents: `docs/architecture.md` (how the player is put together)
and `docs/plugin-authoring.md` (writing a plugin package).

## Code Standards

### TypeScript

**Required**:
- All code must be TypeScript
- Strict mode enabled
- Prefer `unknown` over `any`. The exceptions in the tree are deliberate and
  local: the duck-typed provider calls in `ScarlettPlayer` (`getLevels`,
  `setLevel`, `getLiveInfo`, `loadSource`) and third-party globals such as the
  Cast SDK. Keep the cast at the call site and say why in a comment
- Explicit return types for public APIs
- TSDoc on every exported function, class and public method, with the reasoning
  when the behaviour is not obvious from the code

**Example**:
```typescript
/**
 * Loads a media source into the player
 * @param src - The source URL or object
 * @returns Promise that resolves when source is loaded
 */
public async loadSource(src: string | SourceObject): Promise<void> {
  // Implementation
}
```

### Naming Conventions

**Classes**: PascalCase
```typescript
class PluginManager { }
class HLSPlugin { }
```

**Interfaces/Types**: PascalCase with descriptive names
```typescript
interface PluginAPI { }
type EventHandler = (data: any) => void;
```

**Functions/Methods**: camelCase
```typescript
function loadSource() { }
private setupPlugin() { }
```

**Constants**: UPPER_SNAKE_CASE
```typescript
const MAX_RETRY_COUNT = 3;
const DEFAULT_VOLUME = 1.0;
```

**Files**: kebab-case
```
plugin-manager.ts
event-bus.ts
hls-provider.ts
```

**Packages**: kebab-case with scope, and the scope carries no `plugin-` prefix
```
@scarlett-player/core
@scarlett-player/hls
@scarlett-player/media-session
```

### Code Organization

**File Structure**:
```
package/
├── src/
│   ├── index.ts          # Public exports
│   ├── types.ts          # TypeScript types
│   ├── *.ts              # Implementation files
├── tests/
│   └── *.test.ts         # Test files
├── package.json
├── tsconfig.json         # Build config; excludes tests
├── tsconfig.typecheck.json  # Optional: adds type-contract tests to the program
├── vitest.config.ts
└── README.md
```

`package.json` must declare a `typecheck` and a `test` script.
`scripts/check-package-scripts.mjs` fails CI otherwise, because pnpm's
recursive run silently skips a package that has neither.

**Imports Order**:
1. External dependencies
2. Internal imports from core
3. Relative imports

```typescript
// External
import { createScope } from 'some-library';

// Internal core
import type { IPluginAPI, Plugin } from '@scarlett-player/core';

// Relative
import { HLSConfig } from './types';
import { loadLibrary } from './lib-loader';
```

### Error Handling

**Always use Error objects**:
```typescript
// Good
throw new Error('Failed to load source');

// Bad
throw 'Failed to load source';
```

**Custom error classes for specific errors**:
```typescript
class PluginError extends Error {
  constructor(
    public pluginName: string,
    message: string,
    public cause?: Error
  ) {
    super(`[${pluginName}] ${message}`);
    this.name = 'PluginError';
  }
}
```

**Try-catch for async operations**:
```typescript
async loadSource(src: string): Promise<void> {
  try {
    const response = await fetch(src);
    // ...
  } catch (error) {
    this.handleError(error);
    throw new PluginError('hls', 'Failed to load manifest', error);
  }
}
```

### Testing Requirements

**Unit Tests**:
- Every public method must have tests
- Test happy path and error cases
- Mock external dependencies

**Test File Naming**: `*.test.ts`

**Example**:
```typescript
import { describe, it, expect } from 'vitest';
import { EventBus, Logger, PluginManager, StateManager } from '@scarlett-player/core';

describe('PluginManager', () => {
  const build = () =>
    new PluginManager(new EventBus(), new StateManager(), new Logger(), {
      container: document.createElement('div'),
    });

  const plugin = {
    id: 'test',
    name: 'Test',
    version: '1.0.0',
    type: 'feature' as const,
    init: () => {},
    destroy: () => {},
  };

  it('registers a plugin', () => {
    const manager = build();

    manager.register(plugin);

    expect(manager.hasPlugin('test')).toBe(true);
    expect(manager.getPluginState('test')).toBe('registered');
  });

  it('rejects a duplicate plugin id', () => {
    const manager = build();

    manager.register(plugin);

    expect(() => manager.register(plugin)).toThrow('is already registered');
  });
});
```

Plugins are tested against a mock `IPluginAPI`, one typed helper per package
rather than a cast at every call site.

### Documentation

**README.md Required**:
Every package must have:
- Installation instructions
- Usage examples
- API documentation link
- License

**TSDoc for Public APIs**:
```typescript
/**
 * Create an HLS provider plugin.
 *
 * @param config - Plugin configuration
 * @returns Plugin instance to hand to the player
 *
 * @example
 * ```typescript
 * const player = await createPlayer({
 *   container: '#video',
 *   src: 'https://example.com/video.m3u8',
 *   plugins: [createHLSPlugin()],
 * });
 * ```
 */
export function createHLSPlugin(config: HLSPluginConfig = {}): Plugin {
  // ...
}
```

Every example in a docblock or a README constructs the player with
`createPlayer()`.

**CHANGELOG.md**:
Keep a changelog for each package following [Keep a Changelog](https://keepachangelog.com/) format.

## Plugin Development Guidelines

`docs/plugin-authoring.md` is the full guide: events, state keys, control-bar
controls, and the checklist for a new package. The shape in short:

### Plugin Structure

```typescript
import type { IPluginAPI, Plugin, PluginType } from '@scarlett-player/core';

export interface MyPluginConfig {
  option1?: string;
  option2?: number;
  [key: string]: unknown;
}

const DEFAULT_CONFIG: MyPluginConfig = { option1: 'a' };

export function createMyPlugin(config: MyPluginConfig = {}): Plugin {
  const merged = { ...DEFAULT_CONFIG, ...config };
  let api: IPluginAPI | null = null;

  return {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    type: 'feature' as PluginType,

    init(pluginApi: IPluginAPI): void {
      api = pluginApi;

      // Register any state key this plugin owns, before first use
      api.defineState('myPluginActive', false);

      // Subscribe to events; on() returns an unsubscribe function
      api.onDestroy(api.on('playback:play', handlePlay));
      api.onDestroy(api.on('playback:pause', handlePause));

      // Every state change, as a StateChangeEvent
      api.onDestroy(api.subscribeToState(handleStateChange));
    },

    destroy(): void {
      api = null;
    },
  };
}
```

The lifecycle hook is `init(api)`. There is no `setup` hook, and `destroy()` is
required, not optional. Factory functions (`createMyPlugin()`) are the convention across the
workspace; a class is fine as long as it satisfies the same `Plugin` interface.
`IPluginAPI` is the type a plugin is handed; `PluginAPI` is core's concrete
implementation and plugins should not depend on it.

### Plugin Best Practices

1. **Always cleanup in destroy()**
   - Remove event listeners
   - Clear timers/intervals
   - Destroy DOM elements
   - Release resources

2. **Use arrow functions for event handlers**
   - Preserves `this` context
   - Easier to remove listeners

3. **Validate configuration**
   ```typescript
   constructor(config: PluginConfig) {
     if (config.timeout < 0) {
       throw new Error('timeout must be >= 0');
     }
     this.config = config;
   }
   ```

4. **Emit events for plugin actions**, namespaced with the plugin id and
   declared by merging into `PlayerEventMap`
   ```typescript
   declare module '@scarlett-player/core' {
     interface PlayerEventMap {
       'myplugin:actionCompleted': { data: string };
     }
   }

   api.emit('myplugin:actionCompleted', { data: 'value' });
   ```

5. **Handle errors gracefully.** The `error` payload is a structured
   `PlayerError`, so emit one or let the player's `ErrorHandler` build it
   ```typescript
   try {
     await doSomething();
   } catch (error) {
     api.emit('error', {
       code: ErrorCode.PLUGIN_SETUP_FAILED,
       message: (error as Error).message,
       fatal: false,
       timestamp: Date.now(),
     });
     // Don't throw, let the player continue
   }
   ```

## Git Workflow

### Branch Naming

- `main` - the only long-lived branch; everything merges here
- `feat/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Refactoring
- `docs/description` - Documentation

`changeset-release/main` is created and owned by the release automation. Do not
branch from it or push to it.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build/tooling

**Examples**:
```
feat(core): add plugin priority system
fix(hls): resolve memory leak in event listeners
docs(api): update plugin API documentation
test(core): add PluginManager integration tests
```

### Pull Request Process

1. Create a branch from `main`
2. Make changes with tests
3. Update the documentation and the package README the change affects
4. Add a changeset (`pnpm changeset`) for anything that reaches a published
   package. Versions are never hand-edited: the group is fixed, so every package
   publishes at one version
5. Run `pnpm validate` (package-script guard, lint, typecheck, test, build)
6. Open a PR against `main`
7. Address review comments
8. Merge when approved

Never commit `demo/demo.bundle.js` or `docs/demo/demo.bundle.js`. The release
workflow rebuilds and commits both on every push to `main`, so a bundle
committed from a branch only produces binary merge conflicts with that commit.
Build it locally to preview, then leave it out of the PR. Do not gitignore it
either: the deployed `index.html` is stamped with a version and points at a file
that has to exist in the repo.

## Code Review Checklist

**Before Requesting Review**:
- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New code has tests (80%+ coverage)
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] TypeScript strict mode passes
- [ ] Build succeeds

**Reviewers Check**:
- [ ] Code is understandable
- [ ] Edge cases handled
- [ ] Error handling appropriate
- [ ] Performance considered
- [ ] Security concerns addressed
- [ ] Consistent with architecture
- [ ] Tests are meaningful

## Performance Guidelines

### Bundle Size

- Tree-shakeable exports; no side effects at module scope beyond control
  registration
- No circular dependencies
- Heavy dependencies load lazily. hls.js is fetched through a dynamic import
  inside `loadHlsJs()`, and the playlist plugin reaches the UI package with
  `void import('@scarlett-player/ui')` so it still works when that package is
  absent
- Watch the sizes Vite and tsup print during `pnpm build` rather than adding a
  budget nobody enforces

### Runtime Performance

- Use `requestAnimationFrame` for animations
- Debounce high-frequency events
- Avoid unnecessary re-renders
- Lazy load heavy dependencies

**Example**:
```typescript
// Debounce resize handler
private handleResize = debounce(() => {
  this.updateLayout();
}, 150);
```

### Memory Management

- Clean up event listeners
- Clear timers and intervals
- Remove DOM references
- Avoid memory leaks

Prefer `api.onDestroy(unsubscribe)` at the point of subscription over
remembering to undo each one in `destroy()`: `PluginManager` runs those cleanups
for you when the plugin is destroyed.

```typescript
destroy(): void {
  // Clear timers
  clearInterval(interval);

  // Remove DOM
  element?.remove();

  // Clear references
  api = null;
  element = null;
}
```

## Security Guidelines

### Input Validation

```typescript
loadSource(src: string | SourceObject): void {
  // Validate URL
  if (typeof src === 'string' && !this.isValidUrl(src)) {
    throw new Error('Invalid source URL');
  }

  // Sanitize if needed
  const sanitized = this.sanitizeUrl(src);
}
```

### XSS Prevention

- Never use `innerHTML` with user content
- Always sanitize URLs
- Use textContent instead of innerHTML

```typescript
// Bad
element.innerHTML = userInput;

// Good
element.textContent = userInput;
```

### CSP Compliance

Plugins must document required CSP directives:

```typescript
/**
 * Required CSP:
 * - script-src: For HLS.js loading
 * - media-src: For media sources
 * - connect-src: For manifest fetching
 */
```

## Accessibility Guidelines

**WCAG 2.1 Level AA Required**

### Keyboard Navigation

- All controls keyboard accessible
- Logical tab order
- Visible focus indicators
- Keyboard shortcuts documented

### ARIA Attributes

```typescript
button.setAttribute('aria-label', 'Play video');
button.setAttribute('aria-pressed', 'false');
slider.setAttribute('aria-valuemin', '0');
slider.setAttribute('aria-valuemax', '100');
slider.setAttribute('aria-valuenow', '50');
```

### Screen Readers

- Meaningful labels
- Status announcements
- Error messages

```typescript
// Announce state change
const liveRegion = document.createElement('div');
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.setAttribute('aria-atomic', 'true');
liveRegion.textContent = 'Video playing';
```

## Version Guidelines

**Semantic Versioning** (SemVer), applied through Changesets in fixed mode: all
seventeen packages share one version number, so a release publishes them
together even where a package did not change.

- MAJOR: Breaking changes
- MINOR: New features (backwards compatible)
- PATCH: Bug fixes

**Pre-release versions**:
- `0.x.x` - Initial development
- `1.0.0-alpha.1` - Alpha
- `1.0.0-beta.1` - Beta
- `1.0.0-rc.1` - Release candidate
- `1.0.0` - Stable

## License Guidelines

**MIT License** for all packages

Include attribution for Vidstack:
```
Portions of this software were inspired by Vidstack Player
Copyright (c) 2023 Rahim Alwer
MIT License - https://github.com/vidstack/player
```

## Questions?

When in doubt:
1. Read `docs/architecture.md` for how the pieces fit together
2. Read `docs/plugin-authoring.md` if the change is a plugin
3. Read the existing code: it is the specification, and a claim about how the
   player behaves is not worth making until it has been checked against the
   source
4. Reference Vidstack for patterns (not implementation)
