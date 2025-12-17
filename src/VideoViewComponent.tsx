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

    // Track source URI changes for retries
    useEffect(() => {
        if (player.source?.uri) {
            sourceUriRef.current = player.source.uri;
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
                if (player.status === "idle" && player.source?.uri) {
                    player.preload();
                } else if (
                    player.status === "readyToPlay" &&
                    !player.isPlaying
                ) {
                    player.play();
                    userPausedRef.current = false;
                    setIsPlaying(true);
                }
            } catch (e) {
                // ignore
            }
        } else {
            try {
                if (player.isPlaying) player.pause();
                // leaving screen => auto pause, hide button
                userPausedRef.current = false;
                if (player.muted !== true) player.muted = true;
            } catch (e) {
                // ignore
            }
        }
    }, [isActive, player]);

    // Quick watchdog: retry early for first item, then slower fallback
    useEffect(() => {
        if (!isActive) return;
        if (!isLoading) return;
        const shortRetry = setTimeout(() => {
            try {
                if (player.status === "idle" && player.source?.uri) {
                    player.preload();
                }
            } catch (e) {
                // ignore
            }
        }, 300);

        const t = setTimeout(() => {
            try {
                if (player.status === "idle" && player.source?.uri) {
                    player.preload();
                } else if (
                    player.status === "readyToPlay" &&
                    !player.isPlaying
                ) {
                    player.play();
                } else if (
                    player.status === "loading" &&
                    sourceUriRef.current
                ) {
                    // Retry source attach if stuck
                    player.replaceSourceAsync({ uri: sourceUriRef.current });
                    player.preload();
                }
            } catch (e) {
                // ignore
            }
        }, 1200);
        return () => {
            clearTimeout(shortRetry);
            clearTimeout(t);
        };
    }, [isActive, isLoading, player]);

    useEvent(player, "onLoad", () => {
        setIsLoading(false);
        setIsError(false);
        player.loop = true;
        if (isActive) {
            try {
                if (player.muted === true) player.muted = false;
                player.play();
                userPausedRef.current = false;
                setIsPlaying(true);
            } catch (e) {
                // ignore
            }
        }
    });

    useEvent(player, "onStatusChange", () => {
        setIsPlaying(player.isPlaying);
        if (player.status === "error") {
            setIsError(true);
            setIsLoading(false);
        } else if (player.status === "readyToPlay") {
            setIsError(false);
            setIsLoading(false);
            if (isActive && !player.isPlaying) {
                try {
                    player.play();
                    userPausedRef.current = false;
                    setIsPlaying(true);
                } catch (e) {
                    // ignore
                }
            }
        } else if (player.status === "idle") {
            setIsLoading(true);
        } else if (player.status === "loading") {
            setIsLoading(true);
            setIsError(false);
        }
    });

    useEvent(player, "onError", () => {
        setIsError(true);
        setIsLoading(false);
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
            <VideoOverlay />
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
