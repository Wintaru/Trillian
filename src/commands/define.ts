import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { DictionaryEngine } from "../engines/dictionary-engine.js";
import { buildDictionaryEmbed } from "../utilities/dictionary-embed.js";

export function createDefineCommand(dictionaryEngine: DictionaryEngine): Command {
  return {
    name: "define",
    description: "Look up the definition of an English word",
    slashData: new SlashCommandBuilder()
      .setName("define")
      .setDescription("Look up the definition of an English word")
      .addStringOption((opt) =>
        opt
          .setName("word")
          .setDescription("The word to look up")
          .setRequired(true),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const word = interaction.options.getString("word", true);

      await interaction.deferReply();

      try {
        const result = await dictionaryEngine.define({ word });
        const embed = buildDictionaryEmbed(result);
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred.";
        await interaction.editReply(`Failed to look up definition: ${message}`);
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const word = context.args.join(" ").trim();

      if (!word) {
        await message.reply("Please provide a word to define. Usage: `!define <word>`");
        return;
      }

      try {
        const result = await dictionaryEngine.define({ word });
        const embed = buildDictionaryEmbed(result);
        if (message.channel.isSendable()) {
          await message.channel.send({ embeds: [embed] });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An unknown error occurred.";
        await message.reply(`Failed to look up definition: ${msg}`);
      }
    },
  };
}
