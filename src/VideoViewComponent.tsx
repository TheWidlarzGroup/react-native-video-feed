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

    useEffect(() => {
        setIsPlaying(player.isPlaying);
    }, [player]);

    useEffect(() => {
        if (!player) return;
        if (isActive) {
            try {
                if (player.muted === true) player.muted = false;

                if (player.status === "readyToPlay") {
                    setIsLoading(false);
                    wasEverReadyRef.current = true;
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
                    if (!wasEverReadyRef.current) {
                        setIsLoading(true);
                        try {
                            performanceMonitor.startMark(`video_load_${index}`);
                            player.preload();
                            preloadAttemptedRef.current = true;
                        } catch (e) {
                            // Ignore
                        }
                    } else {
                        setIsLoading(false);
                    }
                } else if (
                    player.status === "idle" &&
                    wasEverReadyRef.current
                ) {
                    setIsLoading(false);
                } else if (
                    player.status === "loading" &&
                    wasEverReadyRef.current
                ) {
                    setIsLoading(false);
                }
            } catch (e) {
                // Ignore
            }
        } else {
            try {
                if (player.isPlaying) {
                    player.pause();
                }
                userPausedRef.current = false;
                if (player.muted !== true) player.muted = true;
            } catch (e) {
                // Ignore
            }
        }
    }, [isActive, player, index]);

    useEffect(() => {
        if (!isActive) return;
        if (!isLoading) return;

        const retryTimeout = setTimeout(() => {
            try {
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
                    player.play();
                } else if (player.status === "error" && sourceUriRef.current) {
                    player.replaceSourceAsync({ uri: sourceUriRef.current });
                    preloadAttemptedRef.current = false;
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
                // Ignore
            }
        }, 2000);

        return () => {
            clearTimeout(retryTimeout);
            timeoutRefsRef.current.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            timeoutRefsRef.current.clear();
        };
    }, [isActive, isLoading, player, index]);

    useEvent(player, "onLoad", () => {
        const loadTime = performanceMonitor.endMark(`video_load_${index}`);
        if (loadTime !== null) {
            performanceMonitor.recordMetric("video_load_time", loadTime, {
                index,
                wasPreloaded: preloadAttemptedRef.current,
            });
        }

        setIsLoading(false);
        setIsError(false);
        player.loop = true;
        preloadAttemptedRef.current = true;
        wasEverReadyRef.current = true;
        if (isActive) {
            try {
                if (player.muted === true) player.muted = false;
                player.play();
                userPausedRef.current = false;
                setIsPlaying(true);
            } catch (e) {
                // Ignore
            }
        }
    });

    useEvent(player, "onStatusChange", () => {
        setIsPlaying(player.isPlaying);
        if (player.status === "error") {
            setIsError(true);
            setIsLoading(false);
            preloadAttemptedRef.current = false;
        } else if (player.status === "readyToPlay") {
            setIsError(false);
            setIsLoading(false);
            preloadAttemptedRef.current = true;
            wasEverReadyRef.current = true;
            if (isActive && !player.isPlaying) {
                try {
                    player.play();
                    userPausedRef.current = false;
                    setIsPlaying(true);
                } catch (e) {
                    // Ignore
                }
            }
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
                            // Ignore
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

export default memo(VideoViewComponent, (prevProps, nextProps) => {
    return (
        prevProps.item === nextProps.item &&
        prevProps.index === nextProps.index &&
        prevProps.isActive === nextProps.isActive
    );
});
