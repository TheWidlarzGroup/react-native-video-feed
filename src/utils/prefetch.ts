import { prefetch } from "react-native-nitro-fetch";
import { SOURCES } from "./utils";

/**
 * Prefetches all video sources at app startup to improve initial load performance.
 * This prefetches the HLS manifest files (.m3u8) and initial segments.
 */
export const prefetchVideos = async () => {
    try {
        const prefetchPromises = SOURCES.map((url, index) =>
            prefetch(url, {
                headers: {
                    prefetchKey: `video-${index}`,
                },
            }).catch((error) => {
                // Silently fail individual prefetches - don't block app startup
                return null;
            })
        );

        await Promise.allSettled(prefetchPromises);
    } catch (error) {
        // Silently fail - don't block app startup if prefetch fails
    }
};
