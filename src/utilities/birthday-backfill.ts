import type { Client, TextChannel } from "discord.js";
import { ChannelType } from "discord.js";
import type { BirthdayEngine } from "../engines/birthday-engine.js";
import type { BackfillProgressReport } from "../types/birthday-contracts.js";
import * as logger from "./logger.js";

const BATCH_SIZE = 100;

export async function backfillBirthdays(
  client: Client,
  birthdayEngine: BirthdayEngine,
  guildId: string,
  onProgress?: (report: BackfillProgressReport) => void,
): Promise<BackfillProgressReport> {
  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();
  const textChannels = [...channels.values()].filter(
    (ch): ch is TextChannel => ch !== null && ch.type === ChannelType.GuildText,
  );

  let messagesProcessed = 0;
  let birthdaysFound = 0;
  let channelsScanned = 0;
  const totalChannels = textChannels.length;

  logger.info(`Birthday backfill: scanning ${totalChannels} text channels...`);

  for (const textChannel of textChannels) {
    const perms = textChannel.permissionsFor(client.user!);
    if (!perms?.has("ViewChannel") || !perms?.has("ReadMessageHistory")) {
      channelsScanned++;
      continue;
    }

    let lastMessageId: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const options: { limit: number; before?: string } = { limit: BATCH_SIZE };
      if (lastMessageId) options.before = lastMessageId;

      const messages = await textChannel.messages.fetch(options);
      if (messages.size === 0) {
        hasMore = false;
        break;
      }

      const sorted = [...messages.values()].sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp,
      );

      for (const message of sorted) {
        if (message.author.bot) continue;
        if (!birthdayEngine.containsBirthdayKeyword(message.content)) continue;

        messagesProcessed++;
        try {
          const result = await birthdayEngine.analyzeAndStore({
            messageContent: message.content,
            messageId: message.id,
            userId: message.author.id,
            guildId,
          });
          if (result.reason === "stored") birthdaysFound++;
        } catch (error) {
          logger.error(`Birthday backfill: failed on message ${message.id}:`, error);
        }
      }

      lastMessageId = sorted[0].id;
      if (messages.size < BATCH_SIZE) hasMore = false;
    }

    channelsScanned++;
    onProgress?.({ channelsScanned, totalChannels, messagesProcessed, birthdaysFound });
  }

  logger.info(
    `Birthday backfill complete: ${channelsScanned} channels, ${messagesProcessed} keyword matches, ${birthdaysFound} birthdays found`,
  );
  return { channelsScanned, totalChannels, messagesProcessed, birthdaysFound };
}
