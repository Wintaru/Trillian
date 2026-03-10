import { describe, it, expect } from "vitest";
import {
  calculateSm2,
  SM2_QUALITY_AGAIN,
  SM2_QUALITY_HARD,
  SM2_QUALITY_GOOD,
  SM2_QUALITY_EASY,
} from "./sm2.js";
import type { Sm2State } from "./sm2.js";

const NOW = 1_000_000_000_000;
const MS_PER_DAY = 86_400_000;

function freshState(): Sm2State {
  return { easeFactor: 2.5, interval: 0, repetition: 0 };
}

describe("calculateSm2", () => {
  it("should set interval to 1 day on first correct answer", () => {
    const result = calculateSm2(freshState(), SM2_QUALITY_GOOD, NOW);

    expect(result.interval).toBe(1);
    expect(result.repetition).toBe(1);
    expect(result.nextReviewAt).toBe(NOW + 1 * MS_PER_DAY);
  });

  it("should set interval to 6 days on second correct answer", () => {
    const state: Sm2State = { easeFactor: 2.5, interval: 1, repetition: 1 };
    const result = calculateSm2(state, SM2_QUALITY_GOOD, NOW);

    expect(result.interval).toBe(6);
    expect(result.repetition).toBe(2);
    expect(result.nextReviewAt).toBe(NOW + 6 * MS_PER_DAY);
  });

  it("should multiply interval by ease factor on third+ correct answer", () => {
    const state: Sm2State = { easeFactor: 2.5, interval: 6, repetition: 2 };
    const result = calculateSm2(state, SM2_QUALITY_GOOD, NOW);

    expect(result.interval).toBe(15); // round(6 * 2.5) = 15
    expect(result.repetition).toBe(3);
  });

  it("should reset repetition and interval on quality 0 (Again)", () => {
    const state: Sm2State = { easeFactor: 2.5, interval: 15, repetition: 3 };
    const result = calculateSm2(state, SM2_QUALITY_AGAIN, NOW);

    expect(result.interval).toBe(1);
    expect(result.repetition).toBe(0);
    expect(result.nextReviewAt).toBe(NOW + 1 * MS_PER_DAY);
  });

  it("should reset on quality 2 (Hard) since quality < 3 is a lapse", () => {
    const state: Sm2State = { easeFactor: 2.5, interval: 15, repetition: 3 };
    const result = calculateSm2(state, SM2_QUALITY_HARD, NOW);

    expect(result.interval).toBe(1);
    expect(result.repetition).toBe(0);
  });

  it("should grow interval faster with quality 5 (Easy) than quality 4 (Good)", () => {
    const state: Sm2State = { easeFactor: 2.5, interval: 6, repetition: 2 };

    const good = calculateSm2(state, SM2_QUALITY_GOOD, NOW);
    const easy = calculateSm2(state, SM2_QUALITY_EASY, NOW);

    // Both produce same interval on this step (same starting interval * EF)
    // but Easy increases ease factor more, leading to faster growth next time
    expect(easy.easeFactor).toBeGreaterThan(good.easeFactor);
  });

  it("should never let ease factor drop below 1.3", () => {
    // quality 0 drastically decreases ease factor
    let state: Sm2State = { easeFactor: 1.4, interval: 6, repetition: 2 };
    const result = calculateSm2(state, SM2_QUALITY_AGAIN, NOW);

    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("should clamp ease factor at 1.3 after repeated failures", () => {
    let state = freshState();

    // Fail many times
    for (let i = 0; i < 10; i++) {
      const result = calculateSm2(state, SM2_QUALITY_AGAIN, NOW + i * MS_PER_DAY);
      state = { easeFactor: result.easeFactor, interval: result.interval, repetition: result.repetition };
    }

    expect(state.easeFactor).toBe(1.3);
  });

  it("should progress through the standard SM-2 sequence", () => {
    let state = freshState();

    // Review 1: 1 day
    let result = calculateSm2(state, SM2_QUALITY_GOOD, NOW);
    expect(result.interval).toBe(1);

    // Review 2: 6 days
    state = result;
    result = calculateSm2(state, SM2_QUALITY_GOOD, NOW + 1 * MS_PER_DAY);
    expect(result.interval).toBe(6);

    // Review 3: 6 * EF
    state = result;
    result = calculateSm2(state, SM2_QUALITY_GOOD, NOW + 7 * MS_PER_DAY);
    expect(result.interval).toBeGreaterThan(6);

    // Review 4: interval grows further
    state = result;
    const prevInterval = result.interval;
    result = calculateSm2(state, SM2_QUALITY_GOOD, NOW + (7 + prevInterval) * MS_PER_DAY);
    expect(result.interval).toBeGreaterThan(prevInterval);
  });
});
