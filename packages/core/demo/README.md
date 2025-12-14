# Scarlett Player Demo

Interactive demo showing the Scarlett Player in action with a real video.

## Quick Start

```bash
npm run demo
```

This will start a development server and open the demo in your browser at `http://localhost:5173/demo/index.html`

## What's Included

### 1. Native HTML5 Provider (`native-provider.ts`)
A minimal video provider plugin that:
- Supports MP4, WebM, and OGG video files
- Forwards all player commands to the HTML5 `<video>` element
- Emits playback events back to the player
- Handles volume, seeking, playback rate, etc.

### 2. Interactive Demo Page (`index.html`)
A fully functional demo page with:
- **Video loading** - Try different video URLs
- **Playback controls** - Play, pause, seek, skip forward/back
- **Volume control** - Slider and mute toggle
- **Playback speed** - 0.5x, 1.0x, 1.5x, 2.0x
- **Real-time state display** - See all player state values update live
- **Event log** - Watch all player events as they happen

## Try It Out

The demo loads with a test video (Big Buck Bunny), but you can try any publicly accessible video URL:

### Sample Videos to Try

**MP4:**
- `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
- `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`

**WebM:**
- `https://upload.wikimedia.org/wikipedia/commons/transcoded/2/22/Volcano_Lava_Sample.webm/Volcano_Lava_Sample.webm.480p.vp9.webm`

### Browser Console

The player instance is available as `window.player`, so you can interact with it directly from the console:

```javascript
// Play/pause
await player.play();
player.pause();

// Seek
player.seek(30); // Jump to 30 seconds

// Volume
player.setVolume(0.5); // 50% volume
player.setMuted(true);

// Playback rate
player.setPlaybackRate(1.5); // 1.5x speed

// Listen to events
player.on('playback:timeupdate', (data) => {
  console.log('Time:', data.currentTime, '/', data.duration);
});

// Get state
console.log(player.getState());

// Access provider
console.log(player.currentProvider.name); // "native-provider"
```

## How It Works

1. **Player Initialization**: Creates a ScarlettPlayer instance with the native provider plugin
2. **Load Video**: When you load a video, the player:
   - Calls `setupAll()` to initialize all plugins
   - Calls `selectProvider()` to find a provider that can play the source
   - Emits `media:loaded` event
   - The native provider creates a `<video>` element and loads the source
3. **Playback**: All play/pause/seek commands flow through the EventBus to the provider
4. **Events**: Video events (timeupdate, play, pause, etc.) are forwarded back to the player

## Next Steps

This demo shows the **core player architecture** working with a basic provider. To build a production-ready player, you'd add:

1. **HLS Provider** - For live streaming (.m3u8)
2. **DASH Provider** - For adaptive streaming (.mpd)
3. **Controls UI Plugin** - Custom player controls
4. **Quality Selector Plugin** - Switch between quality levels
5. **Captions Plugin** - Subtitle/CC support

The plugin architecture makes it easy to add these features without modifying the core!
