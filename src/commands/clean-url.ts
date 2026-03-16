import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { CleanLinksEngine } from "../engines/clean-links-engine.js";

export function createCleanUrlCommand(cleanLinksEngine: CleanLinksEngine): Command {
  return {
    name: "cleanurl",
    description: "Remove tracking parameters from a URL",
    slashData: new SlashCommandBuilder()
      .setName("cleanurl")
      .setDescription("Remove tracking parameters from a URL")
      .addStringOption((opt) =>
        opt.setName("url").setDescription("The URL to clean").setRequired(true),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const url = interaction.options.getString("url", true);
      const result = await cleanLinksEngine.clean({ messageContent: url });

      if (result.cleanedUrls.length === 0) {
        await interaction.reply({ content: "That URL is already clean — no tracking parameters found.", ephemeral: true });
        return;
      }

      await interaction.reply(result.cleanedUrls[0].cleaned);
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const url = context.args[0];
      if (!url) {
        await message.reply("Usage: `!cleanurl <url>`");
        return;
      }

      const result = await cleanLinksEngine.clean({ messageContent: url });

      if (result.cleanedUrls.length === 0) {
        await message.reply("That URL is already clean — no tracking parameters found.");
        return;
      }

      await message.reply(result.cleanedUrls[0].cleaned);
    },
  };
}
