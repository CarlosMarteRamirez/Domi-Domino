import { Tile } from "../value-objects/tile";

/** The set of tiles a single player holds during a round. */
export class Hand {
  private tiles: Tile[];

  constructor(tiles: Tile[] = []) {
    this.tiles = [...tiles];
  }

  get all(): readonly Tile[] {
    return this.tiles;
  }

  get size(): number {
    return this.tiles.length;
  }

  get isEmpty(): boolean {
    return this.tiles.length === 0;
  }

  /** Sum of pips of all remaining tiles, used for scoring. */
  get pips(): number {
    return this.tiles.reduce((sum, t) => sum + t.pips, 0);
  }

  has(tile: Tile): boolean {
    return this.tiles.some((t) => t.equals(tile));
  }

  remove(tile: Tile): void {
    const index = this.tiles.findIndex((t) => t.equals(tile));
    if (index === -1) throw new Error(`Tile ${tile.id} not in hand`);
    this.tiles.splice(index, 1);
  }

  add(tile: Tile): void {
    this.tiles.push(tile);
  }
}
