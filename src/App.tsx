import { StatusBar } from "expo-status-bar";
import React, { useRef } from "react";
import { View } from "react-native";
import { LegendListRef } from "@legendapp/list";
import { styles } from "./styles";
import { useVideoFeed } from "./hooks";
import {
    BootScreen,
    VideoFeedList,
    BottomTabBar,
    PerformanceMonitor,
} from "./components";

export default function App() {
    const listRef = useRef<LegendListRef | null>(null);
    const {
        isBooting,
        players,
        visibleIndex,
        handleMomentumScrollEnd,
        viewabilityConfigCallbackPairs,
        handleEndReached,
    } = useVideoFeed();

    return (
        <View style={styles.container}>
            {isBooting ? (
                <BootScreen />
            ) : (
                <VideoFeedList
                    listRef={listRef}
                    players={players}
                    visibleIndex={visibleIndex}
                    handleMomentumScrollEnd={handleMomentumScrollEnd}
                    viewabilityConfigCallbackPairs={
                        viewabilityConfigCallbackPairs
                    }
                    onEndReached={handleEndReached}
                />
            )}
            <StatusBar style="light" />
            <BottomTabBar />
            <PerformanceMonitor />
        </View>
    );
}
