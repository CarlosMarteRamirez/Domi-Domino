/**
 * Deterministic pseudo-random number generator (mulberry32).
 *
 * The engine never touches Math.random directly: the seed is injected so that
 * deals are fully reproducible, which is essential for server authority and
 * for unit tests.
 */
export interface RandomSource {
  /** Returns a float in [0, 1). */
  next(): number;
}

export function createSeededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Fisher-Yates shuffle driven by an injected RandomSource (pure, in place copy). */
export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
