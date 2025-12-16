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
}

const VideoViewComponent = ({
    item: player,
    index,
}: VideoViewComponentProps) => {
    const [isLoading, setIsLoading] = useState(
        player.status === "idle" || player.status === "loading"
    );
    const [isError, setIsError] = useState(player.status === "error");
    const [isPlaying, setIsPlaying] = useState(player.isPlaying);
    const userPausedRef = useRef(false);

    // Sync isPlaying state
    useEffect(() => {
        setIsPlaying(player.isPlaying);
        const interval = setInterval(() => {
            setIsPlaying(player.isPlaying);
        }, 100);
        return () => clearInterval(interval);
    }, [player]);

    // Simple preload on mount
    useEffect(() => {
        if (player.status === "idle" && player.source?.uri) {
            try {
                player.preload();
            } catch (e) {
                console.error(`[Video ${index}] Preload error:`, e);
            }
        }
    }, [player, index]);

    useEvent(player, "onLoad", (_) => {
        setIsLoading(false);
        setIsError(false);
        player.loop = true;
    });

    useEvent(player, "onStatusChange", (status) => {
        setIsPlaying(player.isPlaying);
        if (player.status === "error") {
            setIsError(true);
            setIsLoading(false);
        } else if (player.status === "readyToPlay") {
            setIsError(false);
            setIsLoading(false);
            if (player.muted === true) {
                try {
                    player.muted = false;
                } catch (e) {
                    // Ignore
                }
            }
        } else if (player.status === "idle") {
            setIsLoading(true);
        } else if (player.status === "loading") {
            setIsLoading(true);
            setIsError(false);
        }
    });

    useEvent(player, "onError", (error) => {
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
                    <Text style={{ color: "#fff" }}>Error loading video</Text>
                </View>
            ) : null}
            <VideoView
                player={player}
                style={{ width: screenWidth, height: screenHeight }}
                controls={false}
                pointerEvents="none"
            />
            {!isPlaying &&
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
                        } else {
                            player.play();
                            userPausedRef.current = false;
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
