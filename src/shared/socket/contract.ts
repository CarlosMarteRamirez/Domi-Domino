import type { MatchState } from "@/domain/domino/engine/domino-engine";
import type { Side } from "@/domain/domino/types";

export type PresenceStatus = "online" | "available" | "playing" | "offline";

export interface LobbyMember {
  userId: string;
  username: string;
  displayName: string;
  image: string | null;
  seat: number;
  team: number;
  isReady: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface RoomConfigDto {
  targetScore: number;
  blockMode: "individual" | "parejas";
  passBonus: number;
  teamSelection: "manual" | "auto";
  maxPlayers: number;
}

export interface LobbyState {
  roomId: string;
  code: string;
  name: string;
  hostId: string;
  status: "LOBBY" | "IN_GAME" | "FINISHED";
  config: RoomConfigDto;
  members: LobbyMember[];
}

export interface ChatMessageDto {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  content: string;
  createdAt: string;
}

/** Events emitted by the client to the server. */
export interface ClientToServerEvents {
  "room:join": (payload: { code: string }) => void;
  "room:leave": (payload: { code: string }) => void;
  "room:ready": (payload: { ready: boolean }) => void;
  "room:setTeam": (payload: { team: number }) => void;
  "room:updateConfig": (payload: Partial<RoomConfigDto>) => void;
  "match:start": () => void;
  "match:playTile": (payload: { tile: string; side: Side }) => void;
  "match:pass": () => void;
  "chat:send": (payload: { content: string }) => void;
}

export interface MatchHandDto {
  tiles: string[];
  legalMoves: { tile: string; sides: Side[] }[];
}

/** Estado de partida + mano privada en un solo evento (evita desincronización). */
export interface MatchSyncDto {
  state: MatchState;
  hand: MatchHandDto;
}

export type MatchActionDto =
  | { type: "play"; playerId: string; displayName: string; tile: string; side: Side }
  | { type: "pass"; playerId: string; displayName: string }
  | {
      type: "passBonus";
      playerId: string;
      displayName: string;
      teamIndex: number;
      amount: number;
    }
  | { type: "deal"; roundIndex: number }
  | {
      type: "roundEnd";
      winningTeam: number | null;
      points: number;
      message: string;
    }
  | { type: "matchEnd"; winningTeam: number; teamScores: Record<number, number> };

/** Duración de animaciones en cliente (debe coincidir con el servidor). */
export const MATCH_ANIM_MS = {
  play: 700,
  pass: 1800,
  passBonus: 2200,
  deal: 2800,
  roundEnd: 1400,
  matchEnd: 2500,
} as const;

/** Events emitted by the server to clients. */
export interface ServerToClientEvents {
  "room:state": (state: LobbyState) => void;
  "room:closed": (payload: { reason: string }) => void;
  "room:error": (payload: { code: string; message: string }) => void;
  "presence:update": (payload: { userId: string; status: PresenceStatus }) => void;
  /** @deprecated Usar match:sync; se mantiene por compatibilidad interna. */
  "match:state": (state: MatchState) => void;
  /** @deprecated Usar match:sync. */
  "match:yourHand": (payload: MatchHandDto) => void;
  "match:sync": (payload: MatchSyncDto) => void;
  "match:action": (action: MatchActionDto) => void;
  "match:event": (payload: { type: string; message: string }) => void;
  "match:finished": (payload: { winningTeam: number; teamScores: Record<number, number> }) => void;
  "chat:message": (message: ChatMessageDto) => void;
  "chat:history": (messages: ChatMessageDto[]) => void;
}

/** Per-connection server-side data attached during the handshake. */
export interface SocketData {
  userId: string;
  username: string;
  roomCode: string | null;
}

export const SOCKET_PATH = "/api/socket";
