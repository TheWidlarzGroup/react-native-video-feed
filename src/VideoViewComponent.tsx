import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState, memo } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useEvent, VideoPlayer, VideoView } from "react-native-video";
import VideoOverlay from "./VideoOverlay";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

interface VideoViewComponentProps {
    item: VideoPlayer;
    index: number;
    isActive: boolean;
}

const VideoViewComponent = ({
    item: player,
    index,
    isActive,
}: VideoViewComponentProps) => {
    const [isLoading, setIsLoading] = useState(
        player.status === "idle" || player.status === "loading"
    );
    const [isError, setIsError] = useState(player.status === "error");
    const [isPlaying, setIsPlaying] = useState(player.isPlaying);
    const sourceUriRef = useRef(player.source?.uri ?? null);
    const userPausedRef = useRef(false);
    const preloadAttemptedRef = useRef(false);
    const timeoutRefsRef = useRef<Set<NodeJS.Timeout>>(new Set());
    // Track if video was ever ready to prevent showing loader after it was ready
    // Initialize: if player is ready OR has source and is not idle/error, it was ready before
    // If player has source and is in loading state, it might have been ready before (e.g., after cleanup)
    // So we check if source exists and status is not idle/error - this indicates it was ready
    const wasEverReadyRef = useRef(
        player.status === "readyToPlay" ||
            (player.source?.uri &&
                player.status !== "idle" &&
                player.status !== "error")
    );

    // Sync wasEverReadyRef with player status changes
    // This ensures that if player becomes ready, we remember it even after status transitions
    useEffect(() => {
        if (player.status === "readyToPlay") {
            // Player is ready - mark as ever ready
            wasEverReadyRef.current = true;
        } else if (player.status === "error") {
            // On error, reset - allow retry
            wasEverReadyRef.current = false;
        }
        // For other statuses (idle, loading), keep the current value
        // This prevents showing loader if player was ready before
    }, [player.status]);

    // Track source URI changes for retries
    useEffect(() => {
        if (player.source?.uri) {
            const newUri = player.source.uri;
            if (sourceUriRef.current !== newUri) {
                // Source changed, reset preload tracking
                sourceUriRef.current = newUri;
                preloadAttemptedRef.current = false;
                // Reset wasEverReadyRef only if player is not currently ready
                // This prevents unnecessary reloads when source changes but player is already ready
                if (player.status !== "readyToPlay") {
                    wasEverReadyRef.current = false;
                }
            }
        }
    }, [player.source?.uri, player.status]);

    // Keep local UI state in sync with player events — no polling.
    useEffect(() => {
        setIsPlaying(player.isPlaying);
    }, [player]);

    // Log when visible player shows/hides ActivityIndicator
    useEffect(() => {
        if (isActive && isLoading) {
            console.log(
                `[Video ${index}] 🔄 ACTIVITY INDICATOR VISIBLE - isActive: true, isLoading: true, status: ${
                    player.status
                }, URI: ${player.source?.uri?.substring(0, 50)}...`
            );
        } else if (isActive && !isLoading) {
            // Only log when loader was just hidden (not on initial mount)
            if (player.status === "readyToPlay") {
                console.log(
                    `[Video ${index}] ✅ ACTIVITY INDICATOR HIDDEN - Video ready, status: ${player.status}`
                );
            }
        }
    }, [isActive, isLoading, index, player.status, player.source?.uri]);

    // Auto control based on visibility
    useEffect(() => {
        if (!player) return;
        if (isActive) {
            try {
                if (player.muted === true) player.muted = false;

                // If ready to play, hide loading and play immediately
                if (player.status === "readyToPlay") {
                    if (isLoading) {
                        console.log(
                            `[Video ${index}] ✅ HIDING LOADER - Ready to play, was showing ActivityIndicator`
                        );
                    }
                    setIsLoading(false);
                    wasEverReadyRef.current = true; // Mark that video was ever ready
                    if (!player.isPlaying) {
                        player.play();
                        userPausedRef.current = false;
                        setIsPlaying(true);
                    }
                } else if (
                    player.status === "idle" &&
                    player.source?.uri &&
                    !preloadAttemptedRef.current
                ) {
                    // Only show loading and preload if video was never ready before
                    // This prevents showing loader and re-preloading for videos that were already ready
                    if (!wasEverReadyRef.current) {
                        setIsLoading(true);
                        if (isActive) {
                            console.log(
                                `[Video ${index}] ⚠️ VISIBLE PLAYER STARTING PRELOAD - URI: ${player.source.uri.substring(
                                    0,
                                    50
                                )}...`
                            );
                        }
                        try {
                            player.preload();
                            preloadAttemptedRef.current = true;
                        } catch (e) {
                            console.warn(`[Video ${index}] Preload error:`, e);
                        }
                    } else {
                        // Video was ready before, don't show loader and don't preload again
                        setIsLoading(false);
                        if (isActive) {
                            console.log(
                                `[Video ${index}] ⚠️ Status IDLE but was ready before - NOT preloading again to prevent reload`
                            );
                        }
                    }
                } else if (
                    player.status === "idle" &&
                    wasEverReadyRef.current
                ) {
                    // Player was ready before but is now idle - don't show loader
                    setIsLoading(false);
                } else if (
                    player.status === "loading" &&
                    wasEverReadyRef.current
                ) {
                    // Player was ready before but is now loading - don't show loader
                    setIsLoading(false);
                }
            } catch (e) {
                console.warn(`[Video ${index}] Active control error:`, e);
            }
        } else {
            try {
                if (player.isPlaying) {
                    player.pause();
                    // Don't reset currentTime to prevent flicker
                }
                userPausedRef.current = false;
                if (player.muted !== true) player.muted = true;
            } catch (e) {
                // ignore
            }
        }
    }, [isActive, player, index]);

    // Watchdog: retry preload if stuck in loading/idle state
    useEffect(() => {
        if (!isActive) return;
        if (!isLoading) return;

        // Only retry if we're stuck and haven't successfully preloaded
        const retryTimeout = setTimeout(() => {
            try {
                // If still idle after timeout, retry preload
                if (
                    player.status === "idle" &&
                    player.source?.uri &&
                    sourceUriRef.current === player.source.uri
                ) {
                    if (!preloadAttemptedRef.current) {
                        player.preload();
                        preloadAttemptedRef.current = true;
                    }
                } else if (
                    player.status === "readyToPlay" &&
                    !player.isPlaying &&
                    isActive
                ) {
                    // Ready but not playing - start playback
                    player.play();
                } else if (player.status === "error" && sourceUriRef.current) {
                    // Error state - try to recover by replacing source
                    console.warn(`[Video ${index}] Retrying after error`);
                    player.replaceSourceAsync({ uri: sourceUriRef.current });
                    preloadAttemptedRef.current = false;
                    // Retry preload after source replacement
                    const retryPreloadTimeout = setTimeout(() => {
                        if (player.status === "idle" && player.source?.uri) {
                            player.preload();
                            preloadAttemptedRef.current = true;
                        }
                        timeoutRefsRef.current.delete(retryPreloadTimeout);
                    }, 200);
                    timeoutRefsRef.current.add(retryPreloadTimeout);
                }
            } catch (e) {
                console.warn(`[Video ${index}] Watchdog retry error:`, e);
            }
        }, 2000); // Longer timeout to avoid premature retries

        return () => {
            clearTimeout(retryTimeout);
            // Cleanup all timeouts
            timeoutRefsRef.current.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            timeoutRefsRef.current.clear();
        };
    }, [isActive, isLoading, player, index]);

    useEvent(player, "onLoad", () => {
        console.log(
            `[Video ${index}] onLoad - video loaded successfully, URI: ${player.source?.uri?.substring(
                0,
                50
            )}...`
        );
        setIsLoading(false);
        setIsError(false);
        player.loop = true;
        // Mark as successfully loaded
        preloadAttemptedRef.current = true;
        wasEverReadyRef.current = true; // Mark that video was ever ready
        if (isActive) {
            try {
                if (player.muted === true) player.muted = false;
                player.play();
                userPausedRef.current = false;
                setIsPlaying(true);
                console.log(
                    `[Video ${index}] Auto-playing after load (isActive: true)`
                );
            } catch (e) {
                console.warn(`[Video ${index}] Play on load error:`, e);
            }
        } else {
            console.log(
                `[Video ${index}] Not auto-playing after load (isActive: false)`
            );
        }
    });

    useEvent(player, "onStatusChange", () => {
        setIsPlaying(player.isPlaying);
        if (player.status === "error") {
            console.warn(`[Video ${index}] Status changed to ERROR`);
            setIsError(true);
            setIsLoading(false);
            // Reset preload tracking on error to allow retry
            preloadAttemptedRef.current = false;
        } else if (player.status === "readyToPlay") {
            console.log(
                `[Video ${index}] Status changed to READY_TO_PLAY - isActive: ${isActive}, isPlaying: ${player.isPlaying}`
            );
            setIsError(false);
            setIsLoading(false);
            preloadAttemptedRef.current = true;
            wasEverReadyRef.current = true; // Mark that video was ever ready
            if (isActive && !player.isPlaying) {
                try {
                    player.play();
                    userPausedRef.current = false;
                    setIsPlaying(true);
                    console.log(`[Video ${index}] Auto-playing on readyToPlay`);
                } catch (e) {
                    console.warn(`[Video ${index}] Play on ready error:`, e);
                }
            }
        } else if (player.status === "idle") {
            // Only show loading if video was never ready before
            // This prevents showing loader for videos that were already ready
            // Also check if player has source - if it does, it was likely ready before
            const likelyWasReady =
                wasEverReadyRef.current || !!player.source?.uri;
            if (!likelyWasReady) {
                setIsLoading(true);
                // Log only if this is the active/visible player showing loader
                if (isActive) {
                    console.log(
                        `[Video ${index}] ⚠️ VISIBLE PLAYER LOADING - Status: IDLE, showing ActivityIndicator`
                    );
                }
            } else {
                // Video was ready before, don't show loader to prevent flicker/reload
                setIsLoading(false);
                // Update wasEverReadyRef to true if it wasn't already
                if (!wasEverReadyRef.current) {
                    wasEverReadyRef.current = true;
                }
                if (isActive) {
                    console.log(
                        `[Video ${index}] ⚠️ Status IDLE but was ready before - NOT showing loader to prevent reload`
                    );
                }
            }
            // Don't reset preloadAttempted here - might be transitioning
        } else if (player.status === "loading") {
            // Only show loading if video was never ready before
            // This prevents showing loader for videos that were already ready
            // Also check if player has source - if it does, it was likely ready before
            const likelyWasReady =
                wasEverReadyRef.current || !!player.source?.uri;
            if (!likelyWasReady) {
                setIsLoading(true);
                setIsError(false);
                // Log only if this is the active/visible player showing loader
                if (isActive) {
                    console.log(
                        `[Video ${index}] ⚠️ VISIBLE PLAYER LOADING - Status: LOADING, showing ActivityIndicator`
                    );
                }
            } else {
                // Video was ready before, don't show loader to prevent flicker/reload
                setIsLoading(false);
                setIsError(false);
                // Update wasEverReadyRef to true if it wasn't already
                if (!wasEverReadyRef.current) {
                    wasEverReadyRef.current = true;
                }
                if (isActive) {
                    console.log(
                        `[Video ${index}] ⚠️ Status LOADING but was ready before - NOT showing loader to prevent reload`
                    );
                }
            }
        }
    });

    useEvent(player, "onError", () => {
        console.error(
            `[Video ${index}] onError - video failed to load, URI: ${player.source?.uri?.substring(
                0,
                50
            )}...`
        );
        setIsError(true);
        setIsLoading(false);
        // Reset preload tracking on error to allow retry
        preloadAttemptedRef.current = false;
    });

    return (
        <View
            style={{
                width: screenWidth,
                height: screenHeight,
                backgroundColor: "black",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            {isLoading ? (
                <View
                    pointerEvents="none"
                    style={{
                        width: screenWidth,
                        height: screenHeight,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "black",
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10,
                    }}
                >
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            ) : null}
            {isError ? (
                <View
                    pointerEvents="none"
                    style={{
                        width: screenWidth,
                        height: screenHeight,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "black",
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10,
                    }}
                >
                    <Text style={{ color: "#fff" }}>Error loading video</Text>
                </View>
            ) : null}
            <VideoView
                player={player}
                style={{ width: screenWidth, height: screenHeight }}
                controls={false}
                pointerEvents="none"
            />
            {userPausedRef.current &&
            !isPlaying &&
            !isLoading &&
            !isError &&
            player.status === "readyToPlay" ? (
                <TouchableOpacity
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        marginTop: -40,
                        marginLeft: -40,
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 20,
                    }}
                    onPress={() => {
                        try {
                            player.play();
                            userPausedRef.current = false;
                            setIsPlaying(true);
                        } catch (e) {
                            console.error(`[Video ${index}] Play error:`, e);
                        }
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="play" size={50} color="#fff" />
                </TouchableOpacity>
            ) : null}
            <VideoOverlay isVisible={!isLoading && !isError && isActive} />
            <Pressable
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 15,
                }}
                onPress={() => {
                    try {
                        if (player.isPlaying) {
                            player.pause();
                            userPausedRef.current = true;
                            setIsPlaying(false);
                        } else {
                            player.play();
                            userPausedRef.current = false;
                            setIsPlaying(true);
                        }
                    } catch (e) {
                        console.error(`[Video ${index}] Play/pause error:`, e);
                    }
                }}
            />
        </View>
    );
};

export default memo(VideoViewComponent, (prevProps, nextProps) => {
    // Only re-render if player, index, or isActive changes
    return (
        prevProps.item === nextProps.item &&
        prevProps.index === nextProps.index &&
        prevProps.isActive === nextProps.isActive
    );
});
