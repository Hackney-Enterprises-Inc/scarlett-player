# Scarlett Player

**A modular, plugin-based video player for the modern web**

> ⚠️ **Work in Progress**: Scarlett Player is under active development. Not ready for production use.

## Vision

Scarlett Player is built on a **true plugin architecture** where every feature—from HLS streaming to Chromecast support—is a first-class plugin. Unlike traditional players where features are baked into the core, Scarlett treats everything as extensible, creating a truly composable media player ecosystem.

## Features (Planned)

- 🎯 **Minimal Core** - < 50KB gzipped, only bundle what you use
- 🔌 **Plugin-First** - HLS, DASH, Chromecast, UI—everything is a plugin
- 📦 **Tree-Shakeable** - Import only the plugins you need
- 🎨 **Framework-Agnostic** - Works with vanilla JS, React, Vue, and more
- ♿ **Accessible** - WCAG 2.1 AA compliant by default
- 🔒 **TypeScript-First** - Full type safety throughout
- ⚡ **Modern Build** - ESM, Vite, optimized for modern browsers

## Architecture

```
@scarlett-player/core          # Minimal player core (< 50KB)
  ├─ Plugin system
  ├─ Event bus
  └─ State management

@scarlett-player/plugin-*      # Provider plugins
  ├─ native                    # HTML5 video/audio
  ├─ hls                       # HLS streaming (HLS.js)
  ├─ dash                      # DASH streaming (DASH.js)
  └─ ...

@scarlett-player/plugin-*      # Feature plugins
  ├─ chromecast                # Google Cast
  ├─ controls                  # Playback controls
  ├─ quality                   # Quality selector
  └─ ...

@scarlett-player/react         # React adapter
@scarlett-player/vue           # Vue adapter
```

## Quick Start (Future)

```bash
npm install @scarlett-player/core @scarlett-player/plugin-hls @scarlett-player/plugin-controls
```

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { HLSPlugin } from '@scarlett-player/plugin-hls';
import { ControlsPlugin } from '@scarlett-player/plugin-controls';

const player = new ScarlettPlayer('#video-container', {
  plugins: [
    new HLSPlugin(),
    new ControlsPlugin()
  ]
});

player.loadSource({
  src: 'https://example.com/stream.m3u8'
});
```

## Development Status

**Current Phase**: Initialization

### Roadmap

- [ ] Core System - Plugin architecture, event bus, state management
- [ ] Provider Plugins - Native, HLS, DASH support
- [ ] Casting Plugins - Chromecast, AirPlay integration
- [ ] UI Plugins - Controls, quality selector, settings
- [ ] Framework Adapters - React, Vue components
- [ ] Feature Plugins - Subtitles, analytics, DRM
- [ ] Documentation & v1.0 Release

## Project Structure

```
scarlett-player/
├── packages/
│   ├── core/              # @scarlett-player/core
│   ├── plugins/           # All plugins
│   │   ├── native/
│   │   ├── hls/
│   │   ├── dash/
│   │   └── ...
│   ├── react/             # React adapter
│   ├── vue/               # Vue adapter
│   └── presets/           # Preset configurations
├── docs/                  # Documentation site
├── examples/              # Example projects
└── scripts/               # Build/dev scripts
```

## Technology Stack

- **Language**: TypeScript
- **Build**: Vite (dev) + Rollup (prod)
- **Testing**: Vitest
- **Monorepo**: pnpm workspaces
- **Linting**: ESLint + Prettier

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

## License

MIT License - See [LICENSE](./LICENSE)

### Attribution

Scarlett Player is inspired by [Vidstack Player](https://github.com/vidstack/player) (Copyright 2023 Rahim Alwer, MIT License). We reference Vidstack's architecture patterns and provider implementations for educational purposes.

## Contributing

Scarlett Player is built by The Stream Platform for our own needs. We welcome:
- Bug reports
- Feature requests
- Documentation improvements
- Community plugins

See [CONTRIBUTING.md](./docs/contributing.md) for development guidelines.

## Credits

Built with inspiration from:
- **Vidstack** - Provider architecture reference
- **Video.js** - Plugin ecosystem inspiration
- **Plyr** - Simplicity goals
- **HLS.js & DASH.js** - Battle-tested streaming libraries

---

**Scarlett Player** - Modular. Extensible. Yours.
