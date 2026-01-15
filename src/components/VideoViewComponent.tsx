import { useEffect, useRef } from "react";
import useVideoPlayback from "../hooks/useVideoPlayback";
import { Video } from "../types";
import { useVideoPlayer, VideoPlayer, VideoView } from "react-native-video";
import { TouchableWithoutFeedback, View } from "react-native";
import VideoOverlay from "./VideoOverlay";

interface VideoViewComponentProps {
    video: Video;
    isActive: boolean;
    shouldPreload?: boolean;
}

function VideoViewComponent({
    video,
    isActive,
    shouldPreload,
}: VideoViewComponentProps) {
    const { paused, togglePause } = useVideoPlayback({ isActive });
    const wasActiveRef = useRef(isActive);

    const player = useVideoPlayer(
        shouldPreload || isActive ? video.url : "",
        (p) => {
            p.loop = true;
            p.muted = true;
        }
    );

    useEffect(() => {
        if (!player) {
            return;
        } else if (isActive && !paused) {
            player.muted = false;
            player.play();
        } else if (!isActive && paused) {
            player.muted = true;
            player.pause();
        } else if (shouldPreload) {
            player.muted = true;
            player.pause();
            player.currentTime = 0;
        } else {
            player.muted = true;
            player.pause();
        }

        if (isActive && !wasActiveRef.current) {
            player.currentTime = 0;
        }

        wasActiveRef.current = isActive;
    }, [isActive, paused, player, shouldPreload]);

    return (
        <View>
            <TouchableWithoutFeedback onPress={togglePause}>
                <View>
                    <View>
                        <VideoView player={player} controls={false} />
                    </View>
                </View>
            </TouchableWithoutFeedback>

            <VideoOverlay isVisible={true} />
        </View>
    );
}

export default VideoViewComponent;
