import { LegendList, ViewabilityConfigCallbackPairs } from '@legendapp/list';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import { VideoPlayer } from 'react-native-video';
import BottomTabBar from './BottomTabBar';
import { styles } from './styles';
import { SOURCES, createListPlayer } from './utils';
import VideoViewComponent from './VideoViewComponent';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const MAX_ANDROID_ACTIVE_PLAYERS = 2;

export default function App() {
  const [players, setPlayers] = useState<VideoPlayer[]>([]);
  const [visibleIndex, setVisibleIndex] = useState(0);

  useEffect(() => {
    const initialPlayers = SOURCES.map((source) => createListPlayer(source));
    setPlayers(initialPlayers);

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
      const newSource = SOURCES[Math.floor(Math.random() * SOURCES.length)];
      return [...prevPlayers, createListPlayer(newSource)];
    });
  }, []);

  useEffect(() => {
    if (!players.length) return;

    // Android have hardware limitation of 2 active players at a time.
    // So we need to carefully manage the players.
    // Otherwise we will get media decoder errors.
    if (Platform.OS === 'android') {
      let androidActivePlayerCount = 0;
      players.forEach((player, idx) => {
        if (!player) {
          return;
        }

        const isVisible = idx === visibleIndex;
        const isPreloadCandidate = idx === visibleIndex + 1;
        const idxString = idx.toString() + (visibleIndex === idx ? ' (visible)' : '');

        let shouldBeActive = false;
        if (isVisible) {
          shouldBeActive = true;
        } else if (isPreloadCandidate && androidActivePlayerCount < MAX_ANDROID_ACTIVE_PLAYERS) {
          shouldBeActive = true;
        }

        if (shouldBeActive) {
          if (player.source?.uri) {
            if (player.status === 'idle') {
              console.log(idxString, 'preloading');
              player.preload();
            } else {
              console.log(idxString, 'already preloaded - status:', player.status);
            }
            androidActivePlayerCount++;
          }
        } else {
          if (player.status !== 'idle') {
            console.log(idxString, 'cleaning source - status:', player.status);
            player.replaceSourceAsync(null);
          } else {
            console.log(idxString, 'requested to clean source - status:', player.status);
          }
        }
      });
    } else {
      players.forEach((player, idx) => {
        if (!player) return;

        const isVisible = idx === visibleIndex;
        const isPreloadCandidate = idx === visibleIndex + 1 || idx === visibleIndex + 2;

        if (isVisible || isPreloadCandidate) {
          if (player.source?.uri && player.status === 'idle') {
            player.preload();
          }
        } else {
          // For players further than 2 positions away (and not visible)
          if (Math.abs(idx - visibleIndex) > 2) {
            if (player.source?.uri) {
              player.replaceSourceAsync(null);
            }
          }
        }
      });
    }
  }, [visibleIndex, players]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems && viewableItems.length > 0 && viewableItems[0].index !== null && typeof viewableItems[0].index === 'number') {
      const newVisibleIndex = viewableItems[0].index;
      setVisibleIndex(newVisibleIndex);
      
      if (players.length > 0 && players.length - newVisibleIndex <= 3) {
        fetchMoreVideos();
      }
    }
  }, [players.length, fetchMoreVideos]);


  const viewabilityConfigCallbackPairs = useMemo(() => ([
    {
      viewabilityConfig: {
        id: 'video',
        viewAreaCoveragePercentThreshold: 60,
      },
      onViewableItemsChanged: onViewableItemsChanged,
    } satisfies ViewabilityConfigCallbackPairs[number],
  ]), [onViewableItemsChanged]);


  return (
    <View style={styles.container}>
      <LegendList
        data={players}
        renderItem={item => <VideoViewComponent {...item} />}
        keyExtractor={(item, idx) => `${item.source.uri}-${idx}`}
        estimatedItemSize={screenHeight}
        style={{ width: screenWidth, height: screenHeight }}
        contentContainerStyle={{ flexGrow: 1 }}
        horizontal={false}
        snapToInterval={screenHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        maintainVisibleContentPosition={true}
      />
      <StatusBar style="light" />
      <BottomTabBar />
    </View>
  );
}
