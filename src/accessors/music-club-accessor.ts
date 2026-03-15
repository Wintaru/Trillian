import { eq, and, sql, desc, lte, or } from "drizzle-orm";
import { db } from "./database.js";
import {
  musicClubMembers,
  musicClubRounds,
  musicClubSongs,
  musicClubRatings,
} from "../db/schema.js";

const REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours before deadline

// --- Members ---

export class MusicClubAccessor {
  async addMember(userId: string, guildId: string, joinedAt: number): Promise<void> {
    await db
      .insert(musicClubMembers)
      .values({ userId, guildId, joinedAt })
      .onConflictDoNothing();
  }

  async removeMember(userId: string, guildId: string): Promise<boolean> {
    const result = await db
      .delete(musicClubMembers)
      .where(
        and(
          eq(musicClubMembers.userId, userId),
          eq(musicClubMembers.guildId, guildId),
        ),
      )
      .returning({ userId: musicClubMembers.userId });
    return result.length > 0;
  }

  async isMember(userId: string, guildId: string): Promise<boolean> {
    const rows = await db
      .select({ userId: musicClubMembers.userId })
      .from(musicClubMembers)
      .where(
        and(
          eq(musicClubMembers.userId, userId),
          eq(musicClubMembers.guildId, guildId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async getMemberCount(guildId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(musicClubMembers)
      .where(eq(musicClubMembers.guildId, guildId));
    return Number(rows[0].count);
  }

  // --- Rounds ---

  async createRound(
    guildId: string,
    channelId: string,
    startsAt: number,
    submissionsCloseAt: number,
    ratingsCloseAt: number,
    createdAt: number,
  ): Promise<{ id: number }> {
    const result = await db
      .insert(musicClubRounds)
      .values({ guildId, channelId, startsAt, submissionsCloseAt, ratingsCloseAt, createdAt })
      .returning({ id: musicClubRounds.id });
    return result[0];
  }

  async getRound(roundId: number): Promise<{
    id: number;
    guildId: string;
    channelId: string;
    messageId: string;
    status: string;
    startsAt: number;
    submissionsCloseAt: number;
    ratingsCloseAt: number;
    playlistMessageId: string;
    resultsMessageId: string;
    createdAt: number;
  } | null> {
    const rows = await db
      .select()
      .from(musicClubRounds)
      .where(eq(musicClubRounds.id, roundId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getActiveRound(guildId: string): Promise<{
    id: number;
    guildId: string;
    channelId: string;
    messageId: string;
    status: string;
    startsAt: number;
    submissionsCloseAt: number;
    ratingsCloseAt: number;
    playlistMessageId: string;
    resultsMessageId: string;
    createdAt: number;
  } | null> {
    const rows = await db
      .select()
      .from(musicClubRounds)
      .where(
        and(
          eq(musicClubRounds.guildId, guildId),
          or(
            eq(musicClubRounds.status, "open"),
            eq(musicClubRounds.status, "listening"),
          ),
        ),
      )
      .orderBy(desc(musicClubRounds.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async getLatestRound(guildId: string): Promise<{
    id: number;
    guildId: string;
    channelId: string;
    messageId: string;
    status: string;
    startsAt: number;
    submissionsCloseAt: number;
    ratingsCloseAt: number;
    playlistMessageId: string;
    resultsMessageId: string;
    createdAt: number;
  } | null> {
    const rows = await db
      .select()
      .from(musicClubRounds)
      .where(eq(musicClubRounds.guildId, guildId))
      .orderBy(desc(musicClubRounds.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async setRoundMessageId(roundId: number, messageId: string): Promise<void> {
    await db
      .update(musicClubRounds)
      .set({ messageId })
      .where(eq(musicClubRounds.id, roundId));
  }

  async setRoundStatus(roundId: number, status: string): Promise<void> {
    await db
      .update(musicClubRounds)
      .set({ status })
      .where(eq(musicClubRounds.id, roundId));
  }

  async setPlaylistMessageId(roundId: number, messageId: string): Promise<void> {
    await db
      .update(musicClubRounds)
      .set({ playlistMessageId: messageId })
      .where(eq(musicClubRounds.id, roundId));
  }

  async setResultsMessageId(roundId: number, messageId: string): Promise<void> {
    await db
      .update(musicClubRounds)
      .set({ resultsMessageId: messageId })
      .where(eq(musicClubRounds.id, roundId));
  }

  async getRoundsReadyToTransition(now: number): Promise<
    { id: number; channelId: string; messageId: string }[]
  > {
    return db
      .select({
        id: musicClubRounds.id,
        channelId: musicClubRounds.channelId,
        messageId: musicClubRounds.messageId,
      })
      .from(musicClubRounds)
      .where(
        and(
          eq(musicClubRounds.status, "open"),
          lte(musicClubRounds.submissionsCloseAt, now),
        ),
      );
  }

  async getRoundsNeedingSubmissionReminder(now: number): Promise<
    { id: number; channelId: string; submissionsCloseAt: number }[]
  > {
    return db
      .select({
        id: musicClubRounds.id,
        channelId: musicClubRounds.channelId,
        submissionsCloseAt: musicClubRounds.submissionsCloseAt,
      })
      .from(musicClubRounds)
      .where(
        and(
          eq(musicClubRounds.status, "open"),
          eq(musicClubRounds.submissionReminderSent, 0),
          lte(musicClubRounds.submissionsCloseAt, now + REMINDER_WINDOW_MS),
        ),
      );
  }

  async getRoundsNeedingRatingReminder(now: number): Promise<
    { id: number; channelId: string; ratingsCloseAt: number }[]
  > {
    return db
      .select({
        id: musicClubRounds.id,
        channelId: musicClubRounds.channelId,
        ratingsCloseAt: musicClubRounds.ratingsCloseAt,
      })
      .from(musicClubRounds)
      .where(
        and(
          eq(musicClubRounds.status, "listening"),
          eq(musicClubRounds.ratingReminderSent, 0),
          lte(musicClubRounds.ratingsCloseAt, now + REMINDER_WINDOW_MS),
        ),
      );
  }

  async markSubmissionReminderSent(roundId: number): Promise<void> {
    await db
      .update(musicClubRounds)
      .set({ submissionReminderSent: 1 })
      .where(eq(musicClubRounds.id, roundId));
  }

  async markRatingReminderSent(roundId: number): Promise<void> {
    await db
      .update(musicClubRounds)
      .set({ ratingReminderSent: 1 })
      .where(eq(musicClubRounds.id, roundId));
  }

  async getRoundsReadyToClose(now: number): Promise<
    { id: number; channelId: string; playlistMessageId: string }[]
  > {
    return db
      .select({
        id: musicClubRounds.id,
        channelId: musicClubRounds.channelId,
        playlistMessageId: musicClubRounds.playlistMessageId,
      })
      .from(musicClubRounds)
      .where(
        and(
          eq(musicClubRounds.status, "listening"),
          lte(musicClubRounds.ratingsCloseAt, now),
        ),
      );
  }

  // --- Songs ---

  async upsertSong(
    roundId: number,
    userId: string,
    originalUrl: string,
    title: string,
    artist: string,
    odesliData: string,
    reason: string,
    submittedAt: number,
  ): Promise<"submitted" | "resubmitted"> {
    const result = await db
      .insert(musicClubSongs)
      .values({ roundId, userId, originalUrl, title, artist, odesliData, reason, submittedAt })
      .onConflictDoNothing()
      .returning({ id: musicClubSongs.id });

    if (result.length > 0) return "submitted";

    await db
      .update(musicClubSongs)
      .set({ originalUrl, title, artist, odesliData, reason, submittedAt })
      .where(
        and(
          eq(musicClubSongs.roundId, roundId),
          eq(musicClubSongs.userId, userId),
        ),
      );

    return "resubmitted";
  }

  async getSong(songId: number): Promise<{
    id: number;
    roundId: number;
    userId: string;
    originalUrl: string;
    title: string;
    artist: string;
    odesliData: string;
    reason: string;
    submittedAt: number;
  } | null> {
    const rows = await db
      .select()
      .from(musicClubSongs)
      .where(eq(musicClubSongs.id, songId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getSongsForRound(roundId: number): Promise<
    {
      id: number;
      roundId: number;
      userId: string;
      originalUrl: string;
      title: string;
      artist: string;
      odesliData: string;
      reason: string;
      submittedAt: number;
    }[]
  > {
    return db
      .select()
      .from(musicClubSongs)
      .where(eq(musicClubSongs.roundId, roundId))
      .orderBy(musicClubSongs.submittedAt);
  }

  // --- Ratings ---

  async upsertRating(
    songId: number,
    userId: string,
    rating: number,
    ratedAt: number,
  ): Promise<"rated" | "changed"> {
    const result = await db
      .insert(musicClubRatings)
      .values({ songId, userId, rating, ratedAt })
      .onConflictDoNothing()
      .returning({ songId: musicClubRatings.songId });

    if (result.length > 0) return "rated";

    await db
      .update(musicClubRatings)
      .set({ rating, ratedAt })
      .where(
        and(
          eq(musicClubRatings.songId, songId),
          eq(musicClubRatings.userId, userId),
        ),
      );

    return "changed";
  }

  async getUserRatingsForRound(
    roundId: number,
    userId: string,
  ): Promise<{ songId: number; rating: number }[]> {
    return db
      .select({
        songId: musicClubRatings.songId,
        rating: musicClubRatings.rating,
      })
      .from(musicClubRatings)
      .innerJoin(musicClubSongs, eq(musicClubRatings.songId, musicClubSongs.id))
      .where(
        and(
          eq(musicClubSongs.roundId, roundId),
          eq(musicClubRatings.userId, userId),
        ),
      );
  }

  async getAverageRatings(roundId: number): Promise<
    { songId: number; averageRating: number; ratingCount: number }[]
  > {
    return db
      .select({
        songId: musicClubRatings.songId,
        averageRating: sql<number>`coalesce(avg(${musicClubRatings.rating}), 0)`,
        ratingCount: sql<number>`count(*)`,
      })
      .from(musicClubRatings)
      .innerJoin(musicClubSongs, eq(musicClubRatings.songId, musicClubSongs.id))
      .where(eq(musicClubSongs.roundId, roundId))
      .groupBy(musicClubRatings.songId);
  }

  async getRaterTallies(roundId: number): Promise<
    { userId: string; totalPointsGiven: number; songsRated: number }[]
  > {
    return db
      .select({
        userId: musicClubRatings.userId,
        totalPointsGiven: sql<number>`coalesce(sum(${musicClubRatings.rating}), 0)`,
        songsRated: sql<number>`count(*)`,
      })
      .from(musicClubRatings)
      .innerJoin(musicClubSongs, eq(musicClubRatings.songId, musicClubSongs.id))
      .where(eq(musicClubSongs.roundId, roundId))
      .groupBy(musicClubRatings.userId)
      .orderBy(desc(sql`sum(${musicClubRatings.rating})`));
  }

}
