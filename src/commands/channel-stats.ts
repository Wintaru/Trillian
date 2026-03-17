import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { ChannelStatsEngine } from "../engines/channel-stats-engine.js";
import type { ServerStatsResponse, ChannelStats } from "../types/channel-stats-contracts.js";

const MAX_CHANNELS_PER_EMBED = 8;

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}${suffix}`;
}

function buildSummaryEmbed(stats: ServerStatsResponse): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Daily Stats — ${stats.date}`)
    .setColor(0x5865f2)
    .setDescription(`Server-wide activity summary for **${stats.guildName}**`);

  const lines: string[] = [
    `**Total Messages:** ${stats.totalMessages}`,
    `**Unique Posters:** ${stats.totalUniquePosters}`,
    `**Media Posts:** ${stats.content.media}`,
    `**Links Shared:** ${stats.content.links}`,
  ];

  if (stats.recipesAdded > 0) {
    lines.push(`**Recipes Added:** ${stats.recipesAdded}`);
  }
  if (stats.libraryEntriesAdded > 0) {
    lines.push(`**Library Additions:** ${stats.libraryEntriesAdded}`);
  }
  if (stats.busiestHour !== null) {
    lines.push(`**Busiest Hour:** ${formatHour(stats.busiestHour)}`);
  }

  embed.addFields({ name: "Overview", value: lines.join("\n") });

  if (stats.topPosters.length > 0) {
    const posterLines = stats.topPosters.map(
      (p, i) => `**${i + 1}.** <@${p.userId}> — ${p.count} message${p.count === 1 ? "" : "s"}`,
    );
    embed.addFields({ name: "Top Posters", value: posterLines.join("\n") });
  }

  return embed;
}

function buildChannelEmbeds(channels: ChannelStats[]): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];
  const activeChannels = channels.filter((c) => c.totalMessages > 0);

  for (let i = 0; i < activeChannels.length; i += MAX_CHANNELS_PER_EMBED) {
    const batch = activeChannels.slice(i, i + MAX_CHANNELS_PER_EMBED);
    const embed = new EmbedBuilder().setColor(0x5865f2);

    if (i === 0) {
      embed.setTitle("Channel Breakdown");
    }

    for (const ch of batch) {
      const lines: string[] = [
        `Messages: **${ch.totalMessages}** · Posters: **${ch.uniquePosters}**`,
      ];

      if (ch.content.media > 0) {
        lines.push(`Media: **${ch.content.media}**`);
      }
      if (ch.content.links > 0) {
        lines.push(`Links: **${ch.content.links}**`);
      }
      if (ch.topPosters.length > 0) {
        const top = ch.topPosters
          .slice(0, 3)
          .map((p) => `<@${p.userId}> (${p.count})`)
          .join(", ");
        lines.push(`Top: ${top}`);
      }

      embed.addFields({ name: `#${ch.channelName}`, value: lines.join("\n"), inline: true });
    }

    embeds.push(embed);
  }

  return embeds;
}

function buildHelpEmbed(prefix: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Channel Stats — Help")
    .setColor(0x5865f2)
    .setDescription(
      "Summarizes today's activity across all text channels in the server.",
    )
    .addFields(
      {
        name: "Usage",
        value: [
          `\`/stats\``,
          `\`${prefix}stats\``,
        ].join("\n"),
      },
      {
        name: "What's Included",
        value: [
          "• Total messages and unique posters",
          "• Media posts and links shared",
          "• Recipes and library additions (from the database)",
          "• Busiest hour of the day",
          "• Top posters server-wide and per channel",
          "• Per-channel breakdown",
        ].join("\n"),
      },
      {
        name: "Tips",
        value: [
          "• Stats cover from midnight (local server time) to now",
          "• Only human messages are counted (bot messages excluded)",
          "• The bot can only see channels it has access to",
        ].join("\n"),
      },
    );
}

export function createChannelStatsCommand(
  engine: ChannelStatsEngine,
  prefix: string,
): Command {
  return {
    name: "stats",
    description: "Show today's channel activity stats",
    slashData: new SlashCommandBuilder()
      .setName("stats")
      .setDescription("Show today's channel activity stats")
      .addSubcommand((sub) =>
        sub.setName("today").setDescription("Show today's activity summary"),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show help for the stats command"),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guild) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: 64 });
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === "help") {
        await interaction.reply({ embeds: [buildHelpEmbed(prefix)], flags: 64 });
        return;
      }

      await interaction.deferReply();

      const stats = await engine.generateStats(
        { guildId: interaction.guildId! },
        interaction.guild,
      );

      if (stats.totalMessages === 0) {
        await interaction.editReply("No messages found today — it's quiet so far!");
        return;
      }

      const embeds = [buildSummaryEmbed(stats), ...buildChannelEmbeds(stats.channels)];

      // Discord allows max 10 embeds per message
      await interaction.editReply({ embeds: embeds.slice(0, 10) });
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      if (!message.guild) {
        await message.reply("This command can only be used in a server.");
        return;
      }

      const sub = context.args[0]?.toLowerCase();

      if (sub === "help" || (sub && sub !== "today")) {
        await message.reply({ embeds: [buildHelpEmbed(prefix)] });
        return;
      }

      const thinking = await message.reply("Crunching today's numbers...");

      const stats = await engine.generateStats(
        { guildId: message.guild.id },
        message.guild,
      );

      if (stats.totalMessages === 0) {
        await thinking.edit("No messages found today — it's quiet so far!");
        return;
      }

      const embeds = [buildSummaryEmbed(stats), ...buildChannelEmbeds(stats.channels)];

      await thinking.edit({ content: "", embeds: embeds.slice(0, 10) });
    },
  };
}
