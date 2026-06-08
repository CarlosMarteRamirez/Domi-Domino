import { Result, ok, err, domainError } from "../../shared/result";
import type { BlockMode, PassBonus, PlayerCount, Side, RoundResult } from "../types";
import { Tile } from "../value-objects/tile";
import { Board } from "./board";
import { Hand } from "./hand";

export interface RoundPlayer {
  id: string;
  seat: number;
  teamIndex: number;
  hand: Hand;
}

export interface RoundConfig {
  blockMode: BlockMode;
  passBonus: PassBonus;
  playerCount: PlayerCount;
}

export type RoundEvent =
  | { type: "tilePlaced"; playerId: string; tile: string; side: Side | "first" }
  | { type: "passed"; playerId: string }
  | { type: "passBonus"; playerId: string; teamIndex: number; amount: number }
  | { type: "roundEnded"; result: RoundResult };

export interface ActionOutcome {
  events: RoundEvent[];
  finished: boolean;
  result: RoundResult | null;
}

/**
 * Authoritative state machine for a single round (one full deal). All move
 * validation and scoring live here; it is pure and deterministic.
 */
export class Round {
  private readonly board = new Board();
  private readonly players: RoundPlayer[];
  private readonly bySeat: Map<number, RoundPlayer>;
  private currentSeat: number;
  private consecutivePasses = 0;
  private lastPlacerSeat: number | null = null;
  private finished = false;
  private result: RoundResult | null = null;
  private readonly bonusByTeam: Record<number, number> = {};

  constructor(
    players: RoundPlayer[],
    openingSeat: number,
    private readonly config: RoundConfig,
  ) {
    this.players = [...players].sort((a, b) => a.seat - b.seat);
    this.bySeat = new Map(this.players.map((p) => [p.seat, p]));
    this.currentSeat = openingSeat;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  get currentPlayerId(): string {
    return this.bySeat.get(this.currentSeat)!.id;
  }

  get boardView(): Board {
    return this.board;
  }

  get roundResult(): RoundResult | null {
    return this.result;
  }

  get passesInARow(): number {
    return this.consecutivePasses;
  }

  handOf(playerId: string): Hand {
    return this.players.find((p) => p.id === playerId)!.hand;
  }

  /** Sides a tile can legally be played on right now. */
  playableSides(tile: Tile): Side[] {
    if (this.board.isEmpty) return ["right"];
    const sides: Side[] = [];
    if (this.board.canPlay(tile, "left")) sides.push("left");
    if (this.board.canPlay(tile, "right")) sides.push("right");
    return sides;
  }

  /** Whether a player currently holds any playable tile. */
  canPlayerMove(playerId: string): boolean {
    const hand = this.handOf(playerId);
    return hand.all.some((t) => this.board.hasPlayFor(t));
  }

  playTile(playerId: string, tile: Tile, side: Side): Result<ActionOutcome> {
    if (this.finished) return err(domainError("ROUND_FINISHED", "The round is already over"));
    if (playerId !== this.currentPlayerId)
      return err(domainError("NOT_YOUR_TURN", "It is not your turn"));

    const player = this.bySeat.get(this.currentSeat)!;
    if (!player.hand.has(tile))
      return err(domainError("TILE_NOT_IN_HAND", `You do not hold ${tile.id}`));

    const effectiveSide: Side = this.board.isEmpty ? "right" : side;
    if (!this.board.canPlay(tile, effectiveSide))
      return err(domainError("ILLEGAL_MOVE", `${tile.id} does not fit on the ${side} end`));

    this.board.place(tile, effectiveSide, playerId);
    player.hand.remove(tile);
    this.lastPlacerSeat = this.currentSeat;
    this.consecutivePasses = 0;

    const events: RoundEvent[] = [
      { type: "tilePlaced", playerId, tile: tile.id, side: this.board.isEmpty ? "first" : side },
    ];

    if (player.hand.isEmpty) {
      const result = this.finishWithDomino(player);
      events.push({ type: "roundEnded", result });
      return ok({ events, finished: true, result });
    }

    this.advanceTurn();
    return ok({ events, finished: false, result: null });
  }

  pass(playerId: string): Result<ActionOutcome> {
    if (this.finished) return err(domainError("ROUND_FINISHED", "The round is already over"));
    if (playerId !== this.currentPlayerId)
      return err(domainError("NOT_YOUR_TURN", "It is not your turn"));
    if (this.canPlayerMove(playerId))
      return err(domainError("MUST_PLAY", "You have a playable tile and cannot pass"));

    this.consecutivePasses += 1;
    const events: RoundEvent[] = [{ type: "passed", playerId }];

    // Tranque: no player anywhere can move against the locked board.
    if (this.isBoardBlocked()) {
      const result = this.finishWithBlock();
      events.push({ type: "roundEnded", result });
      return ok({ events, finished: true, result });
    }

    this.advanceTurn();

    // Pass-completed bonus (4-player rule): the three other players all passed
    // in a row and the turn returns to the player who placed the last tile.
    if (
      this.config.passBonus > 0 &&
      this.config.playerCount === 4 &&
      this.lastPlacerSeat !== null &&
      this.currentSeat === this.lastPlacerSeat &&
      this.consecutivePasses === this.config.playerCount - 1
    ) {
      const placer = this.bySeat.get(this.lastPlacerSeat)!;
      this.bonusByTeam[placer.teamIndex] =
        (this.bonusByTeam[placer.teamIndex] ?? 0) + this.config.passBonus;
      this.consecutivePasses = 0;
      events.push({
        type: "passBonus",
        playerId: placer.id,
        teamIndex: placer.teamIndex,
        amount: this.config.passBonus,
      });
    }

    return ok({ events, finished: false, result: null });
  }

  private advanceTurn(): void {
    this.currentSeat = (this.currentSeat + 1) % this.config.playerCount;
  }

  private isBoardBlocked(): boolean {
    if (this.board.isEmpty) return false;
    return this.players.every((p) => !p.hand.all.some((t) => this.board.hasPlayFor(t)));
  }

  private remainingByPlayer(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const p of this.players) map[p.id] = p.hand.pips;
    return map;
  }

  private finishWithDomino(winner: RoundPlayer): RoundResult {
    this.finished = true;
    const points = this.players
      .filter((p) => p.teamIndex !== winner.teamIndex)
      .reduce((sum, p) => sum + p.hand.pips, 0);
    this.result = {
      reason: "domino",
      winningTeam: winner.teamIndex,
      winningPlayerId: winner.id,
      points,
      bonusByTeam: { ...this.bonusByTeam },
      remainingByPlayer: this.remainingByPlayer(),
    };
    return this.result;
  }

  private finishWithBlock(): RoundResult {
    this.finished = true;
    const remaining = this.remainingByPlayer();

    if (this.config.blockMode === "parejas") {
      const teamTotals = this.teamTotals();
      const teams = Object.keys(teamTotals).map(Number);
      const minTotal = Math.min(...teams.map((t) => teamTotals[t]));
      const winners = teams.filter((t) => teamTotals[t] === minTotal);
      if (winners.length !== 1) return this.tieResult(remaining);
      const winningTeam = winners[0];
      const points = teams
        .filter((t) => t !== winningTeam)
        .reduce((sum, t) => sum + teamTotals[t], 0);
      this.result = {
        reason: "blocked",
        winningTeam,
        winningPlayerId: null,
        points,
        bonusByTeam: { ...this.bonusByTeam },
        remainingByPlayer: remaining,
      };
      return this.result;
    }

    // individual: lowest single hand wins for their team.
    const minPips = Math.min(...this.players.map((p) => p.hand.pips));
    const lowest = this.players.filter((p) => p.hand.pips === minPips);
    if (lowest.length !== 1) return this.tieResult(remaining);
    const winner = lowest[0];
    const points = this.players
      .filter((p) => p.id !== winner.id)
      .reduce((sum, p) => sum + p.hand.pips, 0);
    this.result = {
      reason: "blocked",
      winningTeam: winner.teamIndex,
      winningPlayerId: winner.id,
      points,
      bonusByTeam: { ...this.bonusByTeam },
      remainingByPlayer: remaining,
    };
    return this.result;
  }

  private tieResult(remaining: Record<string, number>): RoundResult {
    this.result = {
      reason: "tie",
      winningTeam: null,
      winningPlayerId: null,
      points: 0,
      bonusByTeam: { ...this.bonusByTeam },
      remainingByPlayer: remaining,
    };
    return this.result;
  }

  private teamTotals(): Record<number, number> {
    const totals: Record<number, number> = {};
    for (const p of this.players) {
      totals[p.teamIndex] = (totals[p.teamIndex] ?? 0) + p.hand.pips;
    }
    return totals;
  }
}
