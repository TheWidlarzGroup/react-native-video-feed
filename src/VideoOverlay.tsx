import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { styles } from "./styles";

interface VideoOverlayProps {
    isVisible: boolean;
}

const VideoOverlay = ({ isVisible }: VideoOverlayProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

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

    return (
        <Animated.View
            style={[styles.overlayContainer, { opacity: fadeAnim }]}
            pointerEvents="box-none"
        >
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

export default VideoOverlay;
