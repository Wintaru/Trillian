import { eq, and } from "drizzle-orm";
import { db } from "./database.js";
import { starboardMessages } from "../db/schema.js";
import type { StarboardEntry } from "../types/starboard-contracts.js";

export class StarboardAccessor {
  async getEntry(guildId: string, originalMessageId: string): Promise<StarboardEntry | null> {
    const rows = await db
      .select()
      .from(starboardMessages)
      .where(
        and(
          eq(starboardMessages.guildId, guildId),
          eq(starboardMessages.originalMessageId, originalMessageId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async upsertEntry(
    guildId: string,
    originalMessageId: string,
    originalChannelId: string,
    originalAuthorId: string,
    authorDisplayName: string,
    messageContent: string,
    starCount: number,
  ): Promise<{ entry: StarboardEntry; isNew: boolean }> {
    const now = Date.now();
    const existing = await this.getEntry(guildId, originalMessageId);

    if (existing) {
      await db
        .update(starboardMessages)
        .set({ starCount, updatedAt: now })
        .where(
          and(
            eq(starboardMessages.guildId, guildId),
            eq(starboardMessages.originalMessageId, originalMessageId),
          ),
        );
      return {
        entry: { ...existing, starCount, updatedAt: now },
        isNew: false,
      };
    }

    const result = await db
      .insert(starboardMessages)
      .values({
        guildId,
        originalMessageId,
        originalChannelId,
        originalAuthorId,
        authorDisplayName,
        messageContent,
        starCount,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { entry: result[0], isNew: true };
  }

  async setStarboardMessageId(
    guildId: string,
    originalMessageId: string,
    starboardMessageId: string,
  ): Promise<void> {
    await db
      .update(starboardMessages)
      .set({ starboardMessageId, updatedAt: Date.now() })
      .where(
        and(
          eq(starboardMessages.guildId, guildId),
          eq(starboardMessages.originalMessageId, originalMessageId),
        ),
      );
  }

  async updateStarCount(
    guildId: string,
    originalMessageId: string,
    starCount: number,
  ): Promise<void> {
    await db
      .update(starboardMessages)
      .set({ starCount, updatedAt: Date.now() })
      .where(
        and(
          eq(starboardMessages.guildId, guildId),
          eq(starboardMessages.originalMessageId, originalMessageId),
        ),
      );
  }
}
