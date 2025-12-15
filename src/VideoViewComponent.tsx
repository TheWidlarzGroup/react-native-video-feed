import { LegendListRenderItemProps, useRecyclingState, useViewability, ViewToken } from '@legendapp/list';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, Text, View } from 'react-native';
import { useEvent, VideoPlayer, VideoView } from 'react-native-video';
import VideoOverlay from './VideoOverlay';
import CustomVideoControls from './CustomVideoControls';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

const VideoViewComponent = ({ item: player, index }: LegendListRenderItemProps<VideoPlayer>) => {
  const [isLoading, setIsLoading] = useRecyclingState(player.status === 'idle' || player.status === 'loading');
  const [isError, setIsError] = useRecyclingState(player.status === 'error');
  const [nitroId, setNitroId] = useState<number | null>(null);

  useEvent(player, 'onLoad', (_) => {
    setIsLoading(false);
    setIsError(false);
    player.play();
    player.loop = true;
  });

  useEvent(player, 'onStatusChange', (status) => {
    console.log(index, '[PLAYER STATUS]', status);

    if (player.status === 'error') {
      setIsError(true);
    } 

    if (player.status === 'readyToPlay') {
      player.play();
      setIsError(false);
      setIsLoading(false);
    }

    if (player.status === 'idle') {
      setIsLoading(true);
    }

    if (player.status === 'loading') {
      setIsLoading(true);
      setIsError(false);
    }
  });

  useEvent(player, 'onError', (error) => {
    console.log(index, '[ERROR]', error);

    setIsError(true);
    setIsLoading(false);
  });

  useViewability((viewToken: ViewToken) => {
    if (viewToken.isViewable && player.status === 'readyToPlay') {
      player.play();
    } else if (player.status !== 'idle') {
      player.pause();
    }

    console.log(index, '[VIEWABILITY]: ', viewToken.isViewable, player.status);
  }, 'video');

  return (
    <Pressable
      style={{ width: screenWidth, height: screenHeight, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}
      onPress={() => {
        player.isPlaying ? player.pause() : player.play();
      }}
    >
      {isLoading ? (
        <View style={{ width: screenWidth, height: screenHeight, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}
      {isError ? <Text style={{ color: '#fff' }}>Error: Something went wrong</Text> : null}
      {!isError ? (
        <View style={{ width: screenWidth, height: screenHeight, position: 'relative' }}>
          <VideoView 
            player={player} 
            style={{ width: screenWidth, height: screenHeight }} 
            controls={false}
          />
          {/* Custom controls will find the player by nitroId internally */}
          {/* We'll use a workaround to get nitroId - for now, pass a placeholder */}
          <CustomVideoControls 
            nitroId={-1} 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              pointerEvents: 'box-none'
            }} 
          />
        </View>
      ) : null}
      <VideoOverlay />
    </Pressable>
  );
};

export default VideoViewComponent; 