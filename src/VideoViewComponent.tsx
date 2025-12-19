import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
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

    // Track source URI changes for retries
    useEffect(() => {
        if (player.source?.uri) {
            const newUri = player.source.uri;
            if (sourceUriRef.current !== newUri) {
                // Source changed, reset preload tracking
                sourceUriRef.current = newUri;
                preloadAttemptedRef.current = false;
            }
        }
    }, [player.source?.uri]);

    // Keep local UI state in sync with player events — no polling.
    useEffect(() => {
        setIsPlaying(player.isPlaying);
    }, [player]);

    // Auto control based on visibility
    useEffect(() => {
        if (!player) return;
        if (isActive) {
            try {
                if (player.muted === true) player.muted = false;
                if (
                    player.status === "idle" &&
                    player.source?.uri &&
                    !preloadAttemptedRef.current
                ) {
                    try {
                        player.preload();
                        preloadAttemptedRef.current = true;
                    } catch (e) {
                        console.warn(`[Video ${index}] Preload error:`, e);
                    }
                } else if (
                    player.status === "readyToPlay" &&
                    !player.isPlaying
                ) {
                    player.play();
                    userPausedRef.current = false;
                    setIsPlaying(true);
                }
            } catch (e) {
                console.warn(`[Video ${index}] Active control error:`, e);
            }
        } else {
            try {
                if (player.isPlaying) {
                    player.pause();
                    player.currentTime = 0;
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
                    setTimeout(() => {
                        if (player.status === "idle" && player.source?.uri) {
                            player.preload();
                            preloadAttemptedRef.current = true;
                        }
                    }, 200);
                }
            } catch (e) {
                console.warn(`[Video ${index}] Watchdog retry error:`, e);
            }
        }, 2000); // Longer timeout to avoid premature retries

        return () => {
            clearTimeout(retryTimeout);
        };
    }, [isActive, isLoading, player, index]);

    useEvent(player, "onLoad", () => {
        setIsLoading(false);
        setIsError(false);
        player.loop = true;
        // Mark as successfully loaded
        preloadAttemptedRef.current = true;
        if (isActive) {
            try {
                if (player.muted === true) player.muted = false;
                player.play();
                userPausedRef.current = false;
                setIsPlaying(true);
            } catch (e) {
                console.warn(`[Video ${index}] Play on load error:`, e);
            }
        }
    });

    useEvent(player, "onStatusChange", () => {
        setIsPlaying(player.isPlaying);
        if (player.status === "error") {
            setIsError(true);
            setIsLoading(false);
            // Reset preload tracking on error to allow retry
            preloadAttemptedRef.current = false;
        } else if (player.status === "readyToPlay") {
            setIsError(false);
            setIsLoading(false);
            preloadAttemptedRef.current = true;
            if (isActive && !player.isPlaying) {
                try {
                    player.play();
                    userPausedRef.current = false;
                    setIsPlaying(true);
                } catch (e) {
                    console.warn(`[Video ${index}] Play on ready error:`, e);
                }
            }
        } else if (player.status === "idle") {
            setIsLoading(true);
            // Don't reset preloadAttempted here - might be transitioning
        } else if (player.status === "loading") {
            setIsLoading(true);
            setIsError(false);
        }
    });

    useEvent(player, "onError", () => {
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

export default VideoViewComponent;
