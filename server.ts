import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { parse } from "node:url";

import { registerGateway, type SocketData } from "@/presentation/socket/gateway";
import { SOCKET_PATH } from "@/shared/socket/contract";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/shared/socket/contract";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
/** Bind address. Use 0.0.0.0 to accept connections from other devices on your LAN/WAN. */
const host = process.env.HOST ?? "0.0.0.0";
const publicUrl = process.env.AUTH_URL ?? `http://localhost:${port}`;
const authSecret = process.env.AUTH_SECRET;

if (!authSecret) {
  throw new Error("AUTH_SECRET is required to start the server");
}

async function main() {
  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url ?? "/", true));
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      path: SOCKET_PATH,
      cors: { origin: publicUrl },
    },
  );

  registerGateway(io, authSecret!);

  httpServer.listen(port, host, () => {
    console.log(`> Domino ready`);
    console.log(`  Local:   http://localhost:${port}`);
    console.log(`  Public:  ${publicUrl}`);
    console.log(`  Socket:  ${SOCKET_PATH} (listening on ${host}:${port})`);
  });
}

main().catch((error) => {
  console.error("Fatal server error", error);
  process.exit(1);
});
