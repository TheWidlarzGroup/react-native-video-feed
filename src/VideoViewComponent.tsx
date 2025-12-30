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
import { performanceMonitor } from "./performance";

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
    const pressStartTimeRef = useRef<number | null>(null);
    const pressStartLocationRef = useRef<{ x: number; y: number } | null>(null);
    const wasEverReadyRef = useRef(
        player.status === "readyToPlay" ||
            (player.source?.uri &&
                player.status !== "idle" &&
                player.status !== "error")
    );

    useEffect(() => {
        if (player.status === "readyToPlay") {
            wasEverReadyRef.current = true;
        } else if (player.status === "error") {
            wasEverReadyRef.current = false;
        }
    }, [player.status]);

    useEffect(() => {
        if (player.source?.uri) {
            const newUri = player.source.uri;
            if (sourceUriRef.current !== newUri) {
                sourceUriRef.current = newUri;
                preloadAttemptedRef.current = false;
                if (player.status !== "readyToPlay") {
                    wasEverReadyRef.current = false;
                }
            }
        }
    }, [player.source?.uri, player.status]);

    // Sync isPlaying state more reliably
    useEffect(() => {
        const currentPlaying = player.isPlaying;
        if (currentPlaying !== isPlaying) {
            setIsPlaying(currentPlaying);
        }
    }, [player.isPlaying, isPlaying]);

    // Removed play/pause/mute logic - App.tsx syncPlaybackForIndex handles it
    // Only update loading/error state here
    useEffect(() => {
        if (!player) return;

        if (player.status === "readyToPlay") {
            setIsLoading(false);
            setIsError(false);
            wasEverReadyRef.current = true;
        } else if (player.status === "error") {
            setIsError(true);
            setIsLoading(false);
        } else if (player.status === "loading") {
            setIsLoading(true);
            setIsError(false);
        } else if (player.status === "idle") {
            if (wasEverReadyRef.current) {
                setIsLoading(false);
            } else {
                setIsLoading(true);
            }
        }
    }, [player.status]);

    // Removed retry logic - App.tsx syncPlaybackForIndex handles preloading and playback

    useEvent(player, "onLoad", () => {
        setIsLoading(false);
        setIsError(false);
        player.loop = true;
        wasEverReadyRef.current = true;
        // App.tsx syncPlaybackForIndex handles play/pause/mute
    });

    useEvent(player, "onStatusChange", () => {
        // Always sync isPlaying state from player
        const currentPlaying = player.isPlaying;
        if (currentPlaying !== isPlaying) {
            setIsPlaying(currentPlaying);
        }
        if (player.status === "error") {
            setIsError(true);
            setIsLoading(false);
            preloadAttemptedRef.current = false;
        } else if (player.status === "readyToPlay") {
            setIsError(false);
            setIsLoading(false);
            wasEverReadyRef.current = true;
            // App.tsx syncPlaybackForIndex handles play/pause/mute
        } else if (player.status === "idle") {
            const likelyWasReady =
                wasEverReadyRef.current || !!player.source?.uri;
            if (!likelyWasReady) {
                setIsLoading(true);
            } else {
                setIsLoading(false);
                if (!wasEverReadyRef.current) {
                    wasEverReadyRef.current = true;
                }
            }
        } else if (player.status === "loading") {
            const likelyWasReady =
                wasEverReadyRef.current || !!player.source?.uri;
            if (!likelyWasReady) {
                setIsLoading(true);
                setIsError(false);
            } else {
                setIsLoading(false);
                setIsError(false);
                if (!wasEverReadyRef.current) {
                    wasEverReadyRef.current = true;
                }
            }
        }
    });

    useEvent(player, "onError", () => {
        setIsError(true);
        setIsLoading(false);
        preloadAttemptedRef.current = false;
    });

    return (
        <View
            style={{
                width: screenWidth,
                height: screenHeight,
                maxHeight: screenHeight,
                minHeight: screenHeight,
                backgroundColor: "black",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                margin: 0,
                padding: 0,
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
                style={{
                    width: screenWidth,
                    height: screenHeight,
                    maxHeight: screenHeight,
                    minHeight: screenHeight,
                }}
                controls={false}
                pointerEvents="none"
            />
            {isActive && !isLoading && !isError && (
                <VideoOverlay isVisible={true} />
            )}
            {isActive &&
            userPausedRef.current &&
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
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 30,
                    }}
                    onPress={() => {
                        try {
                            player.play();
                            userPausedRef.current = false;
                            setIsPlaying(true);
                        } catch (e) {
                            // Ignore
                        }
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="play" size={50} color="#fff" />
                </TouchableOpacity>
            ) : null}
            <Pressable
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 5,
                }}
                onPressIn={(e) => {
                    pressStartTimeRef.current = Date.now();
                    pressStartLocationRef.current = {
                        x: e.nativeEvent.locationX,
                        y: e.nativeEvent.locationY,
                    };
                }}
                onPressOut={(e) => {
                    if (
                        pressStartTimeRef.current === null ||
                        pressStartLocationRef.current === null
                    ) {
                        return;
                    }

                    const pressDuration =
                        Date.now() - pressStartTimeRef.current;
                    const pressDistance = Math.sqrt(
                        Math.pow(
                            e.nativeEvent.locationX -
                                pressStartLocationRef.current.x,
                            2
                        ) +
                            Math.pow(
                                e.nativeEvent.locationY -
                                    pressStartLocationRef.current.y,
                                2
                            )
                    );

                    const isQuickTap =
                        pressDuration < 200 && pressDistance < 10;

                    if (isQuickTap) {
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
                            // Ignore
                        }
                    }

                    pressStartTimeRef.current = null;
                    pressStartLocationRef.current = null;
                }}
            />
        </View>
    );
};

// Temporarily remove memo to debug isActive updates
export default VideoViewComponent;
