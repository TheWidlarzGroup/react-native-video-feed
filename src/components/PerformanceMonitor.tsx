import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
} from "react-native";
import {
    usePerformanceMetrics,
    performanceMonitor,
    PERFORMANCE_MONITOR_ENABLED,
} from "../utils/performance";
import { useMetrics } from "../contexts/MetricsContext";

const PerformanceMonitor = () => {
    if (!PERFORMANCE_MONITOR_ENABLED) return null;

    const { metricsOpen, setMetricsOpen } = useMetrics();
    const { metrics, summary, clear } = usePerformanceMetrics();

    const handleExport = () => {
        const json = performanceMonitor.exportMetrics();
        console.log("Performance Metrics:", json);
    };

    if (!metricsOpen) {
        return null;
    }

    const formatValue = (value: number | null, unit: string = "ms") => {
        if (value === null) return "N/A";
        return `${value.toFixed(2)}${unit}`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Performance Metrics</Text>
            </View>
            <View style={styles.buttons}>
                <TouchableOpacity style={styles.button} onPress={clear}>
                    <Text style={styles.buttonText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => setMetricsOpen(false)}
                >
                    <Text style={styles.buttonText}>Hide</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleExport}>
                    <Text style={styles.buttonText}>Export</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Summary (Average)</Text>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>TTFF (load):</Text>
                        <Text style={styles.metricValue}>
                            {formatValue(summary.ttff)}
                        </Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>
                            Perceived TTFF (visible→ready):
                        </Text>
                        <Text style={styles.metricValue}>
                            {formatValue(summary.perceivedTtff)}
                        </Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>FPS Stability:</Text>
                        <Text style={styles.metricValue}>
                            {formatValue(summary.fpsStability, " fps")}
                        </Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Scroll Lag:</Text>
                        <Text style={styles.metricValue}>
                            {formatValue(summary.scrollLag)}
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        All Metrics ({metrics.length})
                    </Text>
                    {metrics
                        .slice(-20)
                        .reverse()
                        .map((metric, idx) => (
                            <View key={idx} style={styles.metricItem}>
                                <Text style={styles.metricName}>
                                    {metric.name}
                                </Text>
                                <Text style={styles.metricValue}>
                                    {metric.name === "fps_stability"
                                        ? `${metric.value.toFixed(2)} fps`
                                        : `${metric.value.toFixed(2)}ms`}
                                </Text>
                            </View>
                        ))}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 52,
        right: 14,
        width: 300,
        maxHeight: 400,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        borderRadius: 8,
        padding: 12,
        zIndex: 9999,
    },
    header: {
        marginBottom: 8,
    },
    title: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    buttons: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 12,
    },
    button: {
        backgroundColor: "rgba(255,255,255,0.15)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
    },
    buttonText: {
        color: "#fff",
        fontSize: 12,
    },
    content: {
        maxHeight: 320,
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
    },
    metricRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    metricLabel: {
        color: "#ccc",
        fontSize: 12,
        flex: 1,
    },
    metricValue: {
        color: "#0f0",
        fontSize: 12,
        fontWeight: "600",
    },
    metricItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
    },
    metricName: {
        color: "#aaa",
        fontSize: 11,
        flex: 1,
    },
});

export default PerformanceMonitor;
