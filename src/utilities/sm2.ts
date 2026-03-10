export interface Sm2State {
  easeFactor: number;
  interval: number;
  repetition: number;
}

export interface Sm2Result extends Sm2State {
  nextReviewAt: number;
}

export const SM2_QUALITY_AGAIN = 0;
export const SM2_QUALITY_HARD = 2;
export const SM2_QUALITY_GOOD = 4;
export const SM2_QUALITY_EASY = 5;

const MIN_EASE_FACTOR = 1.3;
const MS_PER_DAY = 86_400_000;

export function calculateSm2(state: Sm2State, quality: number, now: number): Sm2Result {
  let { easeFactor, interval, repetition } = state;

  if (quality < 3) {
    // Lapse — reset
    repetition = 0;
    interval = 1;
  } else {
    // Correct
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < MIN_EASE_FACTOR) {
    easeFactor = MIN_EASE_FACTOR;
  }

  const nextReviewAt = now + interval * MS_PER_DAY;

  return { easeFactor, interval, repetition, nextReviewAt };
}
