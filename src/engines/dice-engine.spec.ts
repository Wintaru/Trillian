import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiceEngine } from "./dice-engine.js";

describe("DiceEngine", () => {
  let engine: DiceEngine;

  beforeEach(() => {
    engine = new DiceEngine();
  });

  describe("roll", () => {
    it("should return the correct number of dice", () => {
      const result = engine.roll(8);
      expect(result.results).toHaveLength(8);
      expect(result.pool).toBe(8);
    });

    it("should only produce values 1-6", () => {
      const result = engine.roll(100);
      for (const die of result.results) {
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(6);
      }
    });

    it("should count hits correctly (5s and 6s)", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.5)   // 4
        .mockReturnValueOnce(0.7)   // 5
        .mockReturnValueOnce(0.84)  // 6
        .mockReturnValueOnce(0.4);  // 3

      const result = engine.roll(5);
      expect(result.hits).toBe(2);
      expect(result.ones).toBe(1);
      expect(result.results).toEqual([1, 4, 5, 6, 3]);

      vi.restoreAllMocks();
    });

    it("should detect a glitch when more than half are 1s", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.84); // 6

      const result = engine.roll(4);
      expect(result.isGlitch).toBe(true);
      expect(result.isCriticalGlitch).toBe(false);
      expect(result.hits).toBe(1);

      vi.restoreAllMocks();
    });

    it("should detect a critical glitch (glitch + zero hits)", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.33); // 3

      const result = engine.roll(4);
      expect(result.isGlitch).toBe(true);
      expect(result.isCriticalGlitch).toBe(true);
      expect(result.hits).toBe(0);

      vi.restoreAllMocks();
    });

    it("should not glitch when exactly half are 1s", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.0)   // 1
        .mockReturnValueOnce(0.84)  // 6
        .mockReturnValueOnce(0.84); // 6

      const result = engine.roll(4);
      expect(result.isGlitch).toBe(false);

      vi.restoreAllMocks();
    });

    it("should cap effective hits at the limit", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0.7)   // 5
        .mockReturnValueOnce(0.84)  // 6
        .mockReturnValueOnce(0.7)   // 5
        .mockReturnValueOnce(0.84); // 6

      const result = engine.roll(4, 2);
      expect(result.hits).toBe(4);
      expect(result.effectiveHits).toBe(2);
      expect(result.limit).toBe(2);

      vi.restoreAllMocks();
    });

    it("should not cap hits when no limit is provided", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0.7)   // 5
        .mockReturnValueOnce(0.84)  // 6
        .mockReturnValueOnce(0.7)   // 5
        .mockReturnValueOnce(0.84); // 6

      const result = engine.roll(4);
      expect(result.effectiveHits).toBe(4);
      expect(result.limit).toBeUndefined();

      vi.restoreAllMocks();
    });

    it("should handle zero pool", () => {
      const result = engine.roll(0);
      expect(result.results).toHaveLength(0);
      expect(result.hits).toBe(0);
      expect(result.isGlitch).toBe(false);
    });

    it("should handle negative pool by clamping to 0", () => {
      const result = engine.roll(-3);
      expect(result.results).toHaveLength(0);
      expect(result.pool).toBe(0);
    });
  });

  describe("pushTheLimit", () => {
    it("should add edge dice to the pool", () => {
      const result = engine.pushTheLimit(6, 3);
      expect(result.results).toHaveLength(9);
      expect(result.edgeUsed).toBe("push_the_limit");
    });

    it("should not apply a limit", () => {
      const result = engine.pushTheLimit(4, 2);
      expect(result.limit).toBeUndefined();
      expect(result.effectiveHits).toBe(result.hits);
    });
  });

  describe("secondChance", () => {
    it("should re-roll non-hits from a previous result", () => {
      const previous = engine.roll(6, 4);
      const rerolled = engine.secondChance(previous);

      expect(rerolled.edgeUsed).toBe("second_chance");
      expect(rerolled.pool).toBe(previous.pool);
      expect(rerolled.limit).toBe(previous.limit);
    });

    it("should keep original hits", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0.7)   // 5 (hit, kept)
        .mockReturnValueOnce(0.33)  // 3 (miss, rerolled)
        .mockReturnValueOnce(0.17)  // 2 (miss, rerolled)
        .mockReturnValueOnce(0.84); // reroll -> 6

      // First roll: [5, 3, 2] -> 1 hit
      // Mocking only 4 calls: 3 for initial, 1 for first reroll die
      // secondChance will reroll the 2 misses
      vi.restoreAllMocks();

      // Simpler deterministic test
      const previous: Parameters<typeof engine.secondChance>[0] = {
        pool: 4,
        results: [5, 6, 2, 3],
        hits: 2,
        ones: 0,
        limit: undefined,
        effectiveHits: 2,
        isGlitch: false,
        isCriticalGlitch: false,
      };

      const rerolled = engine.secondChance(previous);
      // Should have kept the 5 and 6, rerolled 2 dice
      expect(rerolled.results.slice(0, 2)).toEqual([5, 6]);
      expect(rerolled.hits).toBeGreaterThanOrEqual(2);
    });
  });

  describe("derived stats", () => {
    it("should calculate physical condition monitor", () => {
      expect(DiceEngine.physicalConditionMonitor(3)).toBe(10);
      expect(DiceEngine.physicalConditionMonitor(4)).toBe(10);
      expect(DiceEngine.physicalConditionMonitor(5)).toBe(11);
      expect(DiceEngine.physicalConditionMonitor(6)).toBe(11);
      expect(DiceEngine.physicalConditionMonitor(9)).toBe(13);
    });

    it("should calculate stun condition monitor", () => {
      expect(DiceEngine.stunConditionMonitor(3)).toBe(10);
      expect(DiceEngine.stunConditionMonitor(4)).toBe(10);
      expect(DiceEngine.stunConditionMonitor(6)).toBe(11);
    });

    it("should calculate physical limit", () => {
      // ceil((STR*2 + BOD + REA) / 3)
      // ceil((4*2 + 3 + 3) / 3) = ceil(14/3) = ceil(4.67) = 5
      expect(DiceEngine.physicalLimit(4, 3, 3)).toBe(5);
    });

    it("should calculate mental limit", () => {
      // ceil((LOG*2 + INT + WIL) / 3)
      // ceil((5*2 + 3 + 4) / 3) = ceil(17/3) = ceil(5.67) = 6
      expect(DiceEngine.mentalLimit(5, 3, 4)).toBe(6);
    });

    it("should calculate social limit", () => {
      // ceil((CHA*2 + WIL + floor(ESS)) / 3)
      // ceil((4*2 + 3 + 6) / 3) = ceil(17/3) = ceil(5.67) = 6
      expect(DiceEngine.socialLimit(4, 3, 6.0)).toBe(6);

      // Essence reduced by cyberware: 4.5 -> floor = 4
      // ceil((4*2 + 3 + 4) / 3) = ceil(15/3) = 5
      expect(DiceEngine.socialLimit(4, 3, 4.5)).toBe(5);
    });

    it("should calculate initiative", () => {
      expect(DiceEngine.initiative(4, 5)).toBe(9);
    });
  });
});
