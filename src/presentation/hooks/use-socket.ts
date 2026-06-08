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
 * Establishes an authenticated Socket.io connection. It first fetches a
 * short-lived signed token from the HTTP layer (which holds the Auth.js
 * session) and uses it on the handshake.
 */
export function useSocket() {
  const [socket, setSocket] = React.useState<AppSocket | null>(null);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let instance: AppSocket | null = null;

    (async () => {
      const res = await fetch("/api/realtime/token");
      if (!res.ok) return;
      const { token } = (await res.json()) as { token: string };
      if (!active) return;

      instance = io({ path: SOCKET_PATH, auth: { token }, transports: ["websocket", "polling"] });
      instance.on("connect", () => setConnected(true));
      instance.on("disconnect", () => setConnected(false));
      setSocket(instance);
    })();

    return () => {
      active = false;
      instance?.disconnect();
    };
  }, []);

  return { socket, connected };
}
