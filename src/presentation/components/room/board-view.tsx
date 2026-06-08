"use client";

import * as React from "react";
import { cn } from "@/presentation/lib/utils";
import type { Side } from "@/domain/domino/types";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import { Tile } from "@/domain/domino/value-objects/tile";
import type { MatchActionDto } from "@/shared/socket/contract";
import { DominoTile } from "./domino-tile";

interface Props {
  board: MatchState["board"];
  selectedTile: string | null;
  playableSides: Side[];
  matchAction: MatchActionDto | null;
  onPlace: (side: Side) => void;
  onDropTile?: (side: Side) => void;
}

function PlacementZone({
  side,
  visible,
  highlighted,
  onPlace,
  tileClassName,
  ariaLabel,
  zoneRef,
}: {
  side: Side;
  visible: boolean;
  highlighted: boolean;
  onPlace: (side: Side) => void;
  tileClassName: string;
  ariaLabel: string;
  zoneRef?: React.Ref<HTMLButtonElement>;
}) {
  if (!visible) return null;
  return (
    <button
      ref={zoneRef}
      type="button"
      onClick={() => onPlace(side)}
      className={cn(
        "shrink-0 rounded-md border-2 border-dashed shadow-inner transition-all duration-200",
        tileClassName,
        highlighted
          ? "scale-105 border-domino-cream/70 bg-domino-blue/45 ring-2 ring-domino-cream/35 shadow-md"
          : "border-domino-blue-light/50 bg-domino-blue/15 hover:border-domino-cream/50 hover:bg-domino-blue/25",
      )}
      aria-label={ariaLabel}
    />
  );
}

type Point = { x: number; y: number };

export type BoardViewHandle = {
  getTargetPoint: (target: Side | "center") => Point | null;
  getBoardElement: () => HTMLDivElement | null;
};

export const BoardView = React.forwardRef<BoardViewHandle, Props>(function BoardView(
  {
  board,
  selectedTile,
  playableSides,
  matchAction,
  onPlace,
  onDropTile,
  },
  ref,
) {
  const isEmpty = board.tiles.length === 0;
  const hasSelection = Boolean(selectedTile);
  const showCenter = hasSelection && isEmpty;
  const showLeft = !isEmpty && hasSelection && playableSides.includes("left");
  const showRight = !isEmpty && hasSelection && playableSides.includes("right");

  const tileHorizontal = "h-11 w-[5.5rem] md:h-12 md:w-24";
  const tileVertical = "h-[5.5rem] w-11 md:h-24 md:w-12";

  const selected = selectedTile ? Tile.fromId(selectedTile) : null;
  const zoneClassName = selected?.isDouble ? tileVertical : tileHorizontal;

  const boardRef = React.useRef<HTMLDivElement>(null);
  const tilesRef = React.useRef<HTMLDivElement>(null);
  const leftZoneRef = React.useRef<HTMLButtonElement>(null);
  const rightZoneRef = React.useRef<HTMLButtonElement>(null);
  const centerZoneRef = React.useRef<HTMLButtonElement>(null);

  const [hoverSide, setHoverSide] = React.useState<Side | null>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  const prevLenRef = React.useRef(board.tiles.length);
  const [landingIdx, setLandingIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (board.tiles.length > prevLenRef.current) {
      setLandingIdx(board.tiles.length - 1);
      const timer = setTimeout(() => setLandingIdx(null), 480);
      prevLenRef.current = board.tiles.length;
      return () => clearTimeout(timer);
    }
    prevLenRef.current = board.tiles.length;
  }, [board.tiles.length]);

  const getTargetPoint = React.useCallback(
    (target: Side | "center"): Point | null => {
      const board = boardRef.current;
      if (!board) return null;
      const boardRect = board.getBoundingClientRect();

      const ref =
        target === "center"
          ? centerZoneRef.current
          : target === "left"
            ? leftZoneRef.current
            : rightZoneRef.current;

      if (ref) {
        const r = ref.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - boardRect.left,
          y: r.top + r.height / 2 - boardRect.top,
        };
      }

      const tiles = tilesRef.current;
      if (tiles && !isEmpty) {
        const tr = tiles.getBoundingClientRect();
        const gap = 12;
        if (target === "left") {
          return {
            x: tr.left - boardRect.left - gap,
            y: tr.top + tr.height / 2 - boardRect.top,
          };
        }
        return {
          x: tr.right - boardRect.left + gap,
          y: tr.top + tr.height / 2 - boardRect.top,
        };
      }

      return { x: boardRect.width / 2, y: boardRect.height / 2 };
    },
    [isEmpty],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      getTargetPoint,
      getBoardElement: () => boardRef.current,
    }),
    [getTargetPoint],
  );

  function resolveNearestSide(clientX: number): Side | null {
    if (isEmpty) return playableSides.includes("right") ? "right" : null;
    if (playableSides.length === 1) return playableSides[0] ?? null;

    const tiles = tilesRef.current;
    if (!tiles) return playableSides[0] ?? null;

    const rect = tiles.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    const preferred: Side = clientX < mid ? "left" : "right";
    if (playableSides.includes(preferred)) return preferred;
    return playableSides[0] ?? null;
  }

  function handleBoardDragOver(e: React.DragEvent) {
    if (!hasSelection || !selectedTile) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDraggingOver(true);
    const side = resolveNearestSide(e.clientX);
    setHoverSide(side);
  }

  function handleBoardDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    setHoverSide(null);
    if (!hasSelection || !onDropTile) return;

    const side = isEmpty ? "right" : resolveNearestSide(e.clientX);
    if (side) onDropTile(side);
  }

  function handleBoardDragLeave(e: React.DragEvent) {
    if (!boardRef.current?.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
      setHoverSide(null);
    }
  }

  const highlightLeft = hoverSide === "left";
  const highlightRight = hoverSide === "right";
  const highlightCenter = isEmpty && isDraggingOver;

  return (
    <div
      ref={boardRef}
      className="relative flex min-h-[360px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-800/40 p-6 shadow-inner md:min-h-[460px] lg:min-h-[540px]"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(34, 120, 70, 0.55), transparent 70%), linear-gradient(160deg, #0d3d28 0%, #145c38 50%, #0a2e1f 100%)",
      }}
      onDragOver={handleBoardDragOver}
      onDrop={handleBoardDrop}
      onDragLeave={handleBoardDragLeave}
    >
      {isEmpty && !selectedTile && (
        <p className="pointer-events-none text-center text-sm text-domino-cream/70">
          El tablero está vacío. Selecciona una ficha para abrir el juego.
        </p>
      )}

      <div
        className={cn(
          "flex w-full max-w-5xl flex-wrap items-center justify-center gap-2 2xl:max-w-6xl",
          isDraggingOver && hasSelection && "ring-1 ring-domino-blue-light/20 rounded-xl",
        )}
      >
        <PlacementZone
          side="left"
          visible={showLeft || (isDraggingOver && playableSides.includes("left"))}
          highlighted={highlightLeft}
          onPlace={onPlace}
          tileClassName={zoneClassName}
          ariaLabel="Colocar ficha a la izquierda"
          zoneRef={leftZoneRef}
        />

        {showCenter && (
          <PlacementZone
            side="right"
            visible={showCenter || highlightCenter}
            highlighted={highlightCenter}
            onPlace={onPlace}
            tileClassName={zoneClassName}
            ariaLabel="Colocar ficha para abrir el juego"
            zoneRef={centerZoneRef}
          />
        )}

        <div ref={tilesRef} className="flex flex-wrap items-center justify-center gap-1 px-2">
          {board.tiles.map((t, i) => {
            const isDouble = t.leftValue === t.rightValue;
            const isNewFromFly =
              matchAction?.type === "play" &&
              matchAction.tile === t.id &&
              i === board.tiles.length - 1;
            return (
              <DominoTile
                key={`${t.id}-${i}`}
                low={t.rightValue}
                high={t.leftValue}
                orientation="auto"
                className={cn(
                  isDouble ? tileVertical : tileHorizontal,
                  landingIdx === i && !isNewFromFly && "animate-domino-land",
                  isNewFromFly && "animate-domino-land",
                )}
              />
            );
          })}
        </div>

        <PlacementZone
          side="right"
          visible={showRight || (isDraggingOver && playableSides.includes("right"))}
          highlighted={highlightRight}
          onPlace={onPlace}
          tileClassName={zoneClassName}
          ariaLabel="Colocar ficha a la derecha"
          zoneRef={rightZoneRef}
        />
      </div>

      {!isEmpty && board.leftEnd !== null && (
        <p className="pointer-events-none text-xs text-domino-cream/60">
          Extremos: {board.leftEnd} — {board.rightEnd}
        </p>
      )}

      {hasSelection && isDraggingOver && (
        <p className="pointer-events-none text-xs text-domino-cream/60">
          Suelta cerca del extremo donde quieras jugar
        </p>
      )}
    </div>
  );
});
