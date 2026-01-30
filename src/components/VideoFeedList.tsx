import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    LayoutChangeEvent,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { LegendList, LegendListRef, ViewToken } from "@legendapp/list";
import useVideoFeed from "../hooks/useVideoFeed";
import { Video } from "../types";
import VideoViewComponent from "./VideoViewComponent";
import { performanceMonitor } from "../utils/performance";

const SCREEN_WIDTH = Dimensions.get("window").width;
const BOTTOM_BAR_HEIGHT = 64;
const FALLBACK_ITEM_HEIGHT = Math.floor(
    Dimensions.get("window").height - BOTTOM_BAR_HEIGHT,
);

const MAX_PRELOAD_DISTANCE = 5;

type Direction = "up" | "down";

const VideoFeedList = () => {
    const { videos, loading, error } = useVideoFeed();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState<Direction>("up");
    const [measuredHeight, setMeasuredHeight] = useState<number | null>(
        Platform.OS === "ios" ? FALLBACK_ITEM_HEIGHT : null,
    );
    const indexRef = useRef(currentIndex);

    const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
        const h = Math.floor(e.nativeEvent.layout.height);
        if (h > 0) setMeasuredHeight(h);
    }, []);

    const itemHeight = measuredHeight ?? FALLBACK_ITEM_HEIGHT;
    const listReady = measuredHeight !== null;
    const listRef = useRef<LegendListRef | null>(null);
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 30,
    }).current;
    const scrollStartTimeRef = useRef<number | null>(null);
    const scrollLagFrameRef = useRef<number | null>(null);

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

            if (clampedIndex === prevIndex) {
                return;
            }

            // Batch state updates to reduce re-renders
            setDirection(clampedIndex > prevIndex ? "up" : "down");
            updateIndex(clampedIndex, maxIndex);
        },
        [updateIndex, videos.length],
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

            return (
                <VideoViewComponent
                    video={item}
                    isActive={isActive}
                    shouldPreload={shouldPreload}
                    itemHeight={itemHeight}
                />
            );
        },
        [currentIndex, direction, itemHeight],
    );

    const keyExtractor = useCallback((item: Video) => item.id, []);

    const handleScrollBeginDrag = useCallback(() => {
        scrollStartTimeRef.current = performance.now();

        if (scrollLagFrameRef.current !== null) {
            cancelAnimationFrame(scrollLagFrameRef.current);
        }

        scrollLagFrameRef.current = requestAnimationFrame(() => {
            if (scrollStartTimeRef.current !== null) {
                const scrollLag =
                    performance.now() - scrollStartTimeRef.current;
                performanceMonitor.recordMetric("scroll_lag", scrollLag, {
                    timestamp: Date.now(),
                });
                scrollStartTimeRef.current = null;
            }
            scrollLagFrameRef.current = null;
        });
    }, []);

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
        <View style={styles.container} onLayout={handleContainerLayout}>
            {listReady ? (
                <LegendList
                    ref={listRef}
                    data={videos}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    extraData={currentIndex}
                    pagingEnabled
                    showsVerticalScrollIndicator={false}
                    snapToInterval={itemHeight}
                    snapToAlignment="start"
                    decelerationRate={0.95}
                    scrollEventThrottle={16}
                    disableIntervalMomentum={false}
                    onViewableItemsChanged={handleVideoChange}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    viewabilityConfig={viewabilityConfig}
                    estimatedItemSize={itemHeight}
                    getFixedItemSize={() => itemHeight}
                    drawDistance={itemHeight * 3}
                    getItemType={() => "video"}
                    bounces={false}
                    overScrollMode="never"
                    style={styles.list}
                />
            ) : null}
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
    },
});

export default VideoFeedList;
