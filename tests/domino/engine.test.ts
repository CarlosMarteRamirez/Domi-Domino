import { describe, it, expect } from "vitest";
import { DominoEngine, type EnginePlayer } from "@domain/domino/engine/domino-engine";
import { DEFAULT_MATCH_CONFIG, type MatchConfig } from "@domain/domino/types";

function fourPlayers(): EnginePlayer[] {
  return [
    { id: "a", seat: 0, teamIndex: 0 },
    { id: "b", seat: 1, teamIndex: 1 },
    { id: "c", seat: 2, teamIndex: 0 },
    { id: "d", seat: 3, teamIndex: 1 },
  ];
}

/**
 * Drives a full match automatically: the current player always plays their
 * first legal move, otherwise passes. New rounds are started as needed. Returns
 * the final state. A step cap guards against accidental infinite loops.
 */
function autoPlay(engine: DominoEngine): ReturnType<DominoEngine["snapshot"]> {
  let guard = 0;
  while (!engine.isFinished && guard++ < 5000) {
    const state = engine.snapshot();
    if (!engine.currentRound || engine.currentRound.isFinished) {
      const started = engine.startRound();
      if (!started.ok) break;
      continue;
    }
    const current = state.currentPlayerId!;
    const moves = engine.legalMovesOf(current);
    if (moves.length > 0) {
      const move = moves[0];
      const res = engine.playTile(current, move.tile, move.sides[0]);
      expect(res.ok).toBe(true);
    } else {
      const res = engine.pass(current);
      expect(res.ok).toBe(true);
    }
  }
  return engine.snapshot();
}

describe("DominoEngine", () => {
  it("auto-assigns teams to alternating seats for 4 players", () => {
    const players = DominoEngine.autoAssignTeams(["a", "b", "c", "d"], DEFAULT_MATCH_CONFIG);
    expect(players.map((p) => p.teamIndex)).toEqual([0, 1, 0, 1]);
  });

  it("starts a round and deals 7 tiles to each player", () => {
    const engine = new DominoEngine(fourPlayers(), DEFAULT_MATCH_CONFIG, 123);
    const res = engine.startRound();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.players.every((p) => p.handCount === 7)).toBe(true);
      expect(res.value.currentPlayerId).not.toBeNull();
    }
  });

  it("exposes legal moves only for the player on turn", () => {
    const engine = new DominoEngine(fourPlayers(), DEFAULT_MATCH_CONFIG, 5);
    engine.startRound();
    const current = engine.snapshot().currentPlayerId!;
    const other = engine.snapshot().players.find((p) => p.id !== current)!.id;
    expect(engine.legalMovesOf(other)).toHaveLength(0);
    expect(engine.legalMovesOf(current).length).toBeGreaterThan(0);
  });

  it("plays a full match to completion with a winner reaching the target", () => {
    const config: MatchConfig = { ...DEFAULT_MATCH_CONFIG, targetScore: 100 };
    const engine = new DominoEngine(fourPlayers(), config, 2026);
    const final = autoPlay(engine);
    expect(final.finished).toBe(true);
    expect(final.winningTeam).not.toBeNull();
    expect(final.teamScores[final.winningTeam!]).toBeGreaterThanOrEqual(100);
  });

  it("is fully deterministic for the same seed and move policy", () => {
    const make = () => new DominoEngine(fourPlayers(), { ...DEFAULT_MATCH_CONFIG, targetScore: 100 }, 99);
    const a = autoPlay(make());
    const b = autoPlay(make());
    expect(a.teamScores).toEqual(b.teamScores);
    expect(a.winningTeam).toBe(b.winningTeam);
  });
});
