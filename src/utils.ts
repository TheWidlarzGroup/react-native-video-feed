import { VideoPlayer } from 'react-native-video';

export const SOURCES = [
  require('../assets/videos/1.mp4'),
  require('../assets/videos/2.mp4'),
  require('../assets/videos/3.mp4'),
  require('../assets/videos/4.mp4'),
  require('../assets/videos/5.mp4'),
  require('../assets/videos/6.mp4'),
  require('../assets/videos/7.mp4'),
  require('../assets/videos/8.mp4'),
  require('../assets/videos/9.mp4'),
];

export const createListPlayer = (source: string) => {
  const player = new VideoPlayer({
    uri: source,
  });
  
  return player;
};