import { createContext, useContext, ReactNode } from "react";
import { useGetStoreSettings, getGetStoreSettingsQueryKey, StoreSettings } from "@workspace/api-client-react";

interface StoreSettingsContextType {
  settings: StoreSettings | undefined;
  isLoading: boolean;
  refetch: () => void;
}

const StoreSettingsContext = createContext<StoreSettingsContextType | undefined>(undefined);

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading, refetch } = useGetStoreSettings({
    query: { queryKey: getGetStoreSettingsQueryKey() },
  });

  return (
    <StoreSettingsContext.Provider value={{ settings, isLoading, refetch }}>
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  const context = useContext(StoreSettingsContext);
  if (!context) throw new Error("useStoreSettings must be used inside StoreSettingsProvider");
  return context;
}
