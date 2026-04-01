import { SlashCommandBuilder } from "discord.js";
import type {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  Message,
} from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { StorySoFarEngine, StorySoFarResult } from "../engines/story-so-far-engine.js";
import * as logger from "../utilities/logger.js";

const DISCORD_MAX_LENGTH = 2000;

function formatResponse(result: StorySoFarResult): string {
  const parts: string[] = [];

  if (result.truncated) {
    parts.push("*Note: The conversation was long, so older messages were trimmed.*\n");
  }

  parts.push(result.summary);

  if (result.mediaReferences.length > 0) {
    parts.push("\n\n**Shared Media & Links:**");
    for (const ref of result.mediaReferences) {
      const line = `- [${ref.description}](${ref.url}) ([jump](${ref.messageUrl}))`;
      parts.push(line);
    }
  }

  parts.push(`\n\n*${result.messageCount} message(s) summarized.*`);

  let text = parts.join("\n");

  if (text.length > DISCORD_MAX_LENGTH) {
    // Trim media section first, keep summary intact
    const withoutMedia = [
      ...(result.truncated ? ["*Note: The conversation was long, so older messages were trimmed.*\n"] : []),
      result.summary,
      `\n\n*${result.messageCount} message(s) summarized. Some media links were omitted for length.*`,
    ].join("\n");

    text = withoutMedia.length <= DISCORD_MAX_LENGTH
      ? withoutMedia
      : withoutMedia.slice(0, DISCORD_MAX_LENGTH - 3) + "...";
  }

  return text;
}

export function createTheStorySoFarCommand(engine: StorySoFarEngine): Command {
  return {
    name: "the-story-so-far",
    description: "Get an AI summary of what you missed in this channel",
    slashData: new SlashCommandBuilder()
      .setName("the-story-so-far")
      .setDescription("Get an AI summary of what you missed in this channel"),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const channel = interaction.channel as GuildTextBasedChannel | null;
      if (!channel || !interaction.guildId) {
        await interaction.reply({ content: "This command can only be used in a server channel.", flags: 64 });
        return;
      }

      await interaction.deferReply({ flags: 64 });

      try {
        const result = await engine.summarize(channel, interaction.user.id);
        await interaction.editReply(formatResponse(result));
      } catch (error) {
        logger.error("the-story-so-far slash command failed:", error);
        await interaction.editReply("Something went wrong generating the summary. Try again in a moment!");
      }
    },

    async executePrefix(message: Message, _context: CommandContext): Promise<void> {
      const channel = message.channel as GuildTextBasedChannel | null;
      if (!channel || !message.guildId) {
        await message.reply("This command can only be used in a server channel.");
        return;
      }

      const notice = await message.reply("Checking the story so far... I'll DM you the summary!");

      try {
        const result = await engine.summarize(channel, message.author.id);
        const text = formatResponse(result);

        try {
          await message.author.send(text);
        } catch {
          await notice.edit("I couldn't DM you the summary — check your privacy settings.");
        }
      } catch (error) {
        logger.error("the-story-so-far prefix command failed:", error);
        await notice.edit("Something went wrong generating the summary. Try again in a moment!");
      }
    },
  };
}
