import { gte, and, eq } from "drizzle-orm";
import { db } from "./database.js";
import { recipes, libraryEntries } from "../db/schema.js";

export class ChannelStatsAccessor {
  async countRecipesSince(guildId: string, since: number): Promise<number> {
    const rows = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.guildId, guildId), gte(recipes.createdAt, since)));
    return rows.length;
  }

  async countLibraryEntriesSince(guildId: string, since: number): Promise<number> {
    const rows = await db
      .select({ id: libraryEntries.id })
      .from(libraryEntries)
      .where(and(eq(libraryEntries.guildId, guildId), gte(libraryEntries.addedAt, since)));
    return rows.length;
  }
}
