/**
 * Placeholder types and stubs for possible feed features.
 * These are NOT implemented – they define the shape of functionality that could be added.
 *
 * To add these features: contact the repo owner (see README).
 */

// ---------------------------------------------------------------------------
// DAI (Dynamic Ad Insertion) – placeholder
// ---------------------------------------------------------------------------

export interface DAIConfig {
    adServerUrl?: string;
    vastTag?: string;
}

/** Placeholder: DAI ads – server-side ad stitching, feed blocks during ad. */
export function useDAIAds(_config?: DAIConfig): void {}

// ---------------------------------------------------------------------------
// Video Ads (standalone clips in feed) – placeholder
// ---------------------------------------------------------------------------

export interface VideoAdItem {
    id: string;
    url: string;
    isAd: true;
    skipAfterSeconds?: number;
    blockScrollUntilEnd?: boolean;
}

/** Placeholder: Video ads as feed items, optional scroll blocking. */
export function isVideoAdItem(_item: unknown): _item is VideoAdItem {
    return false;
}

// ---------------------------------------------------------------------------
// User Tracking – placeholder
// ---------------------------------------------------------------------------

export interface TrackingEvent {
    videoId: string;
    event:
        | "view_start"
        | "view_end"
        | "play"
        | "pause"
        | "complete"
        | "seek"
        | "skip";
    position?: number;
    duration?: number;
}

/** Placeholder: Viewability, engagement, feed behavior tracking. */
export function trackEvent(_event: TrackingEvent): void {}

// ---------------------------------------------------------------------------
// UI: Seek frame preview, seekbar options – placeholder
// ---------------------------------------------------------------------------

export interface SeekbarOptions {
    showSeekbar?: boolean;
    seekMode?: "tap" | "drag" | "step" | "none";
    stepSeconds?: number;
}

/** Placeholder: Thumbnail/frame preview during seek. */
export function useSeekFramePreview(_currentTime: number): string | null {
    return null;
}

/** Placeholder: Seekbar visibility, seek modes (tap, drag, ±10s step). */
export function useSeekbarOptions(_options?: SeekbarOptions): SeekbarOptions {
    return {};
}

// ---------------------------------------------------------------------------
// Mixed content (images, GIFs, forms) – placeholder
// ---------------------------------------------------------------------------

export type FeedItemType = "video" | "image" | "gif" | "form";

export interface MixedFeedItem {
    id: string;
    type: FeedItemType;
    url?: string;
    formSchema?: unknown;
}

/** Placeholder: Photos, GIFs, forms as feed items. */
export function renderMixedFeedItem(_item: MixedFeedItem): null {
    return null;
}

// ---------------------------------------------------------------------------
// Caching – placeholder
// ---------------------------------------------------------------------------

export type CacheEvictionPolicy = "lru" | "ttl" | "fifo";

export interface CacheConfig {
    maxSizeMB?: number;
    ttlSeconds?: number;
    eviction?: CacheEvictionPolicy;
}

/** Placeholder: HLS segment cache, offline playback. */
export function useSegmentCache(_config?: CacheConfig): void {}

/** Placeholder: Thumbnail/sprite cache for seek preview. */
export function useThumbnailCache(_config?: CacheConfig): void {}

// ---------------------------------------------------------------------------
// Reverse proxy / manifest – placeholder
// ---------------------------------------------------------------------------

export interface ProxyConfig {
    manifestRewrite?: boolean;
    cdnUrl?: string;
    geoRouting?: boolean;
}

/** Placeholder: Manifest proxy, CDN routing, DAI at proxy, geo, A/B. */
export function getProxiedManifestUrl(
    _originalUrl: string,
    _config?: ProxyConfig
): string {
    return "";
}

/** Placeholder: A/B manifest variants per user/cohort. */
export function getManifestVariant(_baseUrl: string, _userId?: string): string {
    return "";
}

// ---------------------------------------------------------------------------
// Navigation & folder tiles – placeholder
// ---------------------------------------------------------------------------

export interface FolderTile {
    id: string;
    title: string;
    feedUrl?: string;
}

export interface FeedCategory {
    id: string;
    title: string;
}

/** Placeholder: Tabs/categories (e.g. For You, Trending). */
export function useFeedCategories(): FeedCategory[] {
    return [];
}

/** Placeholder: Folder tiles, stack nav, deep links. */
export function useFolderFeed(_folderId: string): { items: unknown[] } {
    return { items: [] };
}

/** Placeholder: Deep link /feed/:folderId, /feed/:category. */
export function resolveFeedDeepLink(
    _path: string
): { folderId?: string; category?: string } | null {
    return null;
}
