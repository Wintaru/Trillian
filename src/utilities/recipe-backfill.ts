import type { Client, TextChannel } from "discord.js";
import { ChannelType } from "discord.js";
import type { RecipeEngine } from "../engines/recipe-engine.js";
import * as logger from "./logger.js";

const BATCH_SIZE = 100;
const MIN_MESSAGE_LENGTH = 30;

/**
 * Scans all historical messages in the recipe channel and processes any
 * that haven't been stored yet. Uses messageId for deduplication, so
 * it's safe to run repeatedly — already-processed messages are skipped.
 */
export async function backfillRecipes(
  client: Client,
  recipeEngine: RecipeEngine,
  recipeChannelId: string,
): Promise<void> {
  const channel = await client.channels.fetch(recipeChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    logger.warn(`Recipe backfill: channel ${recipeChannelId} not found or not a text channel`);
    return;
  }

  const textChannel = channel as TextChannel;
  const guildId = textChannel.guildId;

  logger.info(`Recipe backfill: scanning #${textChannel.name} for historical recipes...`);

  let processed = 0;
  let saved = 0;
  let lastMessageId: string | undefined;

  // Fetch messages in batches, oldest first
  // Discord API fetches newest first with "before", so we start from the latest
  // and work backwards
  let hasMore = true;
  while (hasMore) {
    const options: { limit: number; before?: string } = { limit: BATCH_SIZE };
    if (lastMessageId) {
      options.before = lastMessageId;
    }

    const messages = await textChannel.messages.fetch(options);
    if (messages.size === 0) {
      hasMore = false;
      break;
    }

    // Process from oldest to newest within batch
    const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const message of sorted) {
      if (message.author.bot) continue;
      if (message.content.length < MIN_MESSAGE_LENGTH) continue;

      processed++;
      try {
        const result = await recipeEngine.parseAndStore({
          messageContent: message.content,
          messageId: message.id,
          userId: message.author.id,
          guildId,
          channelId: recipeChannelId,
        });

        if (result.reason === "saved") {
          saved++;
          logger.info(`Recipe backfill: saved "${result.title}" (id=${result.recipeId})`);
        }
      } catch (error) {
        logger.error(`Recipe backfill: failed to process message ${message.id}:`, error);
      }
    }

    // Get the oldest message ID from this batch to continue backwards
    lastMessageId = sorted[0].id;

    if (messages.size < BATCH_SIZE) {
      hasMore = false;
    }
  }

  logger.info(`Recipe backfill complete: processed ${processed} messages, saved ${saved} new recipes`);
}
