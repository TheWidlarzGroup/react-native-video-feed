import React, { createContext, useContext, useState } from "react";

interface MetricsContextValue {
    metricsOpen: boolean;
    openMetrics: () => void;
    toggleMetrics: () => void;
    setMetricsOpen: (open: boolean) => void;
}

const MetricsContext = createContext<MetricsContextValue>({
    metricsOpen: false,
    openMetrics: () => {},
    toggleMetrics: () => {},
    setMetricsOpen: () => {},
});

export const useMetrics = () => useContext(MetricsContext);

export const MetricsProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [metricsOpen, setMetricsOpen] = useState(false);
    const openMetrics = () => setMetricsOpen(true);
    const toggleMetrics = () => setMetricsOpen((prev) => !prev);
    return (
        <MetricsContext.Provider
            value={{ metricsOpen, openMetrics, toggleMetrics, setMetricsOpen }}
        >
            {children}
        </MetricsContext.Provider>
    );
};
