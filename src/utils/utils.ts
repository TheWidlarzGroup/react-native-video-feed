const NETLIFY_BASE = "https://splendorous-muffin-0ddebe.netlify.app";

export const SOURCES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
    (i) => `${NETLIFY_BASE}/v${i}/index.m3u8`,
);
