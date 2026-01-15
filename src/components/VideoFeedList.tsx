import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { LegendList, LegendListRef, ViewToken } from "@legendapp/list";
import useVideoFeed from "../hooks/useVideoFeed";
import { Video } from "../types";
import VideoViewComponent from "./VideoViewComponent";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;

const MAX_PRELOAD_DISTANCE = 5;

type Direction = "up" | "down";

const VideoFeedList = () => {
    const { videos, loading, error } = useVideoFeed();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState<Direction>("up");
    const indexRef = useRef(currentIndex);
    const listRef = useRef<LegendListRef | null>(null);
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const updateIndex = useCallback((nextIndex: number, maxIndex: number) => {
        const clamped = Math.max(0, Math.min(nextIndex, maxIndex));

        if (clamped === indexRef.current) return;

        indexRef.current = clamped;
        setCurrentIndex(clamped);
    }, []);

    const handleVideoChange = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            const nextIndex = viewableItems[0]?.index ?? -1;
            if (nextIndex === -1 || videos.length === 0) {
                return;
            }
            const maxIndex = videos.length - 1;
            const clampedIndex = Math.max(0, Math.min(nextIndex, maxIndex));
            const prevIndex = indexRef.current;

            console.log(`[VideoFeedList] handleVideoChange - nextIndex: ${nextIndex}, clampedIndex: ${clampedIndex}, prevIndex: ${prevIndex}`);

            if (clampedIndex === prevIndex) {
                return;
            }

            setDirection(clampedIndex > prevIndex ? "up" : "down");
            updateIndex(clampedIndex, maxIndex);
        },
        [updateIndex, videos.length]
    );

    const renderItem = useCallback(
        ({ item, index }: { item: Video; index: number }) => {
            const isActive = index === currentIndex;
            const distanceFromActive = index - currentIndex;
            const isAhead =
                direction === "down"
                    ? distanceFromActive > 0
                    : distanceFromActive < 0;

            const shouldPreloadAhead =
                isAhead && Math.abs(distanceFromActive) <= MAX_PRELOAD_DISTANCE;

            const shouldPreloadBehind =
                !isAhead &&
                Math.abs(distanceFromActive) <= MAX_PRELOAD_DISTANCE;

            const shouldPreload = shouldPreloadAhead || shouldPreloadBehind;

            console.log(`[VideoFeedList] renderItem - index: ${index}, currentIndex: ${currentIndex}, isActive: ${isActive}`);

            return (
                <VideoViewComponent
                    video={item}
                    isActive={isActive}
                    shouldPreload={shouldPreload}
                />
            );
        },
        [currentIndex, direction]
    );

    const keyExtractor = useCallback((item: Video) => item.id, []);

    if (loading) {
        return (
            <View>
                <ActivityIndicator size="large" color="#fff" />
                <Text>Loading....</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View>
                <Text>Error loading videos</Text>
                <Text>{error}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LegendList
                ref={listRef}
                data={videos}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                extraData={currentIndex}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={SCREEN_HEIGHT}
                snapToAlignment="start"
                decelerationRate="fast"
                onViewableItemsChanged={handleVideoChange}
                viewabilityConfig={viewabilityConfig}
                estimatedItemSize={SCREEN_HEIGHT}
                getFixedItemSize={() => SCREEN_HEIGHT}
                drawDistance={SCREEN_HEIGHT * 3}
                getItemType={() => "video"}
                bounces={false}
                overScrollMode="never"
                style={styles.list}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "black",
    },
    list: {
        flex: 1,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
});

export default VideoFeedList;
