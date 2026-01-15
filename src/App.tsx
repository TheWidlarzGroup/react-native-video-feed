import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { VideoFeedList, BottomTabBar } from "./components";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
    return (
        <SafeAreaProvider>
            <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
                <View style={styles.container}>
                    <VideoFeedList />
                    <StatusBar style="light" />
                    <BottomTabBar />
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
