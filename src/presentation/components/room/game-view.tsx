"use client";

import type { Side } from "@/domain/domino/types";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import type { LobbyMember, MatchActionDto } from "@/shared/socket/contract";
import { GameTable } from "./game-table";

interface Props {
  state: MatchState;
  members: LobbyMember[];
  myHand: { tiles: string[]; legalMoves: { tile: string; sides: Side[] }[] };
  currentUserId: string;
  matchAction: MatchActionDto | null;
  onPlay: (tile: string, side: Side) => void;
}

export function GameView({
  state,
  members,
  myHand,
  currentUserId,
  matchAction,
  onPlay,
}: Props) {
  return (
    <GameTable
      state={state}
      members={members}
      myHand={myHand}
      currentUserId={currentUserId}
      matchAction={matchAction}
      onPlay={onPlay}
    />
  );
}
