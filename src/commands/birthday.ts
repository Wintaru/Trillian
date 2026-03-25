import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction, Message, Client } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { BirthdayEngine } from "../engines/birthday-engine.js";
import type { BirthdayEntry } from "../types/birthday-contracts.js";
import { backfillBirthdays } from "../utilities/birthday-backfill.js";

const EMBED_COLOR = 0xe91e63;

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const HELP_DESCRIPTION = [
  "**How it works:**",
  "The bot passively listens for birthday mentions in chat. When someone mentions " +
  "a birthday with a specific date (e.g. \"my birthday is March 15th\" or \"my wife's " +
  "birthday is June 1st\"), the bot detects it and stores it automatically.",
  "",
  "On the day of a stored birthday, the bot posts an announcement in the designated channel.",
  "",
  "**Commands:**",
  "`/birthday add <month> <day> [person]` — Manually add a birthday (leave person blank for yourself)",
  "`/birthday remove [person] [@user]` — Remove a birthday (leave blank to remove your own)",
  "`/birthday scan` — Scan all channels for past birthday mentions (mod only)",
  "`/birthday help` — Show this help message",
  "",
  "**Tips:**",
  "- You can store birthdays for family members too (e.g. `/birthday add 6 15 wife`)",
  "- Mods can remove anyone's birthday data with `/birthday remove @user`",
  "- The bot only stores dates mentioned with a specific month and day",
  "- Use `/birthday remove` with no arguments to remove your own birthday",
].join("\n");

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Birthday Tracker — Help")
    .setDescription(HELP_DESCRIPTION)
    .setColor(EMBED_COLOR);
}

function formatBirthday(entry: BirthdayEntry): string {
  const who = entry.personName ?? "Self";
  return `**${who}** — ${MONTH_NAMES[entry.month]} ${entry.day} (${entry.source})`;
}

export function createBirthdayCommand(birthdayEngine: BirthdayEngine): Command {
  return {
    name: "birthday",
    description: "Track and celebrate birthdays",
    slashData: new SlashCommandBuilder()
      .setName("birthday")
      .setDescription("Track and celebrate birthdays")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a birthday")
          .addIntegerOption((opt) =>
            opt.setName("month").setDescription("Month (1-12)").setRequired(true)
              .setMinValue(1).setMaxValue(12),
          )
          .addIntegerOption((opt) =>
            opt.setName("day").setDescription("Day (1-31)").setRequired(true)
              .setMinValue(1).setMaxValue(31),
          )
          .addStringOption((opt) =>
            opt.setName("person").setDescription("Who? (e.g. 'wife', 'son Jake') — leave blank for yourself").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a birthday")
          .addStringOption((opt) =>
            opt.setName("person").setDescription("Who? Leave blank for yourself").setRequired(false),
          )
          .addUserOption((opt) =>
            opt.setName("user").setDescription("Remove for another user (requires Manage Messages)").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("scan")
          .setDescription("Scan all channels for past birthday mentions (mod only)"),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show birthday command help"),
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
          const month = interaction.options.getInteger("month", true);
          const day = interaction.options.getInteger("day", true);
          const person = interaction.options.getString("person") ?? null;

          const result = await birthdayEngine.addBirthday({
            guildId,
            userId: interaction.user.id,
            personName: person,
            month,
            day,
          });

          if (result.reason === "invalid_date") {
            await interaction.reply({ content: "That's not a valid date.", flags: 64 });
            return;
          }

          const who = person ? `${person}'s birthday` : "your birthday";
          const verb = result.reason === "updated" ? "Updated" : "Added";
          await interaction.reply({
            content: `${verb} ${who}: **${MONTH_NAMES[month]} ${day}**`,
            flags: 64,
          });
          break;
        }

        case "remove": {
          const person = interaction.options.getString("person") ?? null;
          const targetUser = interaction.options.getUser("user");

          let targetUserId = interaction.user.id;
          if (targetUser) {
            const member = await interaction.guild!.members.fetch(interaction.user.id);
            if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
              await interaction.reply({
                content: "You need **Manage Messages** permission to remove another user's birthday.",
                flags: 64,
              });
              return;
            }
            targetUserId = targetUser.id;

            if (person === null) {
              const count = await birthdayEngine.removeAllForUser(guildId, targetUserId);
              await interaction.reply({
                content: count > 0
                  ? `Removed ${count} birthday entr${count === 1 ? "y" : "ies"} for <@${targetUserId}>.`
                  : `No birthday data found for <@${targetUserId}>.`,
                flags: 64,
              });
              return;
            }
          }

          const result = await birthdayEngine.removeBirthday({
            guildId,
            userId: targetUserId,
            personName: person,
          });

          if (!result.removed) {
            await interaction.reply({ content: "No matching birthday found.", flags: 64 });
            return;
          }

          const who = person ? `${person}'s birthday` : "your birthday";
          await interaction.reply({ content: `Removed ${who}.`, flags: 64 });
          break;
        }

        case "scan": {
          const member = await interaction.guild!.members.fetch(interaction.user.id);
          if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await interaction.reply({
              content: "You need **Manage Messages** permission to run a backfill scan.",
              flags: 64,
            });
            return;
          }

          await interaction.deferReply();

          const report = await backfillBirthdays(
            interaction.client as Client,
            birthdayEngine,
            guildId,
          );

          await interaction.editReply(
            `Backfill complete!\n` +
            `Channels scanned: **${report.channelsScanned}/${report.totalChannels}**\n` +
            `Messages with birthday keywords: **${report.messagesProcessed}**\n` +
            `Birthdays found: **${report.birthdaysFound}**`,
          );
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

      const [subcommand, ...rest] = context.args;

      if (subcommand === "help") {
        await message.reply({ embeds: [buildHelpEmbed()] });
        return;
      }

      if (subcommand === "add") {
        const month = parseInt(rest[0], 10);
        const day = parseInt(rest[1], 10);
        if (isNaN(month) || isNaN(day)) {
          await message.reply("Usage: `!birthday add <month> <day> [person]`");
          return;
        }
        const person = rest.length > 2 ? rest.slice(2).join(" ") : null;

        const result = await birthdayEngine.addBirthday({
          guildId,
          userId: message.author.id,
          personName: person,
          month,
          day,
        });

        if (result.reason === "invalid_date") {
          await message.reply("That's not a valid date.");
          return;
        }

        const who = person ? `${person}'s birthday` : "your birthday";
        const verb = result.reason === "updated" ? "Updated" : "Added";
        await message.reply(`${verb} ${who}: **${MONTH_NAMES[month]} ${day}**`);
        return;
      }

      if (subcommand === "remove") {
        const mentionedUser = message.mentions.users.first();
        let targetUserId = message.author.id;
        let person: string | null = null;

        if (mentionedUser) {
          const member = await message.guild!.members.fetch(message.author.id);
          if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await message.reply("You need **Manage Messages** permission to remove another user's birthday.");
            return;
          }
          targetUserId = mentionedUser.id;

          const nonMentionArgs = rest.filter((a) => !a.startsWith("<@"));
          person = nonMentionArgs.length > 0 ? nonMentionArgs.join(" ") : null;

          if (person === null) {
            const count = await birthdayEngine.removeAllForUser(guildId, targetUserId);
            await message.reply(
              count > 0
                ? `Removed ${count} birthday entr${count === 1 ? "y" : "ies"} for <@${targetUserId}>.`
                : `No birthday data found for <@${targetUserId}>.`,
            );
            return;
          }
        } else {
          person = rest.length > 0 ? rest.join(" ") : null;
        }

        const result = await birthdayEngine.removeBirthday({
          guildId,
          userId: targetUserId,
          personName: person,
        });

        if (!result.removed) {
          await message.reply("No matching birthday found.");
          return;
        }

        const who = person ? `${person}'s birthday` : "your birthday";
        await message.reply(`Removed ${who}.`);
        return;
      }

      if (subcommand === "scan") {
        const member = await message.guild!.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          await message.reply("You need **Manage Messages** permission to run a backfill scan.");
          return;
        }

        const statusMsg = await message.reply("Scanning all channels for birthday mentions... This may take a while.");

        const report = await backfillBirthdays(
          message.client as Client,
          birthdayEngine,
          guildId,
        );

        await statusMsg.edit(
          `Backfill complete!\n` +
          `Channels scanned: **${report.channelsScanned}/${report.totalChannels}**\n` +
          `Messages with birthday keywords: **${report.messagesProcessed}**\n` +
          `Birthdays found: **${report.birthdaysFound}**`,
        );
        return;
      }

      // Unknown subcommand — show help
      await message.reply({ embeds: [buildHelpEmbed()] });
    },
  };
}
