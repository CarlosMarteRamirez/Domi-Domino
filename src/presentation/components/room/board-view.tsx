"use client";

import { DominoTile } from "./domino-tile";
import type { MatchState } from "@/domain/domino/engine/domino-engine";

export function BoardView({ board }: { board: MatchState["board"] }) {
  return (
    <div className="felt flex min-h-48 flex-wrap content-center items-center justify-center gap-1 rounded-xl border border-border p-4">
      {board.tiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">El tablero está vacío. La primera ficha abre el juego.</p>
      ) : (
        board.tiles.map((t, i) => (
          <DominoTile
            key={`${t.id}-${i}`}
            low={t.rightValue}
            high={t.leftValue}
            orientation="horizontal"
          />
        ))
      )}
    </div>
  );
}
