import {
    LegendListRenderItemProps,
    useRecyclingState,
    useViewability,
    ViewToken,
} from "@legendapp/list";
import React, { useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    Text,
    View,
} from "react-native";
import { useEvent, VideoPlayer, VideoView } from "react-native-video";
import VideoOverlay from "./VideoOverlay";
import CustomVideoControls from "./CustomVideoControls";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

const VideoViewComponent = ({
    item: player,
    index,
}: LegendListRenderItemProps<VideoPlayer>) => {
    const [isLoading, setIsLoading] = useRecyclingState(
        player.status === "idle" || player.status === "loading"
    );
    const [isError, setIsError] = useRecyclingState(player.status === "error");
    const isViewableRef = useRef(false);
    const userPausedRef = useRef(false); // Track if user manually paused

    // Preload immediately on mount and retry if needed
    useEffect(() => {
        const preloadVideo = () => {
            if (player.source?.uri) {
                if (player.status === "idle") {
                    player.preload();
                } else if (player.status === "error") {
                    // Retry on error
                    setTimeout(() => {
                        if (
                            player.status === "idle" ||
                            player.status === "error"
                        ) {
                            player.preload();
                        }
                    }, 500);
                }
            }
        };

        preloadVideo();

        // Retry preload if still idle after a moment
        const retryTimer = setTimeout(() => {
            if (player.status === "idle" && player.source?.uri) {
                player.preload();
            }
        }, 200);

        return () => clearTimeout(retryTimer);
    }, [player]);

    useEvent(player, "onLoad", (_) => {
        setIsLoading(false);
        setIsError(false);
        player.loop = true;
    });

    useEvent(player, "onStatusChange", (status) => {
        if (player.status === "error") {
            setIsError(true);
            setIsLoading(false);
        } else if (player.status === "readyToPlay") {
            setIsError(false);
            setIsLoading(false);
            // Auto-play if viewable and user hasn't manually paused
            if (
                isViewableRef.current &&
                !player.isPlaying &&
                !userPausedRef.current
            ) {
                // Small delay to ensure everything is ready
                setTimeout(() => {
                    if (
                        isViewableRef.current &&
                        !player.isPlaying &&
                        !userPausedRef.current
                    ) {
                        player.play();
                    }
                }, 50);
            }
        } else if (player.status === "idle") {
            setIsLoading(true);
            userPausedRef.current = false; // Reset on new load
        } else if (player.status === "loading") {
            setIsLoading(true);
            setIsError(false);
        }
    });

    useEvent(player, "onError", (error) => {
        console.log(index, "[ERROR]", error);
        setIsError(true);
        setIsLoading(false);
    });

    // Single source of truth for viewability
    useViewability((viewToken: ViewToken) => {
        const isNowViewable = viewToken.isViewable;
        isViewableRef.current = isNowViewable;

        if (isNowViewable) {
            // Preload if needed
            if (player.status === "idle" && player.source?.uri) {
                player.preload();
            }
            // Auto-play if ready and user hasn't manually paused
            if (
                player.status === "readyToPlay" &&
                !player.isPlaying &&
                !userPausedRef.current
            ) {
                setTimeout(() => {
                    if (
                        isViewableRef.current &&
                        player.status === "readyToPlay" &&
                        !player.isPlaying &&
                        !userPausedRef.current
                    ) {
                        player.play();
                    }
                }, 100);
            }
        } else {
            // IMMEDIATELY pause when not viewable
            if (player.isPlaying) {
                player.pause();
            }
            // Reset user pause flag when not viewable
            userPausedRef.current = false;
        }
    }, "video");

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
                    <Text style={{ color: "#fff" }}>
                        Error: Something went wrong
                    </Text>
                </View>
            ) : null}
            <Pressable
                style={{
                    width: screenWidth,
                    height: screenHeight,
                    position: "relative",
                }}
                onPress={() => {
                    console.log(
                        "Pressable pressed, isPlaying:",
                        player.isPlaying
                    );
                    if (player.isPlaying) {
                        player.pause();
                        userPausedRef.current = true;
                    } else {
                        player.play();
                        userPausedRef.current = false;
                    }
                }}
            >
                <VideoView
                    player={player}
                    style={{ width: screenWidth, height: screenHeight }}
                    controls={false}
                    pointerEvents="none"
                />
                <CustomVideoControls
                    nitroId={-1}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: "box-none",
                    }}
                />
            </Pressable>
            <VideoOverlay />
        </View>
    );
};

export default VideoViewComponent;
