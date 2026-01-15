import { useEffect, useRef, useState } from "react";
import {
    AppState,
    Dimensions,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useEvent, useVideoPlayer, VideoView } from "react-native-video";
import { Video } from "../types";
import VideoOverlay from "./VideoOverlay";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

interface VideoViewComponentProps {
    video: Video;
    isActive: boolean;
    shouldPreload?: boolean;
}

function VideoViewComponent({
    video,
    isActive,
    shouldPreload,
}: VideoViewComponentProps) {
    const [userPaused, setUserPaused] = useState(false);
    const wasActiveRef = useRef(isActive);

    const player = useVideoPlayer(video.url, (p) => {
        p.loop = true;
        p.muted = true;
    });

    useEffect(() => {
        if (!player) return;

        const currentUri = player.source?.uri;
        const currentStatus = player.status;

        // Update source based on preload/active state (Slop-Social approach)
        // Always ensure source is set for preload/active videos
        if (shouldPreload || isActive) {
            if (!currentUri || currentUri !== video.url) {
                player.replaceSourceAsync({ uri: video.url }).then(() => {
                    // Preload after source is set
                    try {
                        player.preload();
                    } catch (e) {
                        // Preload error - silently fail
                    }
                }).catch((e) => {
                    // replaceSourceAsync error - silently fail
                });
            } else if (player.status === "idle") {
                // Source is already set but player is idle, try to preload
                try {
                    player.preload();
                } catch (e) {
                    // Preload error - silently fail
                }
            }
        }
        // Note: We don't clear source for videos outside preload window to avoid issues
        // LegendList will recycle components, so this is safe
    }, [shouldPreload, isActive, player, video.url]);

    useEffect(() => {
        if (!player) return;

        const shouldPlay =
            isActive && !userPaused && AppState.currentState === "active";

        if (shouldPlay) {
            player.muted = false;
            player.play();
        } else {
            player.muted = true;
            player.pause();
            if (shouldPreload) {
                player.currentTime = 0;
            }
        }

        if (isActive && !wasActiveRef.current) {
            player.currentTime = 0;
            setUserPaused(false);
        }

        wasActiveRef.current = isActive;
    }, [isActive, userPaused, player, shouldPreload]);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) => {
            if (!player) return;
            if (isActive && state === "active" && !userPaused) {
                player.muted = false;
                player.play();
            } else {
                player.muted = true;
                player.pause();
            }
        });
        return () => subscription.remove();
    }, [isActive, userPaused, player]);

    useEvent(player, "onStatusChange", () => {
        if (
            isActive &&
            !userPaused &&
            AppState.currentState === "active" &&
            player.status === "readyToPlay" &&
            !player.isPlaying
        ) {
            player.muted = false;
            player.play();
        }
    });

    const togglePause = () => {
        setUserPaused(!userPaused);
    };

    return (
        <View style={styles.container}>
            <VideoView player={player} controls={false} style={styles.video} />
            <TouchableWithoutFeedback onPress={togglePause}>
                <View style={styles.touchArea} />
            </TouchableWithoutFeedback>
            <VideoOverlay isVisible={isActive} isPaused={userPaused} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: screenWidth,
        height: screenHeight,
        backgroundColor: "black",
    },
    video: {
        width: screenWidth,
        height: screenHeight,
    },
    touchArea: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
});

export default VideoViewComponent;
