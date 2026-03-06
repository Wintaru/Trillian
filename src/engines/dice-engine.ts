import type { DiceRollResult } from "../types/shadowrun-contracts.js";

export class DiceEngine {
  roll(pool: number, limit?: number): DiceRollResult {
    const clamped = Math.max(0, Math.floor(pool));
    const results: number[] = [];
    for (let i = 0; i < clamped; i++) {
      results.push(Math.floor(Math.random() * 6) + 1);
    }

    const hits = results.filter((d) => d >= 5).length;
    const ones = results.filter((d) => d === 1).length;
    const isGlitch = clamped > 0 && ones > clamped / 2;
    const isCriticalGlitch = isGlitch && hits === 0;
    const effectiveHits = limit !== undefined ? Math.min(hits, limit) : hits;

    return { pool: clamped, results, hits, ones, limit, effectiveHits, isGlitch, isCriticalGlitch };
  }

  pushTheLimit(pool: number, edgeDice: number): DiceRollResult {
    const result = this.roll(pool + edgeDice);
    return { ...result, edgeUsed: "push_the_limit" };
  }

  secondChance(previousResult: DiceRollResult): DiceRollResult {
    const keptDice = previousResult.results.filter((d) => d >= 5);
    const rerollCount = previousResult.results.length - keptDice.length;
    const rerolled = this.roll(rerollCount);
    const combined = [...keptDice, ...rerolled.results];

    const hits = combined.filter((d) => d >= 5).length;
    const ones = combined.filter((d) => d === 1).length;
    const isGlitch = combined.length > 0 && ones > combined.length / 2;
    const isCriticalGlitch = isGlitch && hits === 0;
    const effectiveHits = previousResult.limit !== undefined
      ? Math.min(hits, previousResult.limit)
      : hits;

    return {
      pool: combined.length,
      results: combined,
      hits,
      ones,
      limit: previousResult.limit,
      effectiveHits,
      isGlitch,
      isCriticalGlitch,
      edgeUsed: "second_chance",
    };
  }

  static physicalConditionMonitor(body: number): number {
    return Math.ceil(body / 2) + 8;
  }

  static stunConditionMonitor(willpower: number): number {
    return Math.ceil(willpower / 2) + 8;
  }

  static physicalLimit(strength: number, body: number, reaction: number): number {
    return Math.ceil((strength * 2 + body + reaction) / 3);
  }

  static mentalLimit(logic: number, intuition: number, willpower: number): number {
    return Math.ceil((logic * 2 + intuition + willpower) / 3);
  }

  static socialLimit(charisma: number, willpower: number, essence: number): number {
    return Math.ceil((charisma * 2 + willpower + Math.floor(essence)) / 3);
  }

  static initiative(reaction: number, intuition: number): number {
    return reaction + intuition;
  }
}
