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
    const pressStartTimeRef = useRef<number | null>(null);
    const pressStartLocationRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const currentUri = player.source?.uri ?? null;
        if (currentUri !== sourceUriRef.current) {
            sourceUriRef.current = currentUri;
        }
    }, [player.source?.uri]);

    useEffect(() => {
        const currentPlaying = player.isPlaying;
        if (currentPlaying !== isPlaying) {
            setIsPlaying(currentPlaying);
        }
    }, [player.isPlaying, isPlaying]);

    useEffect(() => {
        if (
            isActive &&
            player.status === "readyToPlay" &&
            !player.isPlaying &&
            !userPausedRef.current
        ) {
            try {
                player.muted = false;
                player.play();
                setIsPlaying(true);
            } catch (e) {
                // Ignore
            }
        }
    }, [isActive, player.status, player.isPlaying, index]);

    useEvent(player, "onLoad", () => {
        setIsLoading(false);
        setIsError(false);
        player.loop = true;
    });

    useEvent(player, "onStatusChange", () => {
        const currentPlaying = player.isPlaying;
        if (currentPlaying !== isPlaying) {
            setIsPlaying(currentPlaying);
        }

        if (player.status === "error") {
            setIsError(true);
            setIsLoading(false);
        } else if (player.status === "readyToPlay") {
            setIsError(false);
            setIsLoading(false);

            if (isActive && !userPausedRef.current) {
                if (!player.isPlaying) {
                    try {
                        player.muted = false;
                        player.play();
                        setIsPlaying(true);
                    } catch (e) {
                        // Ignore
                    }
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
            {isLoading && isActive ? (
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
