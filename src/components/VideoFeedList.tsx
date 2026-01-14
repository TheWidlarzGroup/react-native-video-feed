import React, { RefObject, useCallback } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
    LegendList,
    LegendListRef,
    LegendListRenderItemProps,
} from "@legendapp/list";
import { VideoPlayer } from "react-native-video";
import VideoViewComponent from "./VideoViewComponent";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

interface VideoFeedListProps {
    listRef: RefObject<LegendListRef>;
    players: VideoPlayer[];
    visibleIndex: number;
    handleMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    viewabilityConfigCallbackPairs: any[];
    onEndReached: () => void;
}

export const VideoFeedList = ({
    listRef,
    players,
    visibleIndex,
    handleMomentumScrollEnd,
    viewabilityConfigCallbackPairs,
    onEndReached,
}: VideoFeedListProps) => {
    const handleScrollEndDrag = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            handleMomentumScrollEnd(e);
        },
        [handleMomentumScrollEnd]
    );

    const handleMomentumEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            handleMomentumScrollEnd(e);
        },
        [handleMomentumScrollEnd]
    );

    return (
        <LegendList
            ref={listRef}
            data={players}
            renderItem={({
                item,
                index,
            }: LegendListRenderItemProps<VideoPlayer>) => (
                <VideoViewComponent
                    item={item}
                    index={index}
                    isActive={index === visibleIndex}
                />
            )}
            keyExtractor={(item, index) => {
                return `video-${index}`;
            }}
            getFixedItemSize={() => screenHeight}
            estimatedItemSize={screenHeight}
            getItemType={() => "video"}
            style={{
                width: screenWidth,
                height: screenHeight,
            }}
            horizontal={false}
            snapToInterval={screenHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            pagingEnabled={true}
            showsVerticalScrollIndicator={false}
            recycleItems={false}
            drawDistance={screenHeight * 3}
            extraData={visibleIndex}
            viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
            onMomentumScrollEnd={handleMomentumEnd}
            onScrollEndDrag={handleScrollEndDrag}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
        />
    );
};
