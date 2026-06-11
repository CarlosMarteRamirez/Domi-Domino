import { describe, expect, it } from "vitest";
import {
  GAP,
  LONG,
  RESERVE,
  UNIT,
  computeLayout,
  getLayoutExtent,
  predictNext,
  type BoardTileInput,
  type PositionedTile,
} from "@/presentation/components/room/board-layout-engine";

const BOARD_W = 12;
const BOARD_H = 8;

function horizontal(
  low: number,
  high: number,
  side: BoardTileInput["side"] = "right",
): BoardTileInput {
  return { leftValue: high, rightValue: low, side };
}

function boxesOverlap(a: PositionedTile, b: PositionedTile): boolean {
  const pad = GAP / 4;
  return (
    a.x + pad < b.x + b.w - pad &&
    a.x + a.w - pad > b.x + pad &&
    a.y + pad < b.y + b.h - pad &&
    a.y + a.h - pad > b.y + pad
  );
}

describe("computeLayout", () => {
  it("returns an empty layout for an empty chain", () => {
    expect(computeLayout([], BOARD_W, BOARD_H)).toEqual([]);
  });

  it("centers the opening double in the board", () => {
    const [first] = computeLayout(
      [{ leftValue: 6, rightValue: 6, side: "first" }],
      BOARD_W,
      BOARD_H,
    );
    expect(first!.w).toBe(UNIT);
    expect(first!.h).toBe(LONG);
    expect(first!.x).toBeCloseTo(BOARD_W / 2 - UNIT / 2);
    expect(first!.y).toBeCloseTo(BOARD_H / 2 - LONG / 2);
  });

  it("places the next horizontal tile flush to the right with GAP", () => {
    const layout = computeLayout(
      [
        { leftValue: 6, rightValue: 6, side: "first" },
        { leftValue: 6, rightValue: 5, side: "right" },
      ],
      BOARD_W,
      BOARD_H,
    );
    const [opening, right] = layout;
    expect(right!.x).toBeCloseTo(opening!.x + opening!.w + GAP);
    expect(right!.y).toBeCloseTo(opening!.y + opening!.h / 2 - right!.h / 2);
  });

  it("places the left arm flush to the left of the spinner with GAP", () => {
    const layout = computeLayout(
      [
        { leftValue: 4, rightValue: 2, side: "left" },
        { leftValue: 6, rightValue: 6, side: "first" },
      ],
      BOARD_W,
      BOARD_H,
    );
    const [left, opening] = layout;
    expect(left!.x + left!.w + GAP).toBeCloseTo(opening!.x);
  });

  it("renders doubles perpendicular to the row", () => {
    const layout = computeLayout(
      [
        { leftValue: 6, rightValue: 6, side: "first" },
        { leftValue: 6, rightValue: 5, side: "right" },
        { leftValue: 5, rightValue: 5, side: "right" },
      ],
      BOARD_W,
      BOARD_H,
    );
    const double5 = layout.find((t) => t.leftValue === 5 && t.rightValue === 5)!;
    expect(double5.orientation).toBe("vertical");
    expect(double5.w).toBe(UNIT);
    expect(double5.h).toBe(LONG);
  });

  it("wraps when reaching the board edge", () => {
    const tiles: BoardTileInput[] = [{ leftValue: 3, rightValue: 1, side: "first" }];
    for (let i = 0; i < 8; i++) tiles.push(horizontal(i, i + 1, "right"));
    const layout = computeLayout(tiles, 6, BOARD_H);
    const ys = layout.map((t) => t.y);
    expect(Math.max(...ys)).toBeGreaterThan(Math.min(...ys));
  });

  it("is deterministic: same history -> identical layout", () => {
    const tiles: BoardTileInput[] = [];
    for (let i = 0; i < 4; i++) tiles.push(horizontal(0, 1, "left"));
    tiles.push({ leftValue: 6, rightValue: 6, side: "first" });
    for (let i = 0; i < 6; i++) tiles.push(horizontal(2, 3, "right"));
    expect(computeLayout(tiles, BOARD_W, BOARD_H)).toEqual(
      computeLayout(tiles, BOARD_W, BOARD_H),
    );
  });

  it("never overlaps tiles in a long chain", () => {
    const tiles: BoardTileInput[] = [];
    for (let i = 0; i < 6; i++) tiles.push(horizontal(0, 1, "left"));
    tiles.push({ leftValue: 6, rightValue: 6, side: "first" });
    for (let i = 0; i < 12; i++) tiles.push(horizontal(2, 3, "right"));
    const layout = computeLayout(tiles, BOARD_W, BOARD_H);
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        expect(boxesOverlap(layout[i]!, layout[j]!)).toBe(false);
      }
    }
  });

  it("wraps before exceeding the board width on a long right arm", () => {
    const tiles: BoardTileInput[] = [{ leftValue: 3, rightValue: 1, side: "first" }];
    for (let i = 0; i < 10; i++) tiles.push(horizontal(i, i + 1, "right"));
    const layout = computeLayout(tiles, BOARD_W, BOARD_H);
    const maxX = Math.max(...layout.map((t) => t.x + t.w));
    expect(maxX).toBeLessThan(BOARD_W + LONG);
  });
});

describe("getLayoutExtent", () => {
  it("returns null for an empty layout", () => {
    expect(getLayoutExtent([])).toBeNull();
  });

  it("uses actual tile footprints", () => {
    const extent = getLayoutExtent(
      computeLayout([{ leftValue: 6, rightValue: 6, side: "first" }], BOARD_W, BOARD_H),
    )!;
    expect(extent.width).toBeCloseTo(UNIT);
    expect(extent.height).toBeCloseTo(LONG);
  });
});

describe("predictNext", () => {
  it("returns null when there is no chain", () => {
    expect(predictNext([], "right", { leftValue: 6, rightValue: 2 }, BOARD_W, BOARD_H)).toBeNull();
  });

  it("matches the actual placed tile on the right end", () => {
    const tiles = [{ leftValue: 6, rightValue: 6, side: "first" as const }];
    const predicted = predictNext(tiles, "right", { leftValue: 6, rightValue: 2 }, BOARD_W, BOARD_H)!;
    const placed = computeLayout(
      [...tiles, { leftValue: 6, rightValue: 2, side: "right" }],
      BOARD_W,
      BOARD_H,
    )[1]!;
    expect(predicted.x).toBeCloseTo(placed.x);
    expect(predicted.y).toBeCloseTo(placed.y);
    expect(predicted.w).toBeCloseTo(placed.w);
    expect(predicted.h).toBeCloseTo(placed.h);
  });

  it("matches the actual placed tile on the left end", () => {
    const tiles = [{ leftValue: 6, rightValue: 6, side: "first" as const }];
    const predicted = predictNext(tiles, "left", { leftValue: 5, rightValue: 6 }, BOARD_W, BOARD_H)!;
    const placed = computeLayout(
      [{ leftValue: 5, rightValue: 6, side: "left" }, ...tiles],
      BOARD_W,
      BOARD_H,
    )[0]!;
    expect(predicted.x).toBeCloseTo(placed.x);
    expect(predicted.y).toBeCloseTo(placed.y);
  });
});
