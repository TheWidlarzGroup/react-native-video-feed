# React Native Video v7 TikTok-Style Feed Example

A high-performance TikTok-style vertical video feed built with React Native Video v7 and `@legendapp/list`, featuring smooth infinite scroll, automatic snapping, aggressive preloading, and optimized playback controls.

## Features

### 🎥 Video Playback

-   **HLS Stream Support**: Uses Mux HLS streams for adaptive bitrate streaming
-   **Smooth Transitions**: Videos start playing when 50% visible for faster engagement
-   **Infinite Scroll**: Seamlessly cycles through videos infinitely using modulo indexing
-   **Automatic Snapping**: `snapToInterval` ensures videos always align perfectly after scroll
-   **Fast Scrolling**: Optimized `decelerationRate` for responsive, smooth scrolling

### ⚡ Performance Optimizations

-   **Aggressive Preloading**: Preloads videos ahead and behind for instant playback
-   **Zero-Rerender Cleanup**: Background resource cleanup without array modifications
-   **Optimized Rendering**: LegendList with proper windowing, clipping, and memoization
-   **Memory Management**: Automatic cleanup of video resources beyond viewport
-   **Smart Preload Tracking**: Prevents duplicate preload attempts
-   **Component Recycling Disabled**: `recycleItems={false}` ensures correct video order

### 🎨 UI/UX

-   **Animated Overlays**: UI elements (likes, comments, share) fade in smoothly
-   **Loading States**: Proper loading indicators during video buffering (only when active)
-   **Error Handling**: Graceful error recovery with retry mechanisms
-   **Tap-to-Play/Pause**: Distinguishes taps from swipes for better UX
-   **Seamless Scrolling**: No flicker or jumps during navigation

## Architecture & Techniques

### Infinite Feed System

The app implements a true infinite feed pattern:

1. **Position-Based Indexing**: Each video player uses its array position (`index`) to determine which source URI to play

    - Uses modulo to cycle through source videos: `uris[index % uris.length]`
    - Ensures correct order: 1-2-3-4-5, 1-2-3-4-5, etc.

2. **Stable Keys**: `keyExtractor` uses array position (`index`), ensuring LegendList treats each position as unique

3. **Proactive Fetching**: When ≤3 videos remain before end, automatically fetches 2-3 more videos ahead

4. **No Component Recycling**: `recycleItems={false}` prevents component reuse issues that could cause incorrect video order

### Preloading Strategy

**Multi-Layer Preloading System:**

1. **Distance-Based Preloading**: Preloads current video + 4 videos ahead and 4 behind (9 total)

    - Only preloads if `status === "idle"` and not already attempted
    - Uses `preloadAttemptedRef` Set to prevent duplicate calls

2. **New Video Preloading**: Automatically preloads newly created players after 100ms delay

3. **Safe Preload Function**: Checks player status, verifies source URI, tracks attempts, handles errors

### Zero-Rerender Cleanup System

**Background Resource Cleanup** (no array modifications):

Instead of removing players from the array (which causes rerenders), the cleanup system:

1. **Preserves Array Structure**: `players` array never changes during cleanup
2. **Cleans Resources Only**: For players beyond `PLAYERS_AROUND_VIEWPORT * 2` distance:

    - Pauses if playing
    - Calls `replaceSourceAsync(null)` to release video resources
    - Keeps player instances in array (FlatList handles rendering via `removeClippedSubviews`)

3. **Benefits**: No rerenders, no flicker, no `visibleIndex` changes, seamless user experience

### Scroll Control & Snapping

**Automatic Snapping:**

1. **Snap to Interval**: `snapToInterval={screenHeight}` ensures videos always snap to exact positions after scroll

2. **Fast Deceleration**: `decelerationRate={0.92}` provides responsive, smooth scrolling

3. **Viewability Detection**: 50% viewability threshold triggers video playback when video is half-visible

4. **LegendList Configuration**: Uses `disableIntervalMomentum={true}`, `snapToAlignment="start"`, and `recycleItems={false}` for reliable scrolling

### Tap vs Swipe Detection

Uses `onPressIn`/`onPressOut` to distinguish taps from swipes:

-   Tracks press start time and location
-   On release, checks duration < 200ms and movement < 10px
-   Only triggers play/pause on true taps
-   Ignores swipe gestures completely

### Memory Management

1. **Ref-Based State Management**: Uses refs for synchronous access and tracking
2. **Cleanup on Unmount**: Clears all timeouts, animation frames, and releases video sources
3. **Periodic Cleanup**: Runs every 5 scrolls, only cleans players beyond viewport distance

### Performance Optimizations

**LegendList Configuration:**

-   `recycleItems: false` - Prevents component recycling issues (critical for correct video order)
-   `drawDistance: screenHeight * 3` - Renders 3 screens worth
-   `scrollEventThrottle: 16` - 60fps scroll events
-   `disableIntervalMomentum: true` - Prevents multi-item jumps
-   `decelerationRate: 0.92` - Fast, responsive scrolling
-   `snapToInterval: screenHeight` - Automatic snapping to video boundaries
-   `snapToAlignment: "start"` - Aligns snap to start of each video

**React Optimizations:**

-   `React.memo` on `VideoViewComponent` with custom comparison
-   `useCallback` for all event handlers
-   `useRef` for stable references

**Video Player Optimizations:**

-   `initializeOnCreation: false` for manual control
-   Preload tracking prevents duplicate network requests
-   Muted inactive videos to save resources
-   Reset `currentTime` to 0 when pausing to prevent audio overlap

## How It Works

### Initialization Flow

1. App resolves video URIs from `SOURCES` array
2. Creates initial players with unique indices
3. Preloads all videos with 50ms delays
4. Auto-plays first video when ready

### Scroll Flow

1. User scrolls, `handleScroll` tracks position
2. `onViewableItemsChanged` detects when video is 50% visible and updates `visibleIndex`
3. `syncPlaybackForIndex` plays current, pauses others, preloads nearby
4. `snapToInterval` automatically snaps to exact video position when scroll ends
5. `handleMomentumScrollEnd` finalizes the visible index
6. If ≤3 videos remain, fetches more

### Cleanup Flow

1. Triggered after every 5 scrolls
2. Finds players beyond 8 positions from current
3. Pauses and releases video sources
4. Keeps players in array, FlatList handles unmounting
5. Zero rerenders, no flicker or jumps

## Key Components

### `App.tsx`

Manages video player pool, infinite scroll, scroll events, preloading, cleanup, and playback synchronization.

**Key Functions:**

-   `cleanupOldPlayers()`: Background resource cleanup (no rerenders)
-   `fetchMoreVideos()`: Creates new players for infinite scroll
-   `syncPlaybackForIndex()`: Manages playback for current and nearby videos
-   `safePreload()`: Safe preload with duplicate prevention
-   `handleScroll()`: Tracks scroll position
-   `handleMomentumScrollEnd()`: Finalizes visible index after scroll ends

### `VideoViewComponent.tsx`

Renders individual video items, handles video lifecycle, manages loading/error states, distinguishes taps from swipes, prevents flicker.

**Key Features:**

-   `wasEverReadyRef`: Tracks if video was ever ready to prevent loader flicker
-   Tap detection: `onPressIn`/`onPressOut` with time/distance checks
-   Status synchronization: Keeps UI in sync with player events
-   Memoization: Custom comparison prevents unnecessary rerenders

### `VideoOverlay.tsx`

Displays interactive UI elements (likes, comments, share) with animated fade-in when video becomes active.

## Configuration

### Video Sources

Edit `src/utils.ts` to change video sources:

```typescript
export const SOURCES = [
    "https://stream.mux.com/your-video-1.m3u8",
    "https://stream.mux.com/your-video-2.m3u8",
    // ... more sources (works with any number)
];
```

### Performance Tuning

In `src/App.tsx`:

```typescript
// LegendList configuration
<LegendList
    decelerationRate={0.92} // Adjust scroll speed (lower = faster)
    snapToInterval={screenHeight} // Snap distance
    drawDistance={screenHeight * 3} // Render distance
    recycleItems={false} // Keep false for correct video order
/>

// Viewability threshold
const viewabilityConfig = {
    itemVisiblePercentThreshold: 50, // Adjust when videos start playing
};
```

## Installation

```bash
# Install dependencies
bun install

# Run on iOS
bun run ios

# Run on Android
bun run android
```

## Technical Details

### React Native Video v7 Features Used

-   **`VideoPlayer`**: Core player instance with manual initialization
-   **`preload()`**: Preloads video without starting playback
-   **`initializeOnCreation: false`**: Manual control over initialization
-   **`replaceSourceAsync()`**: Changes video source dynamically (used for cleanup)
-   **Event System**: `onLoad`, `onStatusChange`, `onError` for state management
-   **`VideoView`**: Renders video player with controls disabled

### Infinite Scroll Implementation

```typescript
// Position-based indexing
const positionInArray = playersRef.current.length; // Current array length
const expectedUri = uris[positionInArray % uris.length]; // Cycles: 0,1,2,3,4,0,1,2...

// Key extractor uses array position
keyExtractor={(item, index) => `video-${index}`}

// Proactive fetching
if (remaining <= 3 && !fetchingRef.current) {
    fetchMoreVideos(); // Adds 2-3 videos ahead
}
```

### Preload Implementation

```typescript
// Safe preload with tracking
const safePreload = (player: VideoPlayer) => {
    if (preloadAttemptedRef.current.has(player)) {
        if (player.status !== "idle") return false; // Already loaded
    }
    if (player.status !== "idle" || !player.source?.uri) return false;
    player.preload();
    preloadAttemptedRef.current.add(player);
    return true;
};
```

### Cleanup Implementation

```typescript
// Zero-rerender cleanup
const cleanupOldPlayers = () => {
    const cleanupDistance = PLAYERS_AROUND_VIEWPORT * 2; // 8

    currentPlayers.forEach((player, idx) => {
        const distance = Math.abs(idx - currentIndex);
        if (distance > cleanupDistance) {
            if (player.isPlaying) player.pause();
            if (player.source?.uri) {
                player.replaceSourceAsync(null); // Release resources
            }
        }
    });
    // No setPlayers() call = no rerenders!
};
```

### Scroll Control Implementation

```typescript
// Automatic snapping with LegendList
<LegendList
    snapToInterval={screenHeight}
    snapToAlignment="start"
    decelerationRate={0.92}
    disableIntervalMomentum={true}
    recycleItems={false} // Critical for correct video order
/>

// Viewability detection
const viewabilityConfig = {
    itemVisiblePercentThreshold: 50, // Play when 50% visible
};

// Finalize index after scroll
const handleMomentumScrollEnd = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const exactIndex = Math.round(offsetY / screenHeight);
    setVisibleIndex(exactIndex);
};
```

## Performance Monitoring

The app includes built-in performance monitoring to track key metrics:

### Tracked Metrics

1. **Video Load Time**: Time to load video from idle to ready
2. **Preload Effectiveness**: Number of preloaded videos ready when needed

### Usage

**In Development Mode:**

-   Performance monitor overlay appears automatically (top-right corner)
-   Shows real-time metrics and averages
-   Clear button to reset metrics
-   Hide button to minimize overlay

**Programmatic Access:**

```typescript
import { performanceMonitor } from "./performance";

// Record custom metric
performanceMonitor.recordMetric("custom_metric", 123.45, { metadata: "value" });

// Get metrics
const metrics = performanceMonitor.getMetrics("video_load_time");
const average = performanceMonitor.getAverageMetric("video_load_time");

// Export all metrics
const json = performanceMonitor.exportMetrics();
```

**Using Hook:**

```typescript
import { usePerformanceMetrics } from "./performance";

const { summary, metrics, clear } = usePerformanceMetrics();
```

### Implementation

-   Uses native `performance.now()` API (no external dependencies)
-   Automatically tracks metrics during scroll and video events
-   Only active in `__DEV__` mode (disabled in production)
-   Lightweight with minimal overhead

## Performance Considerations

### Memory Management

-   **No Array Modifications**: Cleanup doesn't modify `players` array, preventing rerenders
-   **Resource Release**: Only releases video sources, keeps player instances
-   **FlatList Windowing**: `removeClippedSubviews` handles unmounting off-screen items
-   **Ref Tracking**: All async operations tracked for proper cleanup

### Network Optimization

-   **HLS Adaptive Streaming**: Automatically adjusts quality based on connection
-   **Proactive Preloading**: Videos ready before user scrolls to them
-   **Duplicate Prevention**: Preload tracking prevents redundant network requests
-   **Staggered Loading**: Initial preloads spaced 50ms apart to prevent overload

### Rendering Optimization

-   **Memoization**: `React.memo` with custom comparison prevents unnecessary rerenders
-   **Stable Keys**: Unique historical indices ensure stable FlatList keys
-   **Windowed Rendering**: Only renders visible items + buffer
-   **Event Throttling**: Scroll events throttled to 16ms (60fps)
