import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { XpEngine } from "../engines/xp-engine.js";
import type { LeaderboardResponse } from "../types/xp-contracts.js";

const PAGE_SIZE = 10;

function buildLeaderboardEmbed(response: LeaderboardResponse): EmbedBuilder {
  const lines = response.entries.map((entry) => {
    const rank = entry.rankName ? ` — ${entry.rankName}` : "";
    return `**#${entry.position}** <@${entry.userId}> · Level ${entry.level} · ${entry.xp.toLocaleString()} XP${rank}`;
  });

  const description = lines.length > 0 ? lines.join("\n") : "No one has earned XP yet!";

  return new EmbedBuilder()
    .setTitle("Leaderboard")
    .setColor(0xffd700)
    .setDescription(description)
    .setFooter({
      text: `Page ${response.page}/${response.totalPages} · ${response.totalUsers} total members`,
    });
}

export function createLeaderboardCommand(xpEngine: XpEngine): Command {
  return {
    name: "leaderboard",
    description: "Show the server XP leaderboard",
    slashData: new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Show the server XP leaderboard")
      .addIntegerOption((opt) =>
        opt.setName("page").setDescription("Page number (default: 1)").setMinValue(1),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guildId) {
        await interaction.reply({
          content: "This command can only be used in a server.",
          flags: 64,
        });
        return;
      }

      const page = interaction.options.getInteger("page") ?? 1;
      const response = await xpEngine.getLeaderboard({
        guildId: interaction.guildId,
        page,
        pageSize: PAGE_SIZE,
      });
      await interaction.reply({ embeds: [buildLeaderboardEmbed(response)] });
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      if (!message.guild) {
        await message.reply("This command can only be used in a server.");
        return;
      }

      const page = context.args[0] ? parseInt(context.args[0], 10) : 1;
      if (isNaN(page) || page < 1) {
        await message.reply("Please provide a valid page number.");
        return;
      }

      const response = await xpEngine.getLeaderboard({
        guildId: message.guild.id,
        page,
        pageSize: PAGE_SIZE,
      });
      await message.reply({ embeds: [buildLeaderboardEmbed(response)] });
    },
  };
}
