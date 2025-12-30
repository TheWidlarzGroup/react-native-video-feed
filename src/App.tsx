import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    View,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ViewabilityConfig,
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
    const playerVideoIndexRef = useRef<Map<VideoPlayer, number>>(new Map());
    const fetchingRef = useRef(false);
    const listRef = useRef<LegendListRef | null>(null);
    const totalVideoCountRef = useRef(0);
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

            rafRefsRef.current.forEach((rafId) => {
                cancelAnimationFrame(rafId);
            });
            rafRefsRef.current.clear();

            playersRef.current.forEach((player) => {
                try {
                    preloadAttemptedRef.current.delete(player);
                    playerVideoIndexRef.current.delete(player);
                    // Don't clear source - causes black screens
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
        console.log("[FETCH] fetchMoreVideos called", {
            urisLength: uris.length,
            fetching: fetchingRef.current,
            currentPlayers: playersRef.current.length,
            totalVideoCount: totalVideoCountRef.current,
        });

        if (!uris.length) {
            console.log("[FETCH] No URIs, returning");
            return;
        }

        if (fetchingRef.current) {
            console.log("[FETCH] Already fetching, returning");
            return;
        }

        fetchingRef.current = true;

        try {
            setPlayers((prevPlayers) => {
                const nextVideoIndex = totalVideoCountRef.current;
                const nextUri = uris[nextVideoIndex % uris.length];

                console.log("[FETCH] Creating new player", {
                    nextVideoIndex,
                    nextUri,
                    uriIndex: nextVideoIndex % uris.length,
                    prevPlayersCount: prevPlayers.length,
                });

                // Prefetch video URL with nitro-fetch
                prefetch(nextUri, {
                    headers: { prefetchKey: `video-${nextVideoIndex}` },
                }).catch(() => {
                    // Ignore prefetch errors
                });

                const newPlayer = createListPlayer(nextUri);
                playerVideoIndexRef.current.set(newPlayer, nextVideoIndex);
                totalVideoCountRef.current = nextVideoIndex + 1;

                const nextPlayers = [...prevPlayers, newPlayer];
                playersRef.current = nextPlayers;

                console.log("[FETCH] New player created", {
                    newPlayerIndex: nextVideoIndex,
                    newPlayersCount: nextPlayers.length,
                    totalVideoCount: totalVideoCountRef.current,
                });

                const preloadTimeout = setTimeout(() => {
                    try {
                        safePreload(newPlayer);
                    } finally {
                        fetchingRef.current = false;
                        console.log("[FETCH] Preload done, fetching = false");
                    }
                }, 100);
                timeoutRefsRef.current.add(preloadTimeout);

                return nextPlayers;
            });
        } catch (e) {
            console.error("[FETCH] Error in fetchMoreVideos", e);
            fetchingRef.current = false;
        }
    }, [uris, safePreload]);

    const syncPlaybackForIndex = useCallback(
        (targetIndex: number) => {
            const currentPlayers = playersRef.current;
            console.log("[SYNC] syncPlaybackForIndex called", {
                targetIndex,
                playersCount: currentPlayers.length,
                visibleIndex: visibleIndexRef.current,
            });

            if (
                !currentPlayers.length ||
                targetIndex < 0 ||
                targetIndex >= currentPlayers.length
            ) {
                console.log("[SYNC] Invalid targetIndex, returning", {
                    targetIndex,
                    playersCount: currentPlayers.length,
                });
                return;
            }

            // Preload: 1 behind, 4 ahead (max 5 active players)
            const preloadStart = Math.max(0, targetIndex - 1);
            const preloadEnd = Math.min(currentPlayers.length, targetIndex + 5);

            console.log("[SYNC] Preload range", {
                targetIndex,
                preloadStart,
                preloadEnd,
                playersCount: currentPlayers.length,
            });

            currentPlayers.forEach((player, idx) => {
                if (!player) return;

                const videoIndex = playerVideoIndexRef.current.get(player);
                const isInPreloadRange =
                    idx >= preloadStart && idx < preloadEnd;
                const isActive = idx === targetIndex;

                try {
                    if (isActive) {
                        // Active player: unmute and play
                        console.log("[SYNC] Active player BEFORE", {
                            index: idx,
                            videoIndex,
                            status: player.status,
                            isPlaying: player.isPlaying,
                            muted: player.muted,
                            hasSource: !!player.source?.uri,
                        });

                        if (player.muted) {
                            player.muted = false;
                            console.log("[SYNC] Unmuted player", idx);
                        }

                        if (
                            player.status === "idle" &&
                            player.source?.uri &&
                            !preloadAttemptedRef.current.has(player)
                        ) {
                            safePreload(player);
                        }

                        // Always try to play if ready - don't check isPlaying
                        if (player.status === "readyToPlay") {
                            console.log("[SYNC] Calling play() on player", idx);
                            try {
                                player.play();
                            } catch (e) {
                                console.error(
                                    "[SYNC] Error playing player",
                                    idx,
                                    e
                                );
                            }
                        }

                        console.log("[SYNC] Active player AFTER", {
                            index: idx,
                            status: player.status,
                            isPlaying: player.isPlaying,
                            muted: player.muted,
                        });
                    } else if (isInPreloadRange) {
                        // Preload range: preload and pause
                        if (
                            player.status === "idle" &&
                            player.source?.uri &&
                            !preloadAttemptedRef.current.has(player)
                        ) {
                            safePreload(player);
                        }
                        if (player.isPlaying) player.pause();
                        if (!player.muted) player.muted = true;
                    } else {
                        // Outside range: just pause
                        if (player.isPlaying) player.pause();
                        if (!player.muted) player.muted = true;
                    }
                } catch (e) {
                    console.error("[SYNC] Error processing player", idx, e);
                }
            });
        },
        [uris, safePreload]
    );

    useEffect(() => {
        if (players.length === 0) return;
        console.log("[EFFECT] visibleIndex changed", {
            visibleIndex,
            playersCount: players.length,
            visibleIndexRef: visibleIndexRef.current,
        });
        syncPlaybackForIndex(visibleIndexRef.current);
    }, [visibleIndex, syncPlaybackForIndex]);

    useEffect(() => {
        if (isBooting) return;
        syncPlaybackForIndex(0);
    }, [isBooting, syncPlaybackForIndex]);

    const handleScroll = useCallback(() => {
        // Empty - let handleMomentumScrollEnd handle index updates
    }, []);

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            const newIndex = Math.round(offsetY / screenHeight);
            const playersCount = playersRef.current.length;
            const clampedIndex = Math.max(
                0,
                Math.min(newIndex, playersCount > 0 ? playersCount - 1 : 0)
            );

            console.log("[SCROLL] handleMomentumScrollEnd", {
                offsetY,
                newIndex,
                clampedIndex,
                currentVisibleIndex: visibleIndexRef.current,
                playersCount,
                willUpdate:
                    clampedIndex !== visibleIndexRef.current &&
                    clampedIndex >= 0 &&
                    clampedIndex < playersCount,
            });

            // Only update if valid index and different
            if (
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex >= 0 &&
                clampedIndex < playersCount
            ) {
                visibleIndexRef.current = clampedIndex;
                setVisibleIndex(clampedIndex);
                console.log("[SCROLL] Updated visibleIndex", {
                    from: visibleIndexRef.current,
                    to: clampedIndex,
                });
            }
        },
        []
    );

    const viewabilityConfig = useRef<ViewabilityConfig>({
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 100,
        waitForInteraction: false,
    });

    // Removed onViewableItemsChanged - handleMomentumScrollEnd is enough and more reliable

    // Removed viewability config - using handleMomentumScrollEnd only

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
                    keyExtractor={(item) => {
                        const videoIndex =
                            playerVideoIndexRef.current.get(item);
                        return videoIndex !== undefined
                            ? `video-${videoIndex}`
                            : `player-${Math.random()}`;
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
                    decelerationRate={0.98}
                    snapToInterval={screenHeight}
                    snapToAlignment="start"
                    scrollEventThrottle={16}
                    disableIntervalMomentum={true}
                    ItemSeparatorComponent={undefined}
                    onScroll={handleScroll}
                    showsVerticalScrollIndicator={false}
                    recycleItems={true}
                    drawDistance={screenHeight * 3}
                    extraData={visibleIndex}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    onScrollEndDrag={handleMomentumScrollEnd}
                    onEndReached={() => {
                        // Calculate remaining videos correctly - clamp visibleIndex
                        const currentLength = players.length;
                        const currentVisible = Math.min(
                            visibleIndex,
                            currentLength - 1
                        );
                        const remaining = currentLength - currentVisible - 1;

                        console.log("[END_REACHED] onEndReached called", {
                            remaining,
                            currentLength,
                            currentVisible,
                            visibleIndex,
                            fetching: fetchingRef.current,
                            urisLength: uris.length,
                        });

                        // Fetch when 3 or fewer videos remain
                        if (
                            remaining <= 3 &&
                            !fetchingRef.current &&
                            uris.length > 0 &&
                            currentVisible >= 0 &&
                            currentVisible < currentLength
                        ) {
                            console.log(
                                "[END_REACHED] Calling fetchMoreVideos"
                            );
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
