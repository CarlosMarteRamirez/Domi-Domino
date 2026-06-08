"use client";

import { BoardView } from "./board-view";
import { Scoreboard } from "./scoreboard";
import { HandView } from "./hand-view";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Badge } from "@/presentation/components/ui/badge";
import type { Side } from "@/domain/domino/types";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import type { LobbyMember } from "@/shared/socket/contract";

interface Props {
  state: MatchState;
  members: LobbyMember[];
  myHand: { tiles: string[]; legalMoves: { tile: string; sides: Side[] }[] };
  currentUserId: string;
  events: string[];
  onPlay: (tile: string, side: Side) => void;
  onPass: () => void;
}

export function GameView({ state, members, myHand, currentUserId, events, onPlay, onPass }: Props) {
  const isMyTurn = state.currentPlayerId === currentUserId;
  const canPass = isMyTurn && myHand.legalMoves.length === 0;
  const turnName =
    members.find((m) => m.userId === state.currentPlayerId)?.displayName ?? "—";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant={isMyTurn ? "default" : "secondary"}>
            {isMyTurn ? "Es tu turno" : `Turno de ${turnName}`}
          </Badge>
          {state.passesInARow > 0 && (
            <Badge variant="warning">{state.passesInARow} pase(s) seguido(s)</Badge>
          )}
        </div>

        <BoardView board={state.board} />

        <Card>
          <CardContent className="p-4">
            <HandView
              tiles={myHand.tiles}
              legalMoves={myHand.legalMoves}
              isMyTurn={isMyTurn}
              canPass={canPass}
              onPlay={onPlay}
              onPass={onPass}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Scoreboard state={state} members={members} />
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="mb-2 text-sm font-medium">Movimientos</p>
            <div className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {events.length === 0 && <p>Sin eventos aún.</p>}
              {events.map((e, i) => (
                <p key={i}>• {e}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
