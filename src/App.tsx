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
        if (
            !player ||
            player.status !== "idle" ||
            !player.source?.uri ||
            preloadAttemptedRef.current.has(player)
        ) {
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
                            const checkAndPreload = () => {
                                if (safePreload(player)) {
                                    return;
                                }
                                if (player.source?.uri) {
                                    const timeoutId = setTimeout(
                                        checkAndPreload,
                                        100
                                    );
                                    timeoutRefsRef.current.add(timeoutId);
                                }
                            };
                            checkAndPreload();
                        });
                        rafRefsRef.current.add(rafId);
                    });

                    fetchingRef.current = false;
                    return nextPlayers;
                });
                return;
            }

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

            // Preload 5 ahead, 1 behind (like Slop-Social)
            const preloadStart = Math.max(0, targetIndex - 1);
            const preloadEnd = Math.min(currentPlayers.length, targetIndex + 6);

            currentPlayers.forEach((player, idx) => {
                if (!player) return;

                const expectedUri = uris[idx % uris.length];
                const currentUri = player.source?.uri;

                const isInPreloadRange =
                    idx >= preloadStart && idx < preloadEnd;
                const isActive = idx === targetIndex;

                try {
                    if (isActive) {
                        if (player.muted) player.muted = false;

                        // Only change source if missing or different, but not if already playing
                        const sourceChanged = currentUri !== expectedUri;
                        if (
                            sourceChanged &&
                            !player.isPlaying &&
                            player.status !== "loading"
                        ) {
                            try {
                                player.replaceSourceAsync({ uri: expectedUri });
                                preloadAttemptedRef.current.delete(player);
                            } catch (e) {}
                        }

                        // Preload if idle and source is set
                        if (
                            player.status === "idle" &&
                            player.source?.uri &&
                            !preloadAttemptedRef.current.has(player)
                        ) {
                            safePreload(player);
                        }

                        // Play if ready
                        if (
                            player.status === "readyToPlay" &&
                            !player.isPlaying
                        ) {
                            player.play();
                        }
                    } else if (isInPreloadRange) {
                        if (player.isPlaying) player.pause();
                        if (!player.muted) player.muted = true;

                        // Only change source if different and not loading
                        const sourceChanged = currentUri !== expectedUri;
                        if (sourceChanged && player.status !== "loading") {
                            try {
                                player.replaceSourceAsync({ uri: expectedUri });
                                preloadAttemptedRef.current.delete(player);
                            } catch (e) {}
                        }

                        // Preload if idle and source is set
                        if (
                            player.status === "idle" &&
                            player.source?.uri &&
                            !preloadAttemptedRef.current.has(player)
                        ) {
                            safePreload(player);
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
        const currentPlayers = playersRef.current;
        if (currentPlayers.length === 0) return;
        if (isBooting) {
            syncPlaybackForIndex(0);
        } else {
            syncPlaybackForIndex(visibleIndexRef.current);
        }
    }, [visibleIndex, isBooting, syncPlaybackForIndex]);

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

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            const playersCount = playersRef.current.length;
            const index = Math.round(offsetY / screenHeight);
            const clampedIndex = Math.max(0, Math.min(index, playersCount - 1));

            if (
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex < playersCount
            ) {
                visibleIndexRef.current = clampedIndex;
                setVisibleIndex(clampedIndex);
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
                        return `video-${index}`;
                    }}
                    getFixedItemSize={() => screenHeight}
                    estimatedItemSize={screenHeight}
                    getItemType={() => "video"}
                    style={{
                        width: screenWidth,
                        height: screenHeight,
                    }}
                    horizontal={false}
                    pagingEnabled={true}
                    snapToInterval={screenHeight}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    scrollEventThrottle={16}
                    bounces={false}
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
                        const currentLength = playersRef.current.length;
                        const currentVisible = visibleIndexRef.current;
                        const remaining = currentLength - currentVisible - 1;

                        if (
                            remaining <= 2 &&
                            !fetchingRef.current &&
                            uris.length > 0 &&
                            currentLength > 0
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
