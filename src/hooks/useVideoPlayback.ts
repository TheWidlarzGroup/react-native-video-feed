import { useCallback } from "react";
import { VideoPlayer } from "react-native-video";

interface UseVideoPlaybackParams {
    playersRef: React.MutableRefObject<VideoPlayer[]>;
    uris: string[];
    preloadAttemptedRef: React.MutableRefObject<Set<VideoPlayer>>;
    safePreload: (player: VideoPlayer) => boolean;
}

export const useVideoPlayback = ({
    playersRef,
    uris,
    preloadAttemptedRef,
    safePreload,
}: UseVideoPlaybackParams) => {
    const syncPlaybackForIndex = useCallback(
        (targetIndex: number) => {
            const currentPlayers = playersRef.current;

            if (
                !currentPlayers.length ||
                targetIndex < 0 ||
                targetIndex >= currentPlayers.length ||
                !uris.length
            ) {
                return;
            }

            // Preload 5 ahead, 1 behind (like Slop-Social)
            const preloadStart = Math.max(0, targetIndex - 1);
            const preloadEnd = Math.min(currentPlayers.length, targetIndex + 6);

            currentPlayers.forEach((player, idx) => {
                if (!player) return;

                const expectedUri = uris[idx % uris.length];
                const currentUri = player.source?.uri;

                const isInPreloadRange =
                    idx >= preloadStart && idx < preloadEnd;
                const isActive = idx === targetIndex;

                try {
                    if (isActive) {
                        if (player.muted) player.muted = false;

                        // Only change source if missing or different, but not if already playing
                        const sourceChanged = currentUri !== expectedUri;
                        if (
                            sourceChanged &&
                            !player.isPlaying &&
                            player.status !== "loading"
                        ) {
                            try {
                                player.replaceSourceAsync({ uri: expectedUri });
                                preloadAttemptedRef.current.delete(player);
                            } catch (e) {}
                        }

                        // Preload if idle and source is set
                        if (
                            player.status === "idle" &&
                            player.source?.uri &&
                            !preloadAttemptedRef.current.has(player)
                        ) {
                            safePreload(player);
                        }

                        // Play if ready
                        if (
                            player.status === "readyToPlay" &&
                            !player.isPlaying
                        ) {
                            player.play();
                        }
                    } else if (isInPreloadRange) {
                        if (player.isPlaying) player.pause();
                        if (!player.muted) player.muted = true;

                        // Only change source if different and not loading
                        const sourceChanged = currentUri !== expectedUri;
                        if (sourceChanged && player.status !== "loading") {
                            try {
                                player.replaceSourceAsync({ uri: expectedUri });
                                preloadAttemptedRef.current.delete(player);
                            } catch (e) {}
                        }

                        // Preload if idle and source is set
                        if (
                            player.status === "idle" &&
                            player.source?.uri &&
                            !preloadAttemptedRef.current.has(player)
                        ) {
                            safePreload(player);
                        }
                    } else {
                        if (player.isPlaying) player.pause();
                        if (!player.muted) player.muted = true;
                    }
                } catch (e) {
                    // Ignore
                }
            });
        },
        [uris, safePreload, playersRef, preloadAttemptedRef]
    );

    return { syncPlaybackForIndex };
};
