"use client";

import * as React from "react";
import { Tile } from "@/domain/domino/value-objects/tile";
import type { Side } from "@/domain/domino/types";
import { DominoTile } from "./domino-tile";

interface Props {
  tiles: string[];
  legalMoves: { tile: string; sides: Side[] }[];
  isMyTurn: boolean;
  selectedTile: string | null;
  onSelectTile: (tileId: string | null) => void;
  hiddenTileId?: string | null;
  disabled?: boolean;
}

export function HandView({
  tiles,
  legalMoves,
  isMyTurn,
  selectedTile,
  onSelectTile,
  hiddenTileId,
  disabled,
}: Props) {
  const movesByTile = new Map(legalMoves.map((m) => [m.tile, m.sides]));

  function handleClick(tileId: string) {
    if (!isMyTurn || disabled) return;
    const sides = movesByTile.get(tileId);
    if (!sides || sides.length === 0) return;
    onSelectTile(selectedTile === tileId ? null : tileId);
  }

  function handleDragStart(e: React.DragEvent<HTMLButtonElement>, tileId: string) {
    if (!isMyTurn || disabled || !(movesByTile.get(tileId)?.length ?? 0)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", tileId);
    e.dataTransfer.effectAllowed = "move";
    onSelectTile(tileId);

    // Ghost sin translate: evita que el navegador recorte la parte superior al arrastrar.
    const source = e.currentTarget;
    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.style.transform = "none";
    ghost.style.position = "fixed";
    ghost.style.top = "-1000px";
    ghost.style.left = "-1000px";
    ghost.style.pointerEvents = "none";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    requestAnimationFrame(() => ghost.remove());
  }

  const visibleTiles = tiles.filter((id) => id !== hiddenTileId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-center gap-2 overflow-visible py-1 md:gap-3">
        {visibleTiles.map((id) => {
          const tile = Tile.fromId(id);
          const playable = isMyTurn && !disabled && (movesByTile.get(id)?.length ?? 0) > 0;
          return (
            <DominoTile
              key={id}
              low={tile.low}
              high={tile.high}
              playable={playable}
              selected={selectedTile === id}
              draggable={playable}
              onClick={() => handleClick(id)}
              onDragStart={(e) => handleDragStart(e, id)}
              className="h-16 w-9 md:h-20 md:w-10"
            />
          );
        })}
        {visibleTiles.length === 0 && tiles.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin fichas en la mano.</p>
        )}
      </div>

      {selectedTile && isMyTurn && !disabled && (
        <p className="text-center text-xs text-domino-cream/80">
          Toca un extremo del tablero o arrastra la ficha y suéltala cerca del lado donde quieras jugar.
        </p>
      )}

      {isMyTurn && !disabled && legalMoves.length === 0 && tiles.length > 0 && (
        <p className="animate-pulse text-center text-xs text-amber-300/90">
          Sin jugadas — pasando automáticamente…
        </p>
      )}
    </div>
  );
}
