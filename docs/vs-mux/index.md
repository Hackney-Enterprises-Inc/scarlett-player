# Scarlett Player vs. Mux Player

> Rendered at https://scarlettplayer.com/vs-mux/ · Source: https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/docs/scarlett-vs-mux.md

Mux Player is the web player Mux builds for its own video platform: it is tightly integrated with Mux Video hosting and Mux Data analytics, and it is customizable through themes and CSS. Scarlett Player is not tied to a hosting vendor: you assemble playback, controls and analytics from separate packages and point them at your own infrastructure. This page compares the two player libraries, with a source for every claim. Mux Video hosting, Mux Data and the hosted `player.mux.com` iframe are services with their own terms and are not compared here.

**What we compared.** Scarlett Player 1.16.1 against `@mux/mux-player` and `@mux/mux-player-react` 3.13.4. Versions and documentation were checked on September 22, 2026; check the linked sources before you rely on a detail. We have not run a size, startup or latency benchmark between the two, and this page makes no such claim.

## At a glance

| | Scarlett Player | Mux Player |
| --- | --- | --- |
| License | MIT | MIT (the player library; Mux services are billed separately) |
| Built on | Plugin-based TypeScript core | Web Components: Media Chrome and the `mux-video` element |
| Media sources | Any URL your host serves: native files, HLS, WHEP | Mux playback IDs, or a plain `src` URL |
| Analytics | Optional plugin that posts to your own endpoint | Mux Data, on unless `disable-tracking` is set |
| Framework bindings | Vue 3 | Official React wrapper |
| Customization | Replace or omit the UI plugin; build controls on state and events | CSS variables, CSS parts and Media Chrome themes |

## Media sources and hosting

Mux's FAQ asks "Do you support non-Mux HLS streams?" and answers that the player "is designed with the Mux Platform in mind", pointing to features such as timeline hover previews and descriptive Mux Data errors that depend on that coupling. The player's source does accept a plain media URL: its `src` setter works without a playback ID. So non-Mux sources play, but the Mux-specific features and support commitments are designed around Mux Video. [Mux Player FAQ](https://www.mux.com/docs/guides/player-faqs), [player source](https://github.com/muxinc/elements/blob/main/packages/mux-player/src/base.ts)

Scarlett plays whatever URLs your host gives it through its native, HLS and WHEP providers, with no media vendor required. Codecs, CORS, authentication and protocol support still have to line up. The WHEP provider works with servers that answer a WHEP offer with a `201`, not with servers that send counter-offers. [Packages](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/README.md#packages), [WHEP provider](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/packages/plugins/whep/README.md)

## Analytics and data handling

Mux Player reports to Mux Data. The HTML API's `disable-tracking` attribute ("Disables Mux Data tracking") defaults to `false`, so tracking runs unless you set it; React exposes the same switch as `disableTracking`. `disable-cookies` is a separate attribute and does not turn tracking off. `beacon-collection-domain` sends Mux Data beacons to a custom domain. [HTML API](https://www.mux.com/docs/guides/player-api-reference/html), [React API](https://www.mux.com/docs/guides/player-api-reference/react)

Scarlett's [analytics plugin](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/packages/plugins/analytics/README.md) is optional. When you add it, it requires a `beaconUrl` you provide and also accepts a custom transport. You decide where the data goes, and you own ingestion, storage, dashboards and consent handling. It is a client-side QoE collector, not a hosted analytics product.

## UI and framework integration

Mux Player is built from Web Components: Media Chrome for the UI and the `mux-video` element for playback and Mux Data. `@mux/mux-player` 3.13.4 depends on `media-chrome`, `@mux/mux-video`, `@mux/playback-core` and `player.style`, and ships TypeScript declarations. `@mux/mux-player-react` is Mux's official React wrapper at the same version. [Architecture FAQ](https://www.mux.com/docs/guides/player-faqs), [manifest](https://github.com/muxinc/elements/blob/main/packages/mux-player/package.json), [React API](https://www.mux.com/docs/guides/player-api-reference/react)

You customize Mux Player with CSS variables, exposed CSS parts and Media Chrome themes, which can change the layout as well as the styling, from an inline `<template>` or a custom element. Themes are not available in the hosted `player.mux.com` iframe, which Mux states directly; that limit applies to the iframe, not to the library. [Themes](https://www.mux.com/docs/guides/player-themes), [styling reference](https://github.com/muxinc/elements/blob/main/packages/mux-player/REFERENCE.md)

In Scarlett you can omit the UI packages entirely and build your own controls on the player's state and events. The first-party [Vue wrapper](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/packages/vue/src/composables/useScarlettPlayer.ts) turns events and state subscriptions into Vue refs. There is no React wrapper yet; React and Web Component wrappers are on the [roadmap](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/README.md#roadmap). See [Architecture](https://scarlettplayer.com/architecture/index.md) for the plugin model.

## Packaging

Scarlett's plugins are separate packages, so an application build includes only the ones it imports. The [embed](https://scarlettplayer.com/embed/index.md) builds are the exception: each bundles a fixed set of plugins, whether or not a page uses them all. We have not compared equivalent builds of Scarlett and Mux Player, so this page does not say which is smaller or starts faster.

## Which to choose

Both player libraries are MIT-licensed, and in both cases the license does not cover the services behind the player: Mux Video and Mux Data for Mux Player, and your own media and telemetry infrastructure for Scarlett.

Mux Player is worth serious consideration if you host on Mux: the platform integration, React bindings and themed controls save application work. Scarlett fits when you want to stay independent of a media vendor, send analytics to your own endpoint, use Vue, or play WHEP streams, all behind one plugin API. Neither choice guarantees lower cost or better performance without a concrete implementation and usage model.

See also: [Scarlett vs. Video.js](https://scarlettplayer.com/vs-videojs/index.md) and [Scarlett vs. Bitmovin Player](https://scarlettplayer.com/vs-bitmovin/index.md).
