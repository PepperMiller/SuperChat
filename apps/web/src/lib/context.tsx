"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useUser } from "@/hooks/useUser";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { WSClientMessage, WSServerMessage } from "@superchat/shared";

interface AppContextValue {
  userId: string | null;
  userName: string | null;
  userLoading: boolean;
  register: (name: string) => Promise<void>;
  wsConnected: boolean;
  wsSend: (msg: WSClientMessage) => void;
  wsSubscribe: (cb: (msg: WSServerMessage) => void) => () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { userId, userName, loading, register } = useUser();
  const { connected, send, subscribe } = useWebSocket(userId);

  return (
    <AppContext.Provider
      value={{
        userId,
        userName,
        userLoading: loading,
        register,
        wsConnected: connected,
        wsSend: send,
        wsSubscribe: subscribe,
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
