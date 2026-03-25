import { eq, and, isNull } from "drizzle-orm";
import { db } from "./database.js";
import { birthdays } from "../db/schema.js";
import type { BirthdayEntry } from "../types/birthday-contracts.js";

export class BirthdayAccessor {
  async upsert(
    guildId: string,
    userId: string,
    personName: string | null,
    month: number,
    day: number,
    source: string,
  ): Promise<"added" | "updated"> {
    const existing = await this.findExact(guildId, userId, personName);
    if (existing) {
      await db
        .update(birthdays)
        .set({ month, day, source })
        .where(eq(birthdays.id, existing.id));
      return "updated";
    }
    await db.insert(birthdays).values({
      guildId,
      userId,
      personName,
      month,
      day,
      source,
      createdAt: Date.now(),
    });
    return "added";
  }

  async remove(
    guildId: string,
    userId: string,
    personName: string | null,
  ): Promise<boolean> {
    const existing = await this.findExact(guildId, userId, personName);
    if (!existing) return false;
    await db.delete(birthdays).where(eq(birthdays.id, existing.id));
    return true;
  }

  async removeAllForUser(guildId: string, userId: string): Promise<number> {
    const result = await db
      .delete(birthdays)
      .where(and(eq(birthdays.guildId, guildId), eq(birthdays.userId, userId)))
      .returning({ id: birthdays.id });
    return result.length;
  }

  async listForUser(guildId: string, userId: string): Promise<BirthdayEntry[]> {
    return db
      .select({
        id: birthdays.id,
        userId: birthdays.userId,
        personName: birthdays.personName,
        month: birthdays.month,
        day: birthdays.day,
        source: birthdays.source,
      })
      .from(birthdays)
      .where(and(eq(birthdays.guildId, guildId), eq(birthdays.userId, userId)));
  }

  async findAllForGuild(guildId: string): Promise<BirthdayEntry[]> {
    return db
      .select({
        id: birthdays.id,
        userId: birthdays.userId,
        personName: birthdays.personName,
        month: birthdays.month,
        day: birthdays.day,
        source: birthdays.source,
      })
      .from(birthdays)
      .where(eq(birthdays.guildId, guildId));
  }

  async findByDate(
    guildId: string,
    month: number,
    day: number,
  ): Promise<BirthdayEntry[]> {
    return db
      .select({
        id: birthdays.id,
        userId: birthdays.userId,
        personName: birthdays.personName,
        month: birthdays.month,
        day: birthdays.day,
        source: birthdays.source,
      })
      .from(birthdays)
      .where(
        and(
          eq(birthdays.guildId, guildId),
          eq(birthdays.month, month),
          eq(birthdays.day, day),
        ),
      );
  }

  async findExact(
    guildId: string,
    userId: string,
    personName: string | null,
  ): Promise<BirthdayEntry | null> {
    const personCondition =
      personName === null
        ? isNull(birthdays.personName)
        : eq(birthdays.personName, personName);

    const rows = await db
      .select({
        id: birthdays.id,
        userId: birthdays.userId,
        personName: birthdays.personName,
        month: birthdays.month,
        day: birthdays.day,
        source: birthdays.source,
      })
      .from(birthdays)
      .where(
        and(
          eq(birthdays.guildId, guildId),
          eq(birthdays.userId, userId),
          personCondition,
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}
