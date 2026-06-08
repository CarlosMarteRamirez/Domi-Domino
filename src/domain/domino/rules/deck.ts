import type { PlayerCount } from "../types";
import { Tile, buildDoubleSixSet } from "../value-objects/tile";
import { shuffle, type RandomSource } from "../../shared/random";

export const TILES_PER_HAND = 7;

export interface Deal {
  /** Hands keyed by seat index (0..playerCount-1). */
  hands: Tile[][];
  /** Tiles not dealt to anyone (only non-empty for 2-player games). */
  boneyard: Tile[];
}

/**
 * Deals 7 tiles per player from a shuffled double-six set.
 *
 * - 4 players: the full 28 tiles are dealt (no boneyard).
 * - 2 players: 7 tiles each, the remaining 14 stay out of play and players
 *   pass when they cannot move.
 */
export function deal(playerCount: PlayerCount, random: RandomSource): Deal {
  const shuffled = shuffle(buildDoubleSixSet(), random);
  const hands: Tile[][] = Array.from({ length: playerCount }, () => []);
  let cursor = 0;
  for (let seat = 0; seat < playerCount; seat++) {
    hands[seat] = shuffled.slice(cursor, cursor + TILES_PER_HAND);
    cursor += TILES_PER_HAND;
  }
  return { hands, boneyard: shuffled.slice(cursor) };
}

/**
 * Determines which seat opens the first round: the holder of the highest
 * double, falling back to the highest tile by pips when no doubles are dealt.
 */
export function findOpeningSeat(hands: Tile[][]): number {
  let bestSeat = 0;
  let bestDoubleRank = -1;
  for (let seat = 0; seat < hands.length; seat++) {
    for (const tile of hands[seat]) {
      if (tile.isDouble && tile.high > bestDoubleRank) {
        bestDoubleRank = tile.high;
        bestSeat = seat;
      }
    }
  }
  if (bestDoubleRank !== -1) return bestSeat;

  let bestPips = -1;
  for (let seat = 0; seat < hands.length; seat++) {
    for (const tile of hands[seat]) {
      if (tile.pips > bestPips) {
        bestPips = tile.pips;
        bestSeat = seat;
      }
    }
  }
  return bestSeat;
}
