import type { PlayerCount } from "../types";

/**
 * Maps a seat to its team index.
 *
 * - 4 players: partners sit opposite each other, so seats {0,2} form team 0 and
 *   seats {1,3} form team 1.
 * - 2 players: each player is their own team.
 */
export function teamOfSeat(seat: number, playerCount: PlayerCount): number {
  return playerCount === 4 ? seat % 2 : seat;
}

export function teamCount(playerCount: PlayerCount): number {
  return playerCount === 4 ? 2 : 2;
}
