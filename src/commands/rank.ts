import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { XpEngine } from "../engines/xp-engine.js";
import type { UserStatsResponse } from "../types/xp-contracts.js";

function buildProgressBar(current: number, total: number): string {
  const filled = total > 0 ? Math.round((current / total) * 10) : 0;
  const empty = 10 - filled;
  return "[" + "=".repeat(filled) + "-".repeat(empty) + "]";
}

function buildRankEmbed(
  displayName: string,
  avatarUrl: string,
  stats: UserStatsResponse,
): EmbedBuilder {
  const progressBar = buildProgressBar(stats.progressXp, stats.requiredXp);
  return new EmbedBuilder()
    .setTitle(`${displayName}'s Rank`)
    .setThumbnail(avatarUrl)
    .setColor(0x5865f2)
    .addFields(
      { name: "Level", value: `${stats.level}`, inline: true },
      { name: "XP", value: `${stats.xp.toLocaleString()}`, inline: true },
      { name: "Rank", value: stats.rankName ?? "Unranked", inline: true },
      {
        name: "Progress",
        value: `${progressBar}\n${stats.progressXp.toLocaleString()} / ${stats.requiredXp.toLocaleString()} XP`,
      },
    );
}

export function createRankCommand(xpEngine: XpEngine): Command {
  return {
    name: "rank",
    description: "Show your level, XP, and rank",
    slashData: new SlashCommandBuilder()
      .setName("rank")
      .setDescription("Show your level, XP, and rank")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to check (defaults to you)"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guildId) {
        await interaction.reply({
          content: "This command can only be used in a server.",
          flags: 64,
        });
        return;
      }

      const targetUser = interaction.options.getUser("user") ?? interaction.user;
      const stats = await xpEngine.getUserStats({
        userId: targetUser.id,
        guildId: interaction.guildId,
      });
      const embed = buildRankEmbed(
        targetUser.displayName,
        targetUser.displayAvatarURL(),
        stats,
      );
      await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message: Message, _context: CommandContext): Promise<void> {
      if (!message.guild) {
        await message.reply("This command can only be used in a server.");
        return;
      }

      const targetUser = message.mentions.users.first() ?? message.author;
      const stats = await xpEngine.getUserStats({
        userId: targetUser.id,
        guildId: message.guild.id,
      });
      const embed = buildRankEmbed(
        targetUser.displayName,
        targetUser.displayAvatarURL(),
        stats,
      );
      await message.reply({ embeds: [embed] });
    },
  };
}
