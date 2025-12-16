import { LegendList, ViewabilityConfigCallbackPairs } from "@legendapp/list";
import { StatusBar } from "expo-status-bar";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Dimensions, Platform, View } from "react-native";
import { VideoPlayer } from "react-native-video";
import BottomTabBar from "./BottomTabBar";
import { styles } from "./styles";
import { SOURCES, createListPlayer } from "./utils";
import VideoViewComponent from "./VideoViewComponent";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");
const MAX_ANDROID_ACTIVE_PLAYERS = 2;

export default function App() {
    const [players, setPlayers] = useState<VideoPlayer[]>([]);
    const [visibleIndex, setVisibleIndex] = useState(0);
    const playersRef = useRef<VideoPlayer[]>([]);
    const visibleIndexRef = useRef(0);

    useEffect(() => {
        const initialPlayers = SOURCES.map((source) =>
            createListPlayer(source)
        );
        setPlayers(initialPlayers);
        playersRef.current = initialPlayers;

        // Preload ALL videos immediately - no delay
        initialPlayers.forEach((player, idx) => {
            if (player.source?.uri && player.status === "idle") {
                // Preload immediately, no staggering
                player.preload();
            }
        });

        return () => {
            initialPlayers.forEach((player) => {
                player.replaceSourceAsync(null);
            });
            setPlayers([]);
            playersRef.current = [];
        };
    }, []);

    // Keep ref in sync
    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    useEffect(() => {
        visibleIndexRef.current = visibleIndex;
    }, [visibleIndex]);

    const fetchMoreVideos = useCallback(() => {
        setPlayers((prevPlayers) => {
            const newSource =
                SOURCES[Math.floor(Math.random() * SOURCES.length)];
            const newPlayer = createListPlayer(newSource);
            const updated = [...prevPlayers, newPlayer];

            // Preload new video immediately
            if (newPlayer.source?.uri && newPlayer.status === "idle") {
                newPlayer.preload();
            }

            return updated;
        });
    }, []);

    // Manage player lifecycle
    useEffect(() => {
        if (!players.length) return;

        if (Platform.OS === "android") {
            let androidActivePlayerCount = 0;
            players.forEach((player, idx) => {
                if (!player) return;

                const isVisible = idx === visibleIndex;
                const distance = Math.abs(idx - visibleIndex);
                const shouldPreload = distance <= 3;

                if (
                    isVisible ||
                    (shouldPreload &&
                        androidActivePlayerCount < MAX_ANDROID_ACTIVE_PLAYERS)
                ) {
                    if (player.source?.uri && player.status === "idle") {
                        player.preload();
                    }
                    if (shouldPreload) {
                        androidActivePlayerCount++;
                    }
                } else if (distance > 7) {
                    // Only clean up very far away videos (increased from 5 to 7)
                    if (
                        player.status === "readyToPlay" ||
                        player.status === "error"
                    ) {
                        player.replaceSourceAsync(null);
                    }
                }
            });
        } else {
            // iOS - preload visible + next 3
            players.forEach((player, idx) => {
                if (!player) return;

                const distance = Math.abs(idx - visibleIndex);
                if (distance <= 3) {
                    if (player.source?.uri && player.status === "idle") {
                        player.preload();
                    }
                } else if (distance > 7) {
                    // Only clean up very far away videos (increased from 5 to 7)
                    if (
                        player.status === "readyToPlay" ||
                        player.status === "error"
                    ) {
                        player.replaceSourceAsync(null);
                    }
                }
            });
        }
    }, [visibleIndex, players]);

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: any[] }) => {
            if (
                viewableItems &&
                viewableItems.length > 0 &&
                viewableItems[0].index !== null &&
                typeof viewableItems[0].index === "number"
            ) {
                const newVisibleIndex = viewableItems[0].index;
                const oldVisibleIndex = visibleIndexRef.current;

                // CRITICAL: Pause ALL videos except the new visible one
                // Use ref to get latest players array
                const currentPlayers = playersRef.current;
                currentPlayers.forEach((player, idx) => {
                    if (idx !== newVisibleIndex && player) {
                        // Force pause all non-visible videos
                        try {
                            if (player.isPlaying) {
                                player.pause();
                            }
                        } catch (e) {
                            // Ignore errors
                        }
                    } else if (idx === newVisibleIndex && player) {
                        // Preload if not ready, play if ready
                        try {
                            if (
                                player.status === "idle" &&
                                player.source?.uri
                            ) {
                                player.preload();
                            } else if (
                                player.status === "readyToPlay" &&
                                !player.isPlaying
                            ) {
                                // Play immediately when scrolling to visible video
                                player.play();
                            }
                        } catch (e) {
                            // Ignore errors
                        }
                    }
                });

                setVisibleIndex(newVisibleIndex);

                // Fetch more if needed
                if (currentPlayers.length - newVisibleIndex <= 3) {
                    fetchMoreVideos();
                }
            }
        },
        [fetchMoreVideos]
    );

    const viewabilityConfigCallbackPairs = useMemo(
        () => [
            {
                viewabilityConfig: {
                    id: "video",
                    viewAreaCoveragePercentThreshold: 50,
                    minimumViewTime: 0, // Changed to 0 for immediate detection
                },
                onViewableItemsChanged: onViewableItemsChanged,
            } satisfies ViewabilityConfigCallbackPairs[number],
        ],
        [onViewableItemsChanged]
    );

    return (
        <View style={styles.container}>
            <LegendList
                data={players}
                renderItem={(item) => <VideoViewComponent {...item} />}
                keyExtractor={(item, idx) => `${item.source.uri}-${idx}`}
                estimatedItemSize={screenHeight}
                style={{ width: screenWidth, height: screenHeight }}
                contentContainerStyle={{ flexGrow: 1 }}
                horizontal={false}
                snapToInterval={screenHeight}
                snapToAlignment="start"
                decelerationRate="fast"
                pagingEnabled={true}
                showsVerticalScrollIndicator={false}
                viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
                maintainVisibleContentPosition={true}
            />
            <StatusBar style="light" />
            <BottomTabBar />
        </View>
    );
}
