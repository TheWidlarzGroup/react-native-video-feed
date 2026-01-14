export const PERFORMANCE_MONITOR_ENABLED = __DEV__;

type MetricName = "video_load_time" | "preload_effectiveness";

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
        this.metrics.push({
            name,
            value,
            timestamp: Date.now(),
            metadata,
        });

        if (__DEV__) {
            console.log(
                `[Performance] ${name}: ${value.toFixed(2)}ms`,
                metadata
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
                    video_load_time: this.getAverageMetric("video_load_time"),
                    preload_effectiveness: this.getAverageMetric(
                        "preload_effectiveness"
                    ),
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
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return {
        metrics,
        summary: {
            videoLoadTime:
                performanceMonitor.getAverageMetric("video_load_time"),
            preloadEffectiveness: performanceMonitor.getAverageMetric(
                "preload_effectiveness"
            ),
        },
        clear: () => {
            performanceMonitor.clearMetrics();
            setMetrics([]);
        },
    };
};
