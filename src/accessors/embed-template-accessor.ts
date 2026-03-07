import { eq, and, count } from "drizzle-orm";
import { db } from "./database.js";
import { embedTemplates } from "../db/schema.js";

export interface EmbedTemplateRow {
  id: number;
  guildId: string;
  userId: string;
  name: string;
  embedData: string;
  createdAt: number;
  updatedAt: number;
}

export class EmbedTemplateAccessor {
  async saveTemplate(
    guildId: string,
    userId: string,
    name: string,
    embedData: string,
    now: number,
  ): Promise<{ isUpdate: boolean }> {
    const existing = await db
      .select({ id: embedTemplates.id })
      .from(embedTemplates)
      .where(
        and(
          eq(embedTemplates.guildId, guildId),
          eq(embedTemplates.userId, userId),
          eq(embedTemplates.name, name),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(embedTemplates)
        .set({ embedData, updatedAt: now })
        .where(eq(embedTemplates.id, existing[0].id));
      return { isUpdate: true };
    }

    await db.insert(embedTemplates).values({
      guildId,
      userId,
      name,
      embedData,
      createdAt: now,
      updatedAt: now,
    });
    return { isUpdate: false };
  }

  async loadTemplate(
    guildId: string,
    userId: string,
    name: string,
  ): Promise<EmbedTemplateRow | null> {
    const rows = await db
      .select()
      .from(embedTemplates)
      .where(
        and(
          eq(embedTemplates.guildId, guildId),
          eq(embedTemplates.userId, userId),
          eq(embedTemplates.name, name),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async listTemplates(
    guildId: string,
    userId: string,
  ): Promise<{ name: string; createdAt: number; updatedAt: number }[]> {
    return db
      .select({
        name: embedTemplates.name,
        createdAt: embedTemplates.createdAt,
        updatedAt: embedTemplates.updatedAt,
      })
      .from(embedTemplates)
      .where(
        and(
          eq(embedTemplates.guildId, guildId),
          eq(embedTemplates.userId, userId),
        ),
      );
  }

  async deleteTemplate(
    guildId: string,
    userId: string,
    name: string,
  ): Promise<boolean> {
    const result = await db
      .delete(embedTemplates)
      .where(
        and(
          eq(embedTemplates.guildId, guildId),
          eq(embedTemplates.userId, userId),
          eq(embedTemplates.name, name),
        ),
      )
      .returning({ id: embedTemplates.id });
    return result.length > 0;
  }

  async countTemplates(guildId: string, userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(embedTemplates)
      .where(
        and(
          eq(embedTemplates.guildId, guildId),
          eq(embedTemplates.userId, userId),
        ),
      );
    return result[0]?.count ?? 0;
  }
}
