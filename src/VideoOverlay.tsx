import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './styles';

const VideoOverlay = () => (
  <View style={styles.overlayContainer} pointerEvents="box-none">
    <View style={styles.overlayRight}>
      <TouchableOpacity style={styles.iconButton}>
        <Ionicons name="heart" size={40} color="#fff" />
        <Text style={styles.iconLabel}>1.2K</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconButton}>
        <Ionicons name="chatbubble" size={40} color="#fff" />
        <Text style={styles.iconLabel}>345</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconButton}>
        <MaterialCommunityIcons name="share" size={40} color="#fff" />
        <Text style={styles.iconLabel}>Share</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default VideoOverlay; 