# Scarlett Player - Development Guidelines

**Last Updated**: October 10, 2025

## Code Standards

### TypeScript

**Required**:
- All code must be TypeScript
- Strict mode enabled
- No `any` types (use `unknown` if needed)
- Explicit return types for public APIs
- JSDoc comments for public APIs

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

**Packages**: kebab-case with scope
```
@scarlett-player/core
@scarlett-player/plugin-hls
```

### Code Organization

**File Structure**:
```
package/
├── src/
│   ├── index.ts          # Public exports
│   ├── types.ts          # TypeScript types
│   ├── constants.ts      # Constants
│   ├── *.ts              # Implementation files
│   └── utils/            # Utility functions
├── tests/
│   ├── *.test.ts         # Test files
│   └── fixtures/         # Test fixtures
├── package.json
├── tsconfig.json
└── README.md
```

**Imports Order**:
1. External dependencies
2. Internal imports from core
3. Relative imports

```typescript
// External
import { createScope } from 'some-library';

// Internal core
import { Plugin, PluginAPI } from '@scarlett-player/core';

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
import { describe, it, expect, vi } from 'vitest';
import { PluginManager } from './plugin-manager';

describe('PluginManager', () => {
  it('should register a plugin', () => {
    const manager = new PluginManager();
    const plugin = { name: 'test', version: '1.0.0', type: 'feature' };

    manager.register(plugin);

    expect(manager.has('test')).toBe(true);
  });

  it('should throw on duplicate plugin name', () => {
    const manager = new PluginManager();
    const plugin = { name: 'test', version: '1.0.0', type: 'feature' };

    manager.register(plugin);

    expect(() => manager.register(plugin)).toThrow('Plugin already registered');
  });
});
```

### Documentation

**README.md Required**:
Every package must have:
- Installation instructions
- Usage examples
- API documentation link
- License

**JSDoc for Public APIs**:
```typescript
/**
 * Plugin for HLS streaming support
 *
 * @example
 * ```typescript
 * const player = new ScarlettPlayer('#video', {
 *   plugins: [new HLSPlugin({
 *     library: 'https://cdn.jsdelivr.net/npm/hls.js@latest'
 *   })]
 * });
 * ```
 */
export class HLSPlugin implements ProviderPlugin {
  // ...
}
```

**CHANGELOG.md**:
Keep a changelog for each package following [Keep a Changelog](https://keepachangelog.com/) format.

## Plugin Development Guidelines

### Plugin Structure

```typescript
import { Plugin, PluginAPI } from '@scarlett-player/core';

export interface MyPluginConfig {
  option1?: string;
  option2?: number;
}

export class MyPlugin implements Plugin {
  readonly name = 'my-plugin';
  readonly version = '1.0.0';
  readonly type = 'feature';

  private api: PluginAPI | null = null;
  private config: MyPluginConfig;

  constructor(config: MyPluginConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setup(api: PluginAPI): void {
    this.api = api;

    // Subscribe to events
    api.on('play', this.handlePlay);
    api.on('pause', this.handlePause);

    // Subscribe to state
    api.subscribe('currentTime', this.handleTimeUpdate);
  }

  destroy(): void {
    // Cleanup
    this.api = null;
  }

  private handlePlay = (): void => {
    // Implementation
  };

  private handlePause = (): void => {
    // Implementation
  };

  private handleTimeUpdate = (time: number): void => {
    // Implementation
  };
}
```

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

4. **Emit events for plugin actions**
   ```typescript
   api.emit('myplugin:actionCompleted', { data: 'value' });
   ```

5. **Handle errors gracefully**
   ```typescript
   try {
     await this.doSomething();
   } catch (error) {
     api.emit('error', { plugin: this.name, error });
     // Don't throw, let player continue
   }
   ```

## Git Workflow

### Branch Naming

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Refactoring
- `docs/description` - Documentation

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

1. Create feature branch from `develop`
2. Make changes with tests
3. Update documentation
4. Run `npm run validate` (lint + test + build)
5. Create PR to `develop`
6. Request review from relevant agent
7. Address review comments
8. Merge when approved

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

- Core must be < 50KB gzipped
- Each plugin < 20KB gzipped
- Tree-shakeable exports
- No circular dependencies

**Check bundle size**:
```bash
npm run build
npm run analyze
```

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

```typescript
destroy(): void {
  // Clear listeners
  this.api?.off('play', this.handlePlay);

  // Clear timers
  clearInterval(this.interval);

  // Remove DOM
  this.element?.remove();

  // Clear references
  this.api = null;
  this.element = null;
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

**Semantic Versioning** (SemVer):
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
1. Check architecture.md
2. Ask Dev-Master
3. Look at existing code
4. Reference Vidstack for patterns (not implementation)
