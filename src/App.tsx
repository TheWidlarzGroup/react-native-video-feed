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

    useEffect(() => {
        let mounted = true;
        try {
            // Resolve all asset URIs synchronously (no downloads) to avoid first-item black screen
            const resolvedUris = resolveVideoUris();
            if (!mounted) return;
            setUris(resolvedUris);

            const initialPlayers = resolvedUris.map((uri) =>
                createListPlayer(uri)
            );
            playersRef.current = initialPlayers;
            setPlayers(initialPlayers);
            setIsBooting(false);

            // Preload first + neighbor immediately
            initialPlayers.slice(0, 2).forEach((player) => {
                if (player?.source?.uri && player.status === "idle") {
                    try {
                        player.preload();
                    } catch {
                        // ignore
                    }
                }
            });
        } catch (e) {
            console.error("[App] Asset resolve error:", e);
            setIsBooting(false);
        }

        return () => {
            playersRef.current.forEach((player) => {
                try {
                    player.replaceSourceAsync(null);
                } catch (e) {
                    // Ignore
                }
            });
            setPlayers([]);
            playersRef.current = [];
        };
    }, []);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    useEffect(() => {
        visibleIndexRef.current = visibleIndex;
    }, [visibleIndex]);

    const fetchMoreVideos = useCallback(() => {
        if (!uris.length) return;

        setPlayers((prevPlayers) => {
            const nextUri = uris[prevPlayers.length % uris.length];
            const updated = [...prevPlayers];

            let playerToUse: VideoPlayer | undefined;

            if (updated.length >= MAX_PLAYERS) {
                // Reuse the oldest player to keep memory bounded
                playerToUse = updated.shift();
            }

            if (playerToUse) {
                try {
                    playerToUse.pause();
                    playerToUse.muted = true;
                    playerToUse.replaceSourceAsync({ uri: nextUri });
                } catch (e) {
                    // Ignore replace errors, fallback to new player
                    playerToUse = createListPlayer(nextUri);
                }
            } else {
                playerToUse = createListPlayer(nextUri);
            }

            const nextPlayers = [...updated, playerToUse];
            playersRef.current = nextPlayers;
            return nextPlayers;
        });
    }, [uris]);

    const syncPlaybackForIndex = useCallback((targetIndex: number) => {
        const currentPlayers = playersRef.current;
        currentPlayers.forEach((player, idx) => {
            if (!player) return;

            const distance = Math.abs(idx - targetIndex);

            // Preload visible + next 2
            if (
                distance <= 2 &&
                player.source?.uri &&
                player.status === "idle"
            ) {
                try {
                    player.preload();
                } catch (e) {
                    // ignore
                }
            }

            if (idx === targetIndex) {
                try {
                    if (player.muted === true) {
                        player.muted = false;
                    }
                    if (player.status === "idle" && player.source?.uri) {
                        player.preload();
                    }
                    if (player.status === "readyToPlay" && !player.isPlaying) {
                        player.play();
                    }
                } catch (e) {
                    // ignore
                }
            } else {
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
    }, []);

    useEffect(() => {
        if (!players.length) return;
        syncPlaybackForIndex(visibleIndex);
    }, [visibleIndex, players, syncPlaybackForIndex]);

    // Ensure initial item kicks off when boot completes
    useEffect(() => {
        if (isBooting) return;
        syncPlaybackForIndex(0);
    }, [isBooting, syncPlaybackForIndex]);

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            const nextIndex = Math.round(offsetY / screenHeight);
            const clampedIndex = Math.max(0, nextIndex);
            if (clampedIndex !== visibleIndexRef.current) {
                visibleIndexRef.current = clampedIndex;
                setVisibleIndex(clampedIndex);

                const remaining = playersRef.current.length - clampedIndex;
                if (remaining <= 3) {
                    fetchMoreVideos();
                }
            }
        },
        [fetchMoreVideos]
    );

    const viewabilityConfig = useRef<ViewabilityConfig>({
        viewAreaCoveragePercentThreshold: 50,
        minimumViewTime: 0,
        waitForInteraction: false,
    });

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (!viewableItems || viewableItems.length === 0) return;
            const first = viewableItems[0];
            if (first.index == null) return;
            const newIndex = first.index;
            if (newIndex === visibleIndexRef.current) return;
            visibleIndexRef.current = newIndex;
            setVisibleIndex(newIndex);

            const remaining = playersRef.current.length - newIndex;
            if (remaining <= 3) {
                fetchMoreVideos();
            }
        },
        [fetchMoreVideos]
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
                    data={players}
                    renderItem={({ item, index }) => (
                        <VideoViewComponent
                            item={item}
                            index={index}
                            isActive={index === visibleIndex}
                        />
                    )}
                    keyExtractor={(item, idx) =>
                        `${idx}-${item.source?.uri ?? "empty"}`
                    }
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
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews
                    maxToRenderPerBatch={2}
                    windowSize={5}
                    initialNumToRender={1}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    onScrollEndDrag={handleMomentumScrollEnd}
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
