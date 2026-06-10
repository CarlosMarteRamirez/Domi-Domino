"use client";

import * as React from "react";
import type { Side } from "@/domain/domino/types";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import type { LobbyMember, MatchActionDto } from "@/shared/socket/contract";
import { Badge } from "@/presentation/components/ui/badge";
import { PlayerSeat } from "./player-seat";
import { BoardView, type BoardViewHandle } from "./board-view";
import { HandView } from "./hand-view";
import { MatchAnimationLayer } from "./match-animation-layer";
import { PlayFlyAnimation } from "./play-fly-animation";

type SeatPosition = "top" | "bottom" | "left" | "right";

/** Distancia desde el borde del tablero verde hacia adentro (px). */
const PASS_ANCHOR_INSET = 48;
/** 0 = borde del tablero, 1 = carta del jugador (solo laterales). */
const PASS_LATERAL_SEAT_BLEND = 0.86;

function blendToward(board: number, seat: number, t: number) {
  return board + (seat - board) * t;
}

/** Asigna posición en mesa según asiento relativo al jugador actual. */
function seatPosition(relativeOffset: number, playerCount: number): SeatPosition {
  if (playerCount === 2) return relativeOffset === 0 ? "bottom" : "top";
  const map: SeatPosition[] = ["bottom", "right", "top", "left"];
  return map[relativeOffset % 4] ?? "top";
}

interface Props {
  state: MatchState;
  members: LobbyMember[];
  myHand: { tiles: string[]; legalMoves: { tile: string; sides: Side[] }[] };
  currentUserId: string;
  matchAction: MatchActionDto | null;
  onPlay: (tile: string, side: Side) => void;
}

export function GameTable({ state, members, myHand, currentUserId, matchAction, onPlay }: Props) {
  const [selectedTile, setSelectedTile] = React.useState<string | null>(null);
  const tableAreaRef = React.useRef<HTMLDivElement>(null);
  const boardViewRef = React.useRef<BoardViewHandle>(null);
  const handAreaRef = React.useRef<HTMLDivElement>(null);
  const seatElementsRef = React.useRef(new Map<string, HTMLElement>());

  const registerSeat = React.useCallback((playerId: string, el: HTMLElement | null) => {
    if (el) {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) seatElementsRef.current.set(playerId, el);
    } else {
      seatElementsRef.current.delete(playerId);
    }
  }, []);

  const getPlayerOriginEl = React.useCallback(
    (playerId: string) => {
      if (playerId === currentUserId) return handAreaRef.current;
      return seatElementsRef.current.get(playerId) ?? null;
    },
    [currentUserId],
  );

  const myMember = members.find((m) => m.userId === currentUserId);
  const mySeat = myMember?.seat ?? 0;
  const playerCount = state.config.playerCount;
  const isMyTurn = state.currentPlayerId === currentUserId;
  const isAnimating = Boolean(matchAction);

  const playerSeats = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of state.players) map.set(p.id, p.seat);
    return map;
  }, [state.players]);

  const hiddenTileId =
    matchAction?.type === "play" && matchAction.playerId === currentUserId
      ? matchAction.tile
      : null;

  const movesByTile = new Map(myHand.legalMoves.map((m) => [m.tile, m.sides]));
  const selectedSides = selectedTile ? (movesByTile.get(selectedTile) ?? []) : [];

  React.useEffect(() => {
    if (!isMyTurn) setSelectedTile(null);
  }, [isMyTurn, state.currentPlayerId]);

  function place(side: Side) {
    if (!selectedTile || !isMyTurn || isAnimating) return;
    const sides = movesByTile.get(selectedTile);
    if (!sides?.includes(side)) return;
    onPlay(selectedTile, side);
    setSelectedTile(null);
  }

  function dropPlace(side: Side) {
    const tile = selectedTile;
    if (!tile || !isMyTurn || isAnimating) return;
    const sides = movesByTile.get(tile);
    if (!sides?.includes(side)) return;
    onPlay(tile, side);
    setSelectedTile(null);
  }

  const playersAtTable = state.players
    .map((p) => {
      const member = members.find((m) => m.userId === p.id);
      const relative = (p.seat - mySeat + playerCount) % playerCount;
      return {
        ...p,
        member,
        position: seatPosition(relative, playerCount),
        isMe: p.id === currentUserId,
      };
    })
    .filter((p) => !p.isMe);

  const topPlayer = playersAtTable.find((p) => p.position === "top");
  const leftPlayer = playersAtTable.find((p) => p.position === "left");
  const rightPlayer = playersAtTable.find((p) => p.position === "right");

  const teams = Object.keys(state.teamScores).map(Number).sort();

  const getPassAnchor = React.useCallback(
    (position: SeatPosition): { x: number; y: number } | null => {
      const board = boardViewRef.current?.getBoardElement();
      const table = tableAreaRef.current;
      if (!board || !table) return null;

      const br = board.getBoundingClientRect();
      const tr = table.getBoundingClientRect();
      const ox = br.left - tr.left;
      const oy = br.top - tr.top;
      const inset = PASS_ANCHOR_INSET;

      const seatEl = (playerId: string | undefined) =>
        playerId ? seatElementsRef.current.get(playerId) : null;

      switch (position) {
        case "top":
          return { x: ox + br.width / 2, y: oy + inset };
        case "bottom":
          return { x: ox + br.width / 2, y: oy + br.height - inset };
        case "left": {
          const bx = ox + inset;
          const by = oy + br.height / 2;
          const el = seatEl(leftPlayer?.id);
          if (!el) return { x: bx, y: by };
          const sr = el.getBoundingClientRect();
          const sx = sr.right - tr.left + 10;
          const sy = sr.top - tr.top + sr.height / 2;
          return {
            x: blendToward(bx, sx, PASS_LATERAL_SEAT_BLEND),
            y: sy,
          };
        }
        case "right": {
          const bx = ox + br.width - inset;
          const by = oy + br.height / 2;
          const el = seatEl(rightPlayer?.id);
          if (!el) return { x: bx, y: by };
          const sr = el.getBoundingClientRect();
          const sx = sr.left - tr.left - 10;
          const sy = sr.top - tr.top + sr.height / 2;
          return {
            x: blendToward(bx, sx, PASS_LATERAL_SEAT_BLEND),
            y: sy,
          };
        }
      }
    },
    [leftPlayer?.id, rightPlayer?.id],
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant={isMyTurn ? "default" : "secondary"}>
            {isMyTurn ? "Es tu turno" : `Turno de ${members.find((m) => m.userId === state.currentPlayerId)?.displayName ?? "—"}`}
          </Badge>
          {state.passesInARow > 0 && (
            <Badge variant="warning">{state.passesInARow} pase(s)</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Objetivo: {state.config.targetScore}</span>
          {teams.map((t) => (
            <span key={t} className="font-semibold">
              Eq.{t + 1}: <span className="text-domino-blue-light">{state.teamScores[t] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      <div ref={tableAreaRef} className="relative">
        <PlayFlyAnimation
          action={matchAction}
          boardEmpty={state.board.tiles.length === 0}
          tableAreaRef={tableAreaRef}
          boardRef={boardViewRef}
          getPlayerOriginEl={getPlayerOriginEl}
          mySeat={mySeat}
          playerCount={playerCount}
          playerSeats={playerSeats}
        />
        <MatchAnimationLayer
          action={matchAction}
          currentUserId={currentUserId}
          mySeat={mySeat}
          playerCount={playerCount}
          playerSeats={playerSeats}
          getPassAnchor={getPassAnchor}
        />

        <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[7.5rem_1fr_7.5rem] lg:grid-rows-[auto_1fr_auto]">
          <div className="lg:col-span-3 flex min-w-0 justify-center overflow-visible px-2 py-1.5">
            {topPlayer && topPlayer.member && (
              <div ref={(el) => registerSeat(topPlayer.id, el)} className="flex justify-center p-0.5">
              <PlayerSeat
                displayName={topPlayer.member.displayName}
                image={topPlayer.member.image}
                handCount={topPlayer.handCount}
                teamIndex={topPlayer.teamIndex}
                isCurrentTurn={topPlayer.isCurrentTurn}
                position="top"
              />
              </div>
            )}
          </div>

          <div className="hidden min-w-0 items-center justify-center overflow-visible lg:flex">
            {leftPlayer && leftPlayer.member && (
              <div ref={(el) => registerSeat(leftPlayer.id, el)} className="flex justify-center p-0.5">
              <PlayerSeat
                displayName={leftPlayer.member.displayName}
                image={leftPlayer.member.image}
                handCount={leftPlayer.handCount}
                teamIndex={leftPlayer.teamIndex}
                isCurrentTurn={leftPlayer.isCurrentTurn}
                position="left"
              />
              </div>
            )}
          </div>

          <div className="min-w-0 overflow-visible">
            <BoardView
              ref={boardViewRef}
              board={state.board}
              selectedTile={selectedTile}
              playableSides={selectedSides}
              matchAction={matchAction}
              onPlace={place}
              onDropTile={dropPlace}
            />
          </div>

          <div className="hidden min-w-0 items-center justify-center overflow-visible lg:flex">
            {rightPlayer && rightPlayer.member && (
              <div ref={(el) => registerSeat(rightPlayer.id, el)} className="flex justify-center p-0.5">
              <PlayerSeat
                displayName={rightPlayer.member.displayName}
                image={rightPlayer.member.image}
                handCount={rightPlayer.handCount}
                teamIndex={rightPlayer.teamIndex}
                isCurrentTurn={rightPlayer.isCurrentTurn}
                position="right"
              />
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2 lg:hidden">
            {playersAtTable.map(
              (p) =>
                p.member && (
                  <div key={p.id} ref={(el) => registerSeat(p.id, el)}>
                  <PlayerSeat
                    displayName={p.member.displayName}
                    image={p.member.image}
                    handCount={p.handCount}
                    teamIndex={p.teamIndex}
                    isCurrentTurn={p.isCurrentTurn}
                    position="top"
                  />
                  </div>
                ),
            )}
          </div>

          <div className="lg:col-span-3 rounded-xl border border-border bg-card/40 p-4">
            {myMember && (
              <div className="mb-3 flex justify-center p-0.5">
                <PlayerSeat
                  displayName={myMember.displayName}
                  image={myMember.image}
                  handCount={myHand.tiles.length}
                  teamIndex={myMember.team}
                  isCurrentTurn={isMyTurn}
                  isMe
                  position="bottom"
                />
              </div>
            )}
            <div ref={handAreaRef} className="overflow-visible">
            <HandView
              tiles={myHand.tiles}
              legalMoves={myHand.legalMoves}
              isMyTurn={isMyTurn}
              selectedTile={selectedTile}
              onSelectTile={setSelectedTile}
              hiddenTileId={hiddenTileId}
              disabled={isAnimating}
            />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
