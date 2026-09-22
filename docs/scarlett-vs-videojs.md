# Scarlett Player vs. Video.js

Scarlett Player replaced Video.js as the player behind [The Stream Platform](https://thestreamplatform.com). That was a fit decision for one Vue application with its own live-monitoring, clipping and analytics needs, not a verdict on Video.js. Both players are open source and modular, and both ship TypeScript types. This page sets out where they differ, with a source for every claim, so you can make the same call for your own project.

**What we compared.** Scarlett Player 1.16.1 against the `video.js` package at 8.24.1 (the current v8 line) and the Video.js v10 packages (`@videojs/core`, `@videojs/html`, `@videojs/react`) at 10.0.0-rc.2, a release candidate. Versions and documentation were checked on September 22, 2026; both projects move, so check the linked sources before you rely on a detail. We have not run a size, startup or latency benchmark between the two, and this page makes no such claim.

## At a glance

| | Scarlett Player | Video.js |
| --- | --- | --- |
| License | MIT | Apache-2.0 (`video.js` 8.24.1) |
| Streaming formats | HLS (hls.js, or native HLS for AirPlay and browsers without MSE), native files, WHEP | HLS and DASH through VHS, bundled in the default v8 build |
| DRM | Not shipped (planned) | Through `videojs-contrib-eme` |
| WHEP (WebRTC) | First-party provider | Third-party plugins only |
| Framework bindings | Vue 3 | v10: React components and HTML custom elements |
| TypeScript | Written in TypeScript | v8 ships type declarations; v10 announces first-class TypeScript support |
| Plugins | 19 first-party packages | A [plugin directory](https://legacy.videojs.org/plugins/); 381 npm packages carry the `videojs-plugin` keyword (September 22, 2026) |

## Architecture and framework integration

Video.js v8 uses a player, component and plugin model. Its React guide imports `video.js`, creates the player in the component lifecycle, subscribes to events and disposes of the player on cleanup; it does not need a browser global or state polling. Plugins register through a shared API, and "advanced" plugins are classes with their own instances, state and lifecycle. [React integration](https://legacy.videojs.org/guides/react/), [plugin guide](https://legacy.videojs.org/guides/plugins/)

Video.js v10 splits state, media and UI into separate parts, with composable features and optional skins. It ships React hooks and components and HTML custom elements. Its installation guide says the framework guides "use the HTML custom elements until we add first-party Vue and Svelte packages." Modular composition and TypeScript support are therefore not things only Scarlett offers. [v10 announcement](https://videojs.org/blog/videojs-v10-beta-hello-world-again), [v10 installation](https://videojs.org/docs/framework/react/how-to/installation)

Scarlett keeps each state key in its own signal and gives every plugin an instance-specific API with state, events, the container and a logger. Its [Vue composable](../packages/vue/src/composables/useScarlettPlayer.ts) turns events and state subscriptions into Vue refs without polling. There is no first-party React package yet; a React wrapper and a Web Component wrapper are on the [roadmap](../README.md#roadmap). The player always needs a DOM container, even when you leave out its UI plugin. See [Architecture](architecture.md) for the full design.

## Streaming capabilities

Video.js HTTP Streaming (VHS) plays HLS and DASH and is part of the default v8 build: `video.js` 8.24.1 depends on `@videojs/http-streaming`. A core-only build (`video.js/core`, or `dist/alt/video.core.js`) leaves VHS out; in 8.24.1 it is roughly 40% of the size of the full `dist/video.js` (unminified). DRM goes through `videojs-contrib-eme`, which supports Encrypted Media Extensions. [VHS](https://github.com/videojs/http-streaming), [contrib-eme](https://github.com/videojs/videojs-contrib-eme), [npm package](https://www.npmjs.com/package/video.js)

Scarlett ships three playback providers: native files, HLS and WHEP. The HLS provider uses hls.js by default and switches to the browser's native HLS when AirPlay is active or Media Source Extensions are unavailable. There is no DASH provider and no DRM package; DRM support is on the roadmap. [Packages](../README.md#packages), [HLS provider](../packages/plugins/hls/README.md)

Scarlett's [WHEP provider](../packages/plugins/whep/README.md) plays WebRTC streams from servers that answer a WHEP offer with a `201`. It does not handle server counter-offers, trickle ICE or ICE restarts. It is built for low-delay live monitoring; actual latency depends on your server and network. Neither Video.js v8 nor the v10 packages include a WHEP or WebRTC provider, and the `videojs` GitHub organization has no WHEP project. Third-party plugins fill the gap: Millicast's [`videojs-plugin-millicast-whep`](https://github.com/millicast/videojs-plugin-millicast-whep) plays WHEP, and Ant Media's [`videojs-webrtc-plugin`](https://github.com/ant-media/videojs-webrtc-plugin) plays WebRTC from Ant Media Server through that server's own signaling rather than WHEP.

## Dependencies and bundle size

Scarlett's core package has no runtime npm dependencies, and every plugin is a separate package, so an application build includes only the plugins it imports. That does not make the whole stack dependency-free: the HLS provider needs `hls.js` as a peer dependency, and the controls and features you add all count toward your bundle. The [embed](embed-implementation.md) builds bundle a fixed set of plugins. [Core manifest](../packages/core/package.json), [HLS manifest](../packages/plugins/hls/package.json)

Video.js v8 has its core-only build, and the v10 announcement describes much smaller compositions and an alternative streaming engine. Those are Video.js's own figures against Video.js v8, not a comparison with Scarlett. We have not measured equivalent builds of the two players, so this page does not say which one is smaller or faster. [v10 announcement](https://videojs.org/blog/videojs-v10-beta-hello-world-again)

## Which to choose

Scarlett is worth evaluating if you build in Vue and want first-party WHEP playback, viewer clipping, QoE analytics sent to your own endpoint, and a typed plugin API in one set of packages. Video.js is the safer choice if you depend on DASH, EME-based DRM or existing Video.js plugins, all of which you would have to replace to move. React teams should compare Video.js v10's first-party React API with the custom integration Scarlett currently needs.

Neither license removes the work of integrating and maintaining a player. Also compare the Apache-2.0 and MIT terms for the exact packages you would ship.

See also: [Scarlett vs. Mux Player](scarlett-vs-mux.md) and [Scarlett vs. Bitmovin Player](scarlett-vs-bitmovin.md).
