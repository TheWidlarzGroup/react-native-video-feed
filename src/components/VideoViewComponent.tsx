import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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
const FALLBACK_ITEM_HEIGHT = Math.floor(Dimensions.get("window").height);

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
        const [progress, setProgress] = useState(0);
        const wasActiveRef = useRef(isActive);
        const ttffStartTimeRef = useRef<number | null>(null);
        const ttffMeasuredRef = useRef(false);
        const visibleAtRef = useRef<number | null>(null);
        const perceivedMeasuredRef = useRef(false);
        const videoIdRef = useRef(video.id);
        const currentTimeResetRef = useRef(false);
        const isActiveRef = useRef(isActive);
        const userPausedRef = useRef(userPaused);

        const player = useVideoPlayer(video.url, (p) => {
            p.loop = true;
            p.muted = true;
        });
        
        useEffect(() => {
            isActiveRef.current = isActive;
        }, [isActive]);
        
        useEffect(() => {
            userPausedRef.current = userPaused;
        }, [userPaused]);

        useEffect(() => {
            if (!player) return;

            const currentUri = player.source?.uri;

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
                            } catch {}
                        })
                        .catch(() => {});
                } else if (player.status === "idle") {
                    if (
                        ttffStartTimeRef.current === null &&
                        !ttffMeasuredRef.current
                    ) {
                        ttffStartTimeRef.current = performance.now();
                    }

                    try {
                        player.preload();
                    } catch {}
                } else if (
                    player.status === "loading" &&
                    ttffStartTimeRef.current === null &&
                    !ttffMeasuredRef.current
                ) {
                    ttffStartTimeRef.current = performance.now();
                }
            }
        }, [shouldPreload, isActive, player, video.url]);

        useEffect(() => {
            if (!player) return;

            if (video.id !== videoIdRef.current) {
                ttffStartTimeRef.current = null;
                ttffMeasuredRef.current = false;
                visibleAtRef.current = null;
                perceivedMeasuredRef.current = false;
                videoIdRef.current = video.id;
                currentTimeResetRef.current = false;
                setProgress(0);
            }

            const wasActive = wasActiveRef.current;
            wasActiveRef.current = isActive;
            const becameActive = isActive && !wasActive;
            const becameInactive = !isActive && wasActive;

            if (becameActive) {
                const now = performance.now();
                visibleAtRef.current = now;
                perceivedMeasuredRef.current = false;
                setUserPaused(false);
                
                if (!currentTimeResetRef.current) {
                    const shouldReset = !player.isPlaying || player.currentTime < 0.1;
                    if (shouldReset) {
                        player.currentTime = 0;
                        currentTimeResetRef.current = true;
                    }
                }

                if (
                    player.status === "readyToPlay" &&
                    !perceivedMeasuredRef.current
                ) {
                    performanceMonitor.recordMetric("perceived_ttff", 0, {
                        videoId: video.id,
                        status: "readyToPlay",
                        preloaded: true,
                    });
                    perceivedMeasuredRef.current = true;
                    visibleAtRef.current = null;
                    if (AppState.currentState === "active") {
                        player.muted = false;
                        player.play();
                    }
                }
            } else if (becameInactive) {
                visibleAtRef.current = null;
                perceivedMeasuredRef.current = false;
                currentTimeResetRef.current = false;
            }
            
            if (isActive && player.isPlaying && currentTimeResetRef.current) {
                currentTimeResetRef.current = false;
            }

            const appState = AppState.currentState;
            const shouldPlay =
                isActive && !userPaused && appState === "active";

            if (shouldPlay) {
                player.muted = false;
                if (!player.isPlaying) {
                    player.play();
                }
            } else {
                player.muted = true;
                if (player.isPlaying) {
                    player.pause();
                }
                if (shouldPreload && !isActive && !userPaused) {
                    player.currentTime = 0;
                }
            }
        }, [isActive, userPaused, player, shouldPreload, video.id]);

        useEffect(() => {
            const subscription = AppState.addEventListener(
                "change",
                (state) => {
                    if (!player) return;
                    const currentIsActive = isActiveRef.current;
                    const currentUserPaused = userPausedRef.current;
                    if (currentIsActive && state === "active" && !currentUserPaused) {
                        player.muted = false;
                        player.play();
                    } else {
                        player.muted = true;
                        player.pause();
                    }
                },
            );
            return () => subscription.remove();
        }, [player]);

        useEvent(player, "onProgress", () => {
            if (!isActiveRef.current) return;
            const dur = player.duration;
            const cur = player.currentTime;
            if (dur > 0 && Number.isFinite(cur)) {
                setProgress(Math.min(1, Math.max(0, cur / dur)));
            }
        });

        useEvent(player, "onStatusChange", () => {
            const currentIsActive = isActiveRef.current;
            const currentUserPaused = userPausedRef.current;
            
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
                        wasActive: currentIsActive,
                    });
                    ttffMeasuredRef.current = true;
                    ttffStartTimeRef.current = null;
                }
            }

            if (
                currentIsActive &&
                visibleAtRef.current !== null &&
                !perceivedMeasuredRef.current &&
                player.status === "readyToPlay"
            ) {
                const perceivedTtff = performance.now() - visibleAtRef.current;
                if (perceivedTtff >= -100 && perceivedTtff < 10000) {
                    performanceMonitor.recordMetric(
                        "perceived_ttff",
                        perceivedTtff,
                        {
                            videoId: video.id,
                            status: player.status,
                        },
                    );
                    perceivedMeasuredRef.current = true;
                    visibleAtRef.current = null;
                }
            }

            if (
                currentIsActive &&
                !currentUserPaused &&
                AppState.currentState === "active" &&
                player.status === "readyToPlay"
            ) {
                if (!player.isPlaying) {
                    player.muted = false;
                    player.play();
                }
            }
        });

        const togglePause = useCallback(() => {
            setUserPaused((prev) => !prev);
        }, []);

        const handleSeek = useCallback(
            (p: number) => {
                if (!isActive || !player) return;
                const dur = player.duration;
                if (dur > 0 && Number.isFinite(dur)) {
                    const t = Math.max(0, Math.min(1, p)) * dur;
                    player.seekTo(t);
                    setProgress(p);
                }
            },
            [isActive, player],
        );

        const duration = useMemo(
            () => player?.duration ?? 0,
            [player?.duration],
        );

        return (
            <View style={[styles.container, { height: itemHeight }]}>
                <VideoView
                    player={player}
                    controls={false}
                    resizeMode="cover"
                    style={{ ...styles.video, height: itemHeight }}
                />
                <TouchableWithoutFeedback onPress={togglePause}>
                    <View style={styles.touchArea} />
                </TouchableWithoutFeedback>
                <VideoOverlay
                    isVisible={isActive}
                    isPaused={userPaused}
                    progress={progress}
                    duration={duration}
                    onSeek={isActive && player ? handleSeek : undefined}
                />
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
