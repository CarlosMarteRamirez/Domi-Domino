import { describe, it, expect } from "vitest";
import { Tile, buildDoubleSixSet } from "@domain/domino/value-objects/tile";

describe("Tile", () => {
  it("normalises halves so low <= high", () => {
    const t = new Tile(5, 2);
    expect(t.low).toBe(2);
    expect(t.high).toBe(5);
    expect(t.id).toBe("2-5");
  });

  it("identifies doubles and sums pips", () => {
    expect(new Tile(6, 6).isDouble).toBe(true);
    expect(new Tile(6, 6).pips).toBe(12);
    expect(new Tile(0, 0).pips).toBe(0);
  });

  it("matches and computes the other end", () => {
    const t = new Tile(3, 5);
    expect(t.matches(3)).toBe(true);
    expect(t.matches(4)).toBe(false);
    expect(t.otherEnd(3)).toBe(5);
    expect(t.otherEnd(5)).toBe(3);
  });

  it("round-trips through its id", () => {
    const t = Tile.fromId("4-6");
    expect(t.equals(new Tile(6, 4))).toBe(true);
  });

  it("builds the full 28-tile double-six set without duplicates", () => {
    const set = buildDoubleSixSet();
    expect(set).toHaveLength(28);
    expect(new Set(set.map((t) => t.id)).size).toBe(28);
  });
});
