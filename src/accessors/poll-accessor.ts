import { eq, and, sql, count, lte } from "drizzle-orm";
import { db } from "./database.js";
import { polls, pollVotes } from "../db/schema.js";

export interface PollRow {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string;
  creatorId: string;
  question: string;
  options: string;
  status: string;
  closesAt: number | null;
  createdAt: number;
}

export class PollAccessor {
  async createPoll(
    guildId: string,
    channelId: string,
    creatorId: string,
    question: string,
    options: string[],
    closesAt: number | null,
    now: number,
  ): Promise<{ id: number }> {
    const result = await db
      .insert(polls)
      .values({
        guildId,
        channelId,
        creatorId,
        question,
        options: JSON.stringify(options),
        closesAt,
        createdAt: now,
      })
      .returning({ id: polls.id });
    return result[0];
  }

  async setPollMessageId(pollId: number, messageId: string): Promise<void> {
    await db.update(polls).set({ messageId }).where(eq(polls.id, pollId));
  }

  async getPoll(pollId: number): Promise<PollRow | null> {
    const rows = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1);
    return rows[0] ?? null;
  }

  async closePoll(pollId: number): Promise<void> {
    await db.update(polls).set({ status: "closed" }).where(eq(polls.id, pollId));
  }

  async upsertVote(pollId: number, userId: string, optionIndex: number): Promise<boolean> {
    const existing = await db
      .select({ optionIndex: pollVotes.optionIndex })
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)))
      .limit(1);

    const hadPreviousVote = existing.length > 0;

    await db
      .insert(pollVotes)
      .values({ pollId, userId, optionIndex })
      .onConflictDoUpdate({
        target: [pollVotes.pollId, pollVotes.userId],
        set: { optionIndex },
      });

    return hadPreviousVote;
  }

  async getVoteCounts(pollId: number): Promise<{ optionIndex: number; count: number }[]> {
    return db
      .select({
        optionIndex: pollVotes.optionIndex,
        count: count(),
      })
      .from(pollVotes)
      .where(eq(pollVotes.pollId, pollId))
      .groupBy(pollVotes.optionIndex);
  }

  async getOpenPollsDueBefore(
    timestamp: number,
  ): Promise<{ id: number; channelId: string; messageId: string }[]> {
    return db
      .select({
        id: polls.id,
        channelId: polls.channelId,
        messageId: polls.messageId,
      })
      .from(polls)
      .where(
        and(
          eq(polls.status, "open"),
          lte(polls.closesAt, timestamp),
        ),
      );
  }
}
