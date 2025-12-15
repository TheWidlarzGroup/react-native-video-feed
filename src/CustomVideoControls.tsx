import React from "react";
import { Platform, requireNativeComponent, ViewStyle } from "react-native";

interface CustomVideoControlsProps {
    nitroId: number;
    style?: ViewStyle;
}

// Android only - iOS implementation removed
const CustomVideoControlsView =
    Platform.OS === "android"
        ? requireNativeComponent<CustomVideoControlsProps>(
              "CustomVideoControlsView"
          )
        : null;

export const CustomVideoControls: React.FC<CustomVideoControlsProps> = ({
    nitroId,
    style,
}) => {
    // Only render on Android
    if (Platform.OS !== "android" || !CustomVideoControlsView) {
        return null;
    }

    return <CustomVideoControlsView nitroId={nitroId} style={style} />;
};

export default CustomVideoControls;
