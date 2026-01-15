import React, { useState } from "react";
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

const PerformanceMonitor = () => {
    if (!PERFORMANCE_MONITOR_ENABLED) return null;

    const [isVisible, setIsVisible] = useState(false);
    const { metrics, summary, clear } = usePerformanceMetrics();

    const handleExport = () => {
        performanceMonitor.exportMetrics();
    };

    if (!isVisible) {
        return (
            <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setIsVisible(true)}
            >
                <Text style={styles.toggleButtonText}>📊</Text>
            </TouchableOpacity>
        );
    }

    const formatValue = (value: number | null) => {
        if (value === null) return "N/A";
        return `${value.toFixed(2)}ms`;
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
                    onPress={() => setIsVisible(false)}
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
                        <Text style={styles.metricLabel}>Video Load Time:</Text>
                        <Text style={styles.metricValue}>
                            {formatValue(summary.videoLoadTime)}
                        </Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>
                            Preload Effectiveness:
                        </Text>
                        <Text style={styles.metricValue}>
                            {formatValue(summary.preloadEffectiveness)}
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
                                    {metric.value.toFixed(2)}ms
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
        top: 100,
        right: 10,
        width: 300,
        maxHeight: 400,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        borderRadius: 8,
        padding: 12,
        zIndex: 9999,
    },
    toggleButton: {
        position: "absolute",
        top: 100,
        right: 10,
        width: 40,
        height: 40,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
    },
    toggleButtonText: {
        fontSize: 20,
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
        backgroundColor: "#007AFF",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
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
