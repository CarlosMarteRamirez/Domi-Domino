import type { PipValue, Side } from "../types";
import { Tile } from "../value-objects/tile";

/** A tile as it sits on the board, oriented for display (a connects left). */
export interface PlacedTile {
  tile: Tile;
  /** Pip value facing the left end of the chain. */
  leftValue: PipValue;
  /** Pip value facing the right end of the chain. */
  rightValue: PipValue;
  placedBy: string;
  side: Side | "first";
}

export class Board {
  private readonly placed: PlacedTile[] = [];

  get isEmpty(): boolean {
    return this.placed.length === 0;
  }

  get tiles(): readonly PlacedTile[] {
    return this.placed;
  }

  get count(): number {
    return this.placed.length;
  }

  get leftEnd(): PipValue | null {
    return this.isEmpty ? null : this.placed[0].leftValue;
  }

  get rightEnd(): PipValue | null {
    return this.isEmpty ? null : this.placed[this.placed.length - 1].rightValue;
  }

  /** Open ends a tile could attach to. Both equal for the empty board. */
  get openEnds(): [PipValue, PipValue] | null {
    if (this.isEmpty) return null;
    return [this.leftEnd!, this.rightEnd!];
  }

  canPlay(tile: Tile, side: Side): boolean {
    if (this.isEmpty) return true;
    const end = side === "left" ? this.leftEnd! : this.rightEnd!;
    return tile.matches(end);
  }

  /** Whether the tile fits on at least one end. */
  hasPlayFor(tile: Tile): boolean {
    if (this.isEmpty) return true;
    return tile.matches(this.leftEnd!) || tile.matches(this.rightEnd!);
  }

  place(tile: Tile, side: Side, playedBy: string): void {
    if (this.isEmpty) {
      this.placed.push({
        tile,
        leftValue: tile.high,
        rightValue: tile.low,
        placedBy: playedBy,
        side: "first",
      });
      return;
    }
    if (side === "left") {
      const end = this.leftEnd!;
      const exposed = tile.otherEnd(end);
      this.placed.unshift({
        tile,
        leftValue: exposed,
        rightValue: end,
        placedBy: playedBy,
        side,
      });
    } else {
      const end = this.rightEnd!;
      const exposed = tile.otherEnd(end);
      this.placed.push({
        tile,
        leftValue: end,
        rightValue: exposed,
        placedBy: playedBy,
        side,
      });
    }
  }
}
