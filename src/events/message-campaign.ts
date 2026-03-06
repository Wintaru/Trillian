import { ChannelType } from "discord.js";
import type { EventHandler } from "../types/event.js";
import type { CampaignEngine } from "../engines/campaign-engine.js";
import type { CampaignAccessor } from "../accessors/campaign-accessor.js";
import { formatDiceRoll } from "../utilities/shadowrun-format.js";
import type { PlayerMessage } from "../types/shadowrun-contracts.js";
import * as logger from "../utilities/logger.js";

export function createMessageCampaignHandler(
  campaignEngine: CampaignEngine,
  campaignAccessor: CampaignAccessor,
  campaignChannelId: string,
): EventHandler<"messageCreate"> {
  return {
    event: "messageCreate",
    once: false,

    async execute(message): Promise<void> {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (message.channel.type === ChannelType.DM) return;
      if (message.channelId !== campaignChannelId) return;

      const botUser = message.client.user;
      if (!botUser) return;

      const mentionPattern = new RegExp(`<@!?${botUser.id}>`);
      if (!mentionPattern.test(message.content)) return;

      const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild.id, message.channelId);
      if (!campaign) return;

      try {
        await message.channel.sendTyping();

        const playerMessages: PlayerMessage[] = [];

        if (campaign.lastPingAt) {
          try {
            const fetched = await message.channel.messages.fetch({
              after: campaign.lastPingMessageId ?? undefined,
              limit: 50,
            });

            for (const msg of [...fetched.values()].reverse()) {
              if (msg.id === message.id) continue;
              if (msg.author.bot) continue;
              playerMessages.push({
                authorName: msg.author.displayName,
                authorId: msg.author.id,
                content: msg.content,
                timestamp: msg.createdTimestamp,
              });
            }
          } catch (error) {
            logger.error("Failed to fetch messages since last ping:", error);
          }
        }

        const cleanedContent = message.content.replace(mentionPattern, "").trim();

        const result = await campaignEngine.advanceNarrative({
          campaignId: campaign.id,
          playerMessages,
          triggerUserId: message.author.id,
          triggerMessage: `${message.author.displayName}: ${cleanedContent}`,
        });

        await message.reply(result.narrative.slice(0, 2000));

        if (result.diceRollResults.length > 0) {
          const rollText = result.diceRollResults.map((dr) => formatDiceRoll(dr)).join("\n\n");
          await message.channel.send(rollText.slice(0, 2000));
        }

        await campaignAccessor.updateCampaignState(campaign.id, {
          lastPingMessageId: message.id,
          lastPingAt: Date.now(),
        });
      } catch (error) {
        logger.error("Campaign narrative advancement failed:", error);
        await message.reply("The shadows grow quiet... Something went wrong. Try again, chummer.").catch(() => {});
      }
    },
  };
}
