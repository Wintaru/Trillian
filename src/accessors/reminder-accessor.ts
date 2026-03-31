import { eq, and, lte } from "drizzle-orm";
import { db } from "./database.js";
import { reminders } from "../db/schema.js";
import type { ReminderEntry, DueReminder } from "../types/reminder-contracts.js";

export class ReminderAccessor {
  async create(
    guildId: string,
    channelId: string,
    userId: string,
    message: string,
    deliverAt: number,
    isPublic: boolean,
    now: number,
  ): Promise<number> {
    const [row] = await db
      .insert(reminders)
      .values({
        guildId,
        channelId,
        userId,
        message,
        deliverAt,
        isPublic: isPublic ? 1 : 0,
        status: "pending",
        createdAt: now,
      })
      .returning({ id: reminders.id });
    return row.id;
  }

  async cancel(reminderId: number): Promise<void> {
    await db
      .update(reminders)
      .set({ status: "cancelled" })
      .where(eq(reminders.id, reminderId));
  }

  async getById(
    reminderId: number,
  ): Promise<(ReminderEntry & { userId: string }) | null> {
    const rows = await db
      .select({
        id: reminders.id,
        userId: reminders.userId,
        message: reminders.message,
        deliverAt: reminders.deliverAt,
        isPublic: reminders.isPublic,
        channelId: reminders.channelId,
        status: reminders.status,
        createdAt: reminders.createdAt,
      })
      .from(reminders)
      .where(eq(reminders.id, reminderId))
      .limit(1);
    return rows[0] ?? null;
  }

  async listPendingForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<ReminderEntry[]> {
    return db
      .select({
        id: reminders.id,
        message: reminders.message,
        deliverAt: reminders.deliverAt,
        isPublic: reminders.isPublic,
        channelId: reminders.channelId,
        status: reminders.status,
        createdAt: reminders.createdAt,
      })
      .from(reminders)
      .where(and(eq(reminders.userId, userId), eq(reminders.status, "pending")))
      .orderBy(reminders.deliverAt)
      .limit(limit)
      .offset(offset);
  }

  async countPendingForUser(userId: string): Promise<number> {
    const rows = await db
      .select({ id: reminders.id })
      .from(reminders)
      .where(and(eq(reminders.userId, userId), eq(reminders.status, "pending")));
    return rows.length;
  }

  async getDueReminders(now: number): Promise<DueReminder[]> {
    return db
      .select({
        id: reminders.id,
        guildId: reminders.guildId,
        channelId: reminders.channelId,
        userId: reminders.userId,
        message: reminders.message,
        deliverAt: reminders.deliverAt,
        isPublic: reminders.isPublic,
      })
      .from(reminders)
      .where(and(eq(reminders.status, "pending"), lte(reminders.deliverAt, now)));
  }

  async markDelivered(reminderId: number, now: number): Promise<void> {
    await db
      .update(reminders)
      .set({ status: "delivered", deliveredAt: now })
      .where(eq(reminders.id, reminderId));
  }
}
