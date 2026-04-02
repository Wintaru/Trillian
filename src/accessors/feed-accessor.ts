import { eq, and } from "drizzle-orm";
import { db } from "./database.js";
import { feedSubscriptions } from "../db/schema.js";

export interface FeedSubscriptionRow {
  id: number;
  guildId: string;
  channelId: string;
  feedUrl: string;
  label: string;
  lastPostGuid: string | null;
  lastCheckedAt: number | null;
  createdAt: number;
}

export class FeedAccessor {
  async create(
    guildId: string,
    channelId: string,
    feedUrl: string,
    label: string,
  ): Promise<number> {
    const [row] = await db
      .insert(feedSubscriptions)
      .values({ guildId, channelId, feedUrl, label, createdAt: Date.now() })
      .returning({ id: feedSubscriptions.id });
    return row.id;
  }

  async remove(id: number, guildId: string): Promise<boolean> {
    const result = await db
      .delete(feedSubscriptions)
      .where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.guildId, guildId)));
    return result.changes > 0;
  }

  async listByGuild(guildId: string): Promise<FeedSubscriptionRow[]> {
    return db
      .select()
      .from(feedSubscriptions)
      .where(eq(feedSubscriptions.guildId, guildId));
  }

  async getAll(): Promise<FeedSubscriptionRow[]> {
    return db.select().from(feedSubscriptions);
  }

  async updateLastPost(id: number, guid: string): Promise<void> {
    await db
      .update(feedSubscriptions)
      .set({ lastPostGuid: guid, lastCheckedAt: Date.now() })
      .where(eq(feedSubscriptions.id, id));
  }

  async updateLastChecked(id: number): Promise<void> {
    await db
      .update(feedSubscriptions)
      .set({ lastCheckedAt: Date.now() })
      .where(eq(feedSubscriptions.id, id));
  }
}
