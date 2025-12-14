# Scarlett Player - HLS Work Log

## Session Date: 2025-10-11

### Current Status
Working on making HLS video playback "rock solid" - it's the bread and butter of the application.

**Dev Server**: Running at http://localhost:5174 (port 5173 was in use)

---

## Problems Identified & Fixed

### ✅ 1. Event Naming Mismatches
**Files**: `demo/hls-provider.ts`, `demo/native-provider.ts`
- Changed `'play'` → `'playing'` event listeners (line 30)
- Changed `'playback:waiting'` → `'media:waiting'` (line 80)
- **Impact**: Events now correctly match the player's event system

### ✅ 2. Missing Video Events
**Files**: `demo/hls-provider.ts`, `demo/native-provider.ts`
- Added missing events: `loadedmetadata`, `canplay`, `canplaythrough`, `progress`
- **Impact**: Player now receives complete video lifecycle events

### ✅ 3. Incorrect Timeupdate Payload
**Files**: `demo/hls-provider.ts`, `demo/native-provider.ts`, `demo/index.html`
- Fixed timeupdate to only send `{ currentTime }` (removed duration)
- Separated duration handling to `media:durationchange` event
- **Impact**: Event payloads now match type definitions

### ✅ 4. Provider Cleanup Issues
**Files**: `demo/hls-provider.ts`, `demo/native-provider.ts`
- Added video element cleanup on load (lines 118-124 in hls-provider)
- Prevents stale video elements from accumulating in DOM
- **Impact**: Clean provider switching without element leaks

### ✅ 5. HLS Error Propagation
**Files**: `demo/hls-provider.ts`
- Added proper error event propagation (lines 95-104, 210-248)
- Network errors and media errors now emit proper events
- Fatal errors properly reject the loadSource promise
- **Impact**: Errors are now visible to the player and can be handled

### ✅ 6. Async Media Loading
**Files**: `demo/hls-provider.ts`, `demo/native-provider.ts`, `src/scarlett-player.ts`
- Made `loadSource()` async with Promise-based completion
- Wait for HLS manifest parse before resolving
- Removed duplicate `media:loaded` emission from player
- **Impact**: Player waits for actual media readiness before proceeding

### ✅ 7. Multiple Providers Active Simultaneously
**Files**: `src/scarlett-player.ts`, `src/plugin-manager.ts`

**Problem**: Both HLS and Native providers were listening to events at the same time
- Console showed: "Seeking to time" (HLS) AND "Seeking requested but video element not initialized" (Native) repeating

**Solution**:
- Changed from `setupAll()` to only setup selected provider
- Modified `selectProvider()` to check ALL registered plugins (not just active)
- Flow: Select provider FIRST → Setup ONLY that provider → Load source

**Code Location**: `scarlett-player.ts` lines 176-194
```typescript
// OLD: await this.pluginManager.setupAll();

// NEW:
const provider = this.pluginManager.selectProvider(source);
if (!provider) { /* error */ }
this._currentProvider = provider;
await this.pluginManager.setupPlugin(provider.name);
```

**Impact**: Only one provider is active at a time, no event conflicts

---

## 🔄 Current Issue: HLS Seeking Freezes

### Problem Description
"It still freezes on skipping but after a few mins it begins to play again on and off not consistent."

### Latest Fix Applied
**File**: `demo/hls-provider.ts` lines 288-315

Enhanced seeking implementation with:
1. **Time Clamping**: Prevents seeks outside valid range (0 to duration)
2. **Enhanced Debug Logging**: Shows requested time, clamped time, current time, duration, buffered ranges
3. **Large Seek Detection**: Identifies seeks >5 seconds that trigger HLS buffer reloads
4. **Better Observability**: Detailed logs for diagnosing freezes

```typescript
const unsubSeeking = api.events.on('playback:seeking', ({ time }) => {
  if (!videoElement) {
    api?.logger.warn('Seeking requested but video element not initialized');
    return;
  }

  // Clamp time to valid range
  const duration = videoElement.duration || 0;
  const clampedTime = Math.max(0, Math.min(time, duration));

  api?.logger.debug('Seeking to time', {
    requestedTime: time,
    clampedTime,
    currentTime: videoElement.currentTime,
    duration,
    buffered: videoElement.buffered.length > 0 ?
      `${videoElement.buffered.start(0)}-${videoElement.buffered.end(videoElement.buffered.length - 1)}` :
      'none'
  });

  // For HLS.js, check if we need to force a buffer flush on large seeks
  if (hls && Math.abs(clampedTime - videoElement.currentTime) > 5) {
    api?.logger.debug('Large seek detected, may trigger HLS buffer reload');
  }

  videoElement.currentTime = clampedTime;
});
```

### Status
- Fix applied and verified (TypeScript and build pass)
- **Awaiting testing and user feedback**

---

## Next Steps

### Immediate Testing Required
1. Open http://localhost:5174
2. Click "Load HLS Demo" button (loads https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8)
3. Test seeking/skipping through the video
4. **Check browser console logs** for:
   - Seek request details (requested vs clamped time)
   - Buffered ranges during seeks
   - Large seek detection messages
   - Any errors or warnings

### If Freezing Persists

Based on console logs, consider:

1. **HLS.js Buffer Configuration**
   - Tune `maxBufferLength` and `maxMaxBufferLength`
   - Adjust `maxBufferHole` for gap handling
   - Configure `maxFragLookUpTolerance` for segment loading

2. **Seek Throttling**
   - Implement debouncing for rapid consecutive seeks
   - Cancel pending seeks when new seek requested

3. **Visual Feedback**
   - Show loading indicator when HLS is loading segments
   - Display buffer progress during seeks

4. **HLS.js Event Monitoring**
   - Listen to `BUFFER_APPENDING` and `FRAG_LOADING` events
   - Track segment loading state
   - Emit custom events for UI feedback

### Files to Watch
- `packages/core/demo/hls-provider.ts` - Main HLS implementation
- `packages/core/src/scarlett-player.ts` - Player orchestration
- `packages/core/src/plugin-manager.ts` - Provider lifecycle

---

## Build Status
✅ TypeScript type checking: PASSING
✅ Production build: PASSING (dist/index.js: 51.47 kB gzipped: 10.70 kB)

---

## Notes
- HLS video playback is critical ("bread and butter")
- Focus on reliability and rock-solid performance
- Chrome DevTools MCP attempted but never connected successfully
- User provided console logs directly instead

---

## Key Learnings
1. Provider selection must happen BEFORE setup to avoid multiple active providers
2. HLS seeking requires careful buffer management (not just setting currentTime)
3. Async media loading is critical - must wait for manifest parse
4. Event naming and payload structure must exactly match type definitions
5. Video element cleanup is essential when switching providers
