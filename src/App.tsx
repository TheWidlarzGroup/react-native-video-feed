import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
                    if (player.isPlaying) {
                        player.pause();
                    }
                    player.replaceSourceAsync(null);
                    preloadAttemptedRef.current.delete(player);
                    playerVideoIndexRef.current.delete(player);
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

            // Synchronize scroll position with new index using offset
            const scrollOffset = screenHeight * newIndex;
            setTimeout(() => {
                try {
                    flatListRef.current?.scrollToOffset({
                        offset: scrollOffset,
                        animated: false,
                    });
                    console.log(
                        "[Cleanup] Scrolled to offset:",
                        scrollOffset,
                        "for index:",
                        newIndex
                    );
                } catch (e) {
                    console.warn("[Cleanup] Scroll sync error:", e);
                } finally {
                    isCleaningUpRef.current = false;
                }
            }, 100);
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
            playersRef.current = initialPlayers;
            setPlayers(initialPlayers);
            setIsBooting(false);

            setTimeout(() => {
                if (!mounted) return;

                initialPlayers.forEach((player, idx) => {
                    setTimeout(() => {
                        if (mounted) {
                            safePreload(player);
                        }
                    }, idx * 50);
                });
            }, 100);
        } catch (e) {
            console.error("[App] Asset resolve error:", e);
            setIsBooting(false);
        }

        return () => {
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
                const nextVideoIndex = prevPlayers.length;
                const nextUri = uris[nextVideoIndex % uris.length];
                console.log(
                    "[Fetch] Adding video",
                    nextVideoIndex,
                    "URI:",
                    nextUri.substring(0, 50) + "..."
                );

                const newPlayer = createListPlayer(nextUri);
                playerVideoIndexRef.current.set(newPlayer, nextVideoIndex);

                const nextPlayers = [...prevPlayers, newPlayer];
                console.log(
                    "[Fetch] Total players:",
                    nextPlayers.length,
                    "was:",
                    prevPlayers.length
                );
                playersRef.current = nextPlayers;

                setTimeout(() => {
                    try {
                        safePreload(newPlayer);
                    } finally {
                        fetchingRef.current = false;
                        console.log(
                            "[Fetch] END - preload done, fetchingRef reset"
                        );
                    }
                }, 100);

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
                    if (player.status === "idle") {
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
        if (!currentPlayers.length) return;

        const currentIndex = visibleIndexRef.current;
        console.log(
            "[App] Syncing playback for index:",
            currentIndex,
            "players count:",
            currentPlayers.length
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
            setTimeout(() => {
                cleanupOldPlayers();
            }, 100);
        }

        if (remaining <= 3 && !fetchingRef.current && uris.length > 0) {
            console.log("[App] Fetching more videos... remaining:", remaining);
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
                        setTimeout(doFetch, 150);
                    } else {
                        console.log("[App] Finished fetching all videos");
                    }
                }
            };

            setTimeout(doFetch, 50);
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

            console.log("[Scroll] Momentum end:", {
                offsetY,
                exactIndex,
                calculatedIndex: nextIndex,
                clampedIndex,
                currentIndex: visibleIndexRef.current,
                playersCount: playersRef.current.length,
            });

            if (
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex >= 0 &&
                clampedIndex < playersRef.current.length &&
                Math.abs(clampedIndex - visibleIndexRef.current) === 1
            ) {
                console.log(
                    "[Scroll] Updating visibleIndex from",
                    visibleIndexRef.current,
                    "to",
                    clampedIndex
                );
                visibleIndexRef.current = clampedIndex;
                setVisibleIndex(clampedIndex);
                scrollCountRef.current++;
                console.log("[Scroll] Scroll count:", scrollCountRef.current);

                if (scrollCountRef.current % CLEANUP_THRESHOLD === 0) {
                    console.log(
                        "[Scroll] Triggering cleanup - scroll count:",
                        scrollCountRef.current
                    );
                    setTimeout(() => {
                        cleanupOldPlayers();
                    }, 100);
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
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 100,
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
                (mostVisible as any).percentVisible >= 0.5
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
                    keyExtractor={(item, idx) => {
                        return `player-${idx}`;
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
                    scrollEventThrottle={1}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews
                    maxToRenderPerBatch={2}
                    windowSize={5}
                    initialNumToRender={1}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    onScrollEndDrag={(e) => {
                        if (isCleaningUpRef.current) {
                            console.log(
                                "[Scroll] ScrollEndDrag SKIP - cleanup in progress"
                            );
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
                            console.log(
                                "[Scroll] ScrollEndDrag - updating to",
                                clampedIndex
                            );
                            visibleIndexRef.current = clampedIndex;
                            setVisibleIndex(clampedIndex);
                        }
                    }}
                    onScrollToIndexFailed={(info) => {
                        console.warn("[Scroll] ScrollToIndex failed:", info);
                    }}
                    viewabilityConfig={viewabilityConfig.current}
                    onViewableItemsChanged={onViewableItemsChanged}
                />
            )}
            <StatusBar style="light" />
            <BottomTabBar />
        </View>
    );
}
