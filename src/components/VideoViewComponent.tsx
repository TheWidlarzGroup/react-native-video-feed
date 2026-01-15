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

    console.log(`[${video.id}] Component render - isActive: ${isActive}, userPaused: ${userPaused}, shouldPreload: ${shouldPreload}`);

    useEffect(() => {
        if (!player) return;

        const currentUri = player.source?.uri;
        const currentStatus = player.status;
        
        console.log(`[${video.id}] Source effect - shouldPreload: ${shouldPreload}, isActive: ${isActive}, currentUri: ${currentUri}, expectedUri: ${video.url}, status: ${currentStatus}`);

        // Update source based on preload/active state (Slop-Social approach)
        // Always ensure source is set for preload/active videos
        if (shouldPreload || isActive) {
            if (!currentUri || currentUri !== video.url) {
                console.log(`[${video.id}] ⚠️ SOURCE MISMATCH - Setting source to: ${video.url}, current URI: ${currentUri || 'null'}, status: ${currentStatus}`);
                player.replaceSourceAsync({ uri: video.url }).then(() => {
                    const newUri = player.source?.uri;
                    const newStatus = player.status;
                    console.log(`[${video.id}] ✅ replaceSourceAsync DONE - newUri: ${newUri}, newStatus: ${newStatus}`);
                    // Preload after source is set
                    try {
                        console.log(`[${video.id}] Calling preload() after source set`);
                        player.preload();
                    } catch (e) {
                        console.log(`[${video.id}] ❌ Preload error:`, e);
                    }
                }).catch((e) => {
                    console.log(`[${video.id}] ❌ replaceSourceAsync error:`, e);
                });
            } else if (player.status === "idle") {
                // Source is already set but player is idle, try to preload
                try {
                    console.log(`[${video.id}] Source OK but idle - calling preload(), status: ${player.status}`);
                    player.preload();
                } catch (e) {
                    console.log(`[${video.id}] ❌ Preload error:`, e);
                }
            } else {
                console.log(`[${video.id}] ✅ Source OK and status OK: ${player.status}`);
            }
        }
        // Note: We don't clear source for videos outside preload window to avoid issues
        // LegendList will recycle components, so this is safe
    }, [shouldPreload, isActive, player, video.url]);

    useEffect(() => {
        if (!player) return;

        const shouldPlay =
            isActive && !userPaused && AppState.currentState === "active";

        console.log(`[${video.id}] Playback effect - isActive: ${isActive}, userPaused: ${userPaused}, AppState: ${AppState.currentState}, shouldPlay: ${shouldPlay}, player.status: ${player.status}, player.isPlaying: ${player.isPlaying}`);

        if (shouldPlay) {
            console.log(`[${video.id}] CALLING player.play() - status: ${player.status}`);
            player.muted = false;
            player.play();
        } else {
            console.log(`[${video.id}] CALLING player.pause() - status: ${player.status}`);
            player.muted = true;
            player.pause();
            if (shouldPreload) {
                player.currentTime = 0;
            }
        }

        if (isActive && !wasActiveRef.current) {
            console.log(`[${video.id}] Becoming active - resetting currentTime and userPaused`);
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
        const currentUri = player.source?.uri;
        console.log(`[${video.id}] 🔄 onStatusChange - status: ${player.status}, isPlaying: ${player.isPlaying}, sourceUri: ${currentUri || 'null'}, isActive: ${isActive}, userPaused: ${userPaused}`);
        if (
            isActive &&
            !userPaused &&
            AppState.currentState === "active" &&
            player.status === "readyToPlay" &&
            !player.isPlaying
        ) {
            console.log(`[${video.id}] ▶️ onStatusChange - CALLING player.play() because readyToPlay`);
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
            <VideoOverlay isVisible={isActive} />
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
