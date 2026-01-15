# React Native Video v7 TikTok-Style Feed Example

A high-performance TikTok-style vertical video feed built with React Native Video v7 and `@legendapp/list`, featuring smooth infinite scroll, automatic snapping, intelligent preloading, and optimized playback controls.

## Features

### 🎥 Video Playback

- **HLS Stream Support**: Uses HLS streams for adaptive bitrate streaming
- **Early Start**: Videos start playing when 30% visible for faster engagement
- **Infinite Scroll**: Seamlessly cycles through videos with automatic snapping
- **Automatic Snapping**: `snapToInterval` ensures videos always align perfectly after scroll
- **Smooth Scrolling**: Optimized `decelerationRate` (0.88) for responsive, fluid scrolling
- **Tap to Pause/Play**: Tap anywhere on video to pause or resume playback
- **Play Button Overlay**: Centered play button appears when video is paused by user

### ⚡ Performance Optimizations

- **Intelligent Preloading**: Preloads up to 5 videos ahead and behind current position
- **Component Recycling**: Leverages `@legendapp/list` virtualization for efficient memory usage
- **Optimized Rendering**: LegendList with proper windowing, fixed item sizes, and memoization
- **Smart Source Management**: Only sets video source for active and preload-window videos
- **AppState Handling**: Automatically pauses videos when app goes to background

### 🎨 UI/UX

- **Animated Overlays**: UI elements (likes, comments, share) fade in smoothly when video becomes active
- **Play Button Indicator**: Centered play button with fade animation when video is paused
- **Loading States**: Proper loading indicators during video buffering
- **Error Handling**: Graceful error recovery
- **Seamless Scrolling**: No flicker or jumps during navigation

## Architecture

### Component Structure

```
App.tsx
├── VideoFeedList (manages scroll, viewability, preload logic)
│   └── VideoViewComponent (individual video item)
│       ├── VideoView (react-native-video player)
│       └── VideoOverlay (UI controls, play button)
└── BottomTabBar (navigation)
```

### Key Components

#### `App.tsx`
Main application entry point. Renders `VideoFeedList` and `BottomTabBar`.

#### `VideoFeedList.tsx`
Manages the scrollable list of videos using `@legendapp/list` (LegendList).

**Key Features:**
- Tracks current active video index via `onViewableItemsChanged`
- Calculates preload distance (5 videos ahead/behind)
- Determines scroll direction for smart preloading
- Uses `extraData={currentIndex}` to force re-renders when active video changes

**Configuration:**
- `viewabilityConfig.itemVisiblePercentThreshold: 30` - Videos start at 30% visibility
- `MAX_PRELOAD_DISTANCE: 8` - Preloads 5 videos in each direction
- `decelerationRate: 0.88` - Fast, responsive scrolling
- `scrollEventThrottle: 1` - Minimal throttling for smooth events
- `snapToInterval: SCREEN_HEIGHT` - Automatic snapping to video boundaries
- `drawDistance: SCREEN_HEIGHT * 3` - Renders 3 screens worth of content

#### `VideoViewComponent.tsx`
Renders individual video items and manages video lifecycle.

**Key Features:**
- Uses `useVideoPlayer` hook from `react-native-video` v7
- Manages source setting/clearing based on `isActive` and `shouldPreload` props
- Handles play/pause logic based on active state and user interaction
- Tracks `userPaused` state for manual pause/play
- Listens to `AppState` changes to pause/resume on background/foreground
- Uses `useEvent` to listen to `onStatusChange` and auto-play when ready

**Source Management:**
- Sets source via `replaceSourceAsync` when video becomes active or enters preload window
- Calls `preload()` after source is set to start buffering
- Does NOT clear source for videos outside preload window (relies on LegendList recycling)

**Playback Logic:**
- Plays when: `isActive && !userPaused && AppState === "active"`
- Pauses when: not active, user paused, or app in background
- Resets `currentTime` to 0 when video becomes active
- Unmutes active videos, mutes inactive ones

#### `VideoOverlay.tsx`
Displays UI overlays (likes, comments, share) and play button.

**Features:**
- Fades in when video becomes active
- Shows centered play button when video is paused by user
- Animated transitions using `Animated` API

#### `useVideoFeed.ts`
Hook that manages video data fetching.

**Features:**
- Fetches video list from `SOURCES` array
- Creates multiple cycles of videos (20 cycles by default)
- Returns `videos`, `loading`, `error`, and `refetch` function

## How It Works

### Initialization Flow

1. `App.tsx` renders `VideoFeedList`
2. `VideoFeedList` uses `useVideoFeed` hook to fetch video data
3. `LegendList` renders `VideoViewComponent` for each video
4. Each `VideoViewComponent` creates a `VideoPlayer` instance via `useVideoPlayer`
5. Videos in preload window automatically set source and call `preload()`

### Scroll Flow

1. User scrolls vertically
2. `onViewableItemsChanged` fires when video reaches 30% visibility
3. `handleVideoChange` updates `currentIndex` state
4. `renderItem` recalculates `isActive` and `shouldPreload` for each video
5. `VideoViewComponent` receives updated props and adjusts playback/source accordingly
6. `snapToInterval` automatically snaps to exact video position when scroll ends
7. Videos within 8 positions get preloaded automatically

### Preload Strategy

**Distance-Based Preloading:**
- Preloads current video + 5 videos ahead and 8 behind (17 total)
- Only preloads videos that are within `MAX_PRELOAD_DISTANCE`
- Direction-aware: when scrolling down, preloads ahead; when scrolling up, preloads behind

**Source Management:**
- Source is set via `replaceSourceAsync` when video enters preload window or becomes active
- `preload()` is called after source is set to start buffering
- Source is NOT explicitly cleared (relies on LegendList component recycling)

### Playback Control

**Automatic Playback:**
- Active video plays automatically when ready
- Inactive videos are paused and muted
- Videos reset to start (currentTime = 0) when becoming active

**User Control:**
- Tap anywhere on video to toggle pause/play
- `userPaused` state tracks manual pause
- Play button appears in center when video is paused by user
- Play button disappears when video resumes

**AppState Handling:**
- Videos pause when app goes to background
- Videos resume when app returns to foreground (if active and not user-paused)

## Configuration

### Video Sources

Edit `src/utils/utils.ts` to change video sources:

```typescript
export const SOURCES = [
    "https://example.com/video1.m3u8",
    "https://example.com/video2.m3u8",
    // ... more sources
];
```

### Preload Distance

In `src/components/VideoFeedList.tsx`:

```typescript
const MAX_PRELOAD_DISTANCE = 8; // Adjust number of videos to preload
```

### Viewability Threshold

In `src/components/VideoFeedList.tsx`:

```typescript
const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 30, // Adjust when videos start playing (0-100)
}).current;
```

### Scroll Performance

In `src/components/VideoFeedList.tsx`:

```typescript
<LegendList
    decelerationRate={0.88} // Lower = faster scroll (0.0 - 1.0)
    scrollEventThrottle={1} // Lower = more responsive (1-16)
    snapToInterval={SCREEN_HEIGHT} // Snap distance
    drawDistance={SCREEN_HEIGHT * 3} // Render distance
/>
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

## Dependencies

### Core Libraries

- **`react-native-video@7.0.0-beta.2`**: Video playback with `useVideoPlayer` and `VideoView`
- **`@legendapp/list@^2.0.19`**: High-performance list component with virtualization
- **`expo@~52.0.46`**: Expo framework
- **`react@18.3.1`**: React library
- **`react-native@0.76.9`**: React Native framework

### Key React Native Video v7 Features Used

- **`useVideoPlayer`**: Hook to create and manage video player instances
- **`VideoView`**: Component to render video player
- **`useEvent`**: Hook to listen to player events (onStatusChange, etc.)
- **`preload()`**: Method to preload video without starting playback
- **`replaceSourceAsync()`**: Method to change video source dynamically
- **`player.status`**: Player status (idle, loading, readyToPlay, etc.)
- **`player.isPlaying`**: Boolean indicating if video is currently playing

## Technical Details

### Memory Management

- **Component Recycling**: `@legendapp/list` automatically recycles components outside viewport
- **Source Management**: Sources are set for active/preload videos, but not explicitly cleared
- **Player Instances**: Each video has its own `VideoPlayer` instance created via `useVideoPlayer`
- **No Manual Cleanup**: Relies on React component lifecycle and LegendList recycling

### Performance Optimizations

**LegendList Configuration:**
- `getFixedItemSize={() => SCREEN_HEIGHT}` - Fixed item size for better performance
- `estimatedItemSize={SCREEN_HEIGHT}` - Helps with initial render
- `drawDistance={SCREEN_HEIGHT * 3}` - Renders 3 screens worth of content
- `getItemType={() => "video"}` - All items are same type for better recycling
- `extraData={currentIndex}` - Forces re-render when active video changes

**React Optimizations:**
- `useCallback` for all event handlers to prevent unnecessary re-renders
- `useRef` for stable references (indexRef, wasActiveRef)
- Direct state updates in `renderItem` for immediate prop propagation

**Video Player Optimizations:**
- Preload only when needed (within preload distance)
- Mute inactive videos to save resources
- Reset `currentTime` to 0 when pausing to prevent audio overlap
- Use `onStatusChange` event to auto-play when ready

### Scroll Behavior

**Snapping:**
- `pagingEnabled={true}` - Enables paging behavior
- `snapToInterval={SCREEN_HEIGHT}` - Snaps to exact video height
- `snapToAlignment="start"` - Aligns snap to start of video
- `disableIntervalMomentum={false}` - Allows momentum scrolling

**Smoothness:**
- `decelerationRate={0.88}` - Fast deceleration for snappy feel
- `scrollEventThrottle={1}` - Minimal throttling for responsive events
- `bounces={false}` - No bounce effect for cleaner feel
- `overScrollMode="never"` - No overscroll on Android

## Architecture Decisions

### Why LegendList instead of FlatList?

- Better performance with large lists
- More efficient component recycling
- Better support for fixed item sizes
- Optimized for vertical scrolling feeds

### Why not clear source for inactive videos?

- `replaceSourceAsync(null)` was found to be unreliable in testing
- LegendList handles component recycling automatically
- Clearing source caused black screens and playback issues
- Keeping source allows faster resume when scrolling back

### Why 30% viewability threshold?

- Lower threshold (30% vs 50%) means videos start playing earlier
- Reduces perceived lag when scrolling
- Videos are ready to play by the time they're fully visible
- Balances early start with not starting too many videos at once

### Why direction-aware preloading?

- When scrolling down, we need videos ahead (future)
- When scrolling up, we need videos behind (past)
- Direction tracking ensures we preload the right videos
- Reduces unnecessary preloading in wrong direction

## Troubleshooting

### Videos not playing after scroll

- Check that `isActive` prop is correctly passed to `VideoViewComponent`
- Verify `extraData={currentIndex}` is set on LegendList
- Check console logs for playback status

### Black screens

- Verify source is set correctly via `replaceSourceAsync`
- Check that `preload()` is called after source is set
- Ensure video URL is valid and accessible

### Scroll not smooth

- Adjust `decelerationRate` (lower = faster)
- Check `scrollEventThrottle` value
- Verify `drawDistance` is appropriate for device

### Memory issues

- Reduce `MAX_PRELOAD_DISTANCE` if needed
- Check that LegendList is recycling components properly
- Monitor device memory usage

## License

Private project.
