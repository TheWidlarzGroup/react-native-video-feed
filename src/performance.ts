export const PERFORMANCE_MONITOR_ENABLED = __DEV__;

type MetricName =
    | "preload_effectiveness"
    | "ttff"
    | "fps_stability"
    | "memory_usage"
    | "scroll_lag";

interface Metric {
    name: MetricName;
    value: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

class PerformanceMonitor {
    private metrics: Metric[] = [];
    private markers: Map<string, number> = new Map();
    private enabled: boolean = PERFORMANCE_MONITOR_ENABLED;
    private readonly MAX_METRICS = 500; // Limit to prevent memory bloat

    startMark(name: string): void {
        if (!this.enabled) return;
        this.markers.set(name, performance.now());
    }

    endMark(name: string): number | null {
        if (!this.enabled) return null;
        const startTime = this.markers.get(name);
        if (!startTime) return null;
        const duration = performance.now() - startTime;
        this.markers.delete(name);
        return duration;
    }

    recordMetric(
        name: MetricName,
        value: number,
        metadata?: Record<string, any>
    ): void {
        if (!this.enabled) return;

        // Limit metadata size to reduce memory usage
        const limitedMetadata = metadata
            ? Object.fromEntries(
                  Object.entries(metadata).slice(0, 5) // Keep only first 5 metadata entries
              )
            : undefined;

        this.metrics.push({
            name,
            value,
            timestamp: Date.now(),
            metadata: limitedMetadata,
        });

        // Remove oldest metrics if limit exceeded
        if (this.metrics.length > this.MAX_METRICS) {
            this.metrics = this.metrics.slice(-this.MAX_METRICS);
        }

        if (__DEV__) {
            // Format value with appropriate unit
            let unit = "ms";
            if (name === "memory_usage") {
                unit = "MB";
            } else if (name === "fps_stability") {
                unit = "fps";
            }
            console.log(
                `[Performance] ${name}: ${value.toFixed(2)}${unit}`,
                limitedMetadata
            );
        }
    }

    getMetrics(name?: MetricName): Metric[] {
        if (name) {
            return this.metrics.filter((m) => m.name === name);
        }
        return [...this.metrics];
    }

    getAverageMetric(name: MetricName): number | null {
        const filtered = this.metrics.filter((m) => m.name === name);
        if (filtered.length === 0) return null;
        const sum = filtered.reduce((acc, m) => acc + m.value, 0);
        return sum / filtered.length;
    }

    getLatestMetric(name: MetricName): Metric | null {
        const filtered = this.metrics.filter((m) => m.name === name);
        if (filtered.length === 0) return null;
        return filtered[filtered.length - 1];
    }

    clearMetrics(): void {
        this.metrics = [];
        this.markers.clear();
    }

    exportMetrics(): string {
        return JSON.stringify(
            {
                summary: {
                    preload_effectiveness: this.getAverageMetric(
                        "preload_effectiveness"
                    ),
                    ttff: this.getAverageMetric("ttff"),
                    fps_stability: this.getAverageMetric("fps_stability"),
                    memory_usage: this.getAverageMetric("memory_usage"),
                    scroll_lag: this.getAverageMetric("scroll_lag"),
                },
                all: this.metrics,
            },
            null,
            2
        );
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}

export const performanceMonitor = new PerformanceMonitor();

import React from "react";

export const usePerformanceMetrics = () => {
    const [metrics, setMetrics] = React.useState<Metric[]>([]);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setMetrics(performanceMonitor.getMetrics());
        }, 2000); // Update every 2 seconds instead of 1 to reduce overhead

        return () => clearInterval(interval);
    }, []);

    return {
        metrics,
        summary: {
            preloadEffectiveness: performanceMonitor.getAverageMetric(
                "preload_effectiveness"
            ),
            ttff: performanceMonitor.getAverageMetric("ttff"),
            fpsStability: performanceMonitor.getAverageMetric("fps_stability"),
            memoryUsage: performanceMonitor.getAverageMetric("memory_usage"),
            scrollLag: performanceMonitor.getAverageMetric("scroll_lag"),
        },
        clear: () => {
            performanceMonitor.clearMetrics();
            setMetrics([]);
        },
    };
};
