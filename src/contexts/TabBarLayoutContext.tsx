import React, {
    createContext,
    useCallback,
    useContext,
    useState,
} from "react";

interface TabBarLayoutContextValue {
    tabBarHeight: number | null;
    setTabBarHeight: (height: number) => void;
}

const TabBarLayoutContext = createContext<TabBarLayoutContextValue>({
    tabBarHeight: null,
    setTabBarHeight: () => {},
});

export const useTabBarLayout = () => useContext(TabBarLayoutContext);

export const TabBarLayoutProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [tabBarHeight, setTabBarHeightState] = useState<number | null>(null);
    const setTabBarHeight = useCallback((height: number) => {
        setTabBarHeightState((prev) => (prev === height ? prev : height));
    }, []);

    return (
        <TabBarLayoutContext.Provider
            value={{ tabBarHeight, setTabBarHeight }}
        >
            {children}
        </TabBarLayoutContext.Provider>
    );
};
