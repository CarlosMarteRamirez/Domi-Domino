import { Result, ok, err, domainError } from "../../shared/result";
import { createSeededRandom } from "../../shared/random";
import type { MatchConfig, Side } from "../types";
import { Tile } from "../value-objects/tile";
import { Hand } from "../entities/hand";
import { Round, type RoundPlayer, type RoundEvent } from "../entities/round";
import { deal, findOpeningSeat } from "../rules/deck";
import { teamOfSeat } from "../rules/teams";

export interface EnginePlayer {
  id: string;
  seat: number;
  teamIndex: number;
}

export interface PlayerPublicState {
  id: string;
  seat: number;
  teamIndex: number;
  handCount: number;
  isCurrentTurn: boolean;
}

export interface MatchState {
  config: MatchConfig;
  teamScores: Record<number, number>;
  roundIndex: number;
  finished: boolean;
  winningTeam: number | null;
  currentPlayerId: string | null;
  players: PlayerPublicState[];
  board: {
    tiles: {
      id: string;
      leftValue: number;
      rightValue: number;
      placedBy: string;
      side: import("../types").Side | "first";
    }[];
    leftEnd: number | null;
    rightEnd: number | null;
  };
  passesInARow: number;
  lastRoundResult: import("../types").RoundResult | null;
}

/**
 * Orchestrates an entire match: deals rounds, accumulates team scores and
 * declares the overall winner once a team reaches the configured target score.
 * Pure and deterministic given the same seed and the same sequence of moves.
 */
export class DominoEngine {
  private readonly players: EnginePlayer[];
  private readonly teamScores: Record<number, number> = {};
  private round: Round | null = null;
  private roundIndex = -1;
  private nextOpeningSeat: number | null = null;
  private finished = false;
  private winningTeam: number | null = null;
  private lastRoundResult: import("../types").RoundResult | null = null;

  constructor(
    players: EnginePlayer[],
    private readonly config: MatchConfig,
    private readonly seed: number,
  ) {
    this.players = [...players].sort((a, b) => a.seat - b.seat);
    for (const p of this.players) this.teamScores[p.teamIndex] ??= 0;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  get currentRound(): Round | null {
    return this.round;
  }

  /** Begins the next round, dealing a fresh hand. Idempotency is the caller's job. */
  startRound(): Result<MatchState> {
    if (this.finished) return err(domainError("MATCH_FINISHED", "The match is already over"));
    if (this.round && !this.round.isFinished)
      return err(domainError("ROUND_IN_PROGRESS", "Finish the current round first"));

    this.roundIndex += 1;
    const random = createSeededRandom(this.seed + this.roundIndex * 7919);
    const { hands } = deal(this.config.playerCount, random);

    const opening =
      this.nextOpeningSeat ?? findOpeningSeat(this.players.map((p) => hands[p.seat]));

    const roundPlayers: RoundPlayer[] = this.players.map((p) => ({
      id: p.id,
      seat: p.seat,
      teamIndex: p.teamIndex,
      hand: new Hand(hands[p.seat]),
    }));

    this.round = new Round(roundPlayers, opening, {
      blockMode: this.config.blockMode,
      passBonus: this.config.passBonus,
      playerCount: this.config.playerCount,
    });
    return ok(this.snapshot());
  }

  playTile(playerId: string, tileId: string, side: Side): Result<{ events: RoundEvent[]; state: MatchState }> {
    if (!this.round) return err(domainError("NO_ROUND", "No round in progress"));
    const outcome = this.round.playTile(playerId, Tile.fromId(tileId), side);
    if (!outcome.ok) return outcome;
    if (outcome.value.finished) this.applyRoundResult();
    return ok({ events: outcome.value.events, state: this.snapshot() });
  }

  pass(playerId: string): Result<{ events: RoundEvent[]; state: MatchState }> {
    if (!this.round) return err(domainError("NO_ROUND", "No round in progress"));
    const outcome = this.round.pass(playerId);
    if (!outcome.ok) return outcome;
    if (outcome.value.finished) this.applyRoundResult();
    return ok({ events: outcome.value.events, state: this.snapshot() });
  }

  private applyRoundResult(): void {
    const result = this.round!.roundResult!;
    this.lastRoundResult = result;

    for (const [team, bonus] of Object.entries(result.bonusByTeam)) {
      this.teamScores[Number(team)] += bonus;
    }
    if (result.winningTeam !== null) {
      this.teamScores[result.winningTeam] += result.points;
    }

    // Next round opens with the round winner (or their lowest-seated partner).
    if (result.winningPlayerId) {
      this.nextOpeningSeat = this.players.find((p) => p.id === result.winningPlayerId)!.seat;
    } else if (result.winningTeam !== null) {
      this.nextOpeningSeat = this.players
        .filter((p) => p.teamIndex === result.winningTeam)
        .sort((a, b) => a.seat - b.seat)[0].seat;
    }

    const target = this.config.targetScore;
    const leaders = Object.entries(this.teamScores)
      .filter(([, score]) => score >= target)
      .sort((a, b) => b[1] - a[1]);
    if (leaders.length > 0) {
      this.finished = true;
      this.winningTeam = Number(leaders[0][0]);
    }
  }

  /** Full public match state. Hands are reported as counts only. */
  snapshot(): MatchState {
    const board = this.round?.boardView ?? null;
    const currentPlayerId = this.round && !this.round.isFinished ? this.round.currentPlayerId : null;
    return {
      config: this.config,
      teamScores: { ...this.teamScores },
      roundIndex: this.roundIndex,
      finished: this.finished,
      winningTeam: this.winningTeam,
      currentPlayerId,
      players: this.players.map((p) => ({
        id: p.id,
        seat: p.seat,
        teamIndex: p.teamIndex,
        handCount: this.round ? this.round.handOf(p.id).size : 0,
        isCurrentTurn: p.id === currentPlayerId,
      })),
      board: {
        tiles: board
          ? board.tiles.map((t) => ({
              id: t.tile.id,
              leftValue: t.leftValue,
              rightValue: t.rightValue,
              placedBy: t.placedBy,
              side: t.side,
            }))
          : [],
        leftEnd: board?.leftEnd ?? null,
        rightEnd: board?.rightEnd ?? null,
      },
      passesInARow: this.round?.passesInARow ?? 0,
      lastRoundResult: this.lastRoundResult,
    };
  }

  /** Private per-player hand (the tile ids), for delivering to the owner only. */
  handTilesOf(playerId: string): string[] {
    if (!this.round) return [];
    return this.round.handOf(playerId).all.map((t) => t.id);
  }

  /** Tiles the player can legally play right now, with their valid sides. */
  legalMovesOf(playerId: string): { tile: string; sides: Side[] }[] {
    if (!this.round || this.round.isFinished) return [];
    if (this.round.currentPlayerId !== playerId) return [];
    return this.round
      .handOf(playerId)
      .all.map((t) => ({ tile: t.id, sides: this.round!.playableSides(t) }))
      .filter((m) => m.sides.length > 0);
  }

  static autoAssignTeams(playerIds: string[], config: MatchConfig): EnginePlayer[] {
    return playerIds.slice(0, config.playerCount).map((id, seat) => ({
      id,
      seat,
      teamIndex: teamOfSeat(seat, config.playerCount),
    }));
  }
}
