import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    View,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "react-native";
import { VideoPlayer } from "react-native-video";
import {
    LegendList,
    LegendListRef,
    LegendListRenderItemProps,
} from "@legendapp/list";
import { prefetch } from "react-native-nitro-fetch";
import BottomTabBar from "./BottomTabBar";
import { styles } from "./styles";
import { createListPlayer, resolveVideoUris } from "./utils";
import VideoViewComponent from "./VideoViewComponent";
import PerformanceMonitor from "./PerformanceMonitor";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

export default function App() {
    const [players, setPlayers] = useState<VideoPlayer[]>([]);
    const [uris, setUris] = useState<string[]>([]);
    const [visibleIndex, setVisibleIndex] = useState(0);
    const [isBooting, setIsBooting] = useState(true);
    const playersRef = useRef<VideoPlayer[]>([]);
    const visibleIndexRef = useRef(0);
    const preloadAttemptedRef = useRef<Set<VideoPlayer>>(new Set());
    const fetchingRef = useRef(false);
    const listRef = useRef<LegendListRef | null>(null);
    const timeoutRefsRef = useRef<Set<NodeJS.Timeout>>(new Set());
    const rafRefsRef = useRef<Set<number>>(new Set());

    const safePreload = useCallback((player: VideoPlayer) => {
        if (!player) return false;

        if (preloadAttemptedRef.current.has(player)) {
            if (player.status !== "idle") {
                return false;
            }
        }

        if (player.status !== "idle" || !player.source?.uri) {
            return false;
        }

        try {
            player.preload();
            preloadAttemptedRef.current.add(player);
            return true;
        } catch (e) {
            return false;
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        try {
            const resolvedUris = resolveVideoUris();
            if (!mounted) return;
            setUris(resolvedUris);

            // Prefetch all initial video URLs with nitro-fetch
            resolvedUris.forEach((uri, idx) => {
                prefetch(uri, {
                    headers: { prefetchKey: `video-${idx}` },
                }).catch(() => {
                    // Ignore prefetch errors
                });
            });

            const initialPlayers = resolvedUris.map((uri) => {
                return createListPlayer(uri);
            });
            playersRef.current = initialPlayers;
            setPlayers(initialPlayers);
            setIsBooting(false);

            // Preload all players immediately using requestAnimationFrame
            initialPlayers.forEach((player, idx) => {
                const rafId = requestAnimationFrame(() => {
                    if (mounted) {
                        safePreload(player);
                    }
                });
                rafRefsRef.current.add(rafId);
            });
        } catch (e) {
            setIsBooting(false);
        }

        return () => {
            timeoutRefsRef.current.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            timeoutRefsRef.current.clear();

            rafRefsRef.current.forEach((rafId) => {
                cancelAnimationFrame(rafId);
            });
            rafRefsRef.current.clear();

            playersRef.current.forEach((player) => {
                try {
                    preloadAttemptedRef.current.delete(player);
                } catch (e) {
                    // Ignore
                }
            });
            setPlayers([]);
            playersRef.current = [];
            preloadAttemptedRef.current.clear();
        };
    }, [safePreload]);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    useEffect(() => {
        visibleIndexRef.current = visibleIndex;
    }, [visibleIndex]);

    const fetchMoreVideos = useCallback(() => {
        fetchingRef.current = true;

        const videosToFetch = Math.min(3, uris.length);
        let fetchedCount = 0;
        const newPlayers: VideoPlayer[] = [];
        const currentLength = playersRef.current.length;

        const fetchNext = () => {
            if (fetchedCount >= videosToFetch) {
                setPlayers((prevPlayers) => {
                    const nextPlayers = [...prevPlayers, ...newPlayers];
                    playersRef.current = nextPlayers;

                    newPlayers.forEach((player) => {
                        const rafId = requestAnimationFrame(() => {
                            try {
                                safePreload(player);
                            } catch (e) {
                                // Ignore
                            }
                        });
                        rafRefsRef.current.add(rafId);
                    });

                    fetchingRef.current = false;
                    return nextPlayers;
                });
                return;
            }

            // CRITICAL: Position in array = currentLength + newPlayers.length
            // This ensures source matches position: 0,1,2,3,4,0,1,2,3,4...
            const positionInArray = currentLength + newPlayers.length;
            const expectedUri = uris[positionInArray % uris.length];

            prefetch(expectedUri, {
                headers: { prefetchKey: `video-${positionInArray}` },
            }).catch(() => {});

            const newPlayer = createListPlayer(expectedUri);
            newPlayers.push(newPlayer);

            fetchedCount++;
            setTimeout(fetchNext, 100);
        };

        fetchNext();
    }, [uris, safePreload]);

    const syncPlaybackForIndex = useCallback(
        (targetIndex: number) => {
            const currentPlayers = playersRef.current;

            if (
                !currentPlayers.length ||
                targetIndex < 0 ||
                targetIndex >= currentPlayers.length ||
                !uris.length
            ) {
                return;
            }

            const preloadStart = Math.max(0, targetIndex - 1);
            const preloadEnd = Math.min(currentPlayers.length, targetIndex + 6);

            currentPlayers.forEach((player, idx) => {
                if (!player) return;

                // CRITICAL: Source MUST match position in array (idx), not videoIndex
                // This ensures correct sequential playback: 0,1,2,3,4,0,1,2,3,4...
                const expectedUri = uris[idx % uris.length];
                const currentUri = player.source?.uri;

                // Always set source based on position - this fixes incorrect sequences
                if (currentUri !== expectedUri) {
                    try {
                        player.replaceSourceAsync({ uri: expectedUri });
                        preloadAttemptedRef.current.delete(player);
                    } catch (e) {
                        // Ignore
                    }
                }

                const isInPreloadRange =
                    idx >= preloadStart && idx < preloadEnd;
                const isActive = idx === targetIndex;

                try {
                    if (isActive) {
                        if (player.muted) player.muted = false;
                        if (
                            player.status === "idle" &&
                            !preloadAttemptedRef.current.has(player)
                        ) {
                            safePreload(player);
                        }
                        if (
                            player.status === "readyToPlay" &&
                            !player.isPlaying
                        ) {
                            player.play();
                        }
                    } else if (isInPreloadRange) {
                        if (player.isPlaying) player.pause();
                        if (!player.muted) player.muted = true;
                        if (
                            player.status === "idle" &&
                            !preloadAttemptedRef.current.has(player)
                        ) {
                            setTimeout(() => {
                                if (player.status === "idle") {
                                    safePreload(player);
                                }
                            }, 50);
                        }
                    } else {
                        if (player.isPlaying) player.pause();
                        if (!player.muted) player.muted = true;
                        if (player.source?.uri) {
                            player.replaceSourceAsync(null);
                            preloadAttemptedRef.current.delete(player);
                        }
                    }
                } catch (e) {
                    // Ignore
                }
            });
        },
        [uris, safePreload]
    );

    useEffect(() => {
        // Use playersRef to avoid race conditions with setPlayers
        const currentPlayers = playersRef.current;
        if (currentPlayers.length === 0) return;
        syncPlaybackForIndex(visibleIndexRef.current);
    }, [visibleIndex, syncPlaybackForIndex]);

    useEffect(() => {
        if (isBooting) return;
        syncPlaybackForIndex(0);
    }, [isBooting, syncPlaybackForIndex]);

    const viewabilityConfig = {
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 0,
    };

    const viewabilityConfigCallbackPairsRef = useRef([
        {
            viewabilityConfig,
            onViewableItemsChanged: ({
                viewableItems,
            }: {
                viewableItems: Array<{
                    index: number | null;
                    isViewable: boolean;
                }>;
            }) => {
                if (viewableItems.length > 0) {
                    const firstViewable = viewableItems[0];
                    if (
                        firstViewable.index !== null &&
                        firstViewable.isViewable &&
                        firstViewable.index !== visibleIndexRef.current
                    ) {
                        visibleIndexRef.current = firstViewable.index;
                        setVisibleIndex(firstViewable.index);
                    }
                }
            },
        },
    ]);

    const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            // Only track scroll position, don't update visibleIndex here
            // onViewableItemsChanged handles real-time viewability updates
        },
        []
    );

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            // Finalize position after scroll ends - this is the source of truth
            const offsetY = e.nativeEvent.contentOffset.y;
            const viewportHeight = e.nativeEvent.layoutMeasurement.height;
            const scrollPosition = offsetY + viewportHeight / 2;
            const newIndex = Math.round(scrollPosition / screenHeight);
            const playersCount = playersRef.current.length;
            const clampedIndex = Math.max(
                0,
                Math.min(newIndex, playersCount > 0 ? playersCount - 1 : 0)
            );

            const currentIndex = visibleIndexRef.current;
            const diff = Math.abs(clampedIndex - currentIndex);

            // CRITICAL: Only allow adjacent changes (diff === 1) to prevent jumps
            if (diff > 1) {
                // Snap to adjacent position in the direction of scroll
                const snappedIndex =
                    clampedIndex > currentIndex
                        ? currentIndex + 1
                        : currentIndex - 1;
                const finalIndex = Math.max(
                    0,
                    Math.min(snappedIndex, playersCount - 1)
                );

                // Check viewability for snapped position
                const itemStart = finalIndex * screenHeight;
                const itemEnd = itemStart + screenHeight;
                const viewportStart = offsetY;
                const viewportEnd = offsetY + viewportHeight;
                const visibleStart = Math.max(itemStart, viewportStart);
                const visibleEnd = Math.min(itemEnd, viewportEnd);
                const visibleHeight = Math.max(0, visibleEnd - visibleStart);
                const visiblePercent = (visibleHeight / screenHeight) * 100;

                if (visiblePercent >= 50 && finalIndex !== currentIndex) {
                    visibleIndexRef.current = finalIndex;
                    setVisibleIndex(finalIndex);
                }
                return;
            }

            // Normal adjacent change - check viewability
            if (
                clampedIndex !== currentIndex &&
                clampedIndex >= 0 &&
                clampedIndex < playersCount
            ) {
                const itemStart = clampedIndex * screenHeight;
                const itemEnd = itemStart + screenHeight;
                const viewportStart = offsetY;
                const viewportEnd = offsetY + viewportHeight;
                const visibleStart = Math.max(itemStart, viewportStart);
                const visibleEnd = Math.min(itemEnd, viewportEnd);
                const visibleHeight = Math.max(0, visibleEnd - visibleStart);
                const visiblePercent = (visibleHeight / screenHeight) * 100;

                if (visiblePercent >= 50) {
                    visibleIndexRef.current = clampedIndex;
                    setVisibleIndex(clampedIndex);
                }
            }
        },
        []
    );

    return (
        <View style={styles.container}>
            {isBooting ? (
                <View
                    style={{
                        width: screenWidth,
                        height: screenHeight,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "black",
                    }}
                >
                    <ActivityIndicator color="#fff" size="large" />
                </View>
            ) : (
                <LegendList
                    ref={listRef}
                    data={players}
                    renderItem={({
                        item,
                        index,
                    }: LegendListRenderItemProps<VideoPlayer>) => (
                        <VideoViewComponent
                            item={item}
                            index={index}
                            isActive={index === visibleIndex}
                        />
                    )}
                    keyExtractor={(item, index) => {
                        // CRITICAL: Use index (position in array) as key, not videoIndex
                        // This ensures LegendList treats each position as unique,
                        // preventing component recycling issues
                        return `video-${index}`;
                    }}
                    getFixedItemSize={() => screenHeight}
                    estimatedItemSize={screenHeight}
                    getItemType={() => "video"}
                    style={{
                        width: screenWidth,
                        height: screenHeight,
                        overflow: "hidden",
                    }}
                    contentContainerStyle={null}
                    horizontal={false}
                    decelerationRate={0.92}
                    snapToInterval={screenHeight}
                    snapToAlignment="start"
                    scrollEventThrottle={16}
                    disableIntervalMomentum={true}
                    ItemSeparatorComponent={undefined}
                    onScroll={handleScroll}
                    showsVerticalScrollIndicator={false}
                    recycleItems={false}
                    drawDistance={screenHeight * 3}
                    extraData={visibleIndex}
                    viewabilityConfigCallbackPairs={
                        viewabilityConfigCallbackPairsRef.current
                    }
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    onScrollEndDrag={handleMomentumScrollEnd}
                    onEndReached={() => {
                        // Use playersRef.current to avoid race conditions
                        const currentLength = playersRef.current.length;
                        const currentVisible = Math.min(
                            visibleIndexRef.current,
                            currentLength - 1
                        );
                        const remaining = currentLength - currentVisible - 1;

                        // Fetch when 2 or fewer videos remain
                        if (
                            remaining <= 2 &&
                            !fetchingRef.current &&
                            uris.length > 0 &&
                            currentVisible >= 0 &&
                            currentVisible < currentLength
                        ) {
                            fetchMoreVideos();
                        }
                    }}
                    onEndReachedThreshold={0.5}
                />
            )}
            <StatusBar style="light" />
            <BottomTabBar />
            <PerformanceMonitor />
        </View>
    );
}
