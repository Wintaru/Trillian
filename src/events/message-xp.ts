import { ChannelType } from "discord.js";
import type { TextChannel } from "discord.js";
import type { EventHandler } from "../types/event.js";
import type { XpEngine } from "../engines/xp-engine.js";
import type { Config } from "../utilities/load-config.js";
import * as logger from "../utilities/logger.js";

export function createMessageXpHandler(
  xpEngine: XpEngine,
  levelUpChannelId: string | null,
): EventHandler<"messageCreate"> {
  return {
    event: "messageCreate",
    once: false,

    async execute(message): Promise<void> {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (message.channel.type === ChannelType.DM) return;

      const result = await xpEngine.awardXp({
        userId: message.author.id,
        guildId: message.guild.id,
        channelId: message.channelId,
      });

      if (!result.awarded || !result.leveledUp) return;

      // Level-up announcement
      const targetChannelId = levelUpChannelId ?? message.channelId;
      try {
        const channel = await message.guild.channels.fetch(targetChannelId);
        if (channel?.isTextBased()) {
          const rankText = result.rankName ? ` They are now a **${result.rankName}**!` : "";
          await (channel as TextChannel).send(
            `Congratulations <@${message.author.id}>! You reached **Level ${result.currentLevel}**!${rankText}`,
          );
        }
      } catch (err) {
        logger.error(`Failed to send level-up announcement: ${err}`);
      }

      // Assign role rewards
      if (result.newRoleIds.length > 0 && message.member) {
        try {
          await message.member.roles.add(result.newRoleIds);
        } catch (err) {
          logger.error(`Failed to assign role rewards: ${err}`);
        }
      }
    },
  };
}
