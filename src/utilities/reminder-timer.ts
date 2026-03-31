import { EmbedBuilder } from "discord.js";
import type { Client } from "discord.js";
import type { ReminderEngine } from "../engines/reminder-engine.js";
import * as logger from "./logger.js";

const CHECK_INTERVAL_MS = 30_000;
const EMBED_COLOR = 0x5865f2;

export function startReminderTimer(client: Client, reminderEngine: ReminderEngine): void {
  setInterval(async () => {
    try {
      const dueReminders = await reminderEngine.getDueReminders();

      for (const reminder of dueReminders) {
        try {
          if (reminder.isPublic) {
            await deliverPublic(client, reminder);
          } else {
            await deliverDm(client, reminder);
          }
        } catch (err) {
          logger.error(`Failed to deliver reminder ${reminder.id}:`, err);
        } finally {
          await reminderEngine.markDelivered(reminder.id);
        }
      }
    } catch (err) {
      logger.error("Reminder timer error:", err);
    }
  }, CHECK_INTERVAL_MS);
}

async function deliverPublic(
  client: Client,
  reminder: { id: number; channelId: string; userId: string; message: string; deliverAt: number },
): Promise<void> {
  const channel = await client.channels.fetch(reminder.channelId);
  if (!channel?.isSendable()) {
    logger.warn(`Reminder ${reminder.id}: channel ${reminder.channelId} not found or not sendable`);
    return;
  }

  const embed = buildReminderEmbed(reminder.message, reminder.deliverAt);
  await channel.send({
    content: `<@${reminder.userId}>`,
    embeds: [embed],
  });
}

async function deliverDm(
  client: Client,
  reminder: { id: number; channelId: string; userId: string; message: string; deliverAt: number },
): Promise<void> {
  try {
    const user = await client.users.fetch(reminder.userId);
    const embed = buildReminderEmbed(reminder.message, reminder.deliverAt);
    await user.send({ embeds: [embed] });
  } catch {
    // DMs disabled — fall back to channel mention
    logger.warn(`Reminder ${reminder.id}: DM failed, falling back to channel delivery`);
    await deliverPublic(client, reminder);
  }
}

function buildReminderEmbed(message: string, deliverAt: number): EmbedBuilder {
  const timestamp = Math.floor(deliverAt / 1000);
  return new EmbedBuilder()
    .setTitle("Reminder")
    .setDescription(message)
    .setFooter({ text: `Originally scheduled for <t:${timestamp}:F>` })
    .setColor(EMBED_COLOR)
    .setTimestamp();
}
