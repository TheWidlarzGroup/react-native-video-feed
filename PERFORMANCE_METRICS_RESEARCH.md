# Research: Performance Metrics Measurement

## Required Metrics

1. **Time to First Frame (TTFF)** - Time from when video appears in viewport to first frame displayed
2. **FPS Stability (Frame Drops)** - Percentage of frames lost during video playback
3. **Memory Usage (Active Memory)** - RAM consumption by a single video player at a given moment
4. **Scroll Responsiveness (Scroll Lag)** - Input-to-frame delay when scrolling video list (target: ≤16ms for 60Hz)

---

## 1. Time to First Frame (TTFF)

### Definition

Time from the moment video appears in the visible screen area (viewport) to the moment the first frame is displayed.

### Measurement Method

#### A. Detecting Viewport Entry

-   **React Native FlatList**: Use `onViewableItemsChanged` callback (already used in `App.tsx`)
-   **Start moment**: When `isViewable === true` and `percentVisible >= 50%`
-   **Save timestamp**: `performance.now()` at viewport entry moment

#### B. Detecting First Frame

-   **react-native-video v7**: Use `onProgress` event - first callback indicates first displayed frame
-   **Alternative**: Monitor `player.status === "readyToPlay"` + `player.isPlaying === true`
-   **Save timestamp**: `performance.now()` at first frame moment

#### C. TTFF Calculation

```typescript
TTFF = timestamp_first_frame - timestamp_viewport_entry;
```

### Implementation

-   Extended `VideoViewComponent.tsx` with TTFF tracking
-   Uses existing `performanceMonitor` to record metric
-   New metric type: `"ttff"`
-   **Note**: First video (index 0) is skipped as it has initial load overhead

### Challenges

-   Difference between `onLoad` (video loaded) and actual first frame on screen
-   Solution: Use `onProgress` as more precise indicator

---

## 2. FPS Stability (Frame Drops)

### Definition

Percentage of frames lost during playback. Example: 2 frames lost out of 60 = 3.3% drop rate.

### Measurement Method

#### A. Theoretical Frame Count

-   **Assumption**: 60 FPS (or read from video metadata)
-   **Playback time**: `currentTime` from `onProgress` event
-   **Expected frame count**: `currentTime * fps`

#### B. Actual Frame Count

-   **react-native-video v7**: `onProgress` event called regularly (~every 250ms by default)
-   **Interpolation**: Between `onProgress` callbacks, assume smooth playback
-   **Or**: Use `requestAnimationFrame` to monitor rendering

#### C. Frame Drops Calculation

```typescript
// Example for 60 FPS
const expectedFrames = elapsedTime * 60;
const actualFrames = progressCallbacks.length * (60 / 4); // 4 callbacks/second
const droppedFrames = expectedFrames - actualFrames;
const dropRate = (droppedFrames / expectedFrames) * 100;
```

### Alternative Method (More Precise)

-   **requestAnimationFrame**: Monitor RAF call frequency
-   **Compare**: Expected 60 FPS vs actual FPS from RAF
-   **Frame drops**: Difference between expected and actual frames

### Implementation

-   Tracking added in `VideoViewComponent.tsx`
-   Monitors `onProgress` events (reduced frequency to avoid performance impact)
-   Uses `requestAnimationFrame` to measure actual FPS every 3 seconds
-   New metric type: `"fps_stability"` (includes drop rate in metadata)
-   **Note**: Frame drops are included in `fps_stability` metadata, no separate metric needed

### Challenges

-   `onProgress` is not called exactly per frame (~every 250ms)
-   Need interpolation or use RAF
-   Different devices have different refresh rates (60Hz, 120Hz)

---

## 3. Memory Usage (Active Memory)

### Definition

Amount of RAM consumed by a single video player at a given moment.

### Measurement Method

#### A. React Native Performance API

-   **Limitations**: React Native Performance API doesn't provide direct access to per-component memory

#### B. Native Modules

-   **iOS**: Use `RCTMemoryInfo` or `ProcessInfo.processInfo.physicalMemory`
-   **Android**: Use `ActivityManager.getMemoryInfo()` or `Debug.getNativeHeapSize()`
-   **Problem**: These APIs provide memory for entire app, not per-component

#### C. Approximate Method (Current Implementation)

-   **Estimate based on active players**: Count active video players
-   **Rough estimate**: ~75MB per active video player
-   **Difference**: Approximate usage by players
-   **Note**: Not precise, as other processes can change memory

#### D. Better Method (Requires Native Module)

-   **Create native module**: `VideoMemoryTracker`
-   **iOS**: Use `AVPlayer` memory tracking (if available)
-   **Android**: Use `ExoPlayer` memory tracking (if available)
-   **React Native**: Export to JS through bridge

### Implementation (Currently Simplified)

-   Uses player count as proxy for memory estimation
-   Tracks every 30 seconds (reduced frequency to lower overhead)
-   New metric type: `"memory_usage"` (in MB)
-   **Note**: This is an estimation, not precise measurement. For accurate measurements, a native module would be required.

### Challenges

-   No direct API for per-component memory measurement in RN
-   Requires native module for precise measurements
-   Different devices have different memory allocations

---

## 4. Scroll Responsiveness (Scroll Lag)

### Definition

UI delay (input-to-frame) when scrolling video list. Target: draw time ≤16ms (1 frame at 60Hz).

### Measurement Method

#### A. Input Timestamp

-   **React Native ScrollEvent**: Use `performance.now()` when scroll starts (React Native timestamp may not be reliable)
-   **Save**: Timestamp at scroll event start

#### B. Frame Render Timestamp

-   **requestAnimationFrame**: RAF call indicates frame rendering start
-   **Performance API**: `performance.now()` in RAF callback
-   **Difference**: `raf_timestamp - scroll_timestamp`

#### C. Lag Calculation

```typescript
const scrollTimestamp = performance.now();
requestAnimationFrame(() => {
    const renderTimestamp = performance.now();
    const lag = renderTimestamp - scrollTimestamp;
    // Target: lag <= 16ms
});
```

### Implementation

-   Extended `handleScroll` in `App.tsx`
-   Tracks input-to-frame latency
-   Measures only once per scroll gesture (not on every scroll event)
-   Scroll direction determined by comparing current offset with previous offset
-   New metric type: `"scroll_lag"`

### Challenges

-   `e.nativeEvent.timestamp` may be in different units (ms vs seconds)
-   Need to check timestamp format in React Native
-   Different devices have different refresh rates
-   **Solution**: Use `performance.now()` for consistent timestamps

---

## Implementation Plan

### Phase 1: TTFF ✅

1. ✅ Added viewport entry tracking in `VideoViewComponent`
2. ✅ Added first frame tracking (using `onProgress` as first callback)
3. ✅ Calculate and record TTFF
4. ✅ Skip first video (index 0) to avoid initial load overhead

### Phase 2: Scroll Responsiveness ✅

1. ✅ Extended `handleScroll` with input-to-frame measurement
2. ✅ Used `requestAnimationFrame` to measure render time
3. ✅ Measure only once per scroll gesture
4. ✅ Proper scroll direction calculation

### Phase 3: FPS Stability ✅

1. ✅ Added `onProgress` event tracking (reduced frequency)
2. ✅ Used `requestAnimationFrame` to measure actual FPS
3. ✅ Frame drops included in `fps_stability` metadata

### Phase 4: Memory Usage ✅

1. ✅ Simplified measurement (player count as proxy)
2. ⏭️ Future: Native module for precise measurements

---

## Libraries and Helper Tools

### React Native Performance API

-   `performance.now()` - High-resolution timestamps
-   `PerformanceObserver` - Performance monitoring (if available)

### react-native-video v7 Events

-   `onLoad` - Video loaded
-   `onProgress` - Playback progress (~every 250ms)
-   `onStatusChange` - Player status change
-   `player.currentTime` - Current playback time
-   `player.duration` - Video duration

### React Native ScrollView/FlatList

-   `onScroll` - Scroll event
-   `e.nativeEvent.contentOffset` - Scroll position
-   `onMomentumScrollEnd` - Scroll end event
-   `onScrollEndDrag` - Drag end event

### requestAnimationFrame

-   For measuring actual FPS
-   For measuring input-to-frame latency

---

## Metric Data Structure

```typescript
interface TTFFMetric {
    name: "ttff";
    value: number; // ms
    timestamp: number;
    metadata: {
        index: number;
        preloaded: number; // 0 or 1
    };
}

interface FPSStabilityMetric {
    name: "fps_stability";
    value: number; // actual FPS
    timestamp: number;
    metadata: {
        index: number;
        fpsDropRate: string; // percentage as string
    };
}

interface MemoryUsageMetric {
    name: "memory_usage";
    value: number; // MB (estimated)
    timestamp: number;
    metadata: {
        activePlayerCount: number;
        totalPlayerCount: number;
        visibleIndex: number;
    };
}

interface ScrollLagMetric {
    name: "scroll_lag";
    value: number; // ms
    timestamp: number;
    metadata: {
        fromIndex: number;
        scrollDirection: "up" | "down";
        targetMs: number; // 16 for 60Hz
    };
}
```

---

## Implementation Status

1. ✅ Research completed
2. ✅ TTFF implementation
3. ✅ Scroll Responsiveness implementation
4. ✅ FPS Stability implementation
5. ✅ Memory Usage implementation (simplified)
6. ✅ PerformanceMonitor UI extension
7. ✅ Testing and validation

---

## Notes

-   **Memory Usage**: Current implementation is an estimation based on player count. For production use, consider implementing a native module for precise measurements.
-   **FPS Stability**: Frame drops are included in the `fps_stability` metric metadata, no separate `frame_drops` metric is needed.
-   **TTFF**: First video (index 0) is skipped in measurements to avoid initial app load overhead affecting results.
-   **Scroll Lag**: Measured only once per scroll gesture to avoid spam. Direction is determined by comparing scroll offsets.
