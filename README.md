# React Native Video Feed – TikTok-style feed demo

A vertical video feed in the style of TikTok built with **React Native Video v7** and **@legendapp/list** using **Expo**: smooth scroll, one-video snap, preloading, and iOS/Android optimizations.

## Made by TheWidlarzGroup

Supported by **TheWidlarzGroup** – the software agency with focus on audio and video in React Native. Maintainers of [react-native-video](https://github.com/TheWidlarzGroup/react-native-video). Builders of a [PRO player](https://sdk.thewidlarzgroup.com/). If you like this project, give it a star ⭐


### 🤝 Can I hire you?

TWG provides **commercial support** for this project.

Need a custom use case, an extra feature, or want to speed up the feed even more? We can help with that too – reach out for consulting or implementation.

See [FEED_EXTENSIONS.md](./FEED_EXTENSIONS.md) for possible enhancements (DAI/video ads, user tracking, UI customization, mixed content, navigation).

[Request a consultation](mailto:hi@thewidlarzgroup.com) 😎

### 🌐 Follow us

Stay up to date with news – follow us on [Twitter](https://x.com/WidlarzGroup) or [LinkedIn](https://www.linkedin.com/company/the-widlarz-group/).

[![TheWidlarzGroup](assets/baners/rnv-banner.png)](https://sdk.thewidlarzgroup.com/)

## Features

### Video playback

-   **HLS**: Sources are HLS streams (`/v0/index.m3u8` … `/v9/index.m3u8`).
-   **Start at 30% visibility**: Active video starts when 30% visible in the viewport.
-   **One video per swipe**: `snapToInterval` + `disableIntervalMomentum={true}` – one swipe advances or goes back one video.
-   **Tap to pause/play**: Tap on video to pause/resume; centered play button shows when paused.
-   **Overlay**: Like, comment, share icons and animated play button.

### Performance

-   **Preload window**: 1 behind, **3 ahead on both platforms** (plus immediate neighbors stay preloaded). Placeholders outside the window to reduce active players.
-   **Virtualization**: LegendList with fixed item size and draw distance 2× item height.
-   **Source loading only in window**: `shouldPreload` gates when a player is hydrated.
-   **Scroll feel**: `decelerationRate` 0.98, paging enabled; `disableIntervalMomentum` 

### Metrics (dev)

-   **TTFF (load)**: from `replaceSourceAsync`/`preload()` (or when status is already `loading`) to `readyToPlay`.
-   **Perceived TTFF**: from when the video becomes visible (active) to `readyToPlay`; ~0 ms when preload works well.
-   **FPS**: number of `requestAnimationFrame` callbacks per second (≈ display refresh rate).
-   **Scroll lag**: delay from scroll start to first frame (requestAnimationFrame).
-   Enabled in `__DEV__`; view via 📊 button (PerformanceMonitor).


## Why use this demo?

1. **Production-ready patterns** – Asymmetric preload (1 behind, 3 ahead), viewability-based play, and source loading only in the preload window. Copy these patterns into your app instead of figuring them out from scratch.

2. **React Native Video v7 + Legend List** – See how `useVideoPlayer`, `replaceSourceAsync`, `preload()` and a virtualized list work together for a TikTok-style feed on both iOS and Android with one codebase.

3. **Performance from day one** – Virtualization, platform-tuned preload counts, and optional dev metrics (TTFF, perceived TTFF, FPS, scroll lag) so you can measure and improve before launch.

4. **HLS-ready** – Built for real HLS streams (`.m3u8`); preload and playback are tuned for manifest-based sources, so you can plug in your own CDN or ad-stitched URLs without reworking the player logic.

5. **TikTok-style UX** – One video per swipe, play on 30% visibility, tap to pause and overlay controls (like, comment, share). The scroll and snap behaviour are tuned per platform so the feed feels native on both iOS and Android.



**Configuration:**

-   `viewabilityConfig.itemVisiblePercentThreshold: 30`
-   `PRELOAD_AHEAD`: Android 3, iOS 5 | `PRELOAD_BEHIND`: 1
-   `DRAW_DISTANCE_MULTIPLIER`: Android 2, iOS 3
-   `SCROLL_EVENT_THROTTLE`: Android 32 ms, iOS 16 ms
-   `snapToInterval={itemHeight}`, `snapToAlignment="start"`
-   `DECELERATION_RATE`: Android 0.98, iOS 0.95
-   `disableIntervalMomentum={true}` – one video per swipe

### VideoViewComponent

-   **Player**: `useVideoPlayer(video.url)`; loop, muted.
-   **Hydration**: Player only rendered for items in the preload/active window (placeholders elsewhere).
-   **Play/pause**: Play when `isActive && !userPaused && AppState === "active"`; pause otherwise; reset `currentTime` when becoming active.
-   **Height**: `itemHeight` from list (measured layout on Android).

### useVideoFeed

-   Video list from `SOURCES` (10 HLS URLs); `CYCLE_COUNT`: **Android 10**, **iOS 20** (100 vs 200 videos).
-   Returns `videos`, `loading`, `error`, `refetch`.

## Configuration

### Preload

In `VideoFeedList.tsx`:

```typescript
const PRELOAD_AHEAD = 3;
const PRELOAD_BEHIND = 1;
```

### Feed length

In `useVideoFeed.ts`:

```typescript
const CYCLE_COUNT = Platform.OS === "android" ? 10 : 20;
```

### Snap / momentum

-   Paging enabled on both platforms, `snapToInterval` per item height.
-   `disableIntervalMomentum` on Android for one-video snap.
-   `DECELERATION_RATE`: 0.98 on both platforms.

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
