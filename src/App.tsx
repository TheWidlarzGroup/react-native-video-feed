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
const MAX_PLAYERS = 4;

export default function App() {
    const [players, setPlayers] = useState<VideoPlayer[]>([]);
    const [uris, setUris] = useState<string[]>([]);
    const [visibleIndex, setVisibleIndex] = useState(0);
    const [isBooting, setIsBooting] = useState(true);
    const playersRef = useRef<VideoPlayer[]>([]);
    const visibleIndexRef = useRef(0);
    const preloadAttemptedRef = useRef<Set<VideoPlayer>>(new Set());
    // Track which video index each player represents for infinite scroll
    const playerVideoIndexRef = useRef<Map<VideoPlayer, number>>(new Map());
    // Track if we're currently fetching to prevent infinite loops
    const fetchingRef = useRef(false);
    const flatListRef = useRef<FlatList<VideoPlayer> | null>(null);

    // Safe preload helper that tracks attempts and handles errors
    const safePreload = useCallback((player: VideoPlayer) => {
        if (!player) return false;

        // Check if we've already attempted to preload this player
        if (preloadAttemptedRef.current.has(player)) {
            // Only retry if player is in idle state (might have been reset)
            if (player.status !== "idle") {
                return false;
            }
        }

        // Only preload if player is idle and has a valid URI
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
            // Resolve all asset URIs synchronously (no downloads) to avoid first-item black screen
            const resolvedUris = resolveVideoUris();
            if (!mounted) return;
            setUris(resolvedUris);

            // Create initial players - start with all 5 videos for smooth infinite scroll
            const initialPlayers = resolvedUris.map((uri, idx) => {
                const player = createListPlayer(uri);
                playerVideoIndexRef.current.set(player, idx);
                return player;
            });
            playersRef.current = initialPlayers;
            setPlayers(initialPlayers);
            setIsBooting(false);

            // Wait a tick for players to be fully initialized before preloading
            // This prevents race conditions with player creation
            setTimeout(() => {
                if (!mounted) return;

                // Preload ALL videos upfront for smooth transitions - no loading screens!
                // Stagger preloads slightly to avoid overwhelming the network
                initialPlayers.forEach((player, idx) => {
                    setTimeout(() => {
                        if (mounted) {
                            safePreload(player);
                        }
                    }, idx * 50); // 50ms delay between each preload
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

        console.log("[App] fetchMoreVideos called");

        setPlayers((prevPlayers) => {
            // Calculate the next video index based on current player count
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

            // Always create a new player for infinite scroll - don't reuse
            // This ensures the FlatList always has new items to scroll to
            const newPlayer = createListPlayer(nextUri);
            playerVideoIndexRef.current.set(newPlayer, nextVideoIndex);

            const nextPlayers = [...prevPlayers, newPlayer];
            console.log(
                "[App] Total players after fetch:",
                nextPlayers.length,
                "new index:",
                nextVideoIndex
            );
            playersRef.current = nextPlayers;

            // Preload new player after creation
            setTimeout(() => {
                safePreload(newPlayer);
            }, 100);

            return nextPlayers;
        });
    }, [uris, safePreload]);

    const syncPlaybackForIndex = useCallback(
        (targetIndex: number) => {
            const currentPlayers = playersRef.current;

            currentPlayers.forEach((player, idx) => {
                if (!player) return;

                const distance = Math.abs(idx - targetIndex);

                // Aggressively preload: current + next 4 videos for smooth HLS transitions
                // This ensures videos are ready before user scrolls to them
                if (distance <= 4 && player.source?.uri) {
                    // Only preload if in idle state (not already loading/ready/error)
                    if (player.status === "idle") {
                        safePreload(player);
                    }
                }

                if (idx === targetIndex) {
                    // Active video - ensure it's playing
                    try {
                        if (player.muted === true) {
                            player.muted = false;
                        }
                        // Ensure preload is called if needed
                        if (player.status === "idle" && player.source?.uri) {
                            safePreload(player);
                        }
                        // Play when ready
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
                    // Inactive video - pause and mute
                    try {
                        if (player.isPlaying) {
                            player.pause();
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

        // Proactively fetch more videos if we're getting close to the end
        // Do this separately to avoid circular dependencies
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

        // Fetch when we're within 3 videos of the end for smooth infinite scroll
        // Fetch multiple videos at once to ensure we never run out
        if (remaining <= 3 && !fetchingRef.current && uris.length > 0) {
            console.log("[App] Fetching more videos... remaining:", remaining);
            fetchingRef.current = true;
            // Fetch 2-3 videos ahead to ensure smooth scrolling
            const videosToFetch = Math.min(3, uris.length);
            let fetched = 0;

            const fetchNext = () => {
                if (fetched < videosToFetch && !fetchingRef.current) {
                    fetchingRef.current = true;
                    fetchMoreVideos();
                    fetched++;
                    if (fetched < videosToFetch) {
                        setTimeout(() => {
                            fetchingRef.current = false;
                            fetchNext();
                        }, 100);
                    } else {
                        fetchingRef.current = false;
                    }
                }
            };

            setTimeout(() => {
                fetchNext();
            }, 50);
        }
    }, [
        visibleIndex,
        players.length,
        syncPlaybackForIndex,
        uris.length,
        fetchMoreVideos,
    ]);

    // Proactive preloading: preload videos ahead of current position
    // Removed to prevent infinite loops - preloading is handled in syncPlaybackForIndex

    // Ensure initial item kicks off when boot completes
    useEffect(() => {
        if (isBooting) return;
        syncPlaybackForIndex(0);
    }, [isBooting, syncPlaybackForIndex]);

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            // Use precise calculation with proper rounding for one-by-one scrolling
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

            // Only update if we've moved to a different video (prevent same-index updates)
            if (
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex >= 0 &&
                clampedIndex < playersRef.current.length &&
                Math.abs(clampedIndex - visibleIndexRef.current) === 1 // Only allow one-by-one movement
            ) {
                console.log(
                    "[Scroll] Updating visibleIndex from",
                    visibleIndexRef.current,
                    "to",
                    clampedIndex
                );
                visibleIndexRef.current = clampedIndex;
                setVisibleIndex(clampedIndex);
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
        viewAreaCoveragePercentThreshold: 50,
        minimumViewTime: 0,
        waitForInteraction: false,
    });

    // Disable onViewableItemsChanged - we'll use onMomentumScrollEnd only
    // This prevents conflicts and ensures one-by-one scrolling
    const onViewableItemsChanged = useCallback(() => {
        // Disabled - using onMomentumScrollEnd instead for more reliable one-by-one scrolling
    }, []);

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
                        // Use array index as key - each position in the list is unique
                        // The video index can repeat (infinite scroll), but array positions don't
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
                    decelerationRate="fast"
                    pagingEnabled={true}
                    disableIntervalMomentum={true}
                    disableScrollViewPanResponder={false}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews
                    maxToRenderPerBatch={2}
                    windowSize={5}
                    initialNumToRender={1}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    onScrollEndDrag={(e) => {
                        // Handle scroll end drag - but be conservative to prevent jumps
                        const offsetY = e.nativeEvent.contentOffset.y;
                        const exactIndex = offsetY / screenHeight;
                        const nextIndex = Math.round(exactIndex);
                        const clampedIndex = Math.max(
                            0,
                            Math.min(nextIndex, playersRef.current.length - 1)
                        );

                        // Only update if it's a one-step movement to prevent jumps
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
                    scrollEventThrottle={16}
                    viewabilityConfig={viewabilityConfig.current}
                    onViewableItemsChanged={onViewableItemsChanged}
                />
            )}
            <StatusBar style="light" />
            <BottomTabBar />
        </View>
    );
}
