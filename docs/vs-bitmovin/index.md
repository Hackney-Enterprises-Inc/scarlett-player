# Scarlett Player vs. Bitmovin Player

> Rendered at https://scarlettplayer.com/vs-bitmovin/ · Source: https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/docs/scarlett-vs-bitmovin.md

Bitmovin Player is a commercial SDK with a modular build, broad format and DRM support, advertising integrations and a separate open-source UI. Scarlett Player is MIT-licensed source with a smaller feature set built around live monitoring, clipping and Vue. The real differences are ownership, the workflows each one covers, and how each is licensed and paid for. This page sets them out, with a source for every claim.

**What we compared.** Scarlett Player 1.16.1 against Bitmovin Player Web v8, `bitmovin-player` 8.277.0 on npm, with `bitmovin-player-ui` 4.21.1. Bitmovin also offers [Player Web X](https://bitmovin.com/player-web-x), a separate, newer player that is not covered here. Versions, documentation and pricing were checked on September 22, 2026; check the linked sources before you rely on a detail. We have not run a size, startup or latency benchmark between the two, and this page makes no such claim.

## At a glance

| | Scarlett Player | Bitmovin Player Web v8 |
| --- | --- | --- |
| License | MIT, open source | Proprietary SDK; the UI framework is MIT |
| License key | None | Mandatory, tied to allow-listed domains |
| Pricing | Free; you run your own infrastructure | By impressions (video plays) |
| Streaming formats | HLS, native files, WHEP | HLS, DASH, Smooth Streaming, progressive, WHEP |
| DRM | Not shipped (planned) | Widevine, PlayReady, FairPlay, PrimeTime, ClearKey |
| Advertising | None | VAST and VMAP tags, Google IMA, Bitmovin's own ad module, server-guided ad insertion (HLS Interstitials) |
| Viewer clipping, watermark overlay | First-party plugins | Not part of the player API we reviewed |
| TypeScript and frameworks | Written in TypeScript; first-party Vue 3 wrapper | Ships TypeScript definitions |

## Modularity and payload

Bitmovin v8 lets you import its core and register only the engines, renderers, protocols and features you need with `Player.addModule()`. The 8.277.0 package ships 45 modules, among them `drm`, `advertising-ima`, `advertising-bitmovin`, `analytics`, `dash`, `hls`, `smooth` and `engine-webrtc`. Having DRM and advertising available does not mean every installation bundles them. [Modular API](https://cdn.bitmovin.com/player/web/8/docs/index.html), [modular sample](https://github.com/bitmovin/bitmovin-player-web-samples/blob/main/modular-player/static.html)

Scarlett's core package has no runtime npm dependencies, and every provider and control set is a separate package. Its HLS provider uses hls.js by default (a peer dependency) and switches to native HLS when AirPlay is active or Media Source Extensions are unavailable. The full hls.js build can carry DRM code; the [light entry](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/packages/plugins/hls/README.md) drops DRM, subtitles and ID3. The [embed](https://scarlettplayer.com/embed/index.md) builds bundle a fixed set of plugins.

Modularity alone does not decide which player is smaller. That needs equivalent configurations compared with their dependencies, CSS and lazy-loaded chunks, and we have not done that.

## Playback and product workflows

Bitmovin v8's source configuration takes HLS, DASH, progressive files, Smooth Streaming, DRM settings and WHEP (`whep`: "An URL pointing to a WHEP endpoint"), with WebRTC playback in the separate `engine-webrtc` module. So first-party WHEP playback is not unique to Scarlett. The documentation shows that Bitmovin supports WHEP; it does not tell you how it handles authentication, reconnects or particular servers compared with Scarlett. [Source configuration](https://cdn.bitmovin.com/player/web/8/docs/interfaces/core_config.sourceconfig.html)

Bitmovin's DRM configuration covers Widevine, PlayReady, FairPlay, PrimeTime and ClearKey. Ad breaks take VAST or VMAP tags, Google IMA is available as a separate module, and an `sgai` module supports server-guided ad insertion such as HLS Interstitials. Scarlett has no DASH provider, no DRM package (DRM is on the [roadmap](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/README.md#roadmap)) and no ad package, so it is not a drop-in replacement if you need those. [SDK and typings](https://www.npmjs.com/package/bitmovin-player), [ads setup guide](https://developer.bitmovin.com/playback/docs/setting-up-ads-with-the-web-player)

Scarlett ships first-party packages for some focused workflows:

- **WHEP:** a [WebRTC provider](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/packages/plugins/whep/README.md) for low-delay live monitoring, with token authentication and automatic reconnects. It needs a server that answers offers with a `201`; it does not handle server counter-offers, trickle ICE or ICE restarts. Actual latency depends on your server and network.
- **Clips:** [viewer-created clips](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/packages/plugins/clips/README.md) with two-handle range selection, a looping preview and submission to your callback or endpoint. Cutting, storing and publishing the clip is your backend's job.
- **Watermark:** a [visible overlay](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/packages/plugins/watermark/README.md) of text (typically the viewer's email or account id) or an image, fixed in a corner or moving on a timer, so screenshots and screen captures carry it. It is not DRM or forensic watermarking.

## UI and TypeScript

Bitmovin's [UI framework](https://github.com/bitmovin/bitmovin-player-ui) is a separate, MIT-licensed project that you can customize or replace. Setting `ui: false` in the player configuration turns off the default UI so you can supply your own. [UI styling demo](https://bitmovin.com/demos/player-ui-styling)

The `bitmovin-player` npm package ships TypeScript definitions. Scarlett is written in TypeScript and gives every plugin an instance-specific API, plus a first-party [Vue wrapper](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/packages/vue/src/composables/useScarlettPlayer.ts). Both players need a DOM container. See [Architecture](https://scarlettplayer.com/architecture/index.md) for Scarlett's plugin model.

## Licensing and cost

Bitmovin's player configuration documents the license `key` as "Mandatory", with every domain that serves the player entered in your account. Bitmovin prices the player by "the number of impressions (video plays) generated"; on September 22, 2026 its pricing page listed 10,000 free impressions a month and then $1.50 per additional 1,000. A Bitmovin team member explains on the community forum that the player sends requests to Bitmovin's licensing server to count each playback session, that this only works on allow-listed domains, and that it "is not a content protection mechanism". This licensing is separate from analytics: setting `analytics: false` turns off the bundled Bitmovin Analytics, while the key stays mandatory. Your actual cost depends on your plan and contract. [Player configuration](https://cdn.bitmovin.com/player/web/8/docs/interfaces/core_config.playerconfig.html), [pricing](https://bitmovin.com/pricing/), [usage tracking explained](https://community.bitmovin.com/t/how-bitmovin-player-will-track-my-usage/3112)

Scarlett is [MIT-licensed](https://github.com/Hackney-Enterprises-Inc/scarlett-player/blob/main/LICENSE) and has no license key, license server or per-play charge. Its analytics plugin sends data only to an endpoint you configure. Owning the source gives you control of the roadmap and leaves integration, compatibility, support and infrastructure with your team. Some plugins still contact third parties: the Chromecast plugin, for example, loads Google's Cast sender SDK from `www.gstatic.com`.

## Which to choose

Bitmovin is the stronger fit if you need DASH, multi-DRM or advertising from one vendor, and its pricing works at your volume. Scarlett fits if you want MIT-licensed source with no per-play licensing, a Vue integration, and first-party clipping and WHEP monitoring, and you are ready to maintain the player yourself. We have not established a winner on latency, payload, integration effort or total cost.

See also: [Scarlett vs. Video.js](https://scarlettplayer.com/vs-videojs/index.md) and [Scarlett vs. Mux Player](https://scarlettplayer.com/vs-mux/index.md).
