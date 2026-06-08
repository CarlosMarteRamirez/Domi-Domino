"use client";

import * as React from "react";
import { Tile } from "@/domain/domino/value-objects/tile";
import type { Side } from "@/domain/domino/types";
import { DominoTile } from "./domino-tile";
import { Button } from "@/presentation/components/ui/button";

interface Props {
  tiles: string[];
  legalMoves: { tile: string; sides: Side[] }[];
  isMyTurn: boolean;
  canPass: boolean;
  onPlay: (tile: string, side: Side) => void;
  onPass: () => void;
}

export function HandView({ tiles, legalMoves, isMyTurn, canPass, onPlay, onPass }: Props) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const movesByTile = new Map(legalMoves.map((m) => [m.tile, m.sides]));

  function handleClick(tileId: string) {
    const sides = movesByTile.get(tileId);
    if (!isMyTurn || !sides || sides.length === 0) return;
    if (sides.length === 1) {
      onPlay(tileId, sides[0]);
      setSelected(null);
    } else {
      setSelected((cur) => (cur === tileId ? null : tileId));
    }
  }

  const selectedSides = selected ? movesByTile.get(selected) ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-center gap-2">
        {tiles.map((id) => {
          const tile = Tile.fromId(id);
          const playable = isMyTurn && (movesByTile.get(id)?.length ?? 0) > 0;
          return (
            <DominoTile
              key={id}
              low={tile.low}
              high={tile.high}
              playable={playable}
              selected={selected === id}
              onClick={() => handleClick(id)}
            />
          );
        })}
        {tiles.length === 0 && <p className="text-sm text-muted-foreground">Sin fichas.</p>}
      </div>

      {selected && selectedSides.length > 1 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => { onPlay(selected, "left"); setSelected(null); }}>
            Jugar a la izquierda
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { onPlay(selected, "right"); setSelected(null); }}>
            Jugar a la derecha
          </Button>
        </div>
      )}

      {isMyTurn && canPass && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onPass}>Pasar turno</Button>
        </div>
      )}
    </div>
  );
}
