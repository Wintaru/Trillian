import { eq, and, ne, sql, sum, isNull, lte, gt, asc } from "drizzle-orm";
import { db } from "./database.js";
import { dailyWords, userVocabulary } from "../db/schema.js";
import type {
  GenerateWordResponse,
  SaveVocabResponse,
  VocabListEntry,
  VocabStatsResponse,
} from "../types/vocab-contracts.js";

export class VocabAccessor {
  async insertDailyWord(
    word: GenerateWordResponse,
    postedAt: number,
  ): Promise<{ id: number }> {
    const result = await db
      .insert(dailyWords)
      .values({
        word: word.word,
        language: word.language,
        translation: word.translation,
        pronunciation: word.pronunciation,
        exampleSentence: word.exampleSentence,
        exampleTranslation: word.exampleTranslation,
        linguisticNotes: word.linguisticNotes,
        postedAt,
      })
      .returning({ id: dailyWords.id });
    return result[0];
  }

  async hasWordBeenPosted(word: string, language: string): Promise<boolean> {
    const rows = await db
      .select({ id: dailyWords.id })
      .from(dailyWords)
      .where(and(eq(dailyWords.word, word), eq(dailyWords.language, language)))
      .limit(1);
    return rows.length > 0;
  }

  async saveUserWord(
    userId: string,
    dailyWordId: number,
    savedAt: number,
  ): Promise<SaveVocabResponse> {
    const result = await db
      .insert(userVocabulary)
      .values({ userId, dailyWordId, savedAt })
      .onConflictDoNothing()
      .returning({ id: userVocabulary.id });

    return result.length > 0
      ? { saved: true, reason: "saved" }
      : { saved: true, reason: "already_saved" };
  }

  async getUserVocab(userId: string): Promise<VocabListEntry[]> {
    const rows = await db
      .select({
        dailyWordId: dailyWords.id,
        word: dailyWords.word,
        language: dailyWords.language,
        translation: dailyWords.translation,
        reviewCount: userVocabulary.reviewCount,
        correctCount: userVocabulary.correctCount,
        savedAt: userVocabulary.savedAt,
        nextReviewAt: userVocabulary.nextReviewAt,
      })
      .from(userVocabulary)
      .innerJoin(dailyWords, eq(userVocabulary.dailyWordId, dailyWords.id))
      .where(eq(userVocabulary.userId, userId))
      .orderBy(userVocabulary.savedAt);
    return rows;
  }

  async getDueQuizWord(
    userId: string,
    now: number,
  ): Promise<{ dailyWordId: number; word: string; language: string; translation: string } | null> {
    // Prefer words that are due for review (null nextReviewAt = never reviewed = due now)
    const dueRows = await db
      .select({
        dailyWordId: dailyWords.id,
        word: dailyWords.word,
        language: dailyWords.language,
        translation: dailyWords.translation,
      })
      .from(userVocabulary)
      .innerJoin(dailyWords, eq(userVocabulary.dailyWordId, dailyWords.id))
      .where(and(
        eq(userVocabulary.userId, userId),
        sql`(${userVocabulary.nextReviewAt} IS NULL OR ${userVocabulary.nextReviewAt} <= ${now})`,
      ))
      .orderBy(asc(userVocabulary.nextReviewAt))
      .limit(1);

    if (dueRows.length > 0) return dueRows[0];

    // Fall back to random if no due words
    const randomRows = await db
      .select({
        dailyWordId: dailyWords.id,
        word: dailyWords.word,
        language: dailyWords.language,
        translation: dailyWords.translation,
      })
      .from(userVocabulary)
      .innerJoin(dailyWords, eq(userVocabulary.dailyWordId, dailyWords.id))
      .where(eq(userVocabulary.userId, userId))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    return randomRows[0] ?? null;
  }

  async getDistractors(
    dailyWordId: number,
    language: string,
    count: number,
  ): Promise<string[]> {
    const rows = await db
      .select({ translation: dailyWords.translation })
      .from(dailyWords)
      .where(and(eq(dailyWords.language, language), ne(dailyWords.id, dailyWordId)))
      .orderBy(sql`RANDOM()`)
      .limit(count);
    return rows.map((r) => r.translation);
  }

  async recordReview(
    userId: string,
    dailyWordId: number,
    correct: boolean,
  ): Promise<{ reviewCount: number; correctCount: number }> {
    const setClause: Record<string, unknown> = {
      reviewCount: sql`${userVocabulary.reviewCount} + 1`,
    };
    if (correct) {
      setClause["correctCount"] = sql`${userVocabulary.correctCount} + 1`;
    }

    await db
      .update(userVocabulary)
      .set(setClause)
      .where(
        and(
          eq(userVocabulary.userId, userId),
          eq(userVocabulary.dailyWordId, dailyWordId),
        ),
      );

    const rows = await db
      .select({
        reviewCount: userVocabulary.reviewCount,
        correctCount: userVocabulary.correctCount,
      })
      .from(userVocabulary)
      .where(
        and(
          eq(userVocabulary.userId, userId),
          eq(userVocabulary.dailyWordId, dailyWordId),
        ),
      )
      .limit(1);

    return rows[0] ?? { reviewCount: 0, correctCount: 0 };
  }

  async getUserStats(userId: string): Promise<VocabStatsResponse> {
    const rows = await db
      .select({
        totalWords: sql<number>`count(*)`,
        totalReviews: sql<number>`coalesce(sum(${userVocabulary.reviewCount}), 0)`,
        totalCorrect: sql<number>`coalesce(sum(${userVocabulary.correctCount}), 0)`,
      })
      .from(userVocabulary)
      .where(eq(userVocabulary.userId, userId));

    const stats = rows[0];
    const totalReviews = Number(stats.totalReviews);
    const totalCorrect = Number(stats.totalCorrect);

    return {
      totalWords: Number(stats.totalWords),
      totalReviews,
      totalCorrect,
      accuracy: totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0,
    };
  }

  async getDueWord(
    userId: string,
    now: number,
  ): Promise<{
    dailyWordId: number;
    word: string;
    language: string;
    translation: string;
    pronunciation: string;
    exampleSentence: string;
    exampleTranslation: string;
  } | null> {
    const rows = await db
      .select({
        dailyWordId: dailyWords.id,
        word: dailyWords.word,
        language: dailyWords.language,
        translation: dailyWords.translation,
        pronunciation: dailyWords.pronunciation,
        exampleSentence: dailyWords.exampleSentence,
        exampleTranslation: dailyWords.exampleTranslation,
      })
      .from(userVocabulary)
      .innerJoin(dailyWords, eq(userVocabulary.dailyWordId, dailyWords.id))
      .where(and(
        eq(userVocabulary.userId, userId),
        sql`(${userVocabulary.nextReviewAt} IS NULL OR ${userVocabulary.nextReviewAt} <= ${now})`,
      ))
      .orderBy(asc(userVocabulary.nextReviewAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async getSrsState(
    userId: string,
    dailyWordId: number,
  ): Promise<{ easeFactor: number; interval: number; repetition: number }> {
    const rows = await db
      .select({
        easeFactor: userVocabulary.easeFactor,
        interval: userVocabulary.interval,
        repetition: userVocabulary.repetition,
      })
      .from(userVocabulary)
      .where(and(
        eq(userVocabulary.userId, userId),
        eq(userVocabulary.dailyWordId, dailyWordId),
      ))
      .limit(1);
    return rows[0] ?? { easeFactor: 2.5, interval: 0, repetition: 0 };
  }

  async updateSrsState(
    userId: string,
    dailyWordId: number,
    state: {
      easeFactor: number;
      interval: number;
      repetition: number;
      nextReviewAt: number;
      lastReviewedAt: number;
    },
  ): Promise<void> {
    await db
      .update(userVocabulary)
      .set({
        easeFactor: state.easeFactor,
        interval: state.interval,
        repetition: state.repetition,
        nextReviewAt: state.nextReviewAt,
        lastReviewedAt: state.lastReviewedAt,
      })
      .where(and(
        eq(userVocabulary.userId, userId),
        eq(userVocabulary.dailyWordId, dailyWordId),
      ));
  }

  async getWordById(
    dailyWordId: number,
  ): Promise<{
    dailyWordId: number;
    word: string;
    language: string;
    translation: string;
    pronunciation: string;
    exampleSentence: string;
    exampleTranslation: string;
  } | null> {
    const rows = await db
      .select({
        dailyWordId: dailyWords.id,
        word: dailyWords.word,
        language: dailyWords.language,
        translation: dailyWords.translation,
        pronunciation: dailyWords.pronunciation,
        exampleSentence: dailyWords.exampleSentence,
        exampleTranslation: dailyWords.exampleTranslation,
      })
      .from(dailyWords)
      .where(eq(dailyWords.id, dailyWordId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getNextDueDate(userId: string): Promise<number | null> {
    const rows = await db
      .select({ nextReviewAt: userVocabulary.nextReviewAt })
      .from(userVocabulary)
      .where(and(
        eq(userVocabulary.userId, userId),
        gt(userVocabulary.nextReviewAt, 0),
      ))
      .orderBy(asc(userVocabulary.nextReviewAt))
      .limit(1);
    return rows[0]?.nextReviewAt ?? null;
  }
}
