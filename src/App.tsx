import { LegendList, ViewabilityConfigCallbackPairs } from "@legendapp/list";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

    useEffect(() => {
        const initialPlayers = SOURCES.map((source) =>
            createListPlayer(source)
        );
        setPlayers(initialPlayers);

        // Preload the first 2 videos immediately for smooth start
        if (initialPlayers.length > 0 && initialPlayers[0].source?.uri) {
            console.log("[INIT] Preloading first video");
            initialPlayers[0].preload();
        }
        if (initialPlayers.length > 1 && initialPlayers[1].source?.uri) {
            console.log("[INIT] Preloading second video");
            setTimeout(() => {
                if (initialPlayers[1].status === "idle") {
                    initialPlayers[1].preload();
                }
            }, 200);
        }

        return () => {
            initialPlayers.forEach((player) => {
                player.replaceSourceAsync(null);
            });

            // Also clear the state to prevent issues on fast refresh/re-mount
            setPlayers([]);
        };
    }, []);

    const fetchMoreVideos = useCallback(() => {
        setPlayers((prevPlayers) => {
            const newSource =
                SOURCES[Math.floor(Math.random() * SOURCES.length)];
            return [...prevPlayers, createListPlayer(newSource)];
        });
    }, []);

    useEffect(() => {
        if (!players.length) return;

        // Android have hardware limitation of 2 active players at a time.
        // So we need to carefully manage the players.
        // Otherwise we will get media decoder errors.
        if (Platform.OS === "android") {
            let androidActivePlayerCount = 0;
            players.forEach((player, idx) => {
                if (!player) {
                    return;
                }

                const isVisible = idx === visibleIndex;
                const isPreloadCandidate1 = idx === visibleIndex + 1;
                const isPreloadCandidate2 = idx === visibleIndex + 2;
                const idxString =
                    idx.toString() + (visibleIndex === idx ? " (visible)" : "");

                let shouldBeActive = false;
                if (isVisible) {
                    shouldBeActive = true;
                } else if (
                    (isPreloadCandidate1 || isPreloadCandidate2) &&
                    androidActivePlayerCount < MAX_ANDROID_ACTIVE_PLAYERS
                ) {
                    shouldBeActive = true;
                }

                if (shouldBeActive) {
                    if (player.source?.uri) {
                        // Always ensure visible video is preloaded, and preload next if possible
                        if (player.status === "idle") {
                            console.log(idxString, "preloading");
                            player.preload();
                        } else if (
                            isVisible &&
                            player.status === "readyToPlay" &&
                            !player.isPlaying
                        ) {
                            // If visible and ready, ensure it's playing
                            console.log(
                                idxString,
                                "visible video is ready, ensuring play - status:",
                                player.status
                            );
                            player.play();
                        } else if (isVisible && player.status === "loading") {
                            console.log(
                                idxString,
                                "visible video is loading - status:",
                                player.status
                            );
                        } else {
                            console.log(
                                idxString,
                                "already preloaded - status:",
                                player.status
                            );
                        }
                        androidActivePlayerCount++;
                    }
                } else {
                    // Only clean up videos that are far away and ready (not loading)
                    if (Math.abs(idx - visibleIndex) > 2) {
                        if (
                            player.status === "readyToPlay" ||
                            player.status === "error"
                        ) {
                            console.log(
                                idxString,
                                "cleaning source - status:",
                                player.status
                            );
                            player.replaceSourceAsync(null);
                        }
                    }
                }
            });
        } else {
            players.forEach((player, idx) => {
                if (!player) return;

                const isVisible = idx === visibleIndex;
                const isPreloadCandidate1 = idx === visibleIndex + 1;
                const isPreloadCandidate2 = idx === visibleIndex + 2;
                const isPreloadCandidate3 = idx === visibleIndex + 3;

                if (
                    isVisible ||
                    isPreloadCandidate1 ||
                    isPreloadCandidate2 ||
                    isPreloadCandidate3
                ) {
                    if (player.source?.uri) {
                        // Always ensure visible video is preloaded
                        if (player.status === "idle") {
                            console.log(`[iOS] Preloading video ${idx}`);
                            player.preload();
                        } else if (
                            isVisible &&
                            (player.status === "loading" ||
                                player.status === "readyToPlay")
                        ) {
                            console.log(
                                `[iOS] Visible video ${idx} is loading/ready - status:`,
                                player.status
                            );
                        }
                    }
                } else {
                    // For players further than 3 positions away (and not visible)
                    if (Math.abs(idx - visibleIndex) > 3) {
                        if (player.source?.uri) {
                            console.log(
                                `[iOS] Cleaning source for video ${idx}`
                            );
                            player.replaceSourceAsync(null);
                        }
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
                setVisibleIndex(newVisibleIndex);

                if (
                    players.length > 0 &&
                    players.length - newVisibleIndex <= 3
                ) {
                    fetchMoreVideos();
                }
            }
        },
        [players.length, fetchMoreVideos]
    );

    const viewabilityConfigCallbackPairs = useMemo(
        () => [
            {
                viewabilityConfig: {
                    id: "video",
                    viewAreaCoveragePercentThreshold: 50,
                    minimumViewTime: 100,
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
