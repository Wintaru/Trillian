import { ChannelType } from "discord.js";
import type { EventHandler } from "../types/event.js";
import type { BirthdayEngine } from "../engines/birthday-engine.js";
import * as logger from "../utilities/logger.js";

export function createMessageBirthdayHandler(
  birthdayEngine: BirthdayEngine,
): EventHandler<"messageCreate"> {
  return {
    event: "messageCreate",
    once: false,

    async execute(message): Promise<void> {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (message.channel.type === ChannelType.DM) return;

      if (!birthdayEngine.containsBirthdayKeyword(message.content)) return;

      logger.debug(
        `Birthday keyword detected from ${message.author.tag} in #${(message.channel as { name?: string }).name}: "${message.content.slice(0, 100)}"`,
      );

      try {
        const result = await birthdayEngine.analyzeAndStore({
          messageContent: message.content,
          messageId: message.id,
          userId: message.author.id,
          guildId: message.guild.id,
          messageDate: message.createdAt,
        });

        if (result.reason === "stored") {
          logger.info(
            `Birthday detected from ${message.author.tag} in #${(message.channel as { name?: string }).name}`,
          );
        }
      } catch (error) {
        logger.error("Failed to process birthday message:", error);
      }
    },
  };
}
