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
    // TTFF tracking
    const viewportEntryTimeRef = useRef<number | null>(null);
    const ttffMeasuredRef = useRef(false);
    const firstProgressCallbackRef = useRef(true);
    // FPS Stability tracking
    const fpsTrackingActiveRef = useRef(false);
    const expectedFpsRef = useRef(60); // Assume 60 FPS, can be adjusted
    const progressCallbacksRef = useRef<number[]>([]);
    const lastProgressTimeRef = useRef<number | null>(null);
    const rafFrameCountRef = useRef(0);
    const rafStartTimeRef = useRef<number | null>(null);
    const rafIdRef = useRef<number | null>(null);

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
                // Reset TTFF tracking when video source changes
                ttffMeasuredRef.current = false;
                viewportEntryTimeRef.current = null;
                firstProgressCallbackRef.current = true;
                // Reset FPS tracking
                fpsTrackingActiveRef.current = false;
                progressCallbacksRef.current = [];
                lastProgressTimeRef.current = null;
                rafFrameCountRef.current = 0;
                rafStartTimeRef.current = null;
                if (rafIdRef.current !== null) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = null;
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
            // Track viewport entry time for TTFF measurement
            // Set entry time when video becomes active (enters viewport)
            if (!viewportEntryTimeRef.current && !ttffMeasuredRef.current) {
                viewportEntryTimeRef.current = performance.now();
                // Reset first progress flag to ensure we catch the first frame
                firstProgressCallbackRef.current = true;
            }

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
            // Reset TTFF tracking when video leaves viewport
            if (!isActive) {
                ttffMeasuredRef.current = false;
                viewportEntryTimeRef.current = null;
                firstProgressCallbackRef.current = true;
                // Stop FPS tracking when video is not active
                fpsTrackingActiveRef.current = false;
                progressCallbacksRef.current = [];
                lastProgressTimeRef.current = null;
                if (rafIdRef.current !== null) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = null;
                }
            } else if (isActive && player.isPlaying) {
                // Start FPS tracking when video becomes active and playing
                fpsTrackingActiveRef.current = true;
                if (rafStartTimeRef.current === null) {
                    rafStartTimeRef.current = performance.now();
                    rafFrameCountRef.current = 0;
                }
            }

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

    // Track TTFF and FPS Stability: measure time from viewport entry to first frame
    useEvent(player, "onProgress", () => {
        const currentTime = performance.now();

        // Only measure TTFF once per video and when video is playing
        // TTFF = time from viewport entry to first frame displayed
        // Skip first video (index 0) as it has initial load overhead
        if (
            index > 0 &&
            !ttffMeasuredRef.current &&
            viewportEntryTimeRef.current !== null &&
            isActive &&
            player.isPlaying &&
            firstProgressCallbackRef.current &&
            player.status === "readyToPlay"
        ) {
            const firstFrameTime = currentTime;
            const ttff = firstFrameTime - viewportEntryTimeRef.current;

            if (ttff > 0 && ttff < 10000) {
                // Sanity check: TTFF should be positive and less than 10 seconds
                performanceMonitor.recordMetric("ttff", ttff, {
                    index,
                    preloaded: preloadAttemptedRef.current ? 1 : 0,
                });

                ttffMeasuredRef.current = true;
            }
            firstProgressCallbackRef.current = false;
        } else if (index === 0) {
            // Skip TTFF measurement for first video, but still mark as measured to avoid tracking
            firstProgressCallbackRef.current = false;
        }

        // Track FPS Stability: measure progress callback frequency
        // Track whenever video is active and playing (don't require fpsTrackingActiveRef)
        // Reduced frequency to avoid performance impact
        if (isActive && player.isPlaying && progressCallbacksRef.current.length % 2 === 0) {
            progressCallbacksRef.current.push(currentTime);

            // Keep only last 5 seconds of data (reduced from 10)
            const fiveSecondsAgo = currentTime - 5000;
            progressCallbacksRef.current = progressCallbacksRef.current.filter(
                (time) => time > fiveSecondsAgo
            );

            // Calculate expected vs actual progress callbacks
            // onProgress is called ~4 times per second (every ~250ms)
            // So we can estimate frame drops based on callback frequency
            if (progressCallbacksRef.current.length >= 4) {
                const timeSpan =
                    progressCallbacksRef.current[
                        progressCallbacksRef.current.length - 1
                    ] -
                    progressCallbacksRef.current[0];
                const actualCallbacks = progressCallbacksRef.current.length - 1;
                const expectedCallbacks = (timeSpan / 250) * 4; // 4 callbacks per second
                const callbackDropRate =
                    Math.max(0, (expectedCallbacks - actualCallbacks) / expectedCallbacks) *
                    100;

                // Frame drops are already included in fps_stability metadata
                // No need for separate frame_drops metric
            }

            lastProgressTimeRef.current = currentTime;
        }
    });

    // Track actual FPS using requestAnimationFrame
    useEffect(() => {
        // Only track when video is active and playing
        if (!isActive || !player.isPlaying) {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            fpsTrackingActiveRef.current = false;
            return;
        }

        // Start FPS tracking
        fpsTrackingActiveRef.current = true;
        let frameCount = 0;
        let startTime = performance.now();

        const measureFps = () => {
            // Check if still active
            if (!isActive || !player.isPlaying || !fpsTrackingActiveRef.current) {
                fpsTrackingActiveRef.current = false;
                return;
            }

            frameCount++;
            const currentTime = performance.now();
            const elapsed = currentTime - startTime;

            // Measure FPS every 3 seconds (reduced frequency to save memory)
            if (elapsed >= 3000) {
                const actualFps = (frameCount / elapsed) * 1000;
                const expectedFps = expectedFpsRef.current;
                const fpsDropRate =
                    Math.max(0, ((expectedFps - actualFps) / expectedFps) * 100);

                // Only record if there's a significant drop (>5%) to reduce data
                if (fpsDropRate > 5 || actualFps < expectedFps * 0.9) {
                    performanceMonitor.recordMetric("fps_stability", actualFps, {
                        index,
                        fpsDropRate: fpsDropRate.toFixed(1),
                    });
                }

                // Reset for next measurement
                frameCount = 0;
                startTime = currentTime;
            }

            // Continue tracking
            if (fpsTrackingActiveRef.current && isActive && player.isPlaying) {
                rafIdRef.current = requestAnimationFrame(measureFps);
            }
        };

        // Start measurement
        rafIdRef.current = requestAnimationFrame(measureFps);

        return () => {
            fpsTrackingActiveRef.current = false;
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [isActive, player.isPlaying, index]);

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
