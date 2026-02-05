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
import { useSeek } from "../contexts/SeekContext";
import useVideoFeed from "../hooks/useVideoFeed";
import { Video } from "../types";
import VideoViewComponent from "./VideoViewComponent";
import { performanceMonitor } from "../utils/performance";

const SCREEN_WIDTH = Dimensions.get("window").width;
const FALLBACK_ITEM_HEIGHT = Math.ceil(Dimensions.get("window").height);

const ITEM_OVERLAP = 4;

const PRELOAD_AHEAD = 3;
const PRELOAD_BEHIND = 1;
const DRAW_DISTANCE_MULTIPLIER = 2;
const SCROLL_EVENT_THROTTLE = 16;
const USE_PLACEHOLDER_OUTSIDE_PRELOAD = true;
const DECELERATION_RATE = 0.98;

type Direction = "up" | "down";

const VideoFeedList = () => {
    const { seeking } = useSeek();
    const { videos, loading, error } = useVideoFeed();
    const currentIndexRef = useRef(0);
    const directionRef = useRef<Direction>("up");
    const isScrollingRef = useRef(false);
    const rafPendingRef = useRef(false);
    const [renderTrigger, setRenderTrigger] = useState(0);
    const [measuredHeight, setMeasuredHeight] = useState<number | null>(
        Platform.OS === "ios" ? FALLBACK_ITEM_HEIGHT : null,
    );
    const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
        const h = Math.ceil(e.nativeEvent.layout.height);
        if (h > 0) setMeasuredHeight(h);
    }, []);

    const itemHeight = (measuredHeight ?? FALLBACK_ITEM_HEIGHT) + ITEM_OVERLAP;
    const listReady = measuredHeight !== null;
    const listRef = useRef<LegendListRef | null>(null);
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 30,
    }).current;
    const scrollStartTimeRef = useRef<number | null>(null);
    const scrollLagFrameRef = useRef<number | null>(null);

    const handleVideoChange = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            const nextIndex = viewableItems[0]?.index ?? -1;
            if (nextIndex === -1 || videos.length === 0) {
                return;
            }
            const maxIndex = videos.length - 1;
            const clampedIndex = Math.max(0, Math.min(nextIndex, maxIndex));
            const prevIndex = currentIndexRef.current;

            if (clampedIndex === prevIndex) {
                return;
            }

            // Update refs only during scroll; trigger render later
            directionRef.current = clampedIndex > prevIndex ? "up" : "down";
            currentIndexRef.current = clampedIndex;

            // Trigger a render on the next frame (throttled to one rAF)
            if (!rafPendingRef.current) {
                rafPendingRef.current = true;
                requestAnimationFrame(() => {
                    setRenderTrigger((t) => t + 1);
                    rafPendingRef.current = false;
                });
            }
        },
        [videos.length],
    );

    const renderItem = useCallback(
        ({ item, index }: { item: Video; index: number }) => {
            const currentIndex = currentIndexRef.current;
            const direction = directionRef.current;
            const isActive = index === currentIndex;
            const distanceFromActive = index - currentIndex;
            const isAhead =
                direction === "down"
                    ? distanceFromActive > 0
                    : distanceFromActive < 0;

            const shouldPreloadAhead =
                isAhead && Math.abs(distanceFromActive) <= PRELOAD_AHEAD;

            const shouldPreloadBehind =
                !isAhead && Math.abs(distanceFromActive) <= PRELOAD_BEHIND;

            const shouldPreload =
                isActive ||
                Math.abs(distanceFromActive) <= 1 || // always keep neighbor preloaded
                shouldPreloadAhead ||
                shouldPreloadBehind;

            if (
                USE_PLACEHOLDER_OUTSIDE_PRELOAD &&
                !shouldPreload &&
                !isActive
            ) {
                return (
                    <View
                        style={[
                            styles.placeholder,
                            { width: SCREEN_WIDTH, height: itemHeight },
                        ]}
                    />
                );
            }

            return (
                <VideoViewComponent
                    video={item}
                    isActive={isActive}
                    shouldPreload={shouldPreload}
                    itemHeight={itemHeight}
                />
            );
        },
        [itemHeight],
    );

    const keyExtractor = useCallback((item: Video) => item.id, []);

    const handleScrollBeginDrag = useCallback(() => {
        isScrollingRef.current = true;
    }, []);

    const handleScrollEnd = useCallback(() => {
        isScrollingRef.current = false;
        requestAnimationFrame(() => setRenderTrigger((t) => t + 1));
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
                    extraData={renderTrigger}
                    scrollEnabled={!seeking}
                    pagingEnabled={true}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={itemHeight}
                    snapToAlignment="start"
                    decelerationRate={DECELERATION_RATE}
                    scrollEventThrottle={SCROLL_EVENT_THROTTLE}
                    disableIntervalMomentum={Platform.OS === "android"}
                    onViewableItemsChanged={handleVideoChange}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onMomentumScrollEnd={handleScrollEnd}
                    onScrollEndDrag={handleScrollEnd}
                    viewabilityConfig={viewabilityConfig}
                    estimatedItemSize={itemHeight}
                    getFixedItemSize={() => itemHeight}
                    drawDistance={itemHeight * DRAW_DISTANCE_MULTIPLIER}
                    getItemType={() => "video"}
                    bounces={false}
                    overScrollMode="never"
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
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
    listContent: {
        paddingVertical: 0,
        flexGrow: 1,
    },
    placeholder: {
        backgroundColor: "black",
    },
});

export default VideoFeedList;
