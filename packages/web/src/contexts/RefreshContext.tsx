import { createContext, useContext, useState, useCallback } from "react";

interface RefreshContextValue {
  refreshKey: number;
  refresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  refreshKey: 0,
  refresh: () => {},
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <RefreshContext.Provider value={{ refreshKey, refresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefreshKey(): number {
  return useContext(RefreshContext).refreshKey;
}

export function useRefresh(): () => void {
  return useContext(RefreshContext).refresh;
}
