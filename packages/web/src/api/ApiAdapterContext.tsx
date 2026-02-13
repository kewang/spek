import { createContext, useContext } from "react";
import type { ApiAdapter } from "./types.js";

const ApiAdapterContext = createContext<ApiAdapter | null>(null);

export function ApiAdapterProvider({
  adapter,
  children,
}: {
  adapter: ApiAdapter;
  children: React.ReactNode;
}) {
  return (
    <ApiAdapterContext.Provider value={adapter}>
      {children}
    </ApiAdapterContext.Provider>
  );
}

export function useApiAdapter(): ApiAdapter {
  const adapter = useContext(ApiAdapterContext);
  if (!adapter) {
    throw new Error("useApiAdapter must be used within ApiAdapterProvider");
  }
  return adapter;
}
