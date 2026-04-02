import { EmbedBuilder } from "discord.js";
import type { Client } from "discord.js";
import type { FeedEngine, FeedItem } from "../engines/feed-engine.js";
import * as logger from "./logger.js";

const EMBED_COLOR = 0xe67e22;

export function startFeedTimer(
  client: Client,
  feedEngine: FeedEngine,
  intervalMs: number,
): void {
  // Run an initial check shortly after startup
  setTimeout(() => checkFeeds(client, feedEngine), 30_000);

  setInterval(() => checkFeeds(client, feedEngine), intervalMs);
}

async function checkFeeds(client: Client, feedEngine: FeedEngine): Promise<void> {
  try {
    const results = await feedEngine.checkAllFeeds();

    for (const { subscription, newItems } of results) {
      const channel = await client.channels.fetch(subscription.channelId).catch(() => null);
      if (!channel?.isSendable()) {
        logger.warn(`Feed "${subscription.label}": channel ${subscription.channelId} not found or not sendable`);
        continue;
      }

      for (const item of newItems) {
        try {
          const embed = buildFeedEmbed(item, subscription.label);
          await channel.send({ embeds: [embed] });
        } catch (err) {
          logger.error(`Failed to post feed item "${item.title}" for "${subscription.label}":`, err);
        }
      }
    }
  } catch (err) {
    logger.error("Feed timer error:", err);
  }
}

function buildFeedEmbed(item: FeedItem, label: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(item.title)
    .setFooter({ text: label });

  if (item.link) {
    embed.setURL(item.link);
  }

  if (item.contentSnippet) {
    embed.setDescription(item.contentSnippet);
  }

  if (item.creator) {
    embed.setAuthor({ name: item.creator });
  }

  if (item.pubDate) {
    embed.setTimestamp(new Date(item.pubDate));
  }

  return embed;
}
