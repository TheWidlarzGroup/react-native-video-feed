import React from "react";
import { ActivityIndicator, Dimensions, View } from "react-native";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

export const BootScreen = () => {
    return (
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
    );
};
