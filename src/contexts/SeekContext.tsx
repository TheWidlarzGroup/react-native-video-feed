import React, {
    createContext,
    useCallback,
    useContext,
    useState,
} from "react";

interface SeekContextValue {
    seeking: boolean;
    setSeeking: (value: boolean) => void;
}

const SeekContext = createContext<SeekContextValue>({
    seeking: false,
    setSeeking: () => {},
});

export const useSeek = () => useContext(SeekContext);

export const SeekProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [seeking, setSeekingState] = useState(false);
    const setSeeking = useCallback((value: boolean) => {
        setSeekingState((prev) => (prev === value ? prev : value));
    }, []);

    return (
        <SeekContext.Provider value={{ seeking, setSeeking }}>
            {children}
        </SeekContext.Provider>
    );
};
