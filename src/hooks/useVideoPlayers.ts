import { useCallback, useEffect, useRef, useState } from "react";
import { VideoPlayer } from "react-native-video";
import { prefetch } from "react-native-nitro-fetch";
import { createListPlayer, resolveVideoUris } from "../utils/utils";

export const useVideoPlayers = () => {
    const [players, setPlayers] = useState<VideoPlayer[]>([]);
    const [uris, setUris] = useState<string[]>([]);
    const playersRef = useRef<VideoPlayer[]>([]);
    const preloadAttemptedRef = useRef<Set<VideoPlayer>>(new Set());
    const fetchingRef = useRef(false);
    const timeoutRefsRef = useRef<Set<NodeJS.Timeout>>(new Set());
    const rafRefsRef = useRef<Set<number>>(new Set());

    const safePreload = useCallback((player: VideoPlayer) => {
        if (
            !player ||
            player.status !== "idle" ||
            !player.source?.uri ||
            preloadAttemptedRef.current.has(player)
        ) {
            return false;
        }

        try {
            player.preload();
            preloadAttemptedRef.current.add(player);
            return true;
        } catch (e) {
            return false;
        }
    }, []);

    const initializePlayers = useCallback(() => {
        let mounted = true;
        try {
            const resolvedUris = resolveVideoUris();
            if (!mounted) return;
            setUris(resolvedUris);

            // Prefetch all initial video URLs with nitro-fetch
            resolvedUris.forEach((uri, idx) => {
                prefetch(uri, {
                    headers: { prefetchKey: `video-${idx}` },
                }).catch(() => {
                    // Ignore prefetch errors
                });
            });

            const initialPlayers = resolvedUris.map((uri) => {
                return createListPlayer(uri);
            });
            playersRef.current = initialPlayers;
            setPlayers(initialPlayers);

            // Preload all players immediately using requestAnimationFrame
            initialPlayers.forEach((player) => {
                const rafId = requestAnimationFrame(() => {
                    if (mounted) {
                        safePreload(player);
                    }
                });
                rafRefsRef.current.add(rafId);
            });
        } catch (e) {
            // Ignore
        }

        return () => {
            timeoutRefsRef.current.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            timeoutRefsRef.current.clear();

            rafRefsRef.current.forEach((rafId) => {
                cancelAnimationFrame(rafId);
            });
            rafRefsRef.current.clear();

            playersRef.current.forEach((player) => {
                try {
                    preloadAttemptedRef.current.delete(player);
                } catch (e) {
                    // Ignore
                }
            });
            setPlayers([]);
            playersRef.current = [];
            preloadAttemptedRef.current.clear();
        };
    }, [safePreload]);

    useEffect(() => {
        const cleanup = initializePlayers();
        return cleanup;
    }, [initializePlayers]);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    const fetchMoreVideos = useCallback(() => {
        fetchingRef.current = true;

        const videosToFetch = Math.min(3, uris.length);
        let fetchedCount = 0;
        const newPlayers: VideoPlayer[] = [];
        const currentLength = playersRef.current.length;

        const fetchNext = () => {
            if (fetchedCount >= videosToFetch) {
                setPlayers((prevPlayers) => {
                    const nextPlayers = [...prevPlayers, ...newPlayers];
                    playersRef.current = nextPlayers;

                    newPlayers.forEach((player) => {
                        const rafId = requestAnimationFrame(() => {
                            const checkAndPreload = () => {
                                if (safePreload(player)) {
                                    return;
                                }
                                if (player.source?.uri) {
                                    const timeoutId = setTimeout(
                                        checkAndPreload,
                                        100
                                    );
                                    timeoutRefsRef.current.add(timeoutId);
                                }
                            };
                            checkAndPreload();
                        });
                        rafRefsRef.current.add(rafId);
                    });

                    fetchingRef.current = false;
                    return nextPlayers;
                });
                return;
            }

            const positionInArray = currentLength + newPlayers.length;
            const expectedUri = uris[positionInArray % uris.length];

            prefetch(expectedUri, {
                headers: { prefetchKey: `video-${positionInArray}` },
            }).catch(() => {});

            const newPlayer = createListPlayer(expectedUri);
            newPlayers.push(newPlayer);

            fetchedCount++;
            setTimeout(fetchNext, 100);
        };

        fetchNext();
    }, [uris, safePreload]);

    return {
        players,
        uris,
        playersRef,
        preloadAttemptedRef,
        fetchingRef,
        safePreload,
        fetchMoreVideos,
    };
};
