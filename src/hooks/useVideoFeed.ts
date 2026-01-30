import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { SOURCES } from "../utils/utils";
import { Video } from "../types";

const CYCLE_COUNT = Platform.OS === "android" ? 10 : 20;

const useVideoFeed = () => {
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVideos = async () => {
        try {
            setLoading(true);
            setError(null);

            const videoList = Array.from({ length: CYCLE_COUNT }).flatMap(
                (_, cycleIndex) =>
                    SOURCES.map((url, index) => ({
                        id: `${cycleIndex}-${index}`,
                        url,
                    })),
            );

            setVideos(videoList);
        } catch (error) {
            setError(error as string);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVideos();
    }, []);

    return {
        videos,
        loading,
        error,
        refetch: fetchVideos,
    };
};

export default useVideoFeed;
