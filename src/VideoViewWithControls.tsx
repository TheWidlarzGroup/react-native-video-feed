import React, { useRef, useState } from 'react';
import { VideoView, VideoViewProps, VideoViewRef } from 'react-native-video';
import CustomVideoControls from './CustomVideoControls';
import { View, ViewStyle } from 'react-native';

interface VideoViewWithControlsProps extends Omit<VideoViewProps, 'onNitroIdChange'> {
  showCustomControls?: boolean;
}

export const VideoViewWithControls: React.FC<VideoViewWithControlsProps> = ({
  showCustomControls = true,
  controls = false,
  style,
  ...props
}) => {
  const [nitroId, setNitroId] = useState<number | null>(null);
  const viewRef = useRef<VideoViewRef>(null);

  // We need to intercept the nitroId change event
  // Since VideoView doesn't expose onNitroIdChange, we'll use a workaround
  // by accessing the native view's nitroId through the ref after mount
  
  React.useEffect(() => {
    // Try to get nitroId from the native view after a short delay
    // This is a workaround since VideoView doesn't expose onNitroIdChange
    const timer = setTimeout(() => {
      // Access nitroId through native view if possible
      // This is a temporary solution - ideally VideoView would expose onNitroIdChange
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[{ position: 'relative' }, style]}>
      <VideoView
        ref={viewRef}
        {...props}
        controls={controls}
        // We'll need to patch VideoView to expose onNitroIdChange
        // For now, we'll use a different approach
      />
      {showCustomControls && nitroId !== null && (
        <CustomVideoControls
          nitroId={nitroId}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'box-none',
          }}
        />
      )}
    </View>
  );
};




