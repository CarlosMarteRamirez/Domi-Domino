/**
 * End-to-end live test against a running server + Postgres.
 *
 * Connects four authenticated Socket.io clients, creates a room, marks everyone
 * ready, starts the match and auto-plays a full game by always making the first
 * legal move (or passing). Verifies that the server drives the match to
 * completion and emits `match:finished`, and that chat round-trips.
 *
 * Run via the wrapper shell command (server must be listening on PORT).
 */
import { io, type Socket } from "socket.io-client";
import { prisma } from "../../src/infrastructure/db/prisma/client";
import { createRoom } from "../../src/application/rooms";
import { issueSocketToken } from "../../src/infrastructure/realtime/token";
import { SOCKET_PATH } from "../../src/shared/socket/contract";

const PORT = process.env.PORT ?? "3007";
const URL = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.AUTH_SECRET!;

function connect(token: string): Socket {
  return io(URL, { path: SOCKET_PATH, auth: { token }, transports: ["websocket", "polling"] });
}

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: ["ana@example.com", "beto@example.com", "carla@example.com", "dario@example.com"] } },
    orderBy: { username: "asc" },
  });
  if (users.length < 4) throw new Error("Faltan usuarios sembrados");

  const room = await createRoom(users[0].id, {
    name: "E2E Test Room",
    visibility: "PUBLIC",
    maxPlayers: 4,
    targetScore: 100,
    blockMode: "parejas",
    passBonus: 25,
    teamSelection: "auto",
  });
  console.log(`[e2e] sala creada code=${room.code}`);

  const sockets = users.map((u) =>
    connect(issueSocketToken({ userId: u.id, username: u.username }, SECRET)),
  );

  const latestState = new Map<string, any>();
  const latestHand = new Map<string, any>();
  const actedKeys = new Map<string, Set<string>>();
  let finished = false;
  let chatOk = false;
  let winningTeam = -1;

  const idOf = (s: Socket) => users[sockets.indexOf(s)].id;

  function maybeAct(s: Socket) {
    const myId = idOf(s);
    const state = latestState.get(myId);
    const hand = latestHand.get(myId);
    if (!state || finished) return;
    if (state.currentPlayerId !== myId) return;
    const key = `${state.roundIndex}:${state.board.tiles.length}:${state.passesInARow}`;
    const seen = actedKeys.get(myId) ?? new Set<string>();
    if (seen.has(key)) return;
    seen.add(key);
    actedKeys.set(myId, seen);

    setTimeout(() => {
      if (finished) return;
      const moves = hand?.legalMoves ?? [];
      if (moves.length > 0) s.emit("match:playTile", { tile: moves[0].tile, side: moves[0].sides[0] });
      else s.emit("match:pass");
    }, 15);
  }

  sockets.forEach((s) => {
    const myId = idOf(s);
    s.on("connect", () => s.emit("room:join", { code: room.code }));
    s.on("room:error", (e: any) => console.log(`[e2e] room:error (${users[sockets.indexOf(s)].username}):`, e));
    s.on("match:sync", ({ state, hand }: { state: any; hand: any }) => {
      latestState.set(myId, state);
      latestHand.set(myId, hand);
      maybeAct(s);
    });
    s.on("match:finished", (p: any) => {
      if (!finished) {
        finished = true;
        winningTeam = p.winningTeam;
        console.log(`[e2e] match:finished winningTeam=${p.winningTeam} scores=${JSON.stringify(p.teamScores)}`);
      }
    });
    s.on("chat:message", (m: any) => {
      if (m.content === "GG!") chatOk = true;
    });
  });

  // Wait for everyone to be in the lobby, then ready up and start.
  await delay(1500);
  sockets.forEach((s) => s.emit("room:ready", { ready: true }));
  await delay(3500);
  sockets[0].emit("chat:send", { content: "GG!" });
  await delay(300);

  // Let the match play out.
  const deadline = Date.now() + 120_000;
  while (!finished && Date.now() < deadline) await delay(250);

  sockets.forEach((s) => s.disconnect());

  const matchCount = await prisma.match.count({ where: { roomId: room.id, endedAt: { not: null } } });
  const roundCount = await prisma.matchRound.count();
  console.log(`[e2e] persistido: matches finalizados=${matchCount}, rondas=${roundCount}, chatOk=${chatOk}`);

  if (!finished) throw new Error("La partida no terminó dentro del tiempo límite");
  if (winningTeam !== 0 && winningTeam !== 1) throw new Error("Equipo ganador inválido");
  if (matchCount < 1) throw new Error("El match no se persistió como finalizado");
  if (!chatOk) throw new Error("El chat no se propagó");

  console.log("[e2e] OK: partida completa jugada y persistida end-to-end ✔");
  await prisma.$disconnect();
  process.exit(0);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

main().catch(async (e) => {
  console.error("[e2e] FALLO:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
