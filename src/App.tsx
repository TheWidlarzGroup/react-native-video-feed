import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { VideoFeedList, BottomTabBar } from "./components";
import { prefetchVideos } from "./utils/prefetch";

export default function App() {
    useEffect(() => {
        // Prefetch all video sources at app startup
        prefetchVideos();
    }, []);

    return (
        <View style={styles.container}>
            <VideoFeedList />
            <StatusBar style="light" />
            <BottomTabBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
});
