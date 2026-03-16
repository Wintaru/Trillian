import { ChannelType } from "discord.js";
import type { EventHandler } from "../types/event.js";
import type { CleanLinksEngine } from "../engines/clean-links-engine.js";
import * as logger from "../utilities/logger.js";

export function createMessageCleanLinksHandler(
  cleanLinksEngine: CleanLinksEngine,
  channelIds: string[],
): EventHandler<"messageCreate"> {
  const allowedChannels = channelIds.length > 0 ? new Set(channelIds) : null;

  return {
    event: "messageCreate",
    once: false,

    async execute(message): Promise<void> {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (message.channel.type === ChannelType.DM) return;
      if (allowedChannels && !allowedChannels.has(message.channelId)) return;

      try {
        const result = await cleanLinksEngine.clean({ messageContent: message.content });
        if (result.cleanedUrls.length === 0) return;

        const lines = result.cleanedUrls.map((u) => u.cleaned);
        await message.reply(lines.join("\n"));
        await message.suppressEmbeds(true);

        logger.info(
          `Cleaned ${result.cleanedUrls.length} link(s) in #${message.channelId} from ${message.author.tag}`,
        );
      } catch (error) {
        logger.error("Failed to clean links:", error);
      }
    },
  };
}
