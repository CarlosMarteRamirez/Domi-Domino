import type { Server } from "socket.io";
import { prisma } from "@/infrastructure/db/prisma/client";
import { DominoEngine, type EnginePlayer } from "@/domain/domino/engine/domino-engine";
import { teamOfSeat } from "@/domain/domino/rules/teams";
import type { MatchConfig, PlayerCount, Side } from "@/domain/domino/types";
import type {
  ClientToServerEvents,
  LobbyMember,
  LobbyState,
  ServerToClientEvents,
  SocketData,
} from "@/shared/socket/contract";

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface MemberRuntime {
  userId: string;
  username: string;
  displayName: string;
  image: string | null;
  seat: number;
  team: number;
  isReady: boolean;
  connections: number;
}

interface RoomRuntime {
  roomId: string;
  code: string;
  name: string;
  hostId: string;
  status: "LOBBY" | "IN_GAME" | "FINISHED";
  config: MatchConfig & { maxPlayers: number };
  members: Map<string, MemberRuntime>;
  engine: DominoEngine | null;
  matchDbId: string | null;
}

const roomKey = (code: string) => `room:${code}`;
const userKey = (userId: string) => `user:${userId}`;

/**
 * Authoritative, in-memory runtime for active rooms. Lobby state and the
 * DominoEngine live here so every mutation is validated server-side; only
 * durable data (room records, chat, match history, stats) hits the database.
 */
export class RoomManager {
  private rooms = new Map<string, RoomRuntime>();
  /** Per-room mutation lock: chains operations so joins/moves never race. */
  private locks = new Map<string, Promise<unknown>>();

  constructor(private readonly io: IO) {}

  /** Serialises all operations for a given room code. */
  private runLocked<T>(code: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(code) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.locks.set(
      code,
      next.catch(() => {}),
    );
    return next;
  }

  private async hydrate(code: string): Promise<RoomRuntime | null> {
    const cached = this.rooms.get(code);
    if (cached) return cached;

    const room = await prisma.room.findUnique({
      where: { code },
      include: {
        members: {
          include: { user: { select: { username: true, displayName: true, image: true } } },
          orderBy: { seat: "asc" },
        },
      },
    });
    if (!room) return null;

    const runtime: RoomRuntime = {
      roomId: room.id,
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      status: room.status,
      config: {
        targetScore: room.targetScore as MatchConfig["targetScore"],
        blockMode: room.blockMode,
        passBonus: room.passBonus as MatchConfig["passBonus"],
        teamSelection: room.teamSelection,
        playerCount: room.maxPlayers as PlayerCount,
        maxPlayers: room.maxPlayers,
      },
      members: new Map(
        room.members.map((m) => [
          m.userId,
          {
            userId: m.userId,
            username: m.user.username,
            displayName: m.user.displayName,
            image: m.user.image,
            seat: m.seat,
            team: m.team,
            isReady: m.isReady,
            connections: 0,
          },
        ]),
      ),
      engine: null,
      matchDbId: null,
    };
    this.rooms.set(code, runtime);
    return runtime;
  }

  private lobbyState(room: RoomRuntime): LobbyState {
    return {
      roomId: room.roomId,
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      status: room.status,
      config: {
        targetScore: room.config.targetScore,
        blockMode: room.config.blockMode,
        passBonus: room.config.passBonus,
        teamSelection: room.config.teamSelection,
        maxPlayers: room.config.maxPlayers,
      },
      members: [...room.members.values()]
        .sort((a, b) => a.seat - b.seat)
        .map<LobbyMember>((m) => ({
          userId: m.userId,
          username: m.username,
          displayName: m.displayName,
          image: m.image,
          seat: m.seat,
          team: m.team,
          isReady: m.isReady,
          isHost: m.userId === room.hostId,
          connected: m.connections > 0,
        })),
    };
  }

  private broadcastLobby(room: RoomRuntime) {
    this.io.to(roomKey(room.code)).emit("room:state", this.lobbyState(room));
  }

  private broadcastMatch(room: RoomRuntime) {
    if (!room.engine) return;
    const state = room.engine.snapshot();
    this.io.to(roomKey(room.code)).emit("match:state", state);
    for (const member of room.members.values()) {
      this.io.to(userKey(member.userId)).emit("match:yourHand", {
        tiles: room.engine.handTilesOf(member.userId),
        legalMoves: room.engine.legalMovesOf(member.userId),
      });
    }
  }

  private error(code: string, message: string, userId: string) {
    this.io.to(userKey(userId)).emit("room:error", { code, message });
  }

  join(code: string, user: { id: string; username: string }) {
    return this.runLocked(code, () => this.joinImpl(code, user));
  }

  private async joinImpl(code: string, user: { id: string; username: string }) {
    const room = await this.hydrate(code);
    if (!room) return this.error("ROOM_NOT_FOUND", "La sala no existe", user.id);

    let member = room.members.get(user.id);
    if (!member) {
      if (room.status !== "LOBBY")
        return this.error("ROOM_LOCKED", "La partida ya comenzo", user.id);
      if (room.members.size >= room.config.maxPlayers)
        return this.error("ROOM_FULL", "La sala esta llena", user.id);

      const usedSeats = new Set([...room.members.values()].map((m) => m.seat));
      let seat = 0;
      while (usedSeats.has(seat)) seat++;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { username: true, displayName: true, image: true },
      });
      const team = teamOfSeat(seat, room.config.maxPlayers as PlayerCount);
      await prisma.roomMember.create({
        data: { roomId: room.roomId, userId: user.id, seat, team },
      });
      member = {
        userId: user.id,
        username: dbUser?.username ?? user.username,
        displayName: dbUser?.displayName ?? user.username,
        image: dbUser?.image ?? null,
        seat,
        team,
        isReady: false,
        connections: 0,
      };
      room.members.set(user.id, member);
    }
    member.connections += 1;
    this.broadcastLobby(room);
    if (room.status === "IN_GAME") this.broadcastMatch(room);
  }

  disconnect(code: string, userId: string) {
    return this.runLocked(code, () => this.disconnectImpl(code, userId));
  }

  private async disconnectImpl(code: string, userId: string) {
    const room = this.rooms.get(code);
    const member = room?.members.get(userId);
    if (!room || !member) return;
    member.connections = Math.max(0, member.connections - 1);
    this.broadcastLobby(room);
  }

  setReady(code: string, userId: string, ready: boolean) {
    return this.runLocked(code, () => this.setReadyImpl(code, userId, ready));
  }

  private async setReadyImpl(code: string, userId: string, ready: boolean) {
    const room = this.rooms.get(code);
    const member = room?.members.get(userId);
    if (!room || !member) return;
    member.isReady = ready;
    await prisma.roomMember.updateMany({
      where: { roomId: room.roomId, userId },
      data: { isReady: ready },
    });
    this.broadcastLobby(room);
  }

  setTeam(code: string, userId: string, team: number) {
    return this.runLocked(code, () => this.setTeamImpl(code, userId, team));
  }

  private async setTeamImpl(code: string, userId: string, team: number) {
    const room = this.rooms.get(code);
    const member = room?.members.get(userId);
    if (!room || !member) return;
    if (room.config.teamSelection !== "manual")
      return this.error("TEAMS_AUTO", "Los equipos son automaticos", userId);
    if (team !== 0 && team !== 1) return;
    member.team = team;
    await prisma.roomMember.updateMany({
      where: { roomId: room.roomId, userId },
      data: { team },
    });
    this.broadcastLobby(room);
  }

  updateConfig(
    code: string,
    userId: string,
    patch: Partial<{
      targetScore: number;
      blockMode: "individual" | "parejas";
      passBonus: number;
      teamSelection: "manual" | "auto";
      maxPlayers: number;
    }>,
  ) {
    return this.runLocked(code, () => this.updateConfigImpl(code, userId, patch));
  }

  private async updateConfigImpl(
    code: string,
    userId: string,
    patch: Partial<{
      targetScore: number;
      blockMode: "individual" | "parejas";
      passBonus: number;
      teamSelection: "manual" | "auto";
      maxPlayers: number;
    }>,
  ) {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.hostId !== userId)
      return this.error("NOT_HOST", "Solo el anfitrion puede cambiar la config", userId);
    if (room.status !== "LOBBY") return;

    if (patch.targetScore) room.config.targetScore = patch.targetScore as MatchConfig["targetScore"];
    if (patch.blockMode) room.config.blockMode = patch.blockMode;
    if (patch.passBonus !== undefined) room.config.passBonus = patch.passBonus as MatchConfig["passBonus"];
    if (patch.teamSelection) room.config.teamSelection = patch.teamSelection;
    if (patch.maxPlayers && room.members.size <= patch.maxPlayers) {
      room.config.maxPlayers = patch.maxPlayers;
      room.config.playerCount = patch.maxPlayers as PlayerCount;
    }

    await prisma.room.update({
      where: { id: room.roomId },
      data: {
        targetScore: room.config.targetScore,
        blockMode: room.config.blockMode,
        passBonus: room.config.passBonus,
        teamSelection: room.config.teamSelection,
        maxPlayers: room.config.maxPlayers,
      },
    });
    this.broadcastLobby(room);
  }

  startMatch(code: string, userId: string) {
    return this.runLocked(code, () => this.startMatchImpl(code, userId));
  }

  private async startMatchImpl(code: string, userId: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.hostId !== userId)
      return this.error("NOT_HOST", "Solo el anfitrion puede iniciar", userId);
    if (room.status !== "LOBBY") return;

    const members = [...room.members.values()];
    if (members.length !== room.config.maxPlayers)
      return this.error("NOT_FULL", "Faltan jugadores para iniciar", userId);
    if (!members.every((m) => m.isReady))
      return this.error("NOT_READY", "Todos deben marcar Listo", userId);

    let players: EnginePlayer[];
    if (room.config.teamSelection === "auto") {
      players = members
        .sort((a, b) => a.seat - b.seat)
        .map((m) => ({
          id: m.userId,
          seat: m.seat,
          teamIndex: teamOfSeat(m.seat, room.config.maxPlayers as PlayerCount),
        }));
    } else {
      players = members.map((m) => ({ id: m.userId, seat: m.seat, teamIndex: m.team }));
      if (room.config.maxPlayers === 4) {
        const counts = [0, 0];
        players.forEach((p) => (counts[p.teamIndex] += 1));
        if (counts[0] !== 2 || counts[1] !== 2)
          return this.error("UNBALANCED", "Equipos deben tener 2 jugadores cada uno", userId);
      }
    }

    const config: MatchConfig = {
      targetScore: room.config.targetScore,
      blockMode: room.config.blockMode,
      passBonus: room.config.passBonus,
      teamSelection: room.config.teamSelection,
      playerCount: room.config.maxPlayers as PlayerCount,
    };
    const seed = Math.floor(Math.random() * 2 ** 31);
    room.engine = new DominoEngine(players, config, seed);

    const match = await prisma.match.create({
      data: {
        roomId: room.roomId,
        config: config as unknown as object,
        participants: {
          create: players.map((p) => ({ userId: p.id, team: p.teamIndex })),
        },
      },
    });
    room.matchDbId = match.id;
    room.status = "IN_GAME";
    await prisma.room.update({ where: { id: room.roomId }, data: { status: "IN_GAME" } });

    room.engine.startRound();
    this.broadcastLobby(room);
    this.broadcastMatch(room);
  }

  playTile(code: string, userId: string, tile: string, side: Side) {
    return this.runLocked(code, () => this.playTileImpl(code, userId, tile, side));
  }

  private async playTileImpl(code: string, userId: string, tile: string, side: Side) {
    const room = this.rooms.get(code);
    if (!room?.engine) return;
    const result = room.engine.playTile(userId, tile, side);
    if (!result.ok) return this.error(result.error.code, result.error.message, userId);
    await this.afterMove(room, result.value.events);
  }

  pass(code: string, userId: string) {
    return this.runLocked(code, () => this.passImpl(code, userId));
  }

  private async passImpl(code: string, userId: string) {
    const room = this.rooms.get(code);
    if (!room?.engine) return;
    const result = room.engine.pass(userId);
    if (!result.ok) return this.error(result.error.code, result.error.message, userId);
    await this.afterMove(room, result.value.events);
  }

  private async afterMove(
    room: RoomRuntime,
    events: { type: string; [k: string]: unknown }[],
  ) {
    const engine = room.engine!;
    for (const ev of events) {
      if (ev.type === "passBonus") {
        this.io.to(roomKey(room.code)).emit("match:event", {
          type: "passBonus",
          message: `Bono de pase completo (+${ev.amount}) para el equipo ${(ev.teamIndex as number) + 1}`,
        });
      }
      if (ev.type === "roundEnded") {
        await this.persistRound(room);
      }
    }

    const finished = engine.snapshot().finished;
    if (finished) {
      await this.finishMatch(room);
      return;
    }

    // If a round just ended but the match continues, deal the next round.
    if (!engine.currentRound || engine.currentRound.isFinished) {
      engine.startRound();
    }
    this.broadcastMatch(room);
  }

  private async persistRound(room: RoomRuntime) {
    const result = room.engine!.snapshot().lastRoundResult;
    if (!result || !room.matchDbId) return;
    const index = await prisma.matchRound.count({ where: { matchId: room.matchDbId } });
    await prisma.matchRound.create({
      data: { matchId: room.matchDbId, index, result: result as unknown as object },
    });
    this.io.to(roomKey(room.code)).emit("match:event", {
      type: "roundEnded",
      message:
        result.winningTeam !== null
          ? `Fin de ronda: equipo ${result.winningTeam + 1} suma ${result.points} puntos`
          : "Fin de ronda: empate, nadie suma",
    });
  }

  private async finishMatch(room: RoomRuntime) {
    const state = room.engine!.snapshot();
    room.status = "FINISHED";

    if (room.matchDbId) {
      await prisma.match.update({
        where: { id: room.matchDbId },
        data: { winnerTeam: state.winningTeam, endedAt: new Date() },
      });
      for (const member of room.members.values()) {
        const player = state.players.find((p) => p.id === member.userId);
        const team = player?.teamIndex ?? member.team;
        await prisma.matchParticipant.updateMany({
          where: { matchId: room.matchDbId, userId: member.userId },
          data: { finalScore: state.teamScores[team] ?? 0 },
        });
        const won = state.winningTeam === team;
        await prisma.userStats.upsert({
          where: { userId: member.userId },
          create: {
            userId: member.userId,
            gamesPlayed: 1,
            gamesWon: won ? 1 : 0,
            totalPoints: state.teamScores[team] ?? 0,
          },
          update: {
            gamesPlayed: { increment: 1 },
            gamesWon: { increment: won ? 1 : 0 },
            totalPoints: { increment: state.teamScores[team] ?? 0 },
          },
        });
      }
    }

    await prisma.room.update({ where: { id: room.roomId }, data: { status: "FINISHED" } });
    this.broadcastMatch(room);
    this.io.to(roomKey(room.code)).emit("match:finished", {
      winningTeam: state.winningTeam ?? -1,
      teamScores: state.teamScores,
    });
  }

  chat(code: string, user: { id: string }, content: string) {
    return this.runLocked(code, () => this.chatImpl(code, user, content));
  }

  private async chatImpl(code: string, user: { id: string }, content: string) {
    const room = this.rooms.get(code);
    const member = room?.members.get(user.id);
    if (!room || !member) return;
    const trimmed = content.trim().slice(0, 500);
    if (!trimmed) return;

    const message = await prisma.chatMessage.create({
      data: { roomId: room.roomId, userId: user.id, content: trimmed },
    });
    this.io.to(roomKey(room.code)).emit("chat:message", {
      id: message.id,
      userId: user.id,
      username: member.username,
      displayName: member.displayName,
      content: trimmed,
      createdAt: message.createdAt.toISOString(),
    });
  }
}
