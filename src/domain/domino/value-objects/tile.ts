import type { PipValue } from "../types";

/**
 * An immutable domino tile, represented as an unordered pair of pip values.
 * The two halves are normalised so that `low <= high`, which makes equality
 * and serialisation deterministic regardless of construction order.
 */
export class Tile {
  readonly low: PipValue;
  readonly high: PipValue;

  constructor(a: PipValue, b: PipValue) {
    if (a <= b) {
      this.low = a;
      this.high = b;
    } else {
      this.low = b;
      this.high = a;
    }
  }

  get isDouble(): boolean {
    return this.low === this.high;
  }

  /** Sum of both halves; used for scoring remaining hands. */
  get pips(): number {
    return this.low + this.high;
  }

  /** Whether this tile can connect to an open end showing `value`. */
  matches(value: PipValue): boolean {
    return this.low === value || this.high === value;
  }

  /** Given the connecting value, returns the value exposed on the new end. */
  otherEnd(connectingValue: PipValue): PipValue {
    return this.low === connectingValue ? this.high : this.low;
  }

  equals(other: Tile): boolean {
    return this.low === other.low && this.high === other.high;
  }

  /** Canonical id, e.g. "3-5". Stable for persistence and transport. */
  get id(): string {
    return `${this.low}-${this.high}`;
  }

  toString(): string {
    return this.id;
  }

  static fromId(id: string): Tile {
    const [a, b] = id.split("-").map(Number) as [PipValue, PipValue];
    return new Tile(a, b);
  }
}

/** Builds the full double-six set (28 unique tiles). */
export function buildDoubleSixSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push(new Tile(a as PipValue, b as PipValue));
    }
  }
  return tiles;
}
