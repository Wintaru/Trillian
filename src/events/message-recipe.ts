import { ChannelType } from "discord.js";
import type { EventHandler } from "../types/event.js";
import type { RecipeEngine } from "../engines/recipe-engine.js";
import * as logger from "../utilities/logger.js";

export function createMessageRecipeHandler(
  recipeEngine: RecipeEngine,
  recipeChannelId: string,
): EventHandler<"messageCreate"> {
  return {
    event: "messageCreate",
    once: false,

    async execute(message): Promise<void> {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (message.channel.type === ChannelType.DM) return;
      if (message.channelId !== recipeChannelId) return;

      // Skip very short messages — unlikely to be recipes
      if (message.content.length < 30) return;

      try {
        const result = await recipeEngine.parseAndStore({
          messageContent: message.content,
          messageId: message.id,
          userId: message.author.id,
          guildId: message.guild.id,
          channelId: message.channelId,
        });

        if (result.reason === "saved") {
          await message.react("🍳");
          await message.reply(`Recipe saved to the recipe book as **#${result.recipeId}** — "${result.title}" 🍳\nUse \`/recipe view ${result.recipeId}\` to see it.`);
          logger.info(`Recipe saved: "${result.title}" (id=${result.recipeId}) from ${message.author.tag}`);
        }
      } catch (error) {
        logger.error("Failed to process recipe message:", error);
      }
    },
  };
}
