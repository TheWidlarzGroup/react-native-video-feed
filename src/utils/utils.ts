const HLS_BASE =
    "https://69e664383f19480597c5a256--twg-video-feed-demo.netlify.app";

export const SOURCES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
    (i) => `${HLS_BASE}/v${i}/index.m3u8`,
);
