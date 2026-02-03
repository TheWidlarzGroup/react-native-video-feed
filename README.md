# React Native Video v7 – TikTok-style feed

A vertical video feed in the style of TikTok built with **React Native Video v7** and **@legendapp/list**: smooth scroll, one-video snap, preloading, and iOS/Android optimizations.

## Features

### Video playback

-   **HLS**: Sources are HLS streams from Netlify (`/v0/index.m3u8` … `/v9/index.m3u8`).
-   **Start at 30% visibility**: Active video starts when 30% visible in the viewport.
-   **One video per swipe**: `snapToInterval` + `disableIntervalMomentum={true}` – one swipe advances or goes back one video.
-   **Tap to pause/play**: Tap on video to pause/resume; centered play button shows when paused.
-   **Overlay**: Like, comment, share icons and animated play button.

### Performance

-   **Asymmetric preload**: 1 video behind (for quick scroll back), **3 ahead** on Android and **5 ahead** on iOS (`PRELOAD_BEHIND=1`, `PRELOAD_AHEAD` platform-specific). Fewer players than symmetric preload.
-   **Placeholder on Android**: Outside the preload window a black placeholder is rendered instead of `VideoViewComponent` (fewer players = better performance).
-   **Measured height**: On Android the list mounts only after `onLayout`; `itemHeight` = measured container height (correct layout, no “peek” of the next video).
-   **Virtualization**: LegendList with fixed item size, memoization, recycling.
-   **Source only in preload window**: `replaceSourceAsync` / `preload()` only for active and items within preload range.
-   **Scroll feel**: `decelerationRate` – Android 0.98 (slower scroll), iOS 0.95; `disableIntervalMomentum={true}` for one video per swipe.
-   **AppState**: Playback pauses when app goes to background.

### Metrics (dev)

-   **TTFF (load)**: from `replaceSourceAsync`/`preload()` (or when status is already `loading`) to `readyToPlay`.
-   **Perceived TTFF**: from when the video becomes visible (active) to `readyToPlay`; ~0 ms when preload works well.
-   **FPS**: number of `requestAnimationFrame` callbacks per second (≈ display refresh rate).
-   **Scroll lag**: delay from scroll start to first frame (requestAnimationFrame).
-   Enabled in `__DEV__`; view via 📊 button (PerformanceMonitor).

## Made by TheWidlarzGroup

Supported by **TheWidlarzGroup** – the group of React Native Special Task Forces. If you like this project, give it a star ⭐

**E-mail** us if you have any questions or just want to talk: [hi@thewidlarzgroup.com](mailto:hi@thewidlarzgroup.com)

### 🤝 Can I hire you?

TWG provides **commercial support** for this project. Feel free to [contact us](https://thewidlarzgroup.com) to build something awesome together 🚀

Need a custom use case, an extra feature, or want to speed up the feed even more? We can help with that too – reach out for consulting or implementation.

**Request a consultation:** [Contact us](https://thewidlarzgroup.com) 😎

### 🌐 Follow us

Stay up to date with news – follow us on [Twitter](https://x.com/WidlarzGroup) or [LinkedIn](https://www.linkedin.com/company/the-widlarz-group/).

**TheWidlarzGroup**

[![TheWidlarzGroup](assets/baners/twg-dark.png)](https://thewidlarzgroup.com)

---

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

-   **Current index**: `onViewableItemsChanged` → `currentIndex`; on Android the update runs in `requestAnimationFrame`.
-   **Preload**: asymmetric – **1 behind**, **3 ahead** (Android) or **5 ahead** (iOS). `PRELOAD_BEHIND=1`, `PRELOAD_AHEAD` platform-specific.
-   **Scroll direction**: `direction` used for preloading “ahead” vs “behind”.
-   **Placeholder (Android only)**: When `!shouldPreload && !isActive` → black `View` instead of `VideoViewComponent`.
-   **Android layout**: `measuredHeight` from `onLayout`; list renders only when `measuredHeight !== null`; `snapToInterval` / `getFixedItemSize` / item `itemHeight` all use the same measured height.

**Configuration:**

-   `viewabilityConfig.itemVisiblePercentThreshold: 30`
-   `PRELOAD_AHEAD`: Android 3, iOS 5 | `PRELOAD_BEHIND`: 1
-   `DRAW_DISTANCE_MULTIPLIER`: Android 2, iOS 3
-   `SCROLL_EVENT_THROTTLE`: Android 32 ms, iOS 16 ms
-   `snapToInterval={itemHeight}`, `snapToAlignment="start"`
-   `DECELERATION_RATE`: Android 0.98, iOS 0.95
-   `disableIntervalMomentum={true}` – one video per swipe

### VideoViewComponent

-   **Player**: `useVideoPlayer(video.url)`; loop, mute.
-   **Source**: In effect when `shouldPreload || isActive` – `replaceSourceAsync({ uri: video.url })` or `preload()` when `idle`; TTFF (load) start set before call, or when status is already `loading` (fallback so Android still records TTFF).
-   **Play/pause**: Play when `isActive && !userPaused && AppState === "active"`; pause otherwise; reset `currentTime` when becoming active.
-   **Perceived TTFF**: Start when `isActive` becomes true; record when `readyToPlay` (or 0 if already ready when becoming active).
-   **Height**: `itemHeight` from list (measured layout on Android).

### useVideoFeed

-   Video list from `SOURCES` (10 HLS URLs); `CYCLE_COUNT`: **Android 10**, **iOS 20** (100 vs 200 videos).
-   Returns `videos`, `loading`, `error`, `refetch`.



## Configuration

### Preload

In `VideoFeedList.tsx`:

```typescript
const PRELOAD_AHEAD = Platform.OS === "android" ? 3 : 5;
const PRELOAD_BEHIND = 1;
```

### Feed length

In `useVideoFeed.ts`:

```typescript
const CYCLE_COUNT = Platform.OS === "android" ? 10 : 20;
```

### Snap / momentum

-   `disableIntervalMomentum={true}` – after releasing finger, scroll stops on the next/previous video (one per swipe).
-   `DECELERATION_RATE`: Android 0.98 (slower), iOS 0.95 – scroll decay.

## Installation & run

```bash
bun install
bun run ios
bun run android
```

## Dependencies

-   **react-native-video@7.0.0-beta.2** – `useVideoPlayer`, `VideoView`, `useEvent`, `preload()`, `replaceSourceAsync()`
-   **@legendapp/list** – list with virtualization and fixed item size
-   **expo ~52**
-   **react 18.3.1**, **react-native 0.76.9**
