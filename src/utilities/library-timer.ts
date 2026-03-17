import type { Client } from "discord.js";
import type { LibraryEngine } from "../engines/library-engine.js";
import * as logger from "./logger.js";

const CHECK_INTERVAL_MS = 3_600_000; // 1 hour
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours between reminders

export function startLibraryTimer(client: Client, engine: LibraryEngine): void {
  setInterval(async () => {
    try {
      const overdue = await engine.getOverdueBorrows();

      for (const borrow of overdue) {
        try {
          // DM the borrower
          const borrower = await client.users.fetch(borrow.borrowerId);
          const dueDateStr = borrow.dueDate
            ? `<t:${Math.floor(borrow.dueDate / 1000)}:D>`
            : "its due date";
          await borrower.send(
            `Reminder: **${borrow.title}** by ${borrow.author} is overdue (was due ${dueDateStr}). ` +
            `Please return it to <@${borrow.ownerId}> when you can!`,
          );
        } catch {
          // DMs disabled — silently skip
        }

        try {
          // DM the owner
          const owner = await client.users.fetch(borrow.ownerId);
          await owner.send(
            `Heads up: **${borrow.title}** lent to <@${borrow.borrowerId}> is overdue.`,
          );
        } catch {
          // DMs disabled
        }

        await engine.markReminderSent(borrow.borrowId);
      }

      if (overdue.length > 0) {
        logger.info(`Library timer: sent ${overdue.length} overdue reminder(s)`);
      }
    } catch (err) {
      logger.error("Library timer error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
