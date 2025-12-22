import { StatusBar } from "expo-status-bar";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    View,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ViewabilityConfig,
    ViewToken,
} from "react-native";
import { VideoPlayer } from "react-native-video";
import BottomTabBar from "./BottomTabBar";
import { styles } from "./styles";
import { createListPlayer, resolveVideoUris } from "./utils";
import VideoViewComponent from "./VideoViewComponent";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");
const PLAYERS_AROUND_VIEWPORT = 4;
const CLEANUP_THRESHOLD = 5;
const MAX_PLAYERS_BEFORE_CLEANUP = 15;
const SCROLL_BLOCK_TIMEOUT = 500;

export default function App() {
    const [players, setPlayers] = useState<VideoPlayer[]>([]);
    const [uris, setUris] = useState<string[]>([]);
    const [visibleIndex, setVisibleIndex] = useState(0);
    const [isBooting, setIsBooting] = useState(true);
    const playersRef = useRef<VideoPlayer[]>([]);
    const visibleIndexRef = useRef(0);
    const preloadAttemptedRef = useRef<Set<VideoPlayer>>(new Set());
    const playerVideoIndexRef = useRef<Map<VideoPlayer, number>>(new Map());
    const fetchingRef = useRef(false);
    const flatListRef = useRef<FlatList<VideoPlayer> | null>(null);
    const scrollCountRef = useRef(0);
    const isCleaningUpRef = useRef(false);
    const totalVideoCountRef = useRef(0);
    const timeoutRefsRef = useRef<Set<NodeJS.Timeout>>(new Set());
    const rafRefsRef = useRef<Set<number>>(new Set());
    const scrollBlockedRef = useRef(false);
    const scrollBlockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [scrollEnabled, setScrollEnabled] = useState(true);

    const cleanupOldPlayers = useCallback(() => {
        if (isCleaningUpRef.current) {
            return;
        }

        isCleaningUpRef.current = true;
        const currentPlayers = playersRef.current;
        const currentIndex = visibleIndexRef.current;

        if (currentPlayers.length <= MAX_PLAYERS_BEFORE_CLEANUP) {
            isCleaningUpRef.current = false;
            return;
        }

        if (currentIndex < 0 || currentIndex >= currentPlayers.length) {
            isCleaningUpRef.current = false;
            return;
        }

        const keepStart = Math.max(0, currentIndex - PLAYERS_AROUND_VIEWPORT);
        const keepEnd = Math.min(
            currentPlayers.length,
            currentIndex + PLAYERS_AROUND_VIEWPORT * 2
        );

        const playersToKeep = currentPlayers.slice(keepStart, keepEnd);
        const playersToRemove = [
            ...currentPlayers.slice(0, keepStart),
            ...currentPlayers.slice(keepEnd),
        ];

        playersToRemove.forEach((player) => {
            try {
                if (player) {
                    if (player.isPlaying) {
                        player.pause();
                    }
                    player.replaceSourceAsync(null);
                    preloadAttemptedRef.current.delete(player);
                    playerVideoIndexRef.current.delete(player);
                }
            } catch (e) {
                // Ignore
            }
        });

        if (
            playersToKeep.length < currentPlayers.length &&
            playersToKeep.length > 0
        ) {
            const newIndex = Math.max(
                0,
                Math.min(currentIndex - keepStart, playersToKeep.length - 1)
            );

            playersRef.current = playersToKeep;

            visibleIndexRef.current = newIndex;
            setVisibleIndex(newIndex);

            setPlayers(playersToKeep);

            const raf1 = requestAnimationFrame(() => {
                const raf2 = requestAnimationFrame(() => {
                    try {
                        flatListRef.current?.scrollToIndex({
                            index: newIndex,
                            animated: false,
                            viewPosition: 0.5,
                        });
                    } catch (e) {
                        try {
                            const scrollOffset = screenHeight * newIndex;
                            flatListRef.current?.scrollToOffset({
                                offset: scrollOffset,
                                animated: false,
                            });
                        } catch (e2) {
                            // Ignore
                        }
                    }
                });
                rafRefsRef.current.add(raf2);
            });
            rafRefsRef.current.add(raf1);

            playersToKeep.forEach((player, idx) => {
                if (player && player.source?.uri) {
                    const distance = Math.abs(idx - newIndex);
                    if (distance <= 4) {
                        if (!preloadAttemptedRef.current.has(player)) {
                            if (player.status === "idle") {
                                safePreload(player);
                            }
                        } else if (player.status === "idle") {
                            safePreload(player);
                        }
                    }
                }
            });

            syncPlaybackForIndex(newIndex);

            isCleaningUpRef.current = false;
        }
    }, []);

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

            const initialPlayers = resolvedUris.map((uri, idx) => {
                const player = createListPlayer(uri);
                playerVideoIndexRef.current.set(player, idx);
                return player;
            });
            totalVideoCountRef.current = resolvedUris.length;
            playersRef.current = initialPlayers;
            setPlayers(initialPlayers);
            setIsBooting(false);

            const mainTimeout = setTimeout(() => {
                if (!mounted) return;

                initialPlayers.forEach((player, idx) => {
                    const preloadTimeout = setTimeout(() => {
                        if (mounted) {
                            safePreload(player);
                        }
                    }, idx * 50);
                    timeoutRefsRef.current.add(preloadTimeout);
                });
            }, 100);
            timeoutRefsRef.current.add(mainTimeout);
        } catch (e) {
            setIsBooting(false);
        }

        return () => {
            timeoutRefsRef.current.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            timeoutRefsRef.current.clear();

            if (scrollBlockTimeoutRef.current) {
                clearTimeout(scrollBlockTimeoutRef.current);
                scrollBlockTimeoutRef.current = null;
            }
            scrollBlockedRef.current = false;

            rafRefsRef.current.forEach((rafId) => {
                cancelAnimationFrame(rafId);
            });
            rafRefsRef.current.clear();

            playersRef.current.forEach((player) => {
                try {
                    preloadAttemptedRef.current.delete(player);
                    playerVideoIndexRef.current.delete(player);
                    player.replaceSourceAsync(null);
                } catch (e) {
                    // Ignore
                }
            });
            setPlayers([]);
            playersRef.current = [];
            preloadAttemptedRef.current.clear();
            playerVideoIndexRef.current.clear();
        };
    }, [safePreload]);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    useEffect(() => {
        visibleIndexRef.current = visibleIndex;
    }, [visibleIndex]);

    const fetchMoreVideos = useCallback(() => {
        if (!uris.length) {
            return;
        }

        if (fetchingRef.current) {
            return;
        }

        fetchingRef.current = true;

        try {
            setPlayers((prevPlayers) => {
                const nextVideoIndex = totalVideoCountRef.current;
                const nextUri = uris[nextVideoIndex % uris.length];

                const newPlayer = createListPlayer(nextUri);
                playerVideoIndexRef.current.set(newPlayer, nextVideoIndex);
                totalVideoCountRef.current = nextVideoIndex + 1;

                const nextPlayers = [...prevPlayers, newPlayer];
                playersRef.current = nextPlayers;

                const preloadTimeout = setTimeout(() => {
                    try {
                        safePreload(newPlayer);
                    } finally {
                        fetchingRef.current = false;
                    }
                }, 100);
                timeoutRefsRef.current.add(preloadTimeout);

                return nextPlayers;
            });
        } catch (e) {
            fetchingRef.current = false;
        }
    }, [uris, safePreload]);

    const syncPlaybackForIndex = useCallback(
        (targetIndex: number) => {
            const currentPlayers = playersRef.current;

            if (!currentPlayers.length) {
                return;
            }

            if (targetIndex < 0 || targetIndex >= currentPlayers.length) {
                return;
            }

            if (!currentPlayers[targetIndex]) {
                return;
            }

            currentPlayers.forEach((player, idx) => {
                if (!player) return;

                const distance = Math.abs(idx - targetIndex);

                if (distance <= 4 && player.source?.uri) {
                    if (
                        player.status === "idle" &&
                        !preloadAttemptedRef.current.has(player)
                    ) {
                        safePreload(player);
                    }
                }

                if (idx === targetIndex) {
                    try {
                        if (player.muted === true) {
                            player.muted = false;
                        }
                        if (player.status === "idle" && player.source?.uri) {
                            safePreload(player);
                        }
                        if (
                            player.status === "readyToPlay" &&
                            !player.isPlaying
                        ) {
                            player.play();
                        }
                    } catch (e) {
                        // Ignore
                    }
                } else {
                    try {
                        if (player.isPlaying) {
                            player.pause();
                            player.currentTime = 0;
                        }
                        if (player.muted !== true) {
                            player.muted = true;
                        }
                    } catch (e) {
                        // Ignore
                    }
                }
            });
        },
        [safePreload]
    );

    useEffect(() => {
        const currentPlayers = playersRef.current;
        if (!currentPlayers.length) {
            return;
        }

        const currentIndex = visibleIndexRef.current;
        syncPlaybackForIndex(currentIndex);

        const remaining = currentPlayers.length - currentIndex;

        if (currentPlayers.length > MAX_PLAYERS_BEFORE_CLEANUP) {
            const cleanupTimeout = setTimeout(() => {
                cleanupOldPlayers();
            }, 100);
            timeoutRefsRef.current.add(cleanupTimeout);
        }

        if (remaining <= 3 && !fetchingRef.current && uris.length > 0) {
            const videosToFetch = Math.min(3, uris.length);

            let fetchedCount = 0;
            const doFetch = () => {
                if (fetchedCount < videosToFetch && !fetchingRef.current) {
                    fetchMoreVideos();
                    fetchedCount++;

                    if (fetchedCount < videosToFetch) {
                        const fetchTimeout = setTimeout(doFetch, 150);
                        timeoutRefsRef.current.add(fetchTimeout);
                    }
                }
            };

            const initialFetchTimeout = setTimeout(doFetch, 50);
            timeoutRefsRef.current.add(initialFetchTimeout);
        }
    }, [
        visibleIndex,
        players.length,
        syncPlaybackForIndex,
        uris.length,
        fetchMoreVideos,
        cleanupOldPlayers,
    ]);

    useEffect(() => {
        if (isBooting) return;
        syncPlaybackForIndex(0);
    }, [isBooting, syncPlaybackForIndex]);

    const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (isCleaningUpRef.current) return;

            if (scrollBlockedRef.current) {
                const currentIndex = visibleIndexRef.current;
                const currentOffset = currentIndex * screenHeight;
                const offsetY = e.nativeEvent.contentOffset.y;

                if (Math.abs(offsetY - currentOffset) > 50) {
                    requestAnimationFrame(() => {
                        try {
                            flatListRef.current?.scrollToOffset({
                                offset: currentOffset,
                                animated: false,
                            });
                        } catch (e) {
                            // Ignore
                        }
                    });
                }
                return;
            }

            const offsetY = e.nativeEvent.contentOffset.y;
            const centerY = offsetY + screenHeight / 2;
            const centerIndex = Math.floor(centerY / screenHeight);
            const clampedIndex = Math.max(
                0,
                Math.min(centerIndex, playersRef.current.length - 1)
            );

            if (
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex >= 0 &&
                clampedIndex < playersRef.current.length
            ) {
                visibleIndexRef.current = clampedIndex;
                setVisibleIndex(clampedIndex);
            }
        },
        []
    );

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (isCleaningUpRef.current) {
                return;
            }

            const offsetY = e.nativeEvent.contentOffset.y;
            const exactIndex = offsetY / screenHeight;
            const nextIndex = Math.round(exactIndex);
            const clampedIndex = Math.max(
                0,
                Math.min(nextIndex, playersRef.current.length - 1)
            );

            scrollBlockedRef.current = true;
            setScrollEnabled(false);

            if (scrollBlockTimeoutRef.current) {
                clearTimeout(scrollBlockTimeoutRef.current);
            }

            scrollBlockTimeoutRef.current = setTimeout(() => {
                scrollBlockedRef.current = false;
                setScrollEnabled(true);
                scrollBlockTimeoutRef.current = null;
            }, SCROLL_BLOCK_TIMEOUT);
            if (timeoutRefsRef.current) {
                timeoutRefsRef.current.add(scrollBlockTimeoutRef.current);
            }

            if (
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex >= 0 &&
                clampedIndex < playersRef.current.length
            ) {
                const diff = Math.abs(clampedIndex - visibleIndexRef.current);

                if (diff === 1 || diff > 3) {
                    visibleIndexRef.current = clampedIndex;
                    setVisibleIndex(clampedIndex);
                    scrollCountRef.current++;

                    if (scrollCountRef.current % CLEANUP_THRESHOLD === 0) {
                        const scrollCleanupTimeout = setTimeout(() => {
                            cleanupOldPlayers();
                        }, 100);
                        timeoutRefsRef.current.add(scrollCleanupTimeout);
                    }
                }
            }
        },
        []
    );

    const viewabilityConfig = useRef<ViewabilityConfig>({
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 0,
        waitForInteraction: false,
    });

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (!viewableItems || viewableItems.length === 0) return;

            const mostVisible = viewableItems.reduce((prev, current) => {
                const prevPercent = (prev as any).percentVisible || 0;
                const currentPercent = (current as any).percentVisible || 0;
                return currentPercent > prevPercent ? current : prev;
            });

            if (
                mostVisible &&
                mostVisible.isViewable &&
                mostVisible.index != null &&
                (mostVisible as any).percentVisible >= 50
            ) {
                const newIndex = mostVisible.index;
                if (
                    newIndex !== visibleIndexRef.current &&
                    newIndex >= 0 &&
                    newIndex < playersRef.current.length
                ) {
                    visibleIndexRef.current = newIndex;
                    setVisibleIndex(newIndex);
                }
            }
        },
        []
    );

    const viewabilityConfigCallbackPairsRef = useRef([
        {
            viewabilityConfig: viewabilityConfig.current,
            onViewableItemsChanged: onViewableItemsChanged,
        },
    ]);

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
                <FlatList
                    ref={flatListRef}
                    data={players}
                    renderItem={({ item, index }) => (
                        <VideoViewComponent
                            item={item}
                            index={index}
                            isActive={index === visibleIndex}
                        />
                    )}
                    keyExtractor={(item) => {
                        const videoIndex =
                            playerVideoIndexRef.current.get(item);
                        return videoIndex !== undefined
                            ? `video-${videoIndex}`
                            : `player-${Math.random()}`;
                    }}
                    getItemLayout={(_, index) => ({
                        length: screenHeight,
                        offset: screenHeight * index,
                        index,
                    })}
                    style={{ width: screenWidth, height: screenHeight }}
                    horizontal={false}
                    snapToInterval={screenHeight}
                    snapToAlignment="start"
                    decelerationRate={0.92}
                    pagingEnabled={true}
                    disableIntervalMomentum={false}
                    disableScrollViewPanResponder={false}
                    scrollEnabled={scrollEnabled}
                    scrollEventThrottle={16}
                    onScroll={handleScroll}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews
                    maxToRenderPerBatch={2}
                    windowSize={5}
                    initialNumToRender={1}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    onScrollEndDrag={(e) => {
                        if (isCleaningUpRef.current) {
                            return;
                        }

                        const offsetY = e.nativeEvent.contentOffset.y;
                        const exactIndex = offsetY / screenHeight;
                        const nextIndex = Math.round(exactIndex);
                        const clampedIndex = Math.max(
                            0,
                            Math.min(nextIndex, playersRef.current.length - 1)
                        );

                        if (
                            clampedIndex !== visibleIndexRef.current &&
                            clampedIndex >= 0 &&
                            clampedIndex < playersRef.current.length &&
                            Math.abs(clampedIndex - visibleIndexRef.current) ===
                                1
                        ) {
                            visibleIndexRef.current = clampedIndex;
                            setVisibleIndex(clampedIndex);

                            scrollBlockedRef.current = true;
                            setScrollEnabled(false);

                            if (scrollBlockTimeoutRef.current) {
                                clearTimeout(scrollBlockTimeoutRef.current);
                            }

                            scrollBlockTimeoutRef.current = setTimeout(() => {
                                scrollBlockedRef.current = false;
                                setScrollEnabled(true);
                                scrollBlockTimeoutRef.current = null;
                            }, SCROLL_BLOCK_TIMEOUT);
                            if (timeoutRefsRef.current) {
                                timeoutRefsRef.current.add(
                                    scrollBlockTimeoutRef.current
                                );
                            }
                        }
                    }}
                    onScrollToIndexFailed={() => {
                        // Ignore
                    }}
                    viewabilityConfig={viewabilityConfig.current}
                    viewabilityConfigCallbackPairs={
                        viewabilityConfigCallbackPairsRef.current
                    }
                />
            )}
            <StatusBar style="light" />
            <BottomTabBar />
        </View>
    );
}
