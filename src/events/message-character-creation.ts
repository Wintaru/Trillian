import { ChannelType } from "discord.js";
import type { EventHandler } from "../types/event.js";
import type { CharacterCreationEngine } from "../engines/character-creation-engine.js";
import type { CampaignAccessor } from "../accessors/campaign-accessor.js";
import type { CharacterAccessor } from "../accessors/character-accessor.js";
import * as logger from "../utilities/logger.js";

export function createCharacterCreationDmHandler(
  characterCreationEngine: CharacterCreationEngine,
  characterAccessor: CharacterAccessor,
  campaignAccessor: CampaignAccessor,
): EventHandler<"messageCreate"> {
  return {
    event: "messageCreate",
    once: false,

    async execute(message): Promise<void> {
      if (message.author.bot) return;
      if (message.channel.type !== ChannelType.DM) return;

      const userId = message.author.id;

      const inProgress = await characterAccessor.getInProgressCharacterForUser(userId);
      if (!inProgress) return;

      try {
        const result = await characterCreationEngine.processStep(inProgress.id, message.content);

        if (result.response) {
          await message.reply(result.response.slice(0, 2000));
        }

        if (result.complete && inProgress.campaignId !== null) {
          await campaignAccessor.linkCharacterToPlayer(inProgress.campaignId, userId, inProgress.id);
        }
      } catch (error) {
        logger.error("Character creation DM handler failed:", error);
        await message.reply("Something went wrong with character creation. Try again or contact the GM.").catch(() => {});
      }
    },
  };
}
