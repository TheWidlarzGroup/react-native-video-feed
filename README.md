# React Native Video v7 – TikTok-style feed

A vertical video feed in the style of TikTok built with **React Native Video v7** and **@legendapp/list**: smooth scroll, one-video snap, preloading, and iOS/Android optimizations.

## Features

### Video playback

- **HLS (Netlify)**: Sources are HLS streams from Netlify (`/v0/index.m3u8` … `/v9/index.m3u8`).
- **Start at 30% visibility**: Active video starts when 30% visible in the viewport.
- **One video per swipe**: `snapToInterval` + `disableIntervalMomentum={true}` – one swipe advances or goes back one video.
- **Tap to pause/play**: Tap on video to pause/resume; centered play button shows when paused.
- **Overlay**: Like, comment, share icons and animated play button.

### Performance

- **Platform-specific preload**: Android – 3 videos each direction, iOS – 5.
- **Placeholder on Android**: Outside the preload window a black placeholder is rendered instead of `VideoViewComponent` (fewer players = better performance).
- **Measured height**: On Android the list mounts only after `onLayout`; `itemHeight` = measured container height (correct layout, no “peek” of the next video).
- **Virtualization**: LegendList with fixed item size, memoization, recycling.
- **Source only in preload window**: `replaceSourceAsync` / `preload()` only for active and nearby items (per `MAX_PRELOAD_DISTANCE`).
- **AppState**: Playback pauses when app goes to background.

### Metrics (dev)

- **TTFF** (Time to First Frame): from `replaceSourceAsync`/`preload()` call to `readyToPlay`.
- **FPS**: number of `requestAnimationFrame` callbacks per second (≈ display refresh rate).
- **Scroll lag**: delay from scroll start to first frame (requestAnimationFrame).
- Enabled in `__DEV__`; view via 📊 button (PerformanceMonitor).

## Architecture

### Components

```
App.tsx
├── VideoFeedList (scroll, viewability, preload, Android placeholder)
│   └── VideoViewComponent (single item)
│       ├── VideoView (react-native-video)
│       └── VideoOverlay (play, icons)
└── BottomTabBar
```

### VideoFeedList

- **Current index**: `onViewableItemsChanged` → `currentIndex`; on Android the update runs in `requestAnimationFrame`.
- **Preload**: `MAX_PRELOAD_DISTANCE` – Android 3, iOS 5 (each direction).
- **Scroll direction**: `direction` used for preloading “ahead” vs “behind”.
- **Placeholder (Android only)**: When `!shouldPreload && !isActive` → black `View` instead of `VideoViewComponent`.
- **Android layout**: `measuredHeight` from `onLayout`; list renders only when `measuredHeight !== null`; `snapToInterval` / `getFixedItemSize` / item `itemHeight` all use the same measured height.

**Configuration:**

- `viewabilityConfig.itemVisiblePercentThreshold: 30`
- `MAX_PRELOAD_DISTANCE`: Android 3, iOS 5
- `DRAW_DISTANCE_MULTIPLIER`: Android 2, iOS 3 (e.g. `drawDistance = itemHeight * 2` or `* 3`)
- `SCROLL_EVENT_THROTTLE`: Android 32 ms, iOS 16 ms
- `snapToInterval={itemHeight}`, `snapToAlignment="start"`
- `decelerationRate={0.95}`
- `disableIntervalMomentum={true}` – one video per swipe

### VideoViewComponent

- **Player**: `useVideoPlayer(video.url)`; loop, mute.
- **Source**: In effect when `shouldPreload || isActive` – `replaceSourceAsync({ uri: video.url })` or `preload()` when `idle`; TTFF start is set before the call (not when status is `loading`).
- **Play/pause**: Play when `isActive && !userPaused && AppState === "active"`; pause otherwise; reset `currentTime` when becoming active.
- **Height**: `itemHeight` from list (measured layout on Android).

### useVideoFeed

- Video list from `SOURCES` (10 HLS URLs); `CYCLE_COUNT`: **Android 10**, **iOS 20** (100 vs 200 videos).
- Returns `videos`, `loading`, `error`, `refetch`.

## Video sources

In `src/utils/utils.ts`:

```typescript
const NETLIFY_BASE = "https://splendorous-muffin-0ddebe.netlify.app";

export const SOURCES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
    (i) => `${NETLIFY_BASE}/v${i}/index.m3u8`,
);
```

To change sources, edit `NETLIFY_BASE` or the index array.

## Configuration

### Preload

In `VideoFeedList.tsx`:

```typescript
const MAX_PRELOAD_DISTANCE = Platform.OS === "android" ? 3 : 5;
```

### Feed length

In `useVideoFeed.ts`:

```typescript
const CYCLE_COUNT = Platform.OS === "android" ? 10 : 20;
```

### Snap / momentum

- `disableIntervalMomentum={true}` – after releasing finger, scroll stops on the next/previous video (one per swipe).
- `decelerationRate={0.95}` – quick scroll decay.

## Installation & run

```bash
bun install
bun run ios
bun run android
```

## Dependencies

- **react-native-video@7.0.0-beta.2** – `useVideoPlayer`, `VideoView`, `useEvent`, `preload()`, `replaceSourceAsync()`
- **@legendapp/list** – list with virtualization and fixed item size
- **expo ~52**
- **react 18.3.1**, **react-native 0.76.9**

## Troubleshooting

- **On Android, a sliver of the next video is visible**: Ensure the list mounts after `onLayout` (`listReady`) and `itemHeight` is passed from measurement; placeholder outside preload enabled (`USE_PLACEHOLDER_OUTSIDE_PRELOAD`).
- **Slow scroll on Android**: Placeholder outside preload, lower `MAX_PRELOAD_DISTANCE` and `CYCLE_COUNT`, higher `scrollEventThrottle` (32).
- **Scroll skips several videos**: Use `disableIntervalMomentum={true}`.
- **TTFF**: Measured from `replaceSourceAsync`/`preload()` to `readyToPlay`; start is not set when status is `loading` (avoids underestimating TTFF).
- **FPS > 60**: On high-refresh-rate devices (e.g. 90/120 Hz), FPS reflects that refresh rate.

## License

Private project.
