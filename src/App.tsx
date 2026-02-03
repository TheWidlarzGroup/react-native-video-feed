import { StatusBar } from "expo-status-bar";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { VideoFeedList, BottomTabBar, PerformanceMonitor } from "./components";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { MetricsProvider } from "./contexts/MetricsContext";
import { SeekProvider } from "./contexts/SeekContext";
import { TabBarLayoutProvider } from "./contexts/TabBarLayoutContext";
import { useFPSMonitor } from "./hooks/useFPSMonitor";

export default function App() {
    useFPSMonitor(true);

    return (
        <SafeAreaProvider>
            <MetricsProvider>
                <TabBarLayoutProvider>
                    <SeekProvider>
                        <SafeAreaView edges={[]} style={styles.safeArea}>
                            <StatusBar
                                style="light"
                                translucent={Platform.OS === "android"}
                            />
                            <View style={styles.container}>
                                <VideoFeedList />
                                <BottomTabBar />
                                <PerformanceMonitor />
                            </View>
                        </SafeAreaView>
                    </SeekProvider>
                </TabBarLayoutProvider>
            </MetricsProvider>
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
