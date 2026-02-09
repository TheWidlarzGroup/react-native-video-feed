import React, { useCallback, useMemo, useRef, useState } from "react";
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

const PRELOAD_AHEAD = 5;
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
    const directionRef = useRef<Direction>("down");
    const isScrollingRef = useRef(false);
    const scrollStartTimestampRef = useRef<number | null>(null);
    const [renderTrigger, setRenderTrigger] = useState(0);
    const [measuredHeight, setMeasuredHeight] = useState<number | null>(
        Platform.OS === "ios" ? FALLBACK_ITEM_HEIGHT : null,
    );
    const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
        const h = Math.ceil(e.nativeEvent.layout.height);
        if (h > 0) setMeasuredHeight(h);
    }, []);

    const itemHeight = useMemo(
        () => (measuredHeight ?? FALLBACK_ITEM_HEIGHT) + ITEM_OVERLAP,
        [measuredHeight],
    );
    const listReady = useMemo(() => measuredHeight !== null, [measuredHeight]);
    const listRef = useRef<LegendListRef | null>(null);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50, 
        waitForInteraction: false, 
        minimumViewTime: 0, 
        viewAreaCoveragePercentThreshold: 50, 
    }).current;

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

            directionRef.current = clampedIndex > prevIndex ? "down" : "up";
            currentIndexRef.current = clampedIndex;
            setRenderTrigger((t) => t + 1);
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

            const isNeighbor = Math.abs(distanceFromActive) <= 1;
            const shouldPreloadAhead =
                isAhead && Math.abs(distanceFromActive) <= PRELOAD_AHEAD;
            const shouldPreloadBehind =
                !isAhead &&
                distanceFromActive < 0 &&
                Math.abs(distanceFromActive) <= PRELOAD_BEHIND;

            const shouldPreload =
                isActive ||
                isNeighbor ||
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
        [renderTrigger, itemHeight],
    );

    const keyExtractor = useCallback((item: Video) => item.id, []);

    const handleScrollBeginDrag = useCallback(() => {
        isScrollingRef.current = true;
        const scrollStartTimestamp = performance.now();
        scrollStartTimestampRef.current = scrollStartTimestamp;

        requestAnimationFrame(() => {
            if (scrollStartTimestampRef.current !== null) {
                const renderTimestamp = performance.now();
                const lag = renderTimestamp - scrollStartTimestampRef.current;
                performanceMonitor.recordMetric("scroll_lag", lag, {
                    timestamp: Date.now(),
                    platform: Platform.OS,
                });
                scrollStartTimestampRef.current = null;
            }
        });
    }, []);

    const handleScroll = useCallback(() => {
        if (scrollStartTimestampRef.current !== null) {
            const scrollTimestamp = performance.now();
            requestAnimationFrame(() => {
                if (scrollStartTimestampRef.current !== null) {
                    const renderTimestamp = performance.now();
                    const lag =
                        renderTimestamp - scrollStartTimestampRef.current;
                    performanceMonitor.recordMetric("scroll_lag", lag, {
                        timestamp: Date.now(),
                        platform: Platform.OS,
                        duringScroll: true,
                    });
                    scrollStartTimestampRef.current = performance.now();
                }
            });
        }
    }, []);

    const handleScrollEnd = useCallback(() => {
        isScrollingRef.current = false;
        scrollStartTimestampRef.current = null;
    }, []);

    const getFixedItemSize = useCallback(() => itemHeight, [itemHeight]);

    const viewabilityConfigCallbackPairs = useMemo(
        () => [
            {
                viewabilityConfig,
                onViewableItemsChanged: handleVideoChange,
            },
        ],
        [handleVideoChange],
    );

    const getItemType = useCallback(() => "video", []);

    const drawDistance = useMemo(
        () => itemHeight * DRAW_DISTANCE_MULTIPLIER,
        [itemHeight],
    );

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
                    disableIntervalMomentum={true}
                    viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onScroll={handleScroll}
                    onMomentumScrollEnd={handleScrollEnd}
                    onScrollEndDrag={handleScrollEnd}
                    estimatedItemSize={itemHeight}
                    getFixedItemSize={getFixedItemSize}
                    drawDistance={drawDistance}
                    getItemType={getItemType}
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
