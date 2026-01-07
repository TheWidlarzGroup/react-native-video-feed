import { StatusBar } from "expo-status-bar";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    startTransition,
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
import { performanceMonitor } from "./performance";
import PerformanceMonitor from "./PerformanceMonitor";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");
const PLAYERS_AROUND_VIEWPORT = 2;
const CLEANUP_THRESHOLD = 3;
const MAX_PLAYERS_BEFORE_CLEANUP = 8;
const SCROLL_BLOCK_TIMEOUT = 200;

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
    // Scroll responsiveness tracking
    const lastScrollTimestampRef = useRef<number | null>(null);
    const scrollLagTrackingActiveRef = useRef(false);
    const scrollStartIndexRef = useRef<number | null>(null);
    const scrollStartOffsetRef = useRef<number | null>(null);
    const lastScrollOffsetRef = useRef<number | null>(null);
    const rafFrameCountRef = useRef(0);
    const rafStartTimeRef = useRef<number | null>(null);
    // Memory usage tracking (simplified - tracks player count as proxy)
    const memoryTrackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Helper to ensure timeoutRefsRef is always initialized
    const ensureTimeoutRefs = () => {
        if (!timeoutRefsRef.current) {
            timeoutRefsRef.current = new Set();
        }
        return timeoutRefsRef.current;
    };

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

        const cleanupDistance = PLAYERS_AROUND_VIEWPORT * 2; // Keep 4 players around (2 before + current + 2 after)

        currentPlayers.forEach((player, idx) => {
            if (!player) return;

            const distance = Math.abs(idx - currentIndex);

            if (distance > cleanupDistance) {
                try {
                    if (player.isPlaying) {
                        player.pause();
                    }
                    // More aggressive cleanup - clear source to free memory
                    if (player.source?.uri) {
                        player.replaceSourceAsync(null);
                    }
                    // Also mute to reduce processing
                    if (player.muted !== true) {
                        player.muted = true;
                    }
                } catch (e) {
                    // Ignore
                }
            }
        });

        isCleaningUpRef.current = false;
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
                    ensureTimeoutRefs().add(preloadTimeout);
                });
            }, 100);
            ensureTimeoutRefs().add(mainTimeout);
        } catch (e) {
            setIsBooting(false);
        }

        return () => {
            if (timeoutRefsRef.current) {
                timeoutRefsRef.current.forEach((timeoutId) => {
                    clearTimeout(timeoutId);
                });
                // Re-initialize instead of clear to prevent undefined errors
                timeoutRefsRef.current = new Set();
            }

            if (scrollBlockTimeoutRef.current) {
                clearTimeout(scrollBlockTimeoutRef.current);
                scrollBlockTimeoutRef.current = null;
            }
            scrollBlockedRef.current = false;

            if (memoryTrackingIntervalRef.current) {
                clearInterval(memoryTrackingIntervalRef.current);
                memoryTrackingIntervalRef.current = null;
            }

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
                ensureTimeoutRefs().add(preloadTimeout);

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

            const targetPlayer = currentPlayers[targetIndex];
            const wasReady = targetPlayer.status === "readyToPlay";
            const preloadCount = Array.from(currentPlayers)
                .slice(
                    Math.max(0, targetIndex - PLAYERS_AROUND_VIEWPORT),
                    Math.min(
                        currentPlayers.length,
                        targetIndex + PLAYERS_AROUND_VIEWPORT + 1
                    )
                )
                .filter(
                    (p) =>
                        p &&
                        p.status === "readyToPlay" &&
                        preloadAttemptedRef.current.has(p)
                ).length;

            currentPlayers.forEach((player, idx) => {
                if (!player) return;

                const distance = Math.abs(idx - targetIndex);

                if (distance <= PLAYERS_AROUND_VIEWPORT && player.source?.uri) {
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

            if (preloadCount > 0) {
                performanceMonitor.recordMetric(
                    "preload_effectiveness",
                    preloadCount,
                    { targetIndex, totalNearby: 9 }
                );
            }
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

        // More aggressive cleanup - run cleanup more frequently
        if (currentPlayers.length > MAX_PLAYERS_BEFORE_CLEANUP) {
            const cleanupTimeout = setTimeout(() => {
                cleanupOldPlayers();
            }, 50); // Faster cleanup
            ensureTimeoutRefs().add(cleanupTimeout);
        } else if (currentPlayers.length > MAX_PLAYERS_BEFORE_CLEANUP - 2) {
            // Proactive cleanup when approaching limit
            const cleanupTimeout = setTimeout(() => {
                cleanupOldPlayers();
            }, 200);
            ensureTimeoutRefs().add(cleanupTimeout);
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
                        ensureTimeoutRefs().add(fetchTimeout);
                    }
                }
            };

            const initialFetchTimeout = setTimeout(doFetch, 50);
            ensureTimeoutRefs().add(initialFetchTimeout);
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

    // Track memory usage (simplified - uses player count as proxy)
    useEffect(() => {
        if (memoryTrackingIntervalRef.current) {
            clearInterval(memoryTrackingIntervalRef.current);
        }

        // Estimate memory usage based on active players
        // This is a simplified approach - in production, would need native module
        const trackMemory = () => {
            const activePlayers = playersRef.current.filter(
                (p) => p && p.source?.uri && p.status !== "idle"
            ).length;

            // Rough estimate: ~50-100MB per active video player
            // This is a placeholder - actual memory would need native module
            const estimatedMemoryPerPlayer = 75; // MB
            const estimatedMemory = activePlayers * estimatedMemoryPerPlayer;

            if (activePlayers > 0) {
                performanceMonitor.recordMetric(
                    "memory_usage",
                    estimatedMemory,
                    {
                        activePlayerCount: activePlayers,
                        totalPlayerCount: playersRef.current.length,
                        visibleIndex: visibleIndexRef.current,
                    }
                );
            }
        };

        // Track memory every 30 seconds (reduced frequency to lower overhead)
        memoryTrackingIntervalRef.current = setInterval(trackMemory, 30000);
        // Only track on initial mount, not on every change
        if (players.length > 0) {
            trackMemory();
        }

        return () => {
            if (memoryTrackingIntervalRef.current) {
                clearInterval(memoryTrackingIntervalRef.current);
                memoryTrackingIntervalRef.current = null;
            }
        };
    }, [players.length]); // Only track when player count changes, not on every scroll

    const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (isCleaningUpRef.current) return;

            // Track scroll input timestamp for responsiveness measurement
            // Measure only once per scroll gesture (when scroll starts)
            const contentOffsetY = e.nativeEvent.contentOffset.y;
            const currentVisibleIndex = visibleIndexRef.current;

            // Start tracking only when scroll gesture begins (first scroll event)
            // This ensures we measure only once per scroll gesture, not on every scroll event
            if (!scrollLagTrackingActiveRef.current) {
                const scrollTimestamp = performance.now();
                lastScrollTimestampRef.current = scrollTimestamp;
                scrollStartIndexRef.current = currentVisibleIndex;
                scrollStartOffsetRef.current = contentOffsetY;
                scrollLagTrackingActiveRef.current = true;

                // Determine scroll direction based on offset change
                // Compare with last known offset to determine direction
                let scrollDirection: "up" | "down" = "down";
                if (lastScrollOffsetRef.current !== null) {
                    scrollDirection =
                        contentOffsetY > lastScrollOffsetRef.current
                            ? "down"
                            : "up";
                }
                lastScrollOffsetRef.current = contentOffsetY;

                // Use requestAnimationFrame to measure when frame is rendered
                // This gives us input-to-frame latency
                requestAnimationFrame(() => {
                    if (
                        lastScrollTimestampRef.current !== null &&
                        scrollStartIndexRef.current !== null
                    ) {
                        const renderTimestamp = performance.now();
                        const scrollLag =
                            renderTimestamp - lastScrollTimestampRef.current;

                        // Record scroll lag (input-to-frame latency)
                        // Target: ≤16ms for 60Hz (1 frame)
                        // Only record once per scroll gesture
                        if (scrollLag > 0 && scrollLag < 1000) {
                            performanceMonitor.recordMetric(
                                "scroll_lag",
                                scrollLag,
                                {
                                    fromIndex: scrollStartIndexRef.current,
                                    scrollDirection,
                                    targetMs: 16, // Target for 60Hz
                                }
                            );
                        }

                        // Don't reset tracking here - reset only when scroll ends
                        // This prevents multiple measurements during one scroll gesture
                    }
                });
            } else {
                // Update last offset even if tracking is active (for next scroll)
                lastScrollOffsetRef.current = contentOffsetY;
            }

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
                !scrollBlockedRef.current &&
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex >= 0 &&
                clampedIndex < playersRef.current.length
            ) {
                const diff = Math.abs(clampedIndex - visibleIndexRef.current);
                if (diff === 1) {
                    visibleIndexRef.current = clampedIndex;
                    setVisibleIndex(clampedIndex);
                } else {
                    const targetIndex =
                        clampedIndex > visibleIndexRef.current
                            ? visibleIndexRef.current + 1
                            : visibleIndexRef.current - 1;
                    const finalIndex = Math.max(
                        0,
                        Math.min(targetIndex, playersRef.current.length - 1)
                    );
                    visibleIndexRef.current = finalIndex;
                    setVisibleIndex(finalIndex);
                    requestAnimationFrame(() => {
                        try {
                            flatListRef.current?.scrollToOffset({
                                offset: finalIndex * screenHeight,
                                animated: false,
                            });
                        } catch (e) {
                            // Ignore
                        }
                    });
                }
            }
        },
        []
    );

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            // Reset scroll lag tracking when scroll ends
            scrollLagTrackingActiveRef.current = false;
            lastScrollTimestampRef.current = null;
            scrollStartIndexRef.current = null;
            scrollStartOffsetRef.current = null;
            // Keep lastScrollOffsetRef for next scroll direction calculation

            if (isCleaningUpRef.current) {
                return;
            }
            if (scrollBlockedRef.current) {
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
                clampedIndex < playersRef.current.length
            ) {
                const diff = Math.abs(clampedIndex - visibleIndexRef.current);

                if (diff === 1) {
                    visibleIndexRef.current = clampedIndex;
                    setVisibleIndex(clampedIndex);
                    scrollCountRef.current++;

                    if (scrollCountRef.current % CLEANUP_THRESHOLD === 0) {
                        const scrollCleanupTimeout = setTimeout(() => {
                            cleanupOldPlayers();
                        }, 100);
                        ensureTimeoutRefs().add(scrollCleanupTimeout);
                    }
                } else {
                    const targetIndex =
                        clampedIndex > visibleIndexRef.current
                            ? visibleIndexRef.current + 1
                            : visibleIndexRef.current - 1;
                    const finalIndex = Math.max(
                        0,
                        Math.min(targetIndex, playersRef.current.length - 1)
                    );
                    visibleIndexRef.current = finalIndex;
                    setVisibleIndex(finalIndex);
                    requestAnimationFrame(() => {
                        try {
                            flatListRef.current?.scrollToOffset({
                                offset: finalIndex * screenHeight,
                                animated: false,
                            });
                        } catch (e) {
                            // Ignore
                        }
                    });
                }
            }

            scrollBlockedRef.current = true;
            setScrollEnabled(false);

            if (scrollBlockTimeoutRef.current) {
                clearTimeout(scrollBlockTimeoutRef.current);
            }

            const scrollBlockTimeout = setTimeout(() => {
                scrollBlockedRef.current = false;
                setScrollEnabled(true);
                scrollBlockTimeoutRef.current = null;
            }, SCROLL_BLOCK_TIMEOUT);
            scrollBlockTimeoutRef.current = scrollBlockTimeout;
            ensureTimeoutRefs().add(scrollBlockTimeout);
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
            if (scrollBlockedRef.current) return;

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
                    const diff = Math.abs(newIndex - visibleIndexRef.current);
                    if (diff === 1) {
                        visibleIndexRef.current = newIndex;
                        setVisibleIndex(newIndex);
                    }
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
                    decelerationRate={0.95}
                    pagingEnabled={true}
                    disableIntervalMomentum={true}
                    disableScrollViewPanResponder={false}
                    scrollEnabled={scrollEnabled}
                    scrollEventThrottle={16}
                    onScroll={handleScroll}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    initialNumToRender={1}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    onScrollEndDrag={(e) => {
                        if (isCleaningUpRef.current) {
                            return;
                        }
                        if (scrollBlockedRef.current) {
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

                            const scrollBlockTimeout = setTimeout(() => {
                                scrollBlockedRef.current = false;
                                setScrollEnabled(true);
                                scrollBlockTimeoutRef.current = null;
                            }, SCROLL_BLOCK_TIMEOUT);
                            scrollBlockTimeoutRef.current = scrollBlockTimeout;
                            ensureTimeoutRefs().add(scrollBlockTimeout);
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
            <PerformanceMonitor />
        </View>
    );
}
