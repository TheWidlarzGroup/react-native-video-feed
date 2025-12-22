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
            console.log("[Cleanup] SKIP - already cleaning up");
            return;
        }

        isCleaningUpRef.current = true;
        const currentPlayers = playersRef.current;
        const currentIndex = visibleIndexRef.current;

        console.log(
            "[Cleanup] START - players:",
            currentPlayers.length,
            "index:",
            currentIndex
        );

        if (currentPlayers.length <= MAX_PLAYERS_BEFORE_CLEANUP) {
            console.log(
                "[Cleanup] SKIP - not enough players:",
                currentPlayers.length
            );
            isCleaningUpRef.current = false;
            return;
        }

        if (currentIndex < 0 || currentIndex >= currentPlayers.length) {
            console.log(
                "[Cleanup] SKIP - invalid index:",
                currentIndex,
                "players:",
                currentPlayers.length
            );
            isCleaningUpRef.current = false;
            return;
        }

        const keepStart = Math.max(0, currentIndex - PLAYERS_AROUND_VIEWPORT);
        const keepEnd = Math.min(
            currentPlayers.length,
            currentIndex + PLAYERS_AROUND_VIEWPORT * 2
        );

        console.log("[Cleanup] Keeping players from", keepStart, "to", keepEnd);

        const playersToKeep = currentPlayers.slice(keepStart, keepEnd);
        const playersToRemove = [
            ...currentPlayers.slice(0, keepStart),
            ...currentPlayers.slice(keepEnd),
        ];

        console.log(
            "[Cleanup] Removing",
            playersToRemove.length,
            "players, keeping",
            playersToKeep.length
        );

        playersToRemove.forEach((player) => {
            try {
                if (player) {
                    // Pause if playing
                    if (player.isPlaying) {
                        player.pause();
                    }
                    // Release video source to free memory
                    player.replaceSourceAsync(null);
                    // Remove from tracking refs
                    preloadAttemptedRef.current.delete(player);
                    playerVideoIndexRef.current.delete(player);
                    // Clear any pending operations
                    // Note: VideoPlayer should handle internal cleanup
                }
            } catch (e) {
                console.warn("[Cleanup] Error removing player:", e);
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
            console.log(
                "[Cleanup] Updating - old index:",
                currentIndex,
                "new index:",
                newIndex,
                "old players:",
                currentPlayers.length,
                "new players:",
                playersToKeep.length
            );

            playersRef.current = playersToKeep;

            visibleIndexRef.current = newIndex;
            setVisibleIndex(newIndex);
            console.log("[Cleanup] Updated visibleIndex to:", newIndex);

            setPlayers(playersToKeep);

            // Sync scroll position using requestAnimationFrame
            const raf1 = requestAnimationFrame(() => {
                const raf2 = requestAnimationFrame(() => {
                    try {
                        flatListRef.current?.scrollToIndex({
                            index: newIndex,
                            animated: false,
                            viewPosition: 0.5,
                        });
                        console.log(
                            "[Cleanup] Scrolled to index:",
                            newIndex,
                            "to prevent jumps"
                        );
                    } catch (e) {
                        // Fallback to offset if scrollToIndex fails
                        try {
                            const scrollOffset = screenHeight * newIndex;
                            flatListRef.current?.scrollToOffset({
                                offset: scrollOffset,
                                animated: false,
                            });
                            console.log(
                                "[Cleanup] Scrolled to offset:",
                                scrollOffset,
                                "as fallback"
                            );
                        } catch (e2) {
                            console.warn("[Cleanup] Scroll sync error:", e2);
                        }
                    }
                });
                rafRefsRef.current.add(raf2);
            });
            rafRefsRef.current.add(raf1);

            // Preload ALL nearby players immediately
            playersToKeep.forEach((player, idx) => {
                if (player && player.source?.uri) {
                    const distance = Math.abs(idx - newIndex);
                    if (distance <= 4) {
                        // Always try to preload if not already preloaded
                        // or if player is idle (needs preload)
                        if (!preloadAttemptedRef.current.has(player)) {
                            // Player not in preloadAttemptedRef - definitely needs preload
                            if (player.status === "idle") {
                                safePreload(player);
                            }
                        } else if (player.status === "idle") {
                            // Player was preloaded before but is now idle - needs re-preload
                            safePreload(player);
                        }
                        // If player is already "readyToPlay", no need to preload again
                    }
                }
            });

            // Sync playback for new index
            syncPlaybackForIndex(newIndex);

            isCleaningUpRef.current = false;
        }

        console.log(
            "[Cleanup] END - players after cleanup:",
            playersRef.current.length
        );
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
            console.warn("[App] Preload error:", e);
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
            console.error("[App] Asset resolve error:", e);
            setIsBooting(false);
        }

        return () => {
            // Clear all timeouts
            timeoutRefsRef.current.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            timeoutRefsRef.current.clear();

            // Clear scroll block timeout
            if (scrollBlockTimeoutRef.current) {
                clearTimeout(scrollBlockTimeoutRef.current);
                scrollBlockTimeoutRef.current = null;
            }
            scrollBlockedRef.current = false;

            // Cancel all requestAnimationFrame
            rafRefsRef.current.forEach((rafId) => {
                cancelAnimationFrame(rafId);
            });
            rafRefsRef.current.clear();

            // Cleanup all players
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
            console.warn("[Fetch] SKIP - no URIs");
            return;
        }

        if (fetchingRef.current) {
            console.log("[Fetch] SKIP - already fetching");
            return;
        }

        fetchingRef.current = true;
        console.log("[Fetch] START");

        try {
            setPlayers((prevPlayers) => {
                const nextVideoIndex = totalVideoCountRef.current;
                const nextUri = uris[nextVideoIndex % uris.length];
                console.log(
                    "[Fetch] Adding video",
                    nextVideoIndex,
                    "URI:",
                    nextUri.substring(0, 50) + "..."
                );

                const newPlayer = createListPlayer(nextUri);
                playerVideoIndexRef.current.set(newPlayer, nextVideoIndex);
                totalVideoCountRef.current = nextVideoIndex + 1;

                const nextPlayers = [...prevPlayers, newPlayer];
                console.log(
                    "[Fetch] Total players:",
                    nextPlayers.length,
                    "was:",
                    prevPlayers.length
                );
                playersRef.current = nextPlayers;

                const preloadTimeout = setTimeout(() => {
                    try {
                        safePreload(newPlayer);
                    } finally {
                        fetchingRef.current = false;
                        console.log(
                            "[Fetch] END - preload done, fetchingRef reset"
                        );
                    }
                }, 100);
                timeoutRefsRef.current.add(preloadTimeout);

                return nextPlayers;
            });
        } catch (e) {
            fetchingRef.current = false;
            console.error("[Fetch] ERROR:", e);
        }
    }, [uris, safePreload]);

    const syncPlaybackForIndex = useCallback(
        (targetIndex: number) => {
            const currentPlayers = playersRef.current;

            if (!currentPlayers.length) {
                console.warn("[Sync] SKIP - no players");
                return;
            }

            if (targetIndex < 0 || targetIndex >= currentPlayers.length) {
                console.warn(
                    "[Sync] SKIP - invalid index:",
                    targetIndex,
                    "players:",
                    currentPlayers.length
                );
                return;
            }

            if (!currentPlayers[targetIndex]) {
                console.warn(
                    "[Sync] SKIP - player at index",
                    targetIndex,
                    "does not exist"
                );
                return;
            }

            currentPlayers.forEach((player, idx) => {
                if (!player) return;

                const distance = Math.abs(idx - targetIndex);

                if (distance <= 4 && player.source?.uri) {
                    // Preload if idle and not already preloaded
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
                        console.warn(
                            `[Sync] Error syncing active player ${idx}:`,
                            e
                        );
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
                        // ignore
                    }
                }
            });
        },
        [safePreload]
    );

    useEffect(() => {
        const currentPlayers = playersRef.current;
        if (!currentPlayers.length) {
            console.log("[App] useEffect SKIP - no players");
            return;
        }

        const currentIndex = visibleIndexRef.current;
        console.log(
            "[App] useEffect - Syncing playback for index:",
            currentIndex,
            "players count:",
            currentPlayers.length,
            "visibleIndex state:",
            visibleIndex,
            "players state length:",
            players.length
        );
        syncPlaybackForIndex(currentIndex);

        const remaining = currentPlayers.length - currentIndex;
        console.log(
            "[App] Remaining videos:",
            remaining,
            "fetching:",
            fetchingRef.current,
            "visibleIndex:",
            currentIndex,
            "totalPlayers:",
            currentPlayers.length
        );

        if (currentPlayers.length > MAX_PLAYERS_BEFORE_CLEANUP) {
            console.log(
                "[App] Triggering cleanup - players:",
                currentPlayers.length,
                "threshold:",
                MAX_PLAYERS_BEFORE_CLEANUP
            );
            const cleanupTimeout = setTimeout(() => {
                cleanupOldPlayers();
            }, 100);
            timeoutRefsRef.current.add(cleanupTimeout);
        }

        if (remaining <= 3 && !fetchingRef.current && uris.length > 0) {
            console.log(
                "[App] Fetching more videos... remaining:",
                remaining,
                "fetching:",
                fetchingRef.current,
                "uris:",
                uris.length
            );
            const videosToFetch = Math.min(3, uris.length);
            console.log("[App] Will fetch", videosToFetch, "videos");

            let fetchedCount = 0;
            const doFetch = () => {
                if (fetchedCount < videosToFetch && !fetchingRef.current) {
                    console.log(
                        "[App] Fetching video",
                        fetchedCount + 1,
                        "of",
                        videosToFetch
                    );
                    fetchMoreVideos();
                    fetchedCount++;

                    if (fetchedCount < videosToFetch) {
                        const fetchTimeout = setTimeout(doFetch, 150);
                        timeoutRefsRef.current.add(fetchTimeout);
                    } else {
                        console.log("[App] Finished fetching all videos");
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

            // Block scroll if timeout is active
            if (scrollBlockedRef.current) {
                const currentIndex = visibleIndexRef.current;
                const currentOffset = currentIndex * screenHeight;
                const offsetY = e.nativeEvent.contentOffset.y;

                // Snap back to current position if trying to scroll
                if (Math.abs(offsetY - currentOffset) > 50) {
                    requestAnimationFrame(() => {
                        try {
                            flatListRef.current?.scrollToOffset({
                                offset: currentOffset,
                                animated: false,
                            });
                        } catch (e) {
                            // Ignore errors
                        }
                    });
                }
                return;
            }

            const offsetY = e.nativeEvent.contentOffset.y;
            // Calculate which item is at the center of the screen (50% visible)
            // Center of screen = offsetY + screenHeight/2
            const centerY = offsetY + screenHeight / 2;
            const centerIndex = Math.floor(centerY / screenHeight);
            const clampedIndex = Math.max(
                0,
                Math.min(centerIndex, playersRef.current.length - 1)
            );

            // Update when center item changes and it's approximately at 50% visibility
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
                console.log("[Scroll] SKIP - cleanup in progress");
                return;
            }

            const offsetY = e.nativeEvent.contentOffset.y;
            const exactIndex = offsetY / screenHeight;
            const nextIndex = Math.round(exactIndex);
            const clampedIndex = Math.max(
                0,
                Math.min(nextIndex, playersRef.current.length - 1)
            );

            // Always block scroll after momentum ends, regardless of index change
            // This prevents rapid scrolling
            scrollBlockedRef.current = true;
            setScrollEnabled(false);
            console.log(
                `[Scroll] ✅ BLOCKING scroll for 5 seconds after momentum end at index ${clampedIndex}`
            );

            // Clear existing timeout if any
            if (scrollBlockTimeoutRef.current) {
                clearTimeout(scrollBlockTimeoutRef.current);
            }

            // Set new timeout to unblock after 5 seconds
            scrollBlockTimeoutRef.current = setTimeout(() => {
                scrollBlockedRef.current = false;
                setScrollEnabled(true);
                scrollBlockTimeoutRef.current = null;
                console.log("[Scroll] Timeout ended - scrolling enabled again");
            }, 1000);
            if (timeoutRefsRef.current) {
                timeoutRefsRef.current.add(scrollBlockTimeoutRef.current);
            }

            if (
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex >= 0 &&
                clampedIndex < playersRef.current.length
            ) {
                const diff = Math.abs(clampedIndex - visibleIndexRef.current);

                // Allow update if difference is 1 (normal scroll) OR if difference is large (after cleanup desync)
                if (diff === 1 || diff > 3) {
                    console.log(
                        `[Scroll] Momentum end - scrolling from ${visibleIndexRef.current} to ${clampedIndex}, diff: ${diff}`
                    );
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
            } else if (Math.abs(clampedIndex - visibleIndexRef.current) > 1) {
                console.warn(
                    "[Scroll] Blocked jump from",
                    visibleIndexRef.current,
                    "to",
                    clampedIndex,
                    "- only one-by-one scrolling allowed"
                );
            }
        },
        []
    );

    const viewabilityConfig = useRef<ViewabilityConfig>({
        itemVisiblePercentThreshold: 50, // Trigger when 50% visible
        minimumViewTime: 0, // No minimum view time - trigger immediately at 50%
        waitForInteraction: false,
    });

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (!viewableItems || viewableItems.length === 0) return;

            // Find the item with highest visibility percentage
            const mostVisible = viewableItems.reduce((prev, current) => {
                const prevPercent = (prev as any).percentVisible || 0;
                const currentPercent = (current as any).percentVisible || 0;
                return currentPercent > prevPercent ? current : prev;
            });

            // Trigger when item is at least 50% visible
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
                    console.log(
                        "[Viewability] Video",
                        newIndex,
                        "is",
                        Math.round((mostVisible as any).percentVisible),
                        "% visible - activating"
                    );
                    visibleIndexRef.current = newIndex;
                    setVisibleIndex(newIndex);
                }
            }
        },
        []
    );

    // Create stable reference for viewabilityConfigCallbackPairs using useRef
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
                        // Use unique video index as key (each player has unique index in history)
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

                            // Block scroll for 5 seconds after scrolling to a video
                            scrollBlockedRef.current = true;
                            setScrollEnabled(false);
                            console.log(
                                "[Scroll] Blocking scroll for 5 seconds"
                            );

                            // Clear existing timeout if any
                            if (scrollBlockTimeoutRef.current) {
                                clearTimeout(scrollBlockTimeoutRef.current);
                            }

                            // Set new timeout to unblock after 5 seconds
                            scrollBlockTimeoutRef.current = setTimeout(() => {
                                scrollBlockedRef.current = false;
                                setScrollEnabled(true);
                                scrollBlockTimeoutRef.current = null;
                                console.log(
                                    "[Scroll] Timeout ended - scrolling enabled again"
                                );
                            }, 5000);
                            if (timeoutRefsRef.current) {
                                timeoutRefsRef.current.add(
                                    scrollBlockTimeoutRef.current
                                );
                            }
                        }
                    }}
                    onScrollToIndexFailed={(info) => {
                        console.warn("[Scroll] ScrollToIndex failed:", info);
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
