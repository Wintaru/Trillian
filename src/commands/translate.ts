import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { TranslateEngine } from "../engines/translate-engine.js";
import { buildTranslateEmbed } from "../utilities/translate-embed.js";

export function createTranslateCommand(translateEngine: TranslateEngine): Command {
  return {
    name: "translate",
    description: "Translate text between languages",
    slashData: new SlashCommandBuilder()
      .setName("translate")
      .setDescription("Translate text between languages")
      .addStringOption((opt) =>
        opt
          .setName("text")
          .setDescription("The text to translate")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("to")
          .setDescription("Target language code, e.g. ES, FR, DE (default: ES)")
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName("from")
          .setDescription("Source language code (auto-detect if omitted)")
          .setRequired(false),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const text = interaction.options.getString("text", true);
      const to = interaction.options.getString("to") ?? "ES";
      const from = interaction.options.getString("from") ?? null;

      await interaction.deferReply();

      try {
        const result = await translateEngine.translate({
          text,
          fromLang: from,
          toLang: to,
        });
        const embed = buildTranslateEmbed(result);
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred.";
        await interaction.editReply(`Failed to translate: ${message}`);
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const { text, from, to } = parsePrefixArgs(context.args);

      if (!text) {
        await message.reply(
          "Please provide text to translate. Usage: `!translate [--from XX] [--to XX] <text>`",
        );
        return;
      }

      try {
        const result = await translateEngine.translate({
          text,
          fromLang: from,
          toLang: to,
        });
        const embed = buildTranslateEmbed(result);
        if (message.channel.isSendable()) {
          await message.channel.send({ embeds: [embed] });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An unknown error occurred.";
        await message.reply(`Failed to translate: ${msg}`);
      }
    },
  };
}

interface ParsedPrefixArgs {
  text: string;
  from: string | null;
  to: string;
}

function parsePrefixArgs(args: string[]): ParsedPrefixArgs {
  let from: string | null = null;
  let to = "ES";
  const remaining: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && i + 1 < args.length) {
      from = args[++i];
    } else if (args[i] === "--to" && i + 1 < args.length) {
      to = args[++i];
    } else {
      remaining.push(args[i]);
    }
  }

  return { text: remaining.join(" ").trim(), from, to };
}
