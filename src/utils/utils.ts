const HLS_BASE =
    "https://pxcgbjvkyhrwimyeqwhn.supabase.co/storage/v1/object/public/hls";

export const SOURCES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
    (i) => `${HLS_BASE}/v${i}/index.m3u8`,
);
