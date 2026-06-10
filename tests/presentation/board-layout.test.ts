import { describe, expect, it } from "vitest";
import {
  BOARD_TILE,
  SIDE_RESERVE,
  computeChainLayout,
  predictNextTileStyle,
} from "@/presentation/components/room/board-layout";

const CHAIN_W = 600;
const CHAIN_H = 300;

function horizontalTile(low: number, high: number, side: "first" | "left" | "right" = "right") {
  return { leftValue: high, rightValue: low, side };
}

describe("computeChainLayout", () => {
  it("centers the opening tile", () => {
    const [first] = computeChainLayout(
      [{ leftValue: 6, rightValue: 6, side: "first" }],
      CHAIN_W,
      CHAIN_H,
    );
    expect(first!.width).toBe(BOARD_TILE.vW);
    expect(first!.height).toBe(BOARD_TILE.vH);
    expect(first!.anchor.left).toBe(CHAIN_W / 2 - BOARD_TILE.vW / 2);
    expect(first!.anchor.top).toBe(CHAIN_H / 2 - BOARD_TILE.vH / 2);
  });

  it("places a horizontal tile to the right using the vertical double width", () => {
    const styles = computeChainLayout(
      [
        { leftValue: 6, rightValue: 6, side: "first" },
        { leftValue: 6, rightValue: 5, side: "right" },
      ],
      CHAIN_W,
      CHAIN_H,
    );
    const [opening, right] = styles;
    const openingLeft = opening!.anchor.left!;
    expect(right!.anchor.left).toBe(openingLeft + BOARD_TILE.vW + BOARD_TILE.gap);
    expect(right!.anchor.top).toBe(opening!.anchor.top! + BOARD_TILE.vH / 2 - BOARD_TILE.hH / 2);
  });

  it("keeps pip orientation when placing to the left of a vertical double", () => {
    const styles = computeChainLayout(
      [
        { leftValue: 4, rightValue: 6, side: "left" },
        { leftValue: 6, rightValue: 6, side: "first" },
      ],
      CHAIN_W,
      CHAIN_H,
    );
    const [left, opening] = styles;
    expect(left!.anchor.left! + left!.width + BOARD_TILE.gap).toBe(opening!.anchor.left!);
    expect(left!.attachFrom).toBe("right");
  });

  it("places a tile to the left of the opening without overlap", () => {
    const styles = computeChainLayout(
      [
        { leftValue: 4, rightValue: 2, side: "left" },
        { leftValue: 6, rightValue: 6, side: "first" },
        { leftValue: 6, rightValue: 5, side: "right" },
      ],
      CHAIN_W,
      CHAIN_H,
    );
    const [left, opening, right] = styles;
    expect(left!.anchor.left).toBe(opening!.anchor.left! - BOARD_TILE.hW - BOARD_TILE.gap);
    expect(right!.anchor.left).toBe(opening!.anchor.left! + BOARD_TILE.vW + BOARD_TILE.gap);
    expect(left!.anchor.left! + BOARD_TILE.hW + BOARD_TILE.gap).toBeLessThanOrEqual(opening!.anchor.left!);
    expect(opening!.anchor.left! + BOARD_TILE.vW + BOARD_TILE.gap).toBeLessThanOrEqual(right!.anchor.left!);
  });

  it("wraps the right arm downward when reaching the right border", () => {
    const tiles = [horizontalTile(6, 6, "first")];
    for (let i = 0; i < 8; i++) tiles.push(horizontalTile(i, i + 1, "right"));

    const styles = computeChainLayout(tiles, CHAIN_W, CHAIN_H);
    const opening = styles[1]!;
    const last = styles[styles.length - 1]!;

    expect(last.anchor.top).toBeGreaterThan(opening.anchor.top!);
    expect(last.anchor.left! + last.width).toBeLessThanOrEqual(CHAIN_W - SIDE_RESERVE + 1);
    expect(last.anchor.left).toBeGreaterThanOrEqual(SIDE_RESERVE - 1);
  });

  it("shifts the RTL row back when a double replaces the last horizontal slot", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 3, rightValue: 1, side: "first" },
    ];
    for (let i = 0; i < 5; i++) tiles.push({ leftValue: 4, rightValue: 3, side: "right" });
    tiles.push({ leftValue: 4, rightValue: 4, side: "right" });

    const styles = computeChainLayout(tiles, 380, CHAIN_H);
    const double = styles[styles.length - 1]!;
    const neighbor = styles[styles.length - 2]!;
    const shift = BOARD_TILE.hW + BOARD_TILE.gap;

    expect(double.orientation).toBe("horizontal");
    expect(neighbor.anchor.left).toBe(double.anchor.left! - shift);
    expect(double.anchor.top).toBe(
      (neighbor.anchor.top ?? 0) + neighbor.height / 2 - double.height / 2,
    );
    expect(neighbor.anchor.left! + neighbor.width + BOARD_TILE.gap).toBeLessThanOrEqual(
      double.anchor.left!,
    );
  });

  it("does not overlap a double onto the previous horizontal in an RTL row", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 6, rightValue: 6, side: "first" },
    ];
    for (let i = 0; i < 8; i++) tiles.push({ leftValue: 2, rightValue: 5, side: "right" });
    tiles.push({ leftValue: 5, rightValue: 5, side: "right" });

    const styles = computeChainLayout(tiles, CHAIN_W, CHAIN_H);
    const double = styles[styles.length - 1]!;
    const prev = styles[styles.length - 2]!;

    expect(double.orientation).toBe("horizontal");
    expect(prev.orientation).toBe("horizontal");
    expect(prev.anchor.left! + prev.width + BOARD_TILE.gap).toBeLessThanOrEqual(double.anchor.left!);
  });

  it("places horizontal below a vertical corner, extending left (RTL row)", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 3, rightValue: 1, side: "first" },
    ];
    for (let i = 0; i < 6; i++) tiles.push({ leftValue: 4, rightValue: 2, side: "right" });

    const styles = computeChainLayout(tiles, 380, CHAIN_H);
    let cornerIdx = -1;
    for (let i = 1; i < styles.length; i++) {
      if ((styles[i]!.anchor.top ?? 0) > (styles[i - 1]!.anchor.top ?? 0)) {
        cornerIdx = i;
        break;
      }
    }
    expect(cornerIdx).toBeGreaterThan(0);
    if (cornerIdx + 1 < styles.length) {
      const corner = styles[cornerIdx]!;
      const next = styles[cornerIdx + 1]!;
      expect(corner.orientation).toBe("vertical");
      expect(next.orientation).toBe("horizontal");
      expect(next.anchor.top).toBe(corner.anchor.top! + corner.height + BOARD_TILE.gap);
      expect(next.anchor.left).toBe(corner.anchor.left! + corner.width / 2);
      expect(next.reversed).toBe(true);
    }
  });

  it("aligns the first downward corner to the right edge of the previous tile", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 3, rightValue: 1, side: "first" },
    ];
    for (let i = 0; i < 6; i++) tiles.push({ leftValue: i, rightValue: i + 1, side: "right" });

    const styles = computeChainLayout(tiles, 380, CHAIN_H);
    for (let i = 1; i < styles.length; i++) {
      const prev = styles[i - 1]!;
      const cur = styles[i]!;
      if ((cur.anchor.top ?? 0) > (prev.anchor.top ?? 0)) {
        expect(cur.anchor.left).toBe(prev.anchor.left! + prev.width - cur.width);
        expect(cur.orientation).toBe("vertical");
        return;
      }
    }
    expect.fail("expected a downward corner");
  });

  it("places horizontal flush below a vertical double at the left border", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 2, rightValue: 2, side: "first" },
    ];
    for (let i = 0; i < 18; i++) tiles.push({ leftValue: 2, rightValue: 3, side: "right" });
    tiles.push({ leftValue: 2, rightValue: 4, side: "right" });
    tiles.push({ leftValue: 4, rightValue: 4, side: "right" });
    tiles.push({ leftValue: 2, rightValue: 6, side: "right" });

    const styles = computeChainLayout(tiles, 1200, CHAIN_H);
    let found = false;
    for (let i = 1; i < styles.length; i++) {
      const prev = styles[i - 1]!;
      const cur = styles[i]!;
      if (
        prev.orientation === "vertical" &&
        cur.orientation === "horizontal" &&
        cur.anchor.top === prev.anchor.top! + prev.height + BOARD_TILE.gap
      ) {
        expect(cur.anchor.left).toBe(prev.anchor.left! + prev.width / 2);
        expect(cur.reversed).toBe(true);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("predicts the same position as the placed tile for the right end", () => {
    const tiles = [{ leftValue: 6, rightValue: 6, side: "first" as const }];
    const predicted = predictNextTileStyle(
      tiles,
      "right",
      { leftValue: 6, rightValue: 2 },
      CHAIN_W,
      CHAIN_H,
    );
    const placed = computeChainLayout(
      [...tiles, { leftValue: 6, rightValue: 2, side: "right" }],
      CHAIN_W,
      CHAIN_H,
    )[1]!;

    expect(predicted?.anchor.left).toBe(placed.anchor.left);
    expect(predicted?.anchor.top).toBe(placed.anchor.top);
    expect(predicted?.width).toBe(placed.width);
    expect(predicted?.height).toBe(placed.height);
  });

  it("predicts the same position as the placed tile for the left end", () => {
    const tiles = [{ leftValue: 6, rightValue: 6, side: "first" as const }];
    const predicted = predictNextTileStyle(
      tiles,
      "left",
      { leftValue: 5, rightValue: 6 },
      CHAIN_W,
      CHAIN_H,
    );
    const placed = computeChainLayout(
      [{ leftValue: 5, rightValue: 6, side: "left" }, ...tiles],
      CHAIN_W,
      CHAIN_H,
    )[0]!;

    expect(predicted?.anchor.left).toBe(placed.anchor.left);
    expect(predicted?.anchor.top).toBe(placed.anchor.top);
  });

  it("places the first tile of an upper row to the left of the vertical connector", () => {
    const tiles: ReturnType<typeof horizontalTile>[] = [];
    for (let i = 0; i < 8; i++) tiles.push(horizontalTile(i, i + 1, "left"));
    tiles.push(horizontalTile(8, 8, "first"));

    const styles = computeChainLayout(tiles, CHAIN_W, CHAIN_H);
    let upCornerIdx = -1;
    for (let i = 1; i < styles.length; i++) {
      if ((styles[i]!.anchor.top ?? 0) < (styles[i - 1]!.anchor.top ?? 0)) {
        upCornerIdx = i;
        break;
      }
    }
    let found = false;
    for (let i = 1; i < styles.length; i++) {
      const corner = styles[i]!;
      const branch = styles[i - 1]!;
      if (
        corner.orientation === "vertical" &&
        branch.orientation === "horizontal" &&
        branch.anchor.top === corner.anchor.top! - branch.height - BOARD_TILE.gap
      ) {
        expect(branch.anchor.left).toBe(corner.anchor.left! + corner.width / 2 - branch.width);
        expect(branch.reversed).toBe(true);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("places a double above a vertical up-turn, not beside it", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 3, rightValue: 3, side: "left" },
      { leftValue: 3, rightValue: 4, side: "left" },
      { leftValue: 4, rightValue: 2, side: "left" },
      { leftValue: 2, rightValue: 1, side: "left" },
      { leftValue: 1, rightValue: 0, side: "left" },
      { leftValue: 0, rightValue: 0, side: "first" },
    ];

    const styles = computeChainLayout(tiles, 220, CHAIN_H);
    const corner = styles.find(
      (s) =>
        (s.leftValue === 3 && s.rightValue === 4) ||
        (s.leftValue === 4 && s.rightValue === 3),
    )!;
    const double3 = styles.find((s) => s.leftValue === 3 && s.rightValue === 3)!;

    expect(corner.orientation).toBe("vertical");
    expect(double3.orientation).toBe("horizontal");
    expect(double3.anchor.left).toBe(
      corner.anchor.left! + corner.width / 2 - double3.width / 2,
    );
    expect(double3.anchor.top! + double3.height + BOARD_TILE.gap).toBe(corner.anchor.top!);
  });

  it("places the next vertical tile above a corner double, not beside it", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 3, rightValue: 1, side: "left" },
      { leftValue: 3, rightValue: 3, side: "left" },
      { leftValue: 3, rightValue: 4, side: "left" },
      { leftValue: 4, rightValue: 2, side: "left" },
      { leftValue: 2, rightValue: 1, side: "left" },
      { leftValue: 1, rightValue: 0, side: "left" },
      { leftValue: 0, rightValue: 0, side: "first" },
    ];

    const styles = computeChainLayout(tiles, 220, CHAIN_H);
    const double3 = styles.find((s) => s.leftValue === 3 && s.rightValue === 3)!;
    const tile31 = styles.find(
      (s) =>
        (s.leftValue === 3 && s.rightValue === 1) ||
        (s.leftValue === 1 && s.rightValue === 3),
    )!;

    expect(double3.orientation).toBe("horizontal");
    expect(tile31.orientation).toBe("vertical");
    expect(tile31.anchor.top! + tile31.height + BOARD_TILE.gap).toBe(double3.anchor.top!);
    expect(tile31.anchor.left).toBe(double3.anchor.left);
  });

  it("places a horizontal double below a down-turn, then vertical, then RTL row", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 6, rightValue: 6, side: "first" },
      { leftValue: 6, rightValue: 3, side: "right" },
      { leftValue: 1, rightValue: 6, side: "right" },
      { leftValue: 1, rightValue: 1, side: "right" },
      { leftValue: 1, rightValue: 4, side: "right" },
      { leftValue: 1, rightValue: 0, side: "right" },
    ];

    const styles = computeChainLayout(tiles, 420, CHAIN_H);
    const double1 = styles.find((s) => s.leftValue === 1 && s.rightValue === 1)!;
    const tile14 = styles.find(
      (s) =>
        (s.leftValue === 1 && s.rightValue === 4) ||
        (s.leftValue === 4 && s.rightValue === 1),
    )!;
    const tile10 = styles.find(
      (s) =>
        (s.leftValue === 1 && s.rightValue === 0) ||
        (s.leftValue === 0 && s.rightValue === 1),
    )!;

    expect(double1.orientation).toBe("horizontal");
    expect(tile14.orientation).toBe("vertical");
    expect(tile10.orientation).toBe("horizontal");
    expect(tile14.anchor.top!).toBe(double1.anchor.top! + double1.height + BOARD_TILE.gap);
    expect(tile10.anchor.top!).toBe(tile14.anchor.top! + tile14.height - tile10.height);
    expect(tile10.anchor.left! + tile10.width + BOARD_TILE.gap).toBeLessThanOrEqual(tile14.anchor.left!);
  });

  it("places a double at the RTL row end to the left of the previous tile, without shifting the row", () => {
    const tiles: Parameters<typeof computeChainLayout>[0] = [
      { leftValue: 4, rightValue: 4, side: "first" },
      { leftValue: 5, rightValue: 4, side: "right" },
      { leftValue: 0, rightValue: 5, side: "right" },
      { leftValue: 4, rightValue: 0, side: "right" },
      { leftValue: 6, rightValue: 4, side: "right" },
      { leftValue: 5, rightValue: 6, side: "right" },
      { leftValue: 1, rightValue: 5, side: "right" },
      { leftValue: 5, rightValue: 5, side: "right" },
    ];

    const styles = computeChainLayout(tiles, CHAIN_W, CHAIN_H);
    const double5 = styles.find((s) => s.leftValue === 5 && s.rightValue === 5)!;
    const tile51 = styles.find(
      (s) =>
        (s.leftValue === 5 && s.rightValue === 1) ||
        (s.leftValue === 1 && s.rightValue === 5),
    )!;
    const tile56 = styles.find(
      (s) =>
        (s.leftValue === 5 && s.rightValue === 6) ||
        (s.leftValue === 6 && s.rightValue === 5),
    )!;

    expect(double5.orientation).toBe("vertical");
    expect(double5.anchor.left! + double5.width + BOARD_TILE.gap).toBe(tile51.anchor.left);
    expect(tile56.anchor.left).toBe(tile51.anchor.left! + tile51.width + BOARD_TILE.gap);
  });

  it("wraps the left arm upward when reaching the left border", () => {
    const tiles: ReturnType<typeof horizontalTile>[] = [];
    for (let i = 0; i < 8; i++) tiles.push(horizontalTile(i, i + 1, "left"));
    tiles.push(horizontalTile(8, 8, "first"));

    const styles = computeChainLayout(tiles, CHAIN_W, CHAIN_H);
    const opening = styles[styles.length - 1]!;
    const leftmost = styles[0]!;

    expect(leftmost.anchor.top).toBeLessThan(opening.anchor.top!);
    expect(leftmost.anchor.left).toBeGreaterThanOrEqual(SIDE_RESERVE - 1);
  });

});
