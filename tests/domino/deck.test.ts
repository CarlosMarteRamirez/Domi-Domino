import { describe, it, expect } from "vitest";
import { deal, findOpeningSeat } from "@domain/domino/rules/deck";
import { createSeededRandom } from "@domain/shared/random";
import { Tile } from "@domain/domino/value-objects/tile";

describe("deck dealing", () => {
  it("is deterministic for a given seed", () => {
    const a = deal(4, createSeededRandom(42));
    const b = deal(4, createSeededRandom(42));
    expect(a.hands.map((h) => h.map((t) => t.id))).toEqual(b.hands.map((h) => h.map((t) => t.id)));
  });

  it("deals all 28 tiles to 4 players with no boneyard and no duplicates", () => {
    const { hands, boneyard } = deal(4, createSeededRandom(1));
    expect(hands).toHaveLength(4);
    hands.forEach((h) => expect(h).toHaveLength(7));
    expect(boneyard).toHaveLength(0);
    const ids = hands.flat().map((t) => t.id);
    expect(new Set(ids).size).toBe(28);
  });

  it("leaves a 14-tile boneyard for 2 players", () => {
    const { hands, boneyard } = deal(2, createSeededRandom(7));
    expect(hands).toHaveLength(2);
    expect(boneyard).toHaveLength(14);
  });

  it("chooses the holder of the highest double to open", () => {
    const hands = [
      [new Tile(1, 2)],
      [new Tile(6, 6), new Tile(0, 1)],
      [new Tile(5, 5)],
      [new Tile(3, 4)],
    ];
    expect(findOpeningSeat(hands)).toBe(1);
  });

  it("falls back to the highest tile when there are no doubles", () => {
    const hands = [[new Tile(1, 2)], [new Tile(5, 6)], [new Tile(3, 4)]];
    expect(findOpeningSeat(hands)).toBe(1);
  });
});
