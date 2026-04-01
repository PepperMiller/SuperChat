"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useUser } from "@/hooks/useUser";

interface AppContextValue {
  userId: string | null;
  userName: string | null;
  userLoading: boolean;
  register: (name: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { userId, userName, loading, register } = useUser();

  return (
    <AppContext.Provider
      value={{
        userId,
        userName,
        userLoading: loading,
        register,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
