import { StatusBar } from "expo-status-bar";
import React from "react";
import { StyleSheet, View } from "react-native";
import {
    VideoFeedList,
    BottomTabBar,
} from "./components";

export default function App() {
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
