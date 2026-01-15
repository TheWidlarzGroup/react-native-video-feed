import { StatusBar } from "expo-status-bar";
import React from "react";
import { StyleSheet, View } from "react-native";
import { VideoFeedList, BottomTabBar, PerformanceMonitor } from "./components";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { useFPSMonitor } from "./hooks/useFPSMonitor";

export default function App() {
    useFPSMonitor(true);

    return (
        <SafeAreaProvider>
            <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
                <View style={styles.container}>
                    <VideoFeedList />
                    <StatusBar style="light" />
                    <BottomTabBar />
                    <PerformanceMonitor />
                </View>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#000",
    },
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
});
