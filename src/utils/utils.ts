import { VideoPlayer } from "react-native-video";

export const SOURCES = [
    'https://stream.mux.com/3jWgM01DY019O6hBjlwdljlBrULjfK6B6fLUZy86lmhVI.m3u8',
    'https://stream.mux.com/qDVXNeXuL87zBBBtlWqrDvobfEJ7TKYvl93GQ1TnqF4.m3u8',
    'https://stream.mux.com/WHBD6rsdoypxYlsED1fgB482XsLoaZFRATFlO85b3UM.m3u8',
    'https://stream.mux.com/qz0102Sc2RyM6K1d02xLQc00qE8QoRevQrxDx3Labip01TLc.m3u8',
    'https://stream.mux.com/00CaRd4etfCnY2nti02erWsyqhr3Qi36H56TC53q3Lkd00.m3u8',
];

export const resolveVideoUris = () => {
    // HLS URLs can be used directly, no asset resolution needed
    return SOURCES;
};

export const createListPlayer = (uri: string) => {
    const player = new VideoPlayer({
        uri,
        initializeOnCreation: false, // Don't auto-initialize, we'll preload manually
    });
    player.loop = true;
    return player;
};
