import { StatusBar } from "expo-status-bar";
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { Dimensions, FlatList, Platform, View, ViewabilityConfig } from "react-native";
import { VideoPlayer } from "react-native-video";
import BottomTabBar from "./BottomTabBar";
import { styles } from "./styles";
import { SOURCES, createListPlayer } from "./utils";
import VideoViewComponent from "./VideoViewComponent";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

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

        // Preload only first video
        if (initialPlayers[0]?.source?.uri && initialPlayers[0].status === "idle") {
            try {
                initialPlayers[0].preload();
            } catch (e) {
                console.error("[App] Initial preload error:", e);
            }
        }

        return () => {
            initialPlayers.forEach((player) => {
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
        setPlayers((prevPlayers) => {
            const nextIndex = prevPlayers.length % SOURCES.length;
            const newSource = SOURCES[nextIndex];
            const newPlayer = createListPlayer(newSource);
            return [...prevPlayers, newPlayer];
        });
    }, []);

    // Simple lifecycle - preload visible + next 2, cleanup far away
    useEffect(() => {
        if (!players.length) return;

        players.forEach((player, idx) => {
            if (!player) return;

            const distance = Math.abs(idx - visibleIndex);
            const isVisible = idx === visibleIndex;

            // Preload visible + next 2
            if (distance <= 2 && player.source?.uri && player.status === "idle") {
                try {
                    player.preload();
                } catch (e) {
                    // Ignore
                }
            }

            // Clean up far away
            if (distance > 5 && (player.status === "readyToPlay" || player.status === "error")) {
                try {
                    player.replaceSourceAsync(null);
                } catch (e) {
                    // Ignore
                }
            }
        });
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

                if (newVisibleIndex === oldVisibleIndex) {
                    return;
                }

                const currentPlayers = playersRef.current;

                // Pause all except visible
                currentPlayers.forEach((player, idx) => {
                    if (!player) return;

                    if (idx !== newVisibleIndex) {
                        try {
                            if (player.isPlaying) {
                                player.pause();
                            }
                            if (player.muted !== true) {
                                player.muted = true;
                            }
                        } catch (e) {
                            // Ignore
                        }
                    } else {
                        // Visible video
                        try {
                            if (player.muted === true) {
                                player.muted = false;
                            }
                            if (
                                player.status === "idle" &&
                                player.source?.uri
                            ) {
                                player.preload();
                            } else if (
                                player.status === "readyToPlay" &&
                                !player.isPlaying
                            ) {
                                player.play();
                            }
                        } catch (e) {
                            // Ignore
                        }
                    }
                });

                setVisibleIndex(newVisibleIndex);

                // Fetch more if needed
                if (currentPlayers.length - newVisibleIndex <= 2) {
                    fetchMoreVideos();
                }
            }
        },
        [fetchMoreVideos]
    );

    const viewabilityConfig = useRef<ViewabilityConfig>({
        viewAreaCoveragePercentThreshold: 50, // Lower threshold for faster detection
        minimumViewTime: 0, // Immediate detection
        waitForInteraction: false,
    }).current;

    return (
        <View style={styles.container}>
            <FlatList
                data={players}
                renderItem={({ item, index }) => (
                    <VideoViewComponent item={item} index={index} />
                )}
                keyExtractor={(item, idx) => `${item.source?.uri}-${idx}`}
                getItemLayout={(_, index) => ({
                    length: screenHeight,
                    offset: screenHeight * index,
                    index,
                })}
                style={{ width: screenWidth, height: screenHeight }}
                contentContainerStyle={{ flexGrow: 1 }}
                horizontal={false}
                snapToInterval={screenHeight}
                snapToAlignment="start"
                decelerationRate="fast"
                pagingEnabled={true}
                showsVerticalScrollIndicator={false}
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
                removeClippedSubviews={Platform.OS === "android"}
                maxToRenderPerBatch={3}
                windowSize={5}
                initialNumToRender={2}
            />
            <StatusBar style="light" />
            <BottomTabBar />
        </View>
    );
}
