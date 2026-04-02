import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { FeedEngine } from "../engines/feed-engine.js";

const EMBED_COLOR = 0xe67e22;

const HELP_DESCRIPTION = [
  "**How it works:**",
  "Subscribe to RSS/Atom feeds and get new posts delivered to a channel automatically. " +
  "The bot checks all feeds on a regular interval and posts an embed for each new item.",
  "",
  "**Commands:**",
  "`/feed add url:https://example.com/rss/ label:\"My Blog\"` — Subscribe to a feed in this channel",
  "`/feed remove id:3` — Remove a feed subscription",
  "`/feed list` — Show all subscribed feeds in this server",
  "`/feed help` — Show this help message",
  "",
  "**Prefix usage:**",
  "`!feed add https://example.com/rss/ My Blog`",
  "`!feed remove 3`",
  "`!feed list`",
  "",
  "**Tips:**",
  "- When you add a feed, the most recent post is immediately sent to the channel",
  "- The bot remembers the last post it saw, so it won't re-post on restart",
  "- Each feed URL can only be subscribed once per server",
  "- Most blogs and news sites expose an RSS feed at `/rss/`, `/feed/`, or `/atom.xml`",
].join("\n");

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Feed — Help")
    .setDescription(HELP_DESCRIPTION)
    .setColor(EMBED_COLOR);
}

export function createFeedCommand(feedEngine: FeedEngine): Command {
  return {
    name: "feed",
    description: "Subscribe to RSS/Atom feeds",
    slashData: new SlashCommandBuilder()
      .setName("feed")
      .setDescription("Subscribe to RSS/Atom feeds")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Subscribe to a feed in this channel")
          .addStringOption((opt) =>
            opt
              .setName("url")
              .setDescription("The RSS/Atom feed URL")
              .setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("label")
              .setDescription("A friendly name for this feed")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a feed subscription")
          .addIntegerOption((opt) =>
            opt
              .setName("id")
              .setDescription("Subscription ID (from /feed list)")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("List all feed subscriptions in this server"),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show feed command help"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: 64 });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case "add": {
          await interaction.deferReply();
          const url = interaction.options.getString("url", true);
          const label = interaction.options.getString("label", true);

          const result = await feedEngine.addFeed(guildId, interaction.channelId, url, label);

          if (!result.success) {
            const msg = result.reason === "duplicate"
              ? "This feed is already subscribed in this server."
              : "Could not parse that URL as a valid RSS/Atom feed.";
            await interaction.editReply(msg);
            return;
          }

          let reply = `Subscribed to **${label}** (ID: ${result.id}). New posts will appear in this channel.`;
          if (result.latestItem) {
            reply += `\n\nHere's the most recent post:`;
          }
          await interaction.editReply(reply);

          if (result.latestItem && interaction.channel?.isSendable()) {
            const embed = buildItemEmbed(result.latestItem, label);
            await interaction.channel.send({ embeds: [embed] });
          }
          break;
        }

        case "remove": {
          const id = interaction.options.getInteger("id", true);
          const removed = await feedEngine.removeFeed(id, guildId);

          if (!removed) {
            await interaction.reply({ content: "Subscription not found.", flags: 64 });
            return;
          }

          await interaction.reply(`Subscription **#${id}** removed.`);
          break;
        }

        case "list": {
          const feeds = await feedEngine.listFeeds(guildId);

          if (feeds.length === 0) {
            await interaction.reply({ content: "No feed subscriptions in this server.", flags: 64 });
            return;
          }

          const lines = feeds.map((f) => {
            const checked = f.lastCheckedAt ? `<t:${Math.floor(f.lastCheckedAt / 1000)}:R>` : "never";
            return `**#${f.id}** — ${f.label}\n${f.feedUrl}\nChannel: <#${f.channelId}> — Last checked: ${checked}`;
          });

          const embed = new EmbedBuilder()
            .setTitle("Feed Subscriptions")
            .setDescription(lines.join("\n\n"))
            .setColor(EMBED_COLOR);

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "help": {
          await interaction.reply({ embeds: [buildHelpEmbed()], flags: 64 });
          break;
        }
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const guildId = message.guildId;
      if (!guildId || !message.channel.isSendable()) return;

      // Check permissions
      const member = message.member;
      if (!member || !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await message.reply("You need the **Manage Server** permission to use this command.");
        return;
      }

      const [subcommand, ...rest] = context.args;

      if (!subcommand || subcommand === "help") {
        await message.reply({ embeds: [buildHelpEmbed()] });
        return;
      }

      if (subcommand === "add") {
        if (rest.length < 2) {
          await message.reply("Usage: `!feed add <url> <label>`\nExample: `!feed add https://example.com/rss/ My Blog`");
          return;
        }

        const url = rest[0];
        const label = rest.slice(1).join(" ");

        const thinking = await message.reply("Checking feed...");
        const result = await feedEngine.addFeed(guildId, message.channelId, url, label);

        if (!result.success) {
          const msg = result.reason === "duplicate"
            ? "This feed is already subscribed in this server."
            : "Could not parse that URL as a valid RSS/Atom feed.";
          await thinking.edit(msg);
          return;
        }

        let reply = `Subscribed to **${label}** (ID: ${result.id}). New posts will appear in this channel.`;
        if (result.latestItem) {
          reply += `\n\nHere's the most recent post:`;
        }
        await thinking.edit(reply);

        if (result.latestItem) {
          const embed = buildItemEmbed(result.latestItem, label);
          await message.channel.send({ embeds: [embed] });
        }
        return;
      }

      if (subcommand === "remove") {
        const id = parseInt(rest[0], 10);
        if (isNaN(id)) {
          await message.reply("Usage: `!feed remove <id>`");
          return;
        }

        const removed = await feedEngine.removeFeed(id, guildId);
        if (!removed) {
          await message.reply("Subscription not found.");
          return;
        }

        await message.reply(`Subscription **#${id}** removed.`);
        return;
      }

      if (subcommand === "list") {
        const feeds = await feedEngine.listFeeds(guildId);

        if (feeds.length === 0) {
          await message.reply("No feed subscriptions in this server.");
          return;
        }

        const lines = feeds.map((f) => {
          const checked = f.lastCheckedAt ? `<t:${Math.floor(f.lastCheckedAt / 1000)}:R>` : "never";
          return `**#${f.id}** — ${f.label}\n${f.feedUrl}\nChannel: <#${f.channelId}> — Last checked: ${checked}`;
        });

        const embed = new EmbedBuilder()
          .setTitle("Feed Subscriptions")
          .setDescription(lines.join("\n\n"))
          .setColor(EMBED_COLOR);

        await message.reply({ embeds: [embed] });
        return;
      }

      // Unknown subcommand
      await message.reply({ embeds: [buildHelpEmbed()] });
    },
  };
}

function buildItemEmbed(
  item: { title: string; link: string; pubDate?: string; creator?: string; contentSnippet?: string },
  label: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(item.title)
    .setFooter({ text: label });

  if (item.link) embed.setURL(item.link);
  if (item.contentSnippet) embed.setDescription(item.contentSnippet);
  if (item.creator) embed.setAuthor({ name: item.creator });
  if (item.pubDate) embed.setTimestamp(new Date(item.pubDate));

  return embed;
}
