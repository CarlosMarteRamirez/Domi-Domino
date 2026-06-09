"use client";

import * as React from "react";
import { Tile } from "@/domain/domino/value-objects/tile";
import type { Side } from "@/domain/domino/types";
import type { MatchActionDto } from "@/shared/socket/contract";
import { MATCH_ANIM_MS } from "@/shared/socket/contract";
import { cn } from "@/presentation/lib/utils";
import { DominoTile } from "./domino-tile";
import type { BoardViewHandle } from "./board-view";

type SeatPosition = "top" | "bottom" | "left" | "right";

function relativeSeatPosition(
  playerSeat: number,
  mySeat: number,
  playerCount: number,
): SeatPosition {
  const relative = (playerSeat - mySeat + playerCount) % playerCount;
  if (playerCount === 2) return relative === 0 ? "bottom" : "top";
  const map: SeatPosition[] = ["bottom", "right", "top", "left"];
  return map[relative % 4] ?? "top";
}

/** Origen aproximado dentro del área de mesa cuando no hay ref DOM visible. */
const SEAT_ORIGIN_RATIO: Record<SeatPosition, { x: number; y: number }> = {
  bottom: { x: 0.5, y: 0.9 },
  top: { x: 0.5, y: 0.1 },
  left: { x: 0.1, y: 0.45 },
  right: { x: 0.9, y: 0.45 },
};

function originFromElement(el: HTMLElement, tableRect: DOMRect) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2 - tableRect.left,
    y: rect.top + rect.height / 2 - tableRect.top,
  };
}

interface Props {
  action: MatchActionDto | null;
  boardEmpty: boolean;
  tableAreaRef: React.RefObject<HTMLDivElement | null>;
  boardRef: React.RefObject<BoardViewHandle | null>;
  getPlayerOriginEl: (playerId: string) => HTMLElement | null;
  mySeat: number;
  playerCount: number;
  playerSeats: Map<string, number>;
}

export function PlayFlyAnimation({
  action,
  boardEmpty,
  tableAreaRef,
  boardRef,
  getPlayerOriginEl,
  mySeat,
  playerCount,
  playerSeats,
}: Props) {
  const [flyStyle, setFlyStyle] = React.useState<React.CSSProperties | null>(null);
  const [hidden, setHidden] = React.useState(false);
  const openingPlayRef = React.useRef(false);

  React.useEffect(() => {
    if (!action || action.type !== "play") {
      setFlyStyle(null);
      setHidden(false);
      openingPlayRef.current = false;
      return;
    }

    openingPlayRef.current = boardEmpty;

    const apply = () => {
      const table = tableAreaRef.current;
      const boardApi = boardRef.current;
      const boardEl = boardApi?.getBoardElement();
      if (!table || !boardApi || !boardEl) return;

      const targetLocal = boardApi.getTargetPoint(
        openingPlayRef.current ? "center" : action.side,
      );
      if (!targetLocal) return;

      const tableRect = table.getBoundingClientRect();
      const boardRect = boardEl.getBoundingClientRect();

      const endX = boardRect.left - tableRect.left + targetLocal.x;
      const endY = boardRect.top - tableRect.top + targetLocal.y;

      const originEl = getPlayerOriginEl(action.playerId);
      let start = originEl ? originFromElement(originEl, tableRect) : null;

      if (!start) {
        const seat = playerSeats.get(action.playerId) ?? 0;
        const position = relativeSeatPosition(seat, mySeat, playerCount);
        const ratio = SEAT_ORIGIN_RATIO[position];
        start = { x: tableRect.width * ratio.x, y: tableRect.height * ratio.y };
      }

      setHidden(false);
      setFlyStyle({
        left: endX,
        top: endY,
        "--fly-x": `${start.x - endX}px`,
        "--fly-y": `${start.y - endY}px`,
        "--fly-duration": `${MATCH_ANIM_MS.play}ms`,
      } as React.CSSProperties);
    };

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(apply);
    });
    const timer = setTimeout(() => setHidden(true), MATCH_ANIM_MS.play);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [action, boardEmpty, tableAreaRef, boardRef, getPlayerOriginEl, mySeat, playerCount, playerSeats]);

  if (!action || action.type !== "play" || !flyStyle || hidden) return null;

  const tile = Tile.fromId(action.tile);
  const isDouble = tile.isDouble;
  const tileHorizontal = "h-11 w-[5.5rem] md:h-12 md:w-24";
  const tileVertical = "h-[5.5rem] w-11 md:h-24 md:w-12";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <div
        className="absolute animate-domino-fly"
        style={{ ...flyStyle, transform: "translate(-50%, -50%)" }}
      >
        <DominoTile
          low={tile.low}
          high={tile.high}
          orientation={isDouble ? "vertical" : "horizontal"}
          className={cn("shadow-xl", isDouble ? tileVertical : tileHorizontal)}
        />
      </div>
    </div>
  );
}
