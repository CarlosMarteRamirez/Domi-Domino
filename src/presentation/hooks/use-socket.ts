"use client";

import * as React from "react";
import { io, type Socket } from "socket.io-client";
import {
  SOCKET_PATH,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@/shared/socket/contract";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Conexión Socket.io autenticada. Reintenta al reconectar y expone el socket
 * estable para suscribirse a eventos de sala.
 */
export function useSocket() {
  const [socket, setSocket] = React.useState<AppSocket | null>(null);
  const [connected, setConnected] = React.useState(false);
  const socketRef = React.useRef<AppSocket | null>(null);

  React.useEffect(() => {
    let active = true;

    (async () => {
      const res = await fetch("/api/realtime/token");
      if (!res.ok || !active) return;
      const { token } = (await res.json()) as { token: string };
      if (!active) return;

      const instance = io({
        path: SOCKET_PATH,
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      instance.on("connect", () => setConnected(true));
      instance.on("disconnect", () => setConnected(false));

      socketRef.current = instance;
      setSocket(instance);
    })();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket, connected, socketRef };
}
