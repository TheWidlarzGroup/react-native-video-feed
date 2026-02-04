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
/** Dodatkowe px wysokości itemu – przy snapie poprzedni item jest w pełni nad viewportem (brak przerwy u góry). */
const ITEM_OVERLAP = 4;

const PRELOAD_AHEAD = Platform.OS === "android" ? 3 : 5;
const PRELOAD_BEHIND = 1;
const DRAW_DISTANCE_MULTIPLIER = Platform.OS === "android" ? 2 : 3;
const SCROLL_EVENT_THROTTLE = Platform.OS === "android" ? 32 : 16;
const USE_PLACEHOLDER_OUTSIDE_PRELOAD = Platform.OS === "android";
const DECELERATION_RATE = Platform.OS === "android" ? 0.98 : 0;

type Direction = "up" | "down";

const VideoFeedList = () => {
    const { seeking } = useSeek();
    const { videos, loading, error } = useVideoFeed();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState<Direction>("up");
    const [measuredHeight, setMeasuredHeight] = useState<number | null>(
        Platform.OS === "ios" ? FALLBACK_ITEM_HEIGHT : null
    );
    const indexRef = useRef(currentIndex);

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

            const applyUpdate = () => {
                setDirection(clampedIndex > prevIndex ? "up" : "down");
                updateIndex(clampedIndex, maxIndex);
            };

            if (Platform.OS === "android") {
                requestAnimationFrame(applyUpdate);
            } else {
                applyUpdate();
            }
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
                isAhead && Math.abs(distanceFromActive) <= PRELOAD_AHEAD;

            const shouldPreloadBehind =
                !isAhead && Math.abs(distanceFromActive) <= PRELOAD_BEHIND;

            const shouldPreload = shouldPreloadAhead || shouldPreloadBehind;

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
        [currentIndex, direction, itemHeight]
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
                    scrollEnabled={!seeking}
                    pagingEnabled={Platform.OS === "android"}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={itemHeight}
                    snapToAlignment="start"
                    decelerationRate={DECELERATION_RATE}
                    scrollEventThrottle={SCROLL_EVENT_THROTTLE}
                    disableIntervalMomentum={true}
                    onViewableItemsChanged={handleVideoChange}
                    onScrollBeginDrag={handleScrollBeginDrag}
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
