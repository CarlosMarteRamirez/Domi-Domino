import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/shared/socket/contract";
import { closeOrphanRoomsOnStartup } from "@/application/rooms";
import { verifySocketToken } from "@/infrastructure/realtime/token";
import { RoomManager } from "@/infrastructure/realtime/room-manager";

export type { SocketData };

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerGateway(io: AppServer, authSecret: string) {
  closeOrphanRoomsOnStartup().catch((err) =>
    console.error("Error cerrando salas huérfanas:", err),
  );
  const manager = new RoomManager(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const verified = token ? verifySocketToken(token, authSecret) : null;
    if (!verified) return next(new Error("UNAUTHORIZED"));
    socket.data.userId = verified.userId;
    socket.data.username = verified.username;
    socket.data.roomCode = null;
    next();
  });

  io.on("connection", (socket: AppSocket) => {
    const { userId } = socket.data;
    socket.join(`user:${userId}`);
    io.emit("presence:update", { userId, status: "online" });

    socket.on("room:join", async ({ code }) => {
      socket.data.roomCode = code;
      await socket.join(`room:${code}`);
      await manager.join(code, { id: userId, username: socket.data.username }, socket.id);
    });

    socket.on("room:leave", async ({ code }) => {
      socket.leave(`room:${code}`);
      socket.data.roomCode = null;
      await manager.disconnect(code, userId);
    });

    socket.on("room:ready", async ({ ready }) => {
      if (socket.data.roomCode) await manager.setReady(socket.data.roomCode, userId, ready);
    });

    socket.on("room:setTeam", async ({ team }) => {
      if (socket.data.roomCode) await manager.setTeam(socket.data.roomCode, userId, team);
    });

    socket.on("room:updateConfig", async (patch) => {
      if (socket.data.roomCode) await manager.updateConfig(socket.data.roomCode, userId, patch);
    });

    socket.on("match:start", async () => {
      if (socket.data.roomCode) await manager.startMatch(socket.data.roomCode, userId);
    });

    socket.on("match:playTile", async ({ tile, side }) => {
      if (socket.data.roomCode) await manager.playTile(socket.data.roomCode, userId, tile, side);
    });

    socket.on("match:pass", async () => {
      if (socket.data.roomCode) await manager.pass(socket.data.roomCode, userId);
    });

    socket.on("chat:send", async ({ content }) => {
      if (socket.data.roomCode) await manager.chat(socket.data.roomCode, { id: userId }, content);
    });

    socket.on("disconnect", async () => {
      if (socket.data.roomCode) await manager.disconnect(socket.data.roomCode, userId);
      const remaining = await io.in(`user:${userId}`).fetchSockets();
      if (remaining.length === 0) io.emit("presence:update", { userId, status: "offline" });
    });
  });

  return manager;
}
