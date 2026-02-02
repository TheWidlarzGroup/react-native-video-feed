import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMetrics } from "../contexts/MetricsContext";
import { useSeek } from "../contexts/SeekContext";
import { useTabBarLayout } from "../contexts/TabBarLayoutContext";
import {
    TAB_BAR_BOTTOM_PADDING_MIN,
    TAB_BAR_HEIGHT,
} from "../constants/tabBar";
import { PERFORMANCE_MONITOR_ENABLED } from "../utils/performance";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PLAY_BUTTON_SIZE = 64;
const PLAY_BUTTON_HALF = PLAY_BUTTON_SIZE / 2;
const RIGHT_ICON_SIZE = 34;
const RIGHT_ICON_OPACITY = 0.88;
const RIGHT_GAP = 18;
const AVATAR_SIZE = 40;
const BOTTOM_SECTION_MARGIN = 22; // aligns right icons with description bottom
const SEEK_BAR_HEIGHT = 3;
const SEEK_BAR_HIT_SLOP = 14;
const SEEK_BAR_AREA_HEIGHT = SEEK_BAR_HEIGHT + 2 * SEEK_BAR_HIT_SLOP;
const SEEK_TRACK_SCALE_DRAG = 3;
const SEEK_TRACK_ANIM_DURATION = 180;
const BOTTOM_GAP = 4;
const OVERLAY_HORIZONTAL_PADDING = 14;
const SEEK_TIMER_ANIM_DURATION = 200;
const SEEK_TIMER_OFFSET_ABOVE_BAR = 48;

function formatSeekTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

interface VideoOverlayProps {
    isVisible: boolean;
    isPaused: boolean;
    progress?: number;
    duration?: number;
    onSeek?: (progress: number) => void;
}

const VideoOverlay = ({
    isVisible,
    isPaused,
    progress = 0,
    duration = 0,
    onSeek,
}: VideoOverlayProps) => {
    const insets = useSafeAreaInsets();
    const { toggleMetrics } = useMetrics();
    const { setSeeking } = useSeek();
    const { tabBarHeight: measuredTabBarHeight } = useTabBarLayout();
    const setSeekingRef = useRef(setSeeking);
    setSeekingRef.current = setSeeking;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const playButtonAnim = useRef(new Animated.Value(0)).current;

    const fallbackTabBarHeight =
        Platform.OS === "android"
            ? TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_PADDING_MIN
            : TAB_BAR_HEIGHT +
              Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING_MIN);
    const tabBarHeight = measuredTabBarHeight ?? fallbackTabBarHeight;
    const bottomPadding = tabBarHeight + BOTTOM_GAP;
    const seekBarBottom = tabBarHeight - SEEK_BAR_HIT_SLOP;
    const rightColumnBottom = bottomPadding + BOTTOM_SECTION_MARGIN;

    const [seekingProgress, setSeekingProgress] = useState<number | null>(null);
    const trackLayoutRef = useRef({ x: 0, width: 1 });
    const seekTrackRef = useRef<View>(null);
    const onSeekRef = useRef(onSeek);
    const progressRef = useRef(progress);
    const trackScaleY = useRef(new Animated.Value(1)).current;
    const descOpacity = useRef(new Animated.Value(1)).current;
    const seekTimerOpacity = useRef(new Animated.Value(0)).current;
    const isDraggingRef = useRef(false);

    const hideSeekState = useRef(() => {
        setSeekingRef.current(false);
        isDraggingRef.current = false;
        Animated.parallel([
            Animated.timing(trackScaleY, {
                toValue: 1,
                duration: SEEK_TRACK_ANIM_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(descOpacity, {
                toValue: 1,
                duration: SEEK_TIMER_ANIM_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(seekTimerOpacity, {
                toValue: 0,
                duration: SEEK_TIMER_ANIM_DURATION,
                useNativeDriver: true,
            }),
        ]).start();
    }).current;

    const showSeekDescTimerTransition = useRef(() => {
        descOpacity.setValue(0);
        seekTimerOpacity.setValue(1);
    }).current;

    onSeekRef.current = onSeek;
    progressRef.current = progress;

    const displayProgress =
        seekingProgress !== null ? seekingProgress : progress;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !!onSeekRef.current,
            onStartShouldSetPanResponderCapture: () => !!onSeekRef.current,
            onMoveShouldSetPanResponder: () => !!onSeekRef.current,
            onPanResponderGrant: (evt) => {
                const seek = onSeekRef.current;
                if (!seek) return;
                isDraggingRef.current = false;
                const { locationX } = evt.nativeEvent;
                const { width: trackW } = trackLayoutRef.current;
                const p =
                    trackW > 0
                        ? Math.max(0, Math.min(1, locationX / trackW))
                        : progressRef.current;
                setSeekingProgress(p);
                seek(p);
                setSeekingRef.current(true);
                showSeekDescTimerTransition();
            },
            onPanResponderMove: (evt) => {
                const seek = onSeekRef.current;
                if (!seek) return;
                if (!isDraggingRef.current) {
                    isDraggingRef.current = true;
                    Animated.timing(trackScaleY, {
                        toValue: SEEK_TRACK_SCALE_DRAG,
                        duration: SEEK_TRACK_ANIM_DURATION,
                        useNativeDriver: true,
                    }).start();
                }
                const moveX = evt.nativeEvent.pageX;
                const { x: trackX, width: trackW } = trackLayoutRef.current;
                const p =
                    trackW > 0
                        ? Math.max(0, Math.min(1, (moveX - trackX) / trackW))
                        : progressRef.current;
                setSeekingProgress(p);
                seek(p);
            },
            onPanResponderRelease: () => {
                setSeekingProgress(null);
                hideSeekState();
            },
            onPanResponderTerminate: () => {
                setSeekingProgress(null);
                hideSeekState();
            },
        })
    ).current;

    useEffect(() => {
        if (isVisible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [isVisible, fadeAnim]);

    useEffect(() => {
        if (isPaused && isVisible) {
            Animated.timing(playButtonAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(playButtonAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isPaused, isVisible, playButtonAnim]);

    if (!isVisible) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.overlayContainer,
                { opacity: fadeAnim, paddingBottom: bottomPadding },
            ]}
            pointerEvents="box-none"
        >
            <Animated.View
                style={[
                    styles.playButtonContainer,
                    {
                        opacity: playButtonAnim,
                        transform: [
                            { translateX: -PLAY_BUTTON_HALF },
                            { translateY: -PLAY_BUTTON_HALF },
                        ],
                    },
                ]}
                pointerEvents="none"
            >
                <Ionicons name="play" size={40} color="#fff" />
            </Animated.View>

            <View style={[styles.overlayRight, { bottom: rightColumnBottom }]}>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons
                        name="heart"
                        size={RIGHT_ICON_SIZE}
                        color={`rgba(255,255,255,${RIGHT_ICON_OPACITY})`}
                    />
                    <Text style={styles.iconLabel}>1.2K</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons
                        name="chatbubble"
                        size={RIGHT_ICON_SIZE}
                        color={`rgba(255,255,255,${RIGHT_ICON_OPACITY})`}
                    />
                    <Text style={styles.iconLabel}>345</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                    <MaterialCommunityIcons
                        name="share"
                        size={RIGHT_ICON_SIZE}
                        color={`rgba(255,255,255,${RIGHT_ICON_OPACITY})`}
                    />
                    <Text style={styles.iconLabel}>Share</Text>
                </TouchableOpacity>
                {PERFORMANCE_MONITOR_ENABLED && (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={toggleMetrics}
                    >
                        <Ionicons
                            name="stats-chart"
                            size={RIGHT_ICON_SIZE}
                            color={`rgba(255,255,255,${RIGHT_ICON_OPACITY})`}
                        />
                        <Text style={styles.iconLabel}>Metrics</Text>
                    </TouchableOpacity>
                )}
                <View style={styles.avatarPlaceholder}>
                    <Ionicons
                        name="person"
                        size={AVATAR_SIZE * 0.5}
                        color="rgba(255,255,255,0.6)"
                    />
                </View>
            </View>

            <View
                ref={seekTrackRef}
                pointerEvents="box-only"
                style={[
                    styles.seekBarHitAreaSticky,
                    {
                        bottom: seekBarBottom,
                        left: -OVERLAY_HORIZONTAL_PADDING,
                        right: -OVERLAY_HORIZONTAL_PADDING,
                    },
                ]}
                onLayout={(e) => {
                    const { width } = e.nativeEvent.layout;
                    if (width > 0) {
                        trackLayoutRef.current.width = width;
                    }
                    seekTrackRef.current?.measureInWindow((x, _y, w) => {
                        if (w > 0) {
                            trackLayoutRef.current = { x, width: w };
                        }
                    });
                }}
                {...(onSeek ? panResponder.panHandlers : {})}
            >
                <Animated.View
                    style={[
                        styles.seekBarTrack,
                        {
                            transform: [{ scaleY: trackScaleY }],
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.seekBarFill,
                            {
                                width: `${
                                    Math.min(1, Math.max(0, displayProgress)) *
                                    100
                                }%`,
                            },
                        ]}
                    />
                </Animated.View>
            </View>

            <Animated.View
                pointerEvents="none"
                style={[
                    styles.seekTimer,
                    {
                        bottom:
                            seekBarBottom +
                            SEEK_BAR_AREA_HEIGHT +
                            SEEK_TIMER_OFFSET_ABOVE_BAR,
                        opacity: seekTimerOpacity,
                    },
                ]}
            >
                <Text style={styles.seekTimerText}>
                    {formatSeekTime(
                        displayProgress * (duration > 0 ? duration : 0)
                    )}
                    {" / "}
                    {formatSeekTime(duration > 0 ? duration : 0)}
                </Text>
            </Animated.View>

            <Animated.View
                style={[
                    styles.bottomSection,
                    {
                        marginBottom: BOTTOM_SECTION_MARGIN,
                        opacity: descOpacity,
                    },
                ]}
            >
                <View style={styles.captionArea}>
                    <Text style={styles.captionUsername} numberOfLines={1}>
                        @username
                    </Text>
                    <Text style={styles.captionDescLine1}>
                        Video title placeholder. Placeholder description here.
                    </Text>
                    <Text style={styles.captionDescLine2}>
                        More placeholder description here.
                    </Text>
                </View>
            </Animated.View>
        </Animated.View>
    );
};

export const styles = StyleSheet.create({
    overlayContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "flex-end",
        alignItems: "flex-end",
        paddingLeft: 14,
        paddingRight: 14,
        zIndex: 25,
    },
    overlayRight: {
        position: "absolute",
        right: 14,
        justifyContent: "flex-end",
        alignItems: "center",
        gap: RIGHT_GAP,
        zIndex: 10,
    },
    iconButton: {
        alignItems: "center",
    },
    avatarPlaceholder: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: "rgba(255,255,255,0.2)",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.4)",
        justifyContent: "center",
        alignItems: "center",
    },
    iconLabel: {
        color: `rgba(255,255,255,${RIGHT_ICON_OPACITY})`,
        fontSize: 12,
        marginTop: 4,
        fontWeight: "600",
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    playButtonContainer: {
        position: "absolute",
        top: SCREEN_HEIGHT / 2,
        left: SCREEN_WIDTH / 2,
        width: PLAY_BUTTON_SIZE,
        height: PLAY_BUTTON_SIZE,
        borderRadius: PLAY_BUTTON_HALF,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    bottomSection: {
        alignSelf: "stretch",
    },
    seekBarHitAreaSticky: {
        position: "absolute",
        paddingVertical: SEEK_BAR_HIT_SLOP,
    },
    seekBarTrack: {
        height: SEEK_BAR_HEIGHT,
        backgroundColor: "rgba(255,255,255,0.3)",
        borderRadius: SEEK_BAR_HEIGHT / 2,
        overflow: "hidden",
    },
    seekBarFill: {
        height: "100%",
        backgroundColor: "#fff",
        borderRadius: SEEK_BAR_HEIGHT / 2,
    },
    seekTimer: {
        position: "absolute",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 8,
    },
    seekTimerText: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "600",
    },
    captionArea: {
        paddingRight: 88,
    },
    captionUsername: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 2,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    captionDescLine1: {
        color: "rgba(255,255,255,0.92)",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 0,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    captionDescLine2: {
        color: "rgba(255,255,255,0.92)",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 2,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});

export default VideoOverlay;
