import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PLAY_BUTTON_SIZE = 80;
const PLAY_BUTTON_HALF = PLAY_BUTTON_SIZE / 2;

interface VideoOverlayProps {
    isVisible: boolean;
    isPaused: boolean;
}

const VideoOverlay = ({ isVisible, isPaused }: VideoOverlayProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const playButtonAnim = useRef(new Animated.Value(0)).current;

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

    return (
        <Animated.View
            style={[styles.overlayContainer, { opacity: fadeAnim }]}
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
                <Ionicons name="play" size={50} color="#fff" />
            </Animated.View>

            <View style={styles.overlayRight}>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons name="heart" size={40} color="#fff" />
                    <Text style={styles.iconLabel}>1.2K</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons name="chatbubble" size={40} color="#fff" />
                    <Text style={styles.iconLabel}>345</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                    <MaterialCommunityIcons
                        name="share"
                        size={40}
                        color="#fff"
                    />
                    <Text style={styles.iconLabel}>Share</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
    },
    overlayContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "flex-end",
        alignItems: "flex-end",
        padding: 20,
        zIndex: 25,
    },
    overlayRight: {
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        marginBottom: 96,
    },
    iconButton: {
        alignItems: "center",
        marginBottom: 24,
    },
    iconLabel: {
        color: "#fff",
        fontSize: 16,
        marginTop: 4,
        fontWeight: "600",
        textShadowColor: "rgba(0,0,0,0.7)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    tabBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 64,
        backgroundColor: "rgba(0,0,0,0.85)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: 8,
        zIndex: 10,
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
    },
    tabLabel: {
        color: "#fff",
        fontSize: 12,
        marginTop: 2,
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
});

export default VideoOverlay;
