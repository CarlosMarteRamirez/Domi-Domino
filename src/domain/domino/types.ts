/** Number of pips on one half of a tile in a double-six set. */
export type PipValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const PIP_VALUES: readonly PipValue[] = [0, 1, 2, 3, 4, 5, 6];

/** Which open end of the board a tile is being attached to. */
export type Side = "left" | "right";

/** Block (tranque) resolution mode, configured per match. */
export type BlockMode = "individual" | "parejas";

/** Pass-completed bonus options, configured per match. */
export type PassBonus = 0 | 25 | 30;

/** Target score options that end the match. */
export type TargetScore = 100 | 200 | 400 | 500;

export type TeamSelection = "manual" | "auto";

export type PlayerCount = 2 | 4;

export interface MatchConfig {
  targetScore: TargetScore;
  blockMode: BlockMode;
  passBonus: PassBonus;
  playerCount: PlayerCount;
  teamSelection: TeamSelection;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  targetScore: 200,
  blockMode: "parejas",
  passBonus: 25,
  playerCount: 4,
  teamSelection: "auto",
};

/** Why a round finished, used for scoring and history. */
export type RoundEndReason = "domino" | "blocked" | "tie";

export interface RoundResult {
  reason: RoundEndReason;
  /** Team index that won the round, or null on a tie. */
  winningTeam: number | null;
  /** Player id that emptied their hand on a "domino", if any. */
  winningPlayerId: string | null;
  /** Points awarded to the winning team for this round (excludes bonuses). */
  points: number;
  /** Pass-completed bonus awarded during the round, keyed by team index. */
  bonusByTeam: Record<number, number>;
  /** Remaining pip totals per player at round end, keyed by player id. */
  remainingByPlayer: Record<string, number>;
}
