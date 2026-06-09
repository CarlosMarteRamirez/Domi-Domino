import type { Server } from "socket.io";
import { prisma } from "@/infrastructure/db/prisma/client";
import { DominoEngine, type EnginePlayer } from "@/domain/domino/engine/domino-engine";
import { teamOfSeat } from "@/domain/domino/rules/teams";
import type { MatchConfig, PlayerCount, Side } from "@/domain/domino/types";
import type {
  ClientToServerEvents,
  LobbyMember,
  LobbyState,
  MatchActionDto,
  ServerToClientEvents,
  SocketData,
} from "@/shared/socket/contract";
import { LOBBY_AUTO_START_MS, MATCH_ANIM_MS } from "@/shared/socket/contract";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  autoStartTimer: ReturnType<typeof setTimeout> | null;
  matchStartsAt: number | null;
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
      autoStartTimer: null,
      matchStartsAt: null,
    };
    if (runtime.config.maxPlayers === 2 && runtime.config.blockMode !== "individual") {
      runtime.config.blockMode = "individual";
    }
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
      matchStartsAt: room.matchStartsAt,
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

  private handDto(room: RoomRuntime, userId: string) {
    return {
      tiles: room.engine!.handTilesOf(userId),
      legalMoves: room.engine!.legalMovesOf(userId),
    };
  }

  private emitAction(room: RoomRuntime, action: MatchActionDto) {
    this.io.to(roomKey(room.code)).emit("match:action", action);
  }

  /** Envía estado público + mano privada en un solo evento por jugador. */
  private broadcastMatch(room: RoomRuntime) {
    if (!room.engine) return;
    const state = room.engine.snapshot();
    for (const member of room.members.values()) {
      this.io.to(userKey(member.userId)).emit("match:sync", {
        state,
        hand: this.handDto(room, member.userId),
      });
    }
  }

  /** Sincronización directa al socket que acaba de unirse (no depende del broadcast). */
  private emitPlayerSync(room: RoomRuntime, userId: string, socketId: string) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;
    socket.emit("room:state", this.lobbyState(room));
    if (room.status === "IN_GAME" && room.engine) {
      socket.emit("match:sync", {
        state: room.engine.snapshot(),
        hand: this.handDto(room, userId),
      });
    }
  }

  private async emitChatHistory(room: RoomRuntime, socketId: string) {
    const rows = await prisma.chatMessage.findMany({
      where: { roomId: room.roomId },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { username: true, displayName: true } } },
    });
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;
    socket.emit(
      "chat:history",
      [...rows].reverse().map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        displayName: m.user.displayName,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    );
  }

  private error(code: string, message: string, userId: string) {
    this.io.to(userKey(userId)).emit("room:error", { code, message });
  }

  join(code: string, user: { id: string; username: string }, socketId: string) {
    return this.runLocked(code, () => this.joinImpl(code, user, socketId));
  }

  private async joinImpl(
    code: string,
    user: { id: string; username: string },
    socketId: string,
  ) {
    const room = await this.hydrate(code);
    if (!room) return this.error("ROOM_NOT_FOUND", "La sala no existe", user.id);
    if (room.status === "FINISHED") {
      return this.error("ROOM_CLOSED", "Esta sala ya no está disponible", user.id);
    }

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
    // Sync directo al socket que se unió (evita perder eventos por timing).
    await this.emitChatHistory(room, socketId);
    this.emitPlayerSync(room, user.id, socketId);
    // Actualiza a los demás (presencia, lobby, etc.).
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

    const anyoneConnected = [...room.members.values()].some((m) => m.connections > 0);
    if (!anyoneConnected) {
      const reason =
        room.status === "IN_GAME"
          ? "La partida se canceló porque todos abandonaron la sala"
          : "La sala se cerró porque todos abandonaron";
      await this.closeRoom(room, reason);
      return;
    }

    this.broadcastLobby(room);
  }

  private canBeginMatch(room: RoomRuntime): boolean {
    if (room.status !== "LOBBY") return false;
    const members = [...room.members.values()];
    return (
      members.length === room.config.maxPlayers && members.every((m) => m.isReady)
    );
  }

  private clearAutoStart(room: RoomRuntime) {
    if (room.autoStartTimer) {
      clearTimeout(room.autoStartTimer);
      room.autoStartTimer = null;
    }
    room.matchStartsAt = null;
  }

  private syncAutoStart(room: RoomRuntime) {
    if (room.status !== "LOBBY") {
      this.clearAutoStart(room);
      return;
    }
    if (!this.canBeginMatch(room)) {
      const hadCountdown = room.matchStartsAt !== null || room.autoStartTimer !== null;
      this.clearAutoStart(room);
      if (hadCountdown) this.broadcastLobby(room);
      return;
    }
    if (room.autoStartTimer) return;

    room.matchStartsAt = Date.now() + LOBBY_AUTO_START_MS;
    room.autoStartTimer = setTimeout(() => {
      room.autoStartTimer = null;
      void this.runLocked(room.code, () => this.autoStartFireImpl(room.code));
    }, LOBBY_AUTO_START_MS);
    this.broadcastLobby(room);
  }

  private async autoStartFireImpl(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.matchStartsAt = null;
    if (!this.canBeginMatch(room)) {
      this.broadcastLobby(room);
      return;
    }
    await this.beginMatchImpl(room);
  }

  /** Cierra la sala: persiste FINISHED, limpia miembros y la saca del listado público. */
  private async closeRoom(room: RoomRuntime, reason: string) {
    this.clearAutoStart(room);
    room.status = "FINISHED";
    room.engine = null;
    await prisma.room.update({
      where: { id: room.roomId },
      data: { status: "FINISHED" },
    });
    await prisma.roomMember.deleteMany({ where: { roomId: room.roomId } });
    this.io.to(roomKey(room.code)).emit("room:closed", { reason });
    this.rooms.delete(room.code);
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
    this.syncAutoStart(room);
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
    if (patch.blockMode) {
      if (room.config.maxPlayers === 2 && patch.blockMode !== "individual") {
        return this.error(
          "INVALID_CONFIG",
          "Con 2 jugadores solo se permite tranque individual",
          userId,
        );
      }
      room.config.blockMode = patch.blockMode;
    }
    if (patch.passBonus !== undefined) room.config.passBonus = patch.passBonus as MatchConfig["passBonus"];
    if (patch.teamSelection) room.config.teamSelection = patch.teamSelection;
    if (patch.maxPlayers && room.members.size <= patch.maxPlayers) {
      room.config.maxPlayers = patch.maxPlayers;
      room.config.playerCount = patch.maxPlayers as PlayerCount;
      if (patch.maxPlayers === 2) room.config.blockMode = "individual";
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
    if (!this.canBeginMatch(room)) {
      const members = [...room.members.values()];
      if (members.length !== room.config.maxPlayers) {
        return this.error("NOT_FULL", "Faltan jugadores para iniciar", userId);
      }
      return this.error("NOT_READY", "Todos deben marcar Listo", userId);
    }
    await this.beginMatchImpl(room);
  }

  private async beginMatchImpl(room: RoomRuntime) {
    if (room.status !== "LOBBY" || !this.canBeginMatch(room)) return;
    this.clearAutoStart(room);

    const members = [...room.members.values()];
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
        if (counts[0] !== 2 || counts[1] !== 2) return;
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
    await this.dealAndSync(room);
  }

  playTile(code: string, userId: string, tile: string, side: Side) {
    return this.runLocked(code, () => this.playTileImpl(code, userId, tile, side));
  }

  private async playTileImpl(code: string, userId: string, tile: string, side: Side) {
    const room = this.rooms.get(code);
    if (!room?.engine) return;
    const result = room.engine.playTile(userId, tile, side);
    if (!result.ok) return this.error(result.error.code, result.error.message, userId);

    const member = room.members.get(userId);
    this.emitAction(room, {
      type: "play",
      playerId: userId,
      displayName: member?.displayName ?? "Jugador",
      tile,
      side,
    });
    await sleep(MATCH_ANIM_MS.play);
    await this.afterMove(room, result.value.events);
  }

  pass(code: string, userId: string) {
    return this.runLocked(code, () => this.passImpl(code, userId));
  }

  private async passImpl(code: string, userId: string) {
    const room = this.rooms.get(code);
    if (!room?.engine) return;

    this.emitAction(room, {
      type: "pass",
      playerId: userId,
      displayName: this.memberName(room, userId),
    });
    await sleep(MATCH_ANIM_MS.pass);

    const result = room.engine.pass(userId);
    if (!result.ok) return this.error(result.error.code, result.error.message, userId);
    await this.afterMove(room, result.value.events);
  }

  private memberName(room: RoomRuntime, userId: string) {
    return room.members.get(userId)?.displayName ?? "Jugador";
  }

  /** Reparte fichas con animación y sincroniza estado. */
  private async dealAndSync(room: RoomRuntime) {
    const roundIndex = room.engine!.snapshot().roundIndex;
    this.emitAction(room, { type: "deal", roundIndex });
    await sleep(MATCH_ANIM_MS.deal);
    this.broadcastMatch(room);
    await this.runAutoPassChain(room);
  }

  /** Pasa automáticamente si el jugador en turno no tiene jugadas legales. */
  private async runAutoPassChain(room: RoomRuntime) {
    const engine = room.engine;
    if (!engine) return;

    const snap = engine.snapshot();
    if (snap.finished || !snap.currentPlayerId) return;

    const currentId = snap.currentPlayerId;
    if (engine.legalMovesOf(currentId).length > 0) return;

    this.emitAction(room, {
      type: "pass",
      playerId: currentId,
      displayName: this.memberName(room, currentId),
    });
    await sleep(MATCH_ANIM_MS.pass);

    const result = engine.pass(currentId);
    if (!result.ok) return;
    await this.afterMove(room, result.value.events);
  }

  private async afterMove(
    room: RoomRuntime,
    events: { type: string; [k: string]: unknown }[],
  ): Promise<void> {
    const engine = room.engine!;
    let roundJustEnded = false;

    for (const ev of events) {
      if (ev.type === "passBonus") {
        this.emitAction(room, {
          type: "passBonus",
          playerId: ev.playerId as string,
          displayName: this.memberName(room, ev.playerId as string),
          teamIndex: ev.teamIndex as number,
          amount: ev.amount as number,
        });
        await sleep(MATCH_ANIM_MS.passBonus);
      }
      if (ev.type === "roundEnded") {
        roundJustEnded = true;
        await this.persistRound(room);
      }
    }

    if (engine.snapshot().finished) {
      await this.finishMatch(room);
      return;
    }

    if (roundJustEnded || !engine.currentRound || engine.currentRound.isFinished) {
      const last = engine.snapshot().lastRoundResult;
      if (last) {
        const message =
          last.winningTeam !== null
            ? `Equipo ${last.winningTeam + 1} suma ${last.points} puntos`
            : "Empate — nadie suma";
        this.emitAction(room, {
          type: "roundEnd",
          winningTeam: last.winningTeam,
          points: last.points,
          message,
        });
        await sleep(MATCH_ANIM_MS.roundEnd);
      }
      engine.startRound();
      await this.dealAndSync(room);
      return;
    }

    this.broadcastMatch(room);
    await this.runAutoPassChain(room);
  }

  private async persistRound(room: RoomRuntime) {
    const result = room.engine!.snapshot().lastRoundResult;
    if (!result || !room.matchDbId) return;
    const index = await prisma.matchRound.count({ where: { matchId: room.matchDbId } });
    await prisma.matchRound.create({
      data: { matchId: room.matchDbId, index, result: result as unknown as object },
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

    const winningTeam = state.winningTeam ?? -1;
    this.emitAction(room, { type: "matchEnd", winningTeam, teamScores: state.teamScores });
    await sleep(MATCH_ANIM_MS.matchEnd);
    this.io.to(roomKey(room.code)).emit("match:finished", {
      winningTeam,
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
