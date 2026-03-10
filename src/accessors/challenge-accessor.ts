import { eq, and, sql, desc, lte, asc } from "drizzle-orm";
import { db } from "./database.js";
import { challenges, challengeSubmissions, dailyWords } from "../db/schema.js";
import type {
  ChallengeSubmissionEntry,
  ChallengeLeaderboardEntry,
} from "../types/challenge-contracts.js";

export class ChallengeAccessor {
  async createChallenge(
    guildId: string,
    channelId: string,
    language: string,
    direction: string,
    sentence: string,
    referenceTranslation: string,
    context: string,
    closesAt: number,
    createdAt: number,
  ): Promise<{ id: number }> {
    const result = await db
      .insert(challenges)
      .values({
        guildId,
        channelId,
        language,
        direction,
        sentence,
        referenceTranslation,
        context,
        closesAt,
        createdAt,
      })
      .returning({ id: challenges.id });
    return result[0];
  }

  async setChallengeMessageId(challengeId: number, messageId: string): Promise<void> {
    await db
      .update(challenges)
      .set({ messageId })
      .where(eq(challenges.id, challengeId));
  }

  async getChallenge(challengeId: number): Promise<{
    id: number;
    guildId: string;
    channelId: string;
    messageId: string;
    language: string;
    direction: string;
    sentence: string;
    referenceTranslation: string;
    context: string;
    status: string;
    closesAt: number;
    createdAt: number;
  } | null> {
    const rows = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getLatestChallenge(guildId: string): Promise<{
    id: number;
    guildId: string;
    channelId: string;
    messageId: string;
    language: string;
    direction: string;
    sentence: string;
    referenceTranslation: string;
    context: string;
    status: string;
    closesAt: number;
    createdAt: number;
  } | null> {
    const rows = await db
      .select()
      .from(challenges)
      .where(eq(challenges.guildId, guildId))
      .orderBy(desc(challenges.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsertSubmission(
    challengeId: number,
    userId: string,
    translation: string,
    scores: {
      accuracyScore: number;
      grammarScore: number;
      naturalnessScore: number;
      compositeScore: number;
    },
    feedback: string,
    submittedAt: number,
  ): Promise<"submitted" | "resubmitted"> {
    const result = await db
      .insert(challengeSubmissions)
      .values({
        challengeId,
        userId,
        translation,
        ...scores,
        feedback,
        submittedAt,
      })
      .onConflictDoNothing()
      .returning({ id: challengeSubmissions.id });

    if (result.length > 0) return "submitted";

    // Row existed — update it
    await db
      .update(challengeSubmissions)
      .set({
        translation,
        ...scores,
        feedback,
        submittedAt,
      })
      .where(
        and(
          eq(challengeSubmissions.challengeId, challengeId),
          eq(challengeSubmissions.userId, userId),
        ),
      );

    return "resubmitted";
  }

  async getSubmissions(challengeId: number): Promise<ChallengeSubmissionEntry[]> {
    const rows = await db
      .select({
        userId: challengeSubmissions.userId,
        translation: challengeSubmissions.translation,
        compositeScore: challengeSubmissions.compositeScore,
        accuracyScore: challengeSubmissions.accuracyScore,
        grammarScore: challengeSubmissions.grammarScore,
        naturalnessScore: challengeSubmissions.naturalnessScore,
        feedback: challengeSubmissions.feedback,
      })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.challengeId, challengeId))
      .orderBy(desc(challengeSubmissions.compositeScore));

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }

  async getOpenChallengesDueBefore(
    now: number,
  ): Promise<{ id: number; channelId: string; messageId: string }[]> {
    return db
      .select({
        id: challenges.id,
        channelId: challenges.channelId,
        messageId: challenges.messageId,
      })
      .from(challenges)
      .where(
        and(
          eq(challenges.status, "open"),
          lte(challenges.closesAt, now),
        ),
      );
  }

  async closeChallenge(challengeId: number): Promise<void> {
    await db
      .update(challenges)
      .set({ status: "closed" })
      .where(eq(challenges.id, challengeId));
  }

  async getLeaderboard(guildId: string): Promise<ChallengeLeaderboardEntry[]> {
    const rows = await db
      .select({
        userId: challengeSubmissions.userId,
        totalChallenges: sql<number>`count(DISTINCT ${challengeSubmissions.challengeId})`,
        totalScore: sql<number>`coalesce(sum(${challengeSubmissions.compositeScore}), 0)`,
        averageScore: sql<number>`coalesce(avg(${challengeSubmissions.compositeScore}), 0)`,
      })
      .from(challengeSubmissions)
      .innerJoin(challenges, eq(challengeSubmissions.challengeId, challenges.id))
      .where(eq(challenges.guildId, guildId))
      .groupBy(challengeSubmissions.userId)
      .orderBy(desc(sql`avg(${challengeSubmissions.compositeScore})`))
      .limit(20);

    return rows.map((row, index) => ({
      userId: row.userId,
      totalChallenges: Number(row.totalChallenges),
      averageScore: Math.round(Number(row.averageScore) * 10) / 10,
      totalScore: Math.round(Number(row.totalScore) * 10) / 10,
      position: index + 1,
    }));
  }

  async getRecentDailyWords(language: string, limit: number): Promise<string[]> {
    const rows = await db
      .select({ word: dailyWords.word })
      .from(dailyWords)
      .where(eq(dailyWords.language, language))
      .orderBy(desc(dailyWords.postedAt))
      .limit(limit);
    return rows.map((r) => r.word);
  }
}
