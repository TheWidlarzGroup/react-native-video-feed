# Feed Extensions & Possible Features

An overview of **that could be implemented** to add to this React Native Video v7 feed. These features are **not implemented** in this repository. Contact [TheWidlarzGroup](https://thewidlarzgroup.com) (hi@thewidlarzgroup.com) to discuss implementation.

## Ads

### Dynamic Ad Insertion (DAI)

-   Server-side ad stitching into the HLS stream
-   Seamless playback, ads embedded in the manifest
-   Feed naturally blocked until ad segment ends (or skip, if allowed)
-   Tracking via ad server (VAST/VMAP)

### Video Ads (Standalone Clips)

-   Ads as separate feed items
-   Skip button, ad labels, scroll blocking until ad ends (if desired)
-   Simpler integration than DAI, no ad server required

### Difference

-   **DAI**: Ads are part of the stream; playback continues automatically after the ad.
-   **Video ads**: Ads are feed items; scrolling can be blocked in-app until the ad finishes.

## User Tracking

-   Viewability metrics (time in view, visibility threshold, scroll-away)
-   Engagement (play/pause, seek, completion rate, repeat views)
-   Feed behavior (scroll direction, swipes, skipped vs. watched items)


## UI Customization

-   **Current frame preview during seek**: Thumbnail or frame shown while scrubbing
-   **Seekbar options**: Hide seekbar, tap-to-seek, drag, step-seek (±10s), or disabled for live/ads
-   **Custom seek controls**: Different UX per content type

## Mixed Content Types

-   Photos as feed items
-   GIFs (autoplay on view)
-   Forms, surveys, CTAs
-   Mixed feed with `video | image | gif | form` per item

## Caching & Reverse Proxy

### Client-side caching (iOS / Android)

-   HLS segment caching – .m3u8 manifests and .ts segments cached on device
-   Native player cache (AVPlayer, ExoPlayer) – configure size and location
-   Preload + disk cache – persist segments for items in preload window
-   Thumbnail / sprite cache – for seek preview, avoid re-fetching
-   Cache eviction – LRU, max size, TTL
-   Offline playback – cache full videos for offline viewing

### Reverse proxy (manifest / stream)

-   HLS manifest proxy – intercept requests, rewrite segment URLs
-   CDN routing – point segments to your CDN, add auth tokens
-   DAI at proxy – inject ad segments into manifest before client
-   Geo / region – serve from nearest edge
-   A/B testing – different manifest versions per user or cohort

## Navigation & Folders

-   Tabs / categories (e.g. "For You", "Trending")
-   Folder tiles – grid or list, tap to open folder feed
-   Stack navigation: Feed → Folder Feed → Video detail
-   Deep links: `/feed/:folderId`, `/feed/:category`

## Summary

| Area              | Possible features                            |
| ----------------- | -------------------------------------------- |
| **DAI ads**       | Server-side stitching, feed blocks during ad |
| **Video ads**     | Ads as feed items, optional scroll blocking  |
| **Tracking**      | Viewability, engagement, feed behavior       |
| **UI**            | Seek preview, seekbar visibility, seek modes |
| **Mixed content** | Images, GIFs, forms in feed                  |
| **Navigation**    | Tabs, folder tiles, stack nav, deep links    |
| **Caching**       | HLS segment cache, offline playback          |
| **Reverse proxy** | Manifest rewrite, DAI, CDN, geo, A/B         |
