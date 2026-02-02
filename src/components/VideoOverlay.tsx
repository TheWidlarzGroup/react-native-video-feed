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
import { useTabBarLayout } from "../contexts/TabBarLayoutContext";
import {
    TAB_BAR_BOTTOM_PADDING_MIN,
    TAB_BAR_HEIGHT,
} from "../constants/tabBar";
import { PERFORMANCE_MONITOR_ENABLED } from "../utils/performance";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PLAY_BUTTON_SIZE = 64;
const PLAY_BUTTON_HALF = PLAY_BUTTON_SIZE / 2;
const RIGHT_ICON_SIZE = 40;
const RIGHT_GAP = 12;
const RIGHT_ABOVE_DESCRIPTION = 80;
const SEEK_BAR_HEIGHT = 3;
const SEEK_BAR_HIT_SLOP = 14;
const SEEK_BAR_AREA_HEIGHT = SEEK_BAR_HEIGHT + 2 * SEEK_BAR_HIT_SLOP;
const BOTTOM_GAP = 8;
const OVERLAY_HORIZONTAL_PADDING = 14;

interface VideoOverlayProps {
    isVisible: boolean;
    isPaused: boolean;
    progress?: number;
    onSeek?: (progress: number) => void;
}

const VideoOverlay = ({
    isVisible,
    isPaused,
    progress = 0,
    onSeek,
}: VideoOverlayProps) => {
    const insets = useSafeAreaInsets();
    const { toggleMetrics } = useMetrics();
    const { tabBarHeight: measuredTabBarHeight } = useTabBarLayout();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const playButtonAnim = useRef(new Animated.Value(0)).current;

    const fallbackTabBarHeight =
        Platform.OS === "android"
            ? TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_PADDING_MIN
            : TAB_BAR_HEIGHT + Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING_MIN);
    const tabBarHeight = measuredTabBarHeight ?? fallbackTabBarHeight;
    const bottomPadding = tabBarHeight + BOTTOM_GAP;
    const seekBarBottom = tabBarHeight - SEEK_BAR_HIT_SLOP;
    const rightColumnBottom = bottomPadding + RIGHT_ABOVE_DESCRIPTION;

    const [seekingProgress, setSeekingProgress] = useState<number | null>(null);
    const trackLayoutRef = useRef({ x: 0, width: 1 });
    const seekTrackRef = useRef<View>(null);
    const onSeekRef = useRef(onSeek);
    const progressRef = useRef(progress);

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
                const { locationX } = evt.nativeEvent;
                const { width: trackW } = trackLayoutRef.current;
                const p =
                    trackW > 0
                        ? Math.max(0, Math.min(1, locationX / trackW))
                        : progressRef.current;
                setSeekingProgress(p);
                seek(p);
            },
            onPanResponderMove: (evt) => {
                const seek = onSeekRef.current;
                if (!seek) return;
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
            {/* Play button in center when paused */}
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

            {/* Right side: like, comment, share, metrics (same row) */}
            <View style={[styles.overlayRight, { bottom: rightColumnBottom }]}>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons
                        name="heart"
                        size={RIGHT_ICON_SIZE}
                        color="#fff"
                    />
                    <Text style={styles.iconLabel}>1.2K</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons
                        name="chatbubble"
                        size={RIGHT_ICON_SIZE}
                        color="#fff"
                    />
                    <Text style={styles.iconLabel}>345</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                    <MaterialCommunityIcons
                        name="share"
                        size={RIGHT_ICON_SIZE}
                        color="#fff"
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
                            color="#fff"
                        />
                        <Text style={styles.iconLabel}>Metrics</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Seekbar: stuck right above bottom bar, full screen width */}
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
                <View style={styles.seekBarTrack}>
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
                </View>
            </View>

            {/* Bottom: title/description (above seekbar) */}
            <View
                style={[
                    styles.bottomSection,
                    { marginBottom: SEEK_BAR_AREA_HEIGHT },
                ]}
            >
                <View style={styles.captionArea}>
                    <Text style={styles.captionTitle} numberOfLines={1}>
                        @username · Video title placeholder
                    </Text>
                    <Text style={styles.captionDesc} numberOfLines={2}>
                        First line of video description.
                        {"\n"}
                        Second line of description.
                    </Text>
                </View>
            </View>
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
    },
    iconButton: {
        alignItems: "center",
    },
    iconLabel: {
        color: "#fff",
        fontSize: 13,
        marginTop: 5,
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
    captionArea: {
        paddingRight: 88,
    },
    captionTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    captionDesc: {
        color: "rgba(255,255,255,0.9)",
        fontSize: 13,
        marginTop: 4,
        minHeight: 36,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});

export default VideoOverlay;
