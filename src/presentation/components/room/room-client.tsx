"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useSocket } from "@/presentation/hooks/use-socket";
import { LobbyView } from "./lobby-view";
import { GameView } from "./game-view";
import { ChatPanel } from "./chat-panel";
import { MatchResultsOverlay } from "./match-results-overlay";
import { Button } from "@/presentation/components/ui/button";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import type { Side } from "@/domain/domino/types";
import type {
  ChatMessageDto,
  LobbyState,
  MatchActionDto,
  MatchHandDto,
  RoomConfigDto,
} from "@/shared/socket/contract";
import { MATCH_ANIM_MS } from "@/shared/socket/contract";

interface Props {
  code: string;
  currentUserId: string;
}

function actionDuration(action: MatchActionDto): number {
  switch (action.type) {
    case "play":
      return MATCH_ANIM_MS.play;
    case "pass":
      return MATCH_ANIM_MS.pass;
    case "deal":
      return MATCH_ANIM_MS.deal;
    case "roundEnd":
      return MATCH_ANIM_MS.roundEnd;
    case "matchEnd":
      return MATCH_ANIM_MS.matchEnd;
    default:
      return 0;
  }
}

export function RoomClient({ code, currentUserId }: Props) {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const [lobby, setLobby] = React.useState<LobbyState | null>(null);
  const [match, setMatch] = React.useState<MatchState | null>(null);
  const [hand, setHand] = React.useState<MatchHandDto>({ tiles: [], legalMoves: [] });
  const [messages, setMessages] = React.useState<ChatMessageDto[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [matchAction, setMatchAction] = React.useState<MatchActionDto | null>(null);
  const [matchResults, setMatchResults] = React.useState<{
    winningTeam: number;
    teamScores: Record<number, number>;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const joinedRef = React.useRef(false);
  const actionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyMatchSync = React.useCallback((state: MatchState, nextHand: MatchHandDto) => {
    setMatch(state);
    setHand(nextHand);
  }, []);

  const scheduleActionClear = React.useCallback((action: MatchActionDto) => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => setMatchAction(null), actionDuration(action));
  }, []);

  const joinRoom = React.useCallback(() => {
    if (!socket || joinedRef.current) return;
    socket.emit("room:join", { code });
    joinedRef.current = true;
  }, [socket, code]);

  React.useEffect(() => {
    if (!socket) return;

    const onRoomState = (state: LobbyState) => setLobby(state);

    const onMatchSync = ({ state, hand: nextHand }: { state: MatchState; hand: MatchHandDto }) => {
      applyMatchSync(state, nextHand);
    };

    const onMatchAction = (action: MatchActionDto) => {
      setMatchAction(action);
      scheduleActionClear(action);
      if (action.type === "matchEnd") {
        setMatchResults({ winningTeam: action.winningTeam, teamScores: action.teamScores });
      }
    };

    const onChatMessage = (msg: ChatMessageDto) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.userId !== currentUserId) setUnread((u) => u + 1);
    };

    const onChatHistory = (history: ChatMessageDto[]) => {
      setMessages(history);
    };

    const onRoomClosed = ({ reason }: { reason: string }) => {
      setError(reason);
      setTimeout(() => router.push("/dashboard"), 2500);
    };

    const onRoomError = ({ code: errCode, message }: { code: string; message: string }) => {
      if (errCode === "ROOM_CLOSED") {
        setError(message);
        setTimeout(() => router.push("/dashboard"), 2500);
        return;
      }
      setError(message);
      setTimeout(() => setError(null), 4000);
    };

    const onReconnect = () => {
      joinedRef.current = false;
      joinRoom();
    };

    socket.on("room:state", onRoomState);
    socket.on("match:sync", onMatchSync);
    socket.on("match:action", onMatchAction);
    socket.on("chat:message", onChatMessage);
    socket.on("chat:history", onChatHistory);
    socket.on("room:closed", onRoomClosed);
    socket.on("room:error", onRoomError);
    socket.on("connect", onReconnect);

    if (socket.connected) joinRoom();

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("match:sync", onMatchSync);
      socket.off("match:action", onMatchAction);
      socket.off("chat:message", onChatMessage);
      socket.off("chat:history", onChatHistory);
      socket.off("room:closed", onRoomClosed);
      socket.off("room:error", onRoomError);
      socket.off("connect", onReconnect);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      joinedRef.current = false;
    };
  }, [socket, code, currentUserId, router, applyMatchSync, joinRoom, scheduleActionClear]);

  const inGame = lobby?.status === "IN_GAME" && match && !matchResults;
  const myTeam = lobby?.members.find((m) => m.userId === currentUserId)?.team ?? 0;

  return (
    <div className="flex min-h-screen w-full flex-col px-3 py-4 sm:px-6 lg:px-8 xl:px-12">
      <header className="mb-4 flex shrink-0 items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground">
          {connected ? "Conectado" : "Reconectando..."}
        </span>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {matchResults && (
        <MatchResultsOverlay
          winningTeam={matchResults.winningTeam}
          teamScores={matchResults.teamScores}
          myTeam={myTeam}
          visible
        />
      )}

      {!lobby && <p className="text-center text-muted-foreground">Cargando sala...</p>}

      <div
        className={
          inGame
            ? "grid flex-1 gap-4 xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_380px]"
            : "grid flex-1 gap-4 lg:grid-cols-[1fr_340px]"
        }
      >
        <div className="min-w-0">
          {lobby && !inGame && !matchResults && (
            <LobbyView
              lobby={lobby}
              currentUserId={currentUserId}
              onReady={(ready) => socket?.emit("room:ready", { ready })}
              onSetTeam={(team) => socket?.emit("room:setTeam", { team })}
              onUpdateConfig={(patch: Partial<RoomConfigDto>) =>
                socket?.emit("room:updateConfig", patch)
              }
              onStart={() => socket?.emit("match:start")}
            />
          )}
          {lobby && match && !matchResults && (
            <GameView
              state={match}
              members={lobby.members}
              myHand={hand}
              currentUserId={currentUserId}
              matchAction={matchAction}
              onPlay={(tile, side) => socket?.emit("match:playTile", { tile, side })}
            />
          )}
        </div>

        <div className={inGame ? "min-h-[400px] xl:min-h-[calc(100vh-8rem)]" : ""}>
          <ChatPanel
            messages={messages}
            currentUserId={currentUserId}
            unread={unread}
            onSend={(content) => socket?.emit("chat:send", { content })}
            onSeen={() => setUnread(0)}
            fullHeight={Boolean(inGame)}
          />
        </div>
      </div>
    </div>
  );
}
