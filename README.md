# React Native Video v7 TikTok-Style Feed Example

A high-performance TikTok-style vertical video feed built with React Native Video v7, featuring smooth infinite scroll, aggressive preloading, and optimized playback controls.

## Features

### 🎥 Video Playback

-   **HLS Stream Support**: Uses Mux HLS streams for adaptive bitrate streaming
-   **Smooth Transitions**: Videos start playing when 50% visible for faster engagement
-   **Infinite Scroll**: Seamlessly cycles through 5 videos infinitely
-   **One-by-One Scrolling**: Prevents multi-video jumps for better UX

### ⚡ Performance Optimizations

-   **Aggressive Preloading**: Preloads 2-4 videos ahead for instant playback
-   **Memory Management**: Automatic cleanup of old players after 50 scrolls
-   **Optimized Rendering**: Uses FlatList with proper windowing and clipping
-   **Fast Scroll**: Optimized deceleration rate (0.92) for TikTok-like speed

### 🎨 UI/UX

-   **Animated Overlays**: UI elements (likes, comments, share) fade in smoothly
-   **Loading States**: Proper loading indicators during video buffering
-   **Error Handling**: Graceful error recovery with retry mechanisms
-   **Playback Controls**: Tap to play/pause functionality

## How It Works

### Architecture

The app uses a **player pool pattern** with infinite scroll:

1. **Initial Load**: Creates 5 video players (one for each HLS source)
2. **Preloading**: All videos are preloaded upfront with staggered timing (50ms apart)
3. **Scroll Detection**: Uses `onMomentumScrollEnd` and `onViewableItemsChanged` to track visible video
4. **Infinite Scroll**: When approaching the end, new players are created and added to the list
5. **Memory Management**: After 50 scrolls, old players beyond the viewport are cleaned up

### Key Components

#### `App.tsx`

-   Manages the video player pool and scroll state
-   Handles infinite scroll by fetching more videos when needed
-   Syncs playback (play/pause/mute) based on visible index
-   Implements cleanup logic to prevent memory leaks

#### `VideoViewComponent.tsx`

-   Renders individual video items
-   Handles video lifecycle (load, play, pause, error)
-   Manages loading and error states
-   Provides play/pause controls

#### `VideoOverlay.tsx`

-   Displays interactive UI elements (likes, comments, share)
-   Animated fade-in when video becomes active
-   Only renders when video is loaded and playing

### Video Preloading Strategy

1. **Initial Preload**: All 5 videos preloaded on app start (staggered by 50ms)
2. **Proactive Preload**: When within 3 videos of the end, fetches 2-3 more videos ahead
3. **Distance-Based Preload**: Preloads current video + next 4 videos
4. **Status Tracking**: Tracks preload attempts to prevent duplicate calls

### Scroll Behavior

-   **Snap Scroll**: Full-screen snap-to-interval scrolling
-   **Viewability Threshold**: Videos start at 50% visibility (`itemVisiblePercentThreshold: 50`)
-   **One-by-One Validation**: Only allows single-step scrolling (prevents jumps)
-   **Fast Deceleration**: `decelerationRate: 0.92` for quick transitions

### Memory Management

-   **Dynamic Player List**: Players are created as needed for infinite scroll (can grow to 50+ before cleanup)
-   **Automatic Cleanup**: After every 50 scrolls, removes players outside viewport
-   **Viewport Window**: Keeps 4 players before and 8 players after current position (12 total around viewport)
-   **Proper Cleanup**: Releases resources on unmount and during periodic cleanup

## Installation

```bash
# Install dependencies
bun install

# Run on iOS
bun run ios

# Run on Android
bun run android
```

## Configuration

### Video Sources

Edit `src/utils.ts` to change video sources:

```typescript
export const SOURCES = [
    "https://stream.mux.com/your-video-1.m3u8",
    "https://stream.mux.com/your-video-2.m3u8",
    // ... more sources
];
```

### Performance Tuning

In `src/App.tsx`:

-   `PLAYERS_AROUND_VIEWPORT`: Players to keep before/after current position (default: 4)
-   `CLEANUP_THRESHOLD`: Scrolls before cleanup runs (default: 50)
-   `decelerationRate`: Scroll speed (0.92 = fast, lower = slower)
-   `itemVisiblePercentThreshold`: Visibility % to start video (50 = 50%)

**Note**: The player list can grow to many players (50+) during infinite scroll. Cleanup keeps `PLAYERS_AROUND_VIEWPORT * 2` (8) players after current position and `PLAYERS_AROUND_VIEWPORT` (4) before, for a total of 12 players around the viewport.

## Technical Details

### React Native Video v7 Features Used

-   **`VideoPlayer`**: Core player instance with manual initialization
-   **`preload()`**: Preloads video without starting playback
-   **`initializeOnCreation: false`**: Manual control over initialization
-   **`replaceSourceAsync()`**: Changes video source dynamically
-   **Event System**: `onLoad`, `onStatusChange`, `onError` for state management

### Preloading Implementation

```typescript
// Safe preload with tracking
const safePreload = (player: VideoPlayer) => {
    if (player.status === "idle" && !preloadAttemptedRef.current.has(player)) {
        player.preload();
        preloadAttemptedRef.current.add(player);
    }
};
```

### Infinite Scroll Logic

```typescript
// Fetch more videos when within 3 of the end
if (remaining <= 3 && !fetchingRef.current) {
    // Create new players and add to list
    fetchMoreVideos();
}
```

### Viewability Detection

```typescript
// Start video when 50% visible
viewabilityConfig: {
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
}
```

## Performance Considerations

### Android Optimization

-   Automatic cleanup prevents lag after 100-200 scrolls
-   Proper FlatList windowing reduces memory usage
-   Staggered preloading prevents network overload

### Network Optimization

-   HLS adaptive streaming adjusts quality based on connection
-   Prefetching ensures videos are ready before user scrolls
-   Failed preloads are retried automatically

## Troubleshooting

### Videos not preloading

-   Check network connection
-   Verify HLS stream URLs are accessible
-   Check console for preload errors

### Scroll feels laggy

-   Reduce `MAX_PLAYERS` if memory constrained
-   Lower `CLEANUP_THRESHOLD` for more frequent cleanup
-   Check device performance

### Audio overlap

-   Ensure `currentTime = 0` is set when pausing
-   Verify mute is applied to inactive videos
-   Check player status before playing

## Future Enhancements

-   [ ] MP4 support (currently HLS only)
-   [ ] Device-side video compression
-   [ ] Background upload functionality
-   [ ] Analytics/KPI tracking
-   [ ] Custom video filters/effects

## License

Private project
