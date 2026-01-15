import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

interface UseVideoPlaybackProps {
    isActive: boolean;
}

interface UseVideoPlaybackResult {
    paused: boolean;
    togglePause: () => void;
}

const useVideoPlayback = ({
    isActive,
}: UseVideoPlaybackProps): UseVideoPlaybackResult => {
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        setPaused(!isActive);
    }, [isActive]);

    useEffect(() => {
        const subscription = AppState.addEventListener(
            "change",
            (state: AppStateStatus) => setPaused(state !== "active")
        );

        return () => subscription.remove();
    }, []);

    const togglePause = () => {
        setPaused(!paused);
    };

    return { paused, togglePause };
};

export default useVideoPlayback;
