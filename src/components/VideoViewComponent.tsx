import React, { useEffect, useRef, useState } from "react";
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
import { performanceMonitor } from "../utils/performance";

const { width: screenWidth } = Dimensions.get("window");
const FALLBACK_ITEM_HEIGHT = Math.floor(Dimensions.get("window").height - 64);

interface VideoViewComponentProps {
    video: Video;
    isActive: boolean;
    shouldPreload?: boolean;
    itemHeight?: number;
}

const VideoViewComponent = React.memo(
    function VideoViewComponent({
        video,
        isActive,
        shouldPreload,
        itemHeight = FALLBACK_ITEM_HEIGHT,
    }: VideoViewComponentProps) {
        const [userPaused, setUserPaused] = useState(false);
        const wasActiveRef = useRef(isActive);
        const ttffStartTimeRef = useRef<number | null>(null);
        const ttffMeasuredRef = useRef(false);
        const videoIdRef = useRef(video.id);

        const player = useVideoPlayer(video.url, (p) => {
            p.loop = true;
            p.muted = true;
        });

        useEffect(() => {
            if (!player) return;

            const currentUri = player.source?.uri;
            const currentStatus = player.status;

            if (shouldPreload || isActive) {
                if (!currentUri || currentUri !== video.url) {
                    if (
                        ttffStartTimeRef.current === null &&
                        !ttffMeasuredRef.current
                    ) {
                        ttffStartTimeRef.current = performance.now();
                    }

                    player
                        .replaceSourceAsync({ uri: video.url })
                        .then(() => {
                            try {
                                player.preload();
                            } catch (e) {
                                // Preload error - silently fail
                            }
                        })
                        .catch((e) => {
                            // replaceSourceAsync error - silently fail
                        });
                } else if (player.status === "idle") {
                    if (
                        ttffStartTimeRef.current === null &&
                        !ttffMeasuredRef.current
                    ) {
                        ttffStartTimeRef.current = performance.now();
                    }

                    try {
                        player.preload();
                    } catch (e) {
                        // Preload error - silently fail
                    }
                } else if (player.status === "loading") {
                    if (
                        ttffStartTimeRef.current === null &&
                        !ttffMeasuredRef.current
                    ) {
                        ttffStartTimeRef.current = performance.now();
                    }
                }
            }
            // Note: We don't clear source for videos outside preload window to avoid issues
            // LegendList will recycle components, so this is safe
        }, [shouldPreload, isActive, player, video.url]);

        useEffect(() => {
            if (!player) return;

            if (video.id !== videoIdRef.current) {
                ttffStartTimeRef.current = null;
                ttffMeasuredRef.current = false;
                videoIdRef.current = video.id;
            }

            const shouldPlay =
                isActive && !userPaused && AppState.currentState === "active";

            if (shouldPlay) {
                player.muted = false;
                player.play();
            } else {
                player.muted = true;
                player.pause();
                if (shouldPreload && !isActive && !userPaused) {
                    player.currentTime = 0;
                }
            }

            if (isActive && !wasActiveRef.current) {
                player.currentTime = 0;
                setUserPaused(false);
            }

            wasActiveRef.current = isActive;
        }, [isActive, userPaused, player, shouldPreload, video.id]);

        useEffect(() => {
            const subscription = AppState.addEventListener(
                "change",
                (state) => {
                    if (!player) return;
                    if (isActive && state === "active" && !userPaused) {
                        player.muted = false;
                        player.play();
                    } else {
                        player.muted = true;
                        player.pause();
                    }
                },
            );
            return () => subscription.remove();
        }, [isActive, userPaused, player]);

        useEvent(player, "onStatusChange", () => {
            if (
                ttffStartTimeRef.current !== null &&
                !ttffMeasuredRef.current &&
                player.status === "readyToPlay"
            ) {
                const ttff = performance.now() - ttffStartTimeRef.current;
                if (ttff >= 0 && ttff < 10000) {
                    performanceMonitor.recordMetric("ttff", ttff, {
                        videoId: video.id,
                        status: player.status,
                        wasActive: isActive,
                    });
                    ttffMeasuredRef.current = true;
                    ttffStartTimeRef.current = null;
                }
            }

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
            <View style={[styles.container, { height: itemHeight }]}>
                <VideoView
                    player={player}
                    controls={false}
                    style={{ ...styles.video, height: itemHeight }}
                />
                <TouchableWithoutFeedback onPress={togglePause}>
                    <View style={styles.touchArea} />
                </TouchableWithoutFeedback>
                <VideoOverlay isVisible={isActive} isPaused={userPaused} />
            </View>
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.video.id === nextProps.video.id &&
            prevProps.isActive === nextProps.isActive &&
            prevProps.shouldPreload === nextProps.shouldPreload &&
            prevProps.itemHeight === nextProps.itemHeight
        );
    },
);

const styles = StyleSheet.create({
    container: {
        width: screenWidth,
        backgroundColor: "black",
        overflow: "hidden",
    },
    video: {
        width: screenWidth,
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
