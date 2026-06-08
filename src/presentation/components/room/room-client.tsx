"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { useSocket } from "@/presentation/hooks/use-socket";
import { LobbyView } from "./lobby-view";
import { GameView } from "./game-view";
import { ChatPanel } from "./chat-panel";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import type { Side } from "@/domain/domino/types";
import type {
  ChatMessageDto,
  LobbyState,
  RoomConfigDto,
} from "@/shared/socket/contract";

interface Props {
  code: string;
  currentUserId: string;
}

export function RoomClient({ code, currentUserId }: Props) {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const [lobby, setLobby] = React.useState<LobbyState | null>(null);
  const [match, setMatch] = React.useState<MatchState | null>(null);
  const [hand, setHand] = React.useState<{ tiles: string[]; legalMoves: { tile: string; sides: Side[] }[] }>({
    tiles: [],
    legalMoves: [],
  });
  const [messages, setMessages] = React.useState<ChatMessageDto[]>([]);
  const [events, setEvents] = React.useState<string[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [finished, setFinished] = React.useState<{ winningTeam: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!socket) return;

    socket.emit("room:join", { code });

    socket.on("room:state", setLobby);
    socket.on("match:state", (state) => {
      setMatch(state);
      if (state.lastRoundResult) {
        // round result is also surfaced via match:event messages
      }
    });
    socket.on("match:yourHand", setHand);
    socket.on("match:event", ({ message }) => setEvents((prev) => [message, ...prev].slice(0, 50)));
    socket.on("match:finished", ({ winningTeam }) => setFinished({ winningTeam }));
    socket.on("chat:message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.userId !== currentUserId) setUnread((u) => u + 1);
    });
    socket.on("room:closed", ({ reason }) => {
      setError(reason);
      setTimeout(() => router.push("/dashboard"), 2500);
    });
    socket.on("room:error", ({ code: errCode, message }) => {
      if (errCode === "ROOM_CLOSED") {
        setError(message);
        setTimeout(() => router.push("/dashboard"), 2500);
        return;
      }
      setError(message);
      setTimeout(() => setError(null), 4000);
    });

    return () => {
      socket.emit("room:leave", { code });
      socket.off("room:state");
      socket.off("room:closed");
      socket.off("match:state");
      socket.off("match:yourHand");
      socket.off("match:event");
      socket.off("match:finished");
      socket.off("chat:message");
      socket.off("room:error");
    };
  }, [socket, code, currentUserId]);

  const inGame = lobby?.status === "IN_GAME" && match;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Link>
        </Button>
        <span className="text-xs text-muted-foreground">
          {connected ? "Conectado" : "Conectando..."}
        </span>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {finished && (
        <Card className="mb-4 border-primary">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-amber-400" />
              <div>
                <p className="font-bold">¡Partida terminada!</p>
                <p className="text-sm text-muted-foreground">
                  Ganó el Equipo {finished.winningTeam + 1}
                </p>
              </div>
            </div>
            <Button asChild><Link href="/dashboard">Volver</Link></Button>
          </CardContent>
        </Card>
      )}

      {!lobby && <p className="text-center text-muted-foreground">Cargando sala...</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {lobby && !inGame && (
            <LobbyView
              lobby={lobby}
              currentUserId={currentUserId}
              onReady={(ready) => socket?.emit("room:ready", { ready })}
              onSetTeam={(team) => socket?.emit("room:setTeam", { team })}
              onUpdateConfig={(patch: Partial<RoomConfigDto>) => socket?.emit("room:updateConfig", patch)}
              onStart={() => socket?.emit("match:start")}
            />
          )}
          {lobby && inGame && match && (
            <GameView
              state={match}
              members={lobby.members}
              myHand={hand}
              currentUserId={currentUserId}
              events={events}
              onPlay={(tile, side) => socket?.emit("match:playTile", { tile, side })}
              onPass={() => socket?.emit("match:pass")}
            />
          )}
        </div>

        <ChatPanel
          messages={messages}
          currentUserId={currentUserId}
          unread={unread}
          onSend={(content) => socket?.emit("chat:send", { content })}
          onSeen={() => setUnread(0)}
        />
      </div>
    </div>
  );
}
