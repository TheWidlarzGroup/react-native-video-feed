import { useEffect, useState } from "react";
import { useVideoPlayers } from "./useVideoPlayers";
import { useVideoPlayback } from "./useVideoPlayback";
import { useVideoScroll } from "./useVideoScroll";

export const useVideoFeed = () => {
    const [isBooting, setIsBooting] = useState(true);
    const {
        players,
        uris,
        playersRef,
        preloadAttemptedRef,
        fetchingRef,
        safePreload,
        fetchMoreVideos,
    } = useVideoPlayers();

    const { syncPlaybackForIndex } = useVideoPlayback({
        playersRef,
        uris,
        preloadAttemptedRef,
        safePreload,
    });

    const handleVisibleIndexChange = (index: number) => {
        syncPlaybackForIndex(index);
    };

    const { visibleIndex, visibleIndexRef, handleMomentumScrollEnd, viewabilityConfigCallbackPairs } =
        useVideoScroll({
            playersRef,
            onVisibleIndexChange: handleVisibleIndexChange,
        });

    // Set booting to false once players are initialized
    useEffect(() => {
        if (players.length > 0 && isBooting) {
            setIsBooting(false);
        }
    }, [players.length, isBooting]);

    // Sync playback when visible index changes
    useEffect(() => {
        const currentPlayers = playersRef.current;
        if (currentPlayers.length === 0) return;
        if (isBooting) {
            syncPlaybackForIndex(0);
        } else {
            syncPlaybackForIndex(visibleIndexRef.current);
        }
    }, [visibleIndex, isBooting, syncPlaybackForIndex, visibleIndexRef, playersRef]);

    const handleEndReached = () => {
        const currentLength = playersRef.current.length;
        const currentVisible = visibleIndexRef.current;
        const remaining = currentLength - currentVisible - 1;

        if (
            remaining <= 2 &&
            !fetchingRef.current &&
            uris.length > 0 &&
            currentLength > 0
        ) {
            fetchMoreVideos();
        }
    };

    return {
        isBooting,
        players,
        visibleIndex,
        handleMomentumScrollEnd,
        viewabilityConfigCallbackPairs,
        handleEndReached,
        playersRef,
        fetchingRef,
        uris,
    };
};
