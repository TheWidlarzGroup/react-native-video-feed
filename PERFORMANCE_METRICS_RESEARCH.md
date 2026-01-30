# Research: Performance Metrics Measurement

## Required Metrics

1. **Time to First Frame (TTFF)** - Time from when video preload starts to first frame ready (readyToPlay status)
2. **Perceived TTFF** - Time from when the video becomes visible (active) to first frame ready; user-facing metric; ~0 ms when preload works well
3. **FPS Stability (Frame Drops)** - Actual FPS measured via requestAnimationFrame, with dropped frames detection
4. **Memory Usage (Active Memory)** - RAM consumption by video players (requires native measurement - see instructions below)
5. **Scroll Responsiveness (Scroll Lag)** - Input-to-frame delay when scrolling video list (target: ≤16ms for 60Hz)

**Note**: Only metrics measurable in JavaScript are implemented. Memory Usage requires native module implementation.

---

## 1. Time to First Frame (TTFF)

### Definition

Time from the moment video preload starts to the moment the first frame is ready to play (readyToPlay status).

**Current Implementation**: Measures from preload start, not from viewport entry, to capture actual video loading performance.

### Measurement Method

#### A. Detecting Preload Start

-   **Start moment**: When `player.preload()` is called or `replaceSourceAsync()` begins
-   **Save timestamp**: `performance.now()` at preload start moment
-   **Location**: In `VideoViewComponent.tsx` useEffect that handles preload logic

#### B. Detecting First Frame Ready

-   **react-native-video v7**: Monitor `player.status === "readyToPlay"` via `onStatusChange` event
-   **Save timestamp**: `performance.now()` when status changes to readyToPlay

#### C. TTFF Calculation

```typescript
TTFF = timestamp_readyToPlay - timestamp_preload_start;
```

### Implementation

-   Implemented in `VideoViewComponent.tsx`
-   Tracks preload start when `player.preload()` is called or source is replaced
-   Records TTFF when `player.status === "readyToPlay"`
-   Uses `performanceMonitor.recordMetric("ttff", ttff, metadata)`
-   Metric includes metadata: `videoId`, `status`, `wasActive`

### Notes

-   If video is already `readyToPlay` when preload starts, TTFF = 0 (preload worked perfectly)
-   Measurement happens regardless of whether video is active or not
-   Provides accurate video loading performance data

---

## 2. Perceived TTFF (visible → ready)

### Definition

Time from when the video **becomes visible** (user scrolls to it, `isActive` becomes true) to when the first frame is ready (`readyToPlay`). This is the **user-facing** metric: how long the user waits from seeing the video cell until playback can start.

### Why two TTFF metrics?

- **TTFF (load)**: From `replaceSourceAsync`/`preload()` to `readyToPlay` – measures player/network load time; can be measured before the video is visible (preload).
- **Perceived TTFF**: From visible to `readyToPlay` – measures UX; if preload is good, this is ~0 ms (video already ready when user scrolls to it).

### Measurement Method

- **Start**: When `isActive` becomes true (video is the active/visible one); store `visibleAtRef.current = performance.now()`.
- **End**: When `player.status === "readyToPlay"`.
- **Special case**: If the video is already `readyToPlay` when we become active (preloaded), record perceived TTFF = 0 and metadata `preloaded: true`.

### Implementation

- In `VideoViewComponent.tsx`: `visibleAtRef` set when `isActive` transitions to true; in `onStatusChange` when `readyToPlay` and active, record `perceived_ttff = now - visibleAtRef`. When becoming active with `player.status === "readyToPlay"` already, record 0.
- Metric: `performanceMonitor.recordMetric("perceived_ttff", value, { videoId, status, preloaded? })`.
- One record per “visible session” (reset when `isActive` becomes false or `video.id` changes).

---

## 3. FPS Stability (Frame Drops)

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

-   Implemented in `useFPSMonitor` hook (`src/hooks/useFPSMonitor.ts`)
-   Uses `requestAnimationFrame` to measure actual FPS
-   Detects dropped frames when deltaTime > 2x expected frame time (~33.34ms for 60 FPS)
-   Reports FPS stability every 1 second
-   Metric type: `"fps_stability"` (value is actual FPS)
-   Metadata includes: `droppedFrames` count and `dropRate` percentage
-   Hook is enabled in `App.tsx` via `useFPSMonitor(true)`

### Challenges

-   `onProgress` is not called exactly per frame (~every 250ms)
-   Need interpolation or use RAF
-   Different devices have different refresh rates (60Hz, 120Hz)

---

## 4. Memory Usage (Active Memory)

### Definition

Amount of RAM consumed by video players at a given moment.

### Measurement Method

#### JavaScript Limitation

-   `performance.memory` is **only available in Chrome DevTools/React Native Debugger**
-   Not available on real devices in production
-   React Native Performance API doesn't provide per-component memory access

#### Measurement in DevTools

**Chrome DevTools (React Native Debugger):**

1. Open Chrome DevTools (when using React Native Debugger)
2. Go to **Console** tab
3. Type: `performance.memory` to see memory info:
   ```javascript
   {
     jsHeapSizeLimit: 4294705152,
     totalJSHeapSize: 12345678,
     usedJSHeapSize: 9876543
   }
   ```
4. `usedJSHeapSize` is the current memory usage in bytes
5. Convert to MB: `usedJSHeapSize / (1024 * 1024)`

**React Native Debugger:**

1. Enable remote debugging
2. Open Chrome DevTools
3. Use `performance.memory` in console
4. Monitor memory usage over time by periodically checking values

**Manual Measurement Script:**

```javascript
// Run in DevTools console
const measureMemory = () => {
  if (performance.memory) {
    const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);
    const totalMB = performance.memory.totalJSHeapSize / (1024 * 1024);
    const limitMB = performance.memory.jsHeapSizeLimit / (1024 * 1024);
    
    console.log(`Memory Usage: ${usedMB.toFixed(2)} MB`);
    console.log(`Total Heap: ${totalMB.toFixed(2)} MB`);
    console.log(`Heap Limit: ${limitMB.toFixed(2)} MB`);
    
    return usedMB;
  }
  return null;
};

// Measure every 5 seconds
setInterval(measureMemory, 5000);
```

### Current Status

-   ⚠️ **Only measurable in DevTools** (not on real devices)
-   📝 **Metric type**: `"memory_usage"` (in MB)
-   💡 **Note**: For production measurements, use native profiling tools (Xcode Instruments, Android Profiler)

---

## 5. Scroll Responsiveness (Scroll Lag)

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

-   Implemented in `VideoFeedList.tsx`
-   Uses `onScrollBeginDrag` event to capture scroll start
-   Uses `requestAnimationFrame` to measure frame render time
-   Calculates: `scrollLag = raf_timestamp - scroll_start_timestamp`
-   Metric type: `"scroll_lag"` (in ms)
-   Metadata includes: `timestamp`
-   Target: ≤16ms for 60Hz displays

### Challenges

-   `e.nativeEvent.timestamp` may be in different units (ms vs seconds)
-   Need to check timestamp format in React Native
-   Different devices have different refresh rates
-   **Solution**: Use `performance.now()` for consistent timestamps

---

## Implementation Status

### ✅ Implemented Metrics (JavaScript)

1. **TTFF** - Measures from preload start to readyToPlay
   - Location: `src/components/VideoViewComponent.tsx`
   - Metric: `"ttff"` (in ms)

2. **FPS Stability** - Measures actual FPS via requestAnimationFrame
   - Location: `src/hooks/useFPSMonitor.ts`
   - Metric: `"fps_stability"` (in fps)
   - Includes dropped frames detection

3. **Scroll Lag** - Measures input-to-frame delay
   - Location: `src/components/VideoFeedList.tsx`
   - Metric: `"scroll_lag"` (in ms)

### ⏭️ Requires Native Module

4. **Memory Usage** - Cannot be measured in JavaScript
   - Requires native module implementation (see instructions above)
   - Metric type ready: `"memory_usage"` (in MB)
   - Integration code provided in instructions

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
    value: number; // ms (0 if preloaded, otherwise time from preload start)
    timestamp: number;
    metadata: {
        videoId: string;
        status: "readyToPlay" | "loading" | "idle" | "error";
        wasActive: boolean; // whether video was active when measured
    };
}

interface FPSStabilityMetric {
    name: "fps_stability";
    value: number; // actual FPS measured
    timestamp: number;
    metadata: {
        droppedFrames: number; // count of dropped frames
        dropRate: string; // percentage as string (e.g., "3.3%")
    };
}

interface MemoryUsageMetric {
    name: "memory_usage";
    value: number; // MB (only available in DevTools)
    timestamp: number;
    metadata?: Record<string, any>; // optional additional data
}

interface ScrollLagMetric {
    name: "scroll_lag";
    value: number; // ms (input-to-frame delay)
    timestamp: number;
    metadata: {
        timestamp: number; // when measurement was taken
    };
}
```

---

## Performance Monitor UI

-   Location: `src/components/PerformanceMonitor.tsx`
-   Toggle button (📊) to show/hide metrics
-   Displays average values for all metrics
-   Shows last 20 individual metric records
-   Export button to log JSON metrics to console
-   Clear button to reset all metrics
-   Only visible in `__DEV__` mode

## Usage

All metrics are automatically collected when:
-   `useFPSMonitor(true)` is called in `App.tsx`
-   Videos are loaded and played in `VideoFeedList`
-   User scrolls the video feed

Metrics can be viewed in the PerformanceMonitor UI (toggle button) or exported via console.

---

## Notes

-   **Memory Usage**: Only measurable in DevTools via `performance.memory`. Not available on real devices. Use native profiling tools (Xcode Instruments, Android Profiler) for production measurements.
-   **FPS Stability**: Measured continuously via `requestAnimationFrame`. Frame drops are included in metadata.
-   **TTFF**: Measures from preload start to readyToPlay, providing accurate video loading performance data.
-   **Scroll Lag**: Measured on each `onScrollBeginDrag` event using `requestAnimationFrame` for frame timing.
-   **Console Logs**: Removed to reduce noise. Use PerformanceMonitor UI or export function to view metrics.
