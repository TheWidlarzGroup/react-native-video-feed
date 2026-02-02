import { useEffect, useRef } from "react";
import { performanceMonitor } from "../utils/performance";

const TARGET_FPS = 60;
const FRAME_TIME_MS = 1000 / TARGET_FPS;

/** Monitors FPS via requestAnimationFrame; reports stability every second. */
export const useFPSMonitor = (enabled: boolean = true) => {
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef<number | null>(null);
    const droppedFramesRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) return;

        let lastMeasureTime = performance.now();
        const measureInterval = 1000;

        const measureFPS = (currentTime: number) => {
            if (lastTimeRef.current === null) {
                lastTimeRef.current = currentTime;
                animationFrameRef.current = requestAnimationFrame(measureFPS);
                return;
            }

            const deltaTime = currentTime - lastTimeRef.current;
            frameCountRef.current++;

            if (deltaTime > FRAME_TIME_MS * 2) {
                const expectedFrames = Math.floor(deltaTime / FRAME_TIME_MS);
                const droppedFrames = expectedFrames - 1;
                droppedFramesRef.current += droppedFrames;
            }

            lastTimeRef.current = currentTime;

            const timeSinceLastMeasure = currentTime - lastMeasureTime;
            if (timeSinceLastMeasure >= measureInterval) {
                const actualFPS = frameCountRef.current / (timeSinceLastMeasure / 1000);
                const droppedFramesCount = droppedFramesRef.current;
                const totalExpectedFrames = Math.floor(timeSinceLastMeasure / FRAME_TIME_MS);
                const dropRate = totalExpectedFrames > 0 
                    ? (droppedFramesCount / totalExpectedFrames) * 100 
                    : 0;

                performanceMonitor.recordMetric("fps_stability", actualFPS, {
                    droppedFrames: droppedFramesCount,
                    dropRate: dropRate.toFixed(2) + "%",
                });

                frameCountRef.current = 0;
                droppedFramesRef.current = 0;
                lastMeasureTime = currentTime;
            }

            animationFrameRef.current = requestAnimationFrame(measureFPS);
        };

        animationFrameRef.current = requestAnimationFrame(measureFPS);

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [enabled]);
};

export default useFPSMonitor;
