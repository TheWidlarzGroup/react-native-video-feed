import { useCallback, useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { Dimensions } from "react-native";

const { height: screenHeight } = Dimensions.get("window");

interface UseVideoScrollParams {
    playersRef: React.MutableRefObject<any[]>;
    onVisibleIndexChange: (index: number) => void;
}

export const useVideoScroll = ({
    playersRef,
    onVisibleIndexChange,
}: UseVideoScrollParams) => {
    const [visibleIndex, setVisibleIndex] = useState(0);
    const visibleIndexRef = useRef(0);

    useEffect(() => {
        visibleIndexRef.current = visibleIndex;
    }, [visibleIndex]);

    const handleMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            const playersCount = playersRef.current.length;
            const index = Math.round(offsetY / screenHeight);
            const clampedIndex = Math.max(0, Math.min(index, playersCount - 1));

            if (
                clampedIndex !== visibleIndexRef.current &&
                clampedIndex < playersCount
            ) {
                visibleIndexRef.current = clampedIndex;
                setVisibleIndex(clampedIndex);
                onVisibleIndexChange(clampedIndex);
            }
        },
        [playersRef, onVisibleIndexChange]
    );

    const viewabilityConfig = {
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 0,
    };

    const viewabilityConfigCallbackPairsRef = useRef([
        {
            viewabilityConfig,
            onViewableItemsChanged: ({
                viewableItems,
            }: {
                viewableItems: Array<{
                    index: number | null;
                    isViewable: boolean;
                }>;
            }) => {
                if (viewableItems.length > 0) {
                    const firstViewable = viewableItems[0];
                    if (
                        firstViewable.index !== null &&
                        firstViewable.isViewable &&
                        firstViewable.index !== visibleIndexRef.current
                    ) {
                        visibleIndexRef.current = firstViewable.index;
                        setVisibleIndex(firstViewable.index);
                        onVisibleIndexChange(firstViewable.index);
                    }
                }
            },
        },
    ]);

    return {
        visibleIndex,
        visibleIndexRef,
        handleMomentumScrollEnd,
        viewabilityConfigCallbackPairs: viewabilityConfigCallbackPairsRef.current,
    };
};
