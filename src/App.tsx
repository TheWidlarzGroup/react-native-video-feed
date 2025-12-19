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
const CLEANUP_THRESHOLD = 50;

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

    const cleanupOldPlayers = useCallback(() => {
        const currentPlayers = playersRef.current;
        const currentIndex = visibleIndexRef.current;

        if (currentPlayers.length > PLAYERS_AROUND_VIEWPORT * 2) {
            const keepStart = Math.max(
                0,
                currentIndex - PLAYERS_AROUND_VIEWPORT
            );
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
                    player.pause();
                    player.replaceSourceAsync(null);
                    preloadAttemptedRef.current.delete(player);
                    playerVideoIndexRef.current.delete(player);
                } catch (e) {
                    // ignore
                }
            });

            if (playersToKeep.length < currentPlayers.length) {
                setPlayers(playersToKeep);
                playersRef.current = playersToKeep;
            }
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
            console.warn("[App] Cannot fetch more videos - no URIs");
            return;
        }

        console.log("[App] fetchMoreVideos called - START");

        setPlayers((prevPlayers) => {
            const nextVideoIndex = prevPlayers.length;
            const nextUri = uris[nextVideoIndex % uris.length];
            console.log(
                "[App] Adding video at index",
                nextVideoIndex,
                "URI:",
                nextUri,
                "current players:",
                prevPlayers.length
            );

            const newPlayer = createListPlayer(nextUri);
            playerVideoIndexRef.current.set(newPlayer, nextVideoIndex);

            const nextPlayers = [...prevPlayers, newPlayer];
            console.log(
                "[App] Total players after fetch:",
                nextPlayers.length,
                "new index:",
                nextVideoIndex,
                "- STATE UPDATE"
            );
            playersRef.current = nextPlayers;

            setTimeout(() => {
                safePreload(newPlayer);
            }, 100);

            return nextPlayers;
        });

        console.log("[App] fetchMoreVideos called - END");
    }, [uris, safePreload]);

    const syncPlaybackForIndex = useCallback(
        (targetIndex: number) => {
            const currentPlayers = playersRef.current;

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
                            `[App] Error syncing active player ${idx}:`,
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
        if (!players.length) return;

        console.log(
            "[App] Syncing playback for index:",
            visibleIndex,
            "players count:",
            players.length
        );
        syncPlaybackForIndex(visibleIndex);

        const currentPlayers = playersRef.current;
        const remaining = currentPlayers.length - visibleIndex;
        console.log(
            "[App] Remaining videos:",
            remaining,
            "fetching:",
            fetchingRef.current,
            "visibleIndex:",
            visibleIndex,
            "totalPlayers:",
            currentPlayers.length
        );

        if (remaining <= 3 && !fetchingRef.current && uris.length > 0) {
            console.log("[App] Fetching more videos... remaining:", remaining);
            fetchingRef.current = true;

            const videosToFetch = Math.min(3, uris.length);
            console.log("[App] Will fetch", videosToFetch, "videos");

            let fetchedCount = 0;
            const doFetch = () => {
                if (fetchedCount < videosToFetch) {
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
                        setTimeout(() => {
                            fetchingRef.current = false;
                            console.log("[App] Finished fetching all videos");
                        }, 200);
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
    ]);

    useEffect(() => {
        if (isBooting) return;
        syncPlaybackForIndex(0);
    }, [isBooting, syncPlaybackForIndex]);

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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

                if (scrollCountRef.current % CLEANUP_THRESHOLD === 0) {
                    cleanupOldPlayers();
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
