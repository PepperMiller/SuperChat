"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { WSClientMessage, WSServerMessage } from "@superchat/shared";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

export function useWebSocket(userId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Set<(msg: WSServerMessage) => void>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`${WS_URL}?userId=${userId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 2000);
    };

    ws.onmessage = (event) => {
      const msg: WSServerMessage = JSON.parse(event.data);
      listenersRef.current.forEach((cb) => cb(msg));
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [userId]);

  const send = useCallback((msg: WSClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const subscribe = useCallback(
    (cb: (msg: WSServerMessage) => void) => {
      listenersRef.current.add(cb);
      return () => {
        listenersRef.current.delete(cb);
      };
    },
    []
  );

  return { connected, send, subscribe };
}
