import { FontAwesome, Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    TAB_BAR_BOTTOM_PADDING_MIN,
    TAB_BAR_HEIGHT,
} from "../constants/tabBar";
import { useTabBarLayout } from "../contexts/TabBarLayoutContext";

const ICON_SIZE = 24;

const BottomTabBar = () => {
    const insets = useSafeAreaInsets();
    const { setTabBarHeight } = useTabBarLayout();

    const handleLayout = (e: LayoutChangeEvent) => {
        const height = e.nativeEvent.layout.height;
        if (height > 0) setTabBarHeight(height);
    };

    return (
        <View
            style={[
                styles.tabBar,
                { paddingBottom: Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING_MIN) },
            ]}
            onLayout={handleLayout}
        >
            <TouchableOpacity style={styles.tabItem}>
                <Ionicons name="home" size={ICON_SIZE} color="#fff" />
                <Text style={styles.tabLabel}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem}>
                <Ionicons name="search" size={ICON_SIZE} color="#fff" />
                <Text style={styles.tabLabel}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem}>
                <FontAwesome
                    name="plus-square"
                    size={ICON_SIZE + 4}
                    color="#fff"
                />
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem}>
                <Ionicons
                    name="chatbubble-ellipses"
                    size={ICON_SIZE}
                    color="#fff"
                />
                <Text style={styles.tabLabel}>Inbox</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem}>
                <Ionicons name="person" size={ICON_SIZE} color="#fff" />
                <Text style={styles.tabLabel}>Profile</Text>
            </TouchableOpacity>
        </View>
    );
};

export default BottomTabBar;

export const styles = StyleSheet.create({
    tabBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: TAB_BAR_HEIGHT,
        backgroundColor: "#000",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingTop: 10,
        zIndex: 10,
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
    },
    tabLabel: {
        color: "#fff",
        fontSize: 10,
        marginTop: 2,
    },
});
