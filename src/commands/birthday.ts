import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { BirthdayEngine } from "../engines/birthday-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { BirthdayEntry } from "../types/birthday-contracts.js";
import { buildBirthdayEmbeds } from "../utilities/birthday-timer.js";

const EMBED_COLOR = 0xe91e63;

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const HELP_DESCRIPTION = [
  "**How it works:**",
  "Mods can add birthdays for server members and their family. " +
  "On the day of a stored birthday, the bot posts an announcement in the designated channel.",
  "",
  "**Commands:**",
  "`/birthday add <month> <day> <@user> [person]` — Add a birthday for a user (leave person blank for themselves)",
  "`/birthday remove <@user> [person]` — Remove a birthday",
  "`/birthday list [@user]` — List stored birthdays (all, or for a specific user)",
  "`/birthday announce` — Post today's birthday announcements now",
  "`/birthday help` — Show this help message",
  "",
  "**Tips:**",
  "- You can store birthdays for family members too (e.g. `/birthday add 6 15 @user wife`)",
  "- Use `/birthday list` to see all stored birthdays",
  "- Use `/birthday remove @user` with no person to remove all entries for that user",
].join("\n");

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Birthday Tracker — Help")
    .setDescription(HELP_DESCRIPTION)
    .setColor(EMBED_COLOR);
}

function formatBirthday(entry: BirthdayEntry): string {
  const who = entry.personName ?? "Self";
  return `<@${entry.userId}> — **${who}** — ${MONTH_NAMES[entry.month]} ${entry.day}`;
}

export function createBirthdayCommand(birthdayEngine: BirthdayEngine, ollamaAccessor: OllamaAccessor): Command {
  return {
    name: "birthday",
    description: "Track and celebrate birthdays (mod only)",
    slashData: new SlashCommandBuilder()
      .setName("birthday")
      .setDescription("Track and celebrate birthdays (mod only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
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
          .addUserOption((opt) =>
            opt.setName("user").setDescription("Whose birthday?").setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName("person").setDescription("Relationship (e.g. 'wife', 'son Jake') — leave blank for the user themselves").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a birthday")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("Whose birthday to remove?").setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName("person").setDescription("Which person? Leave blank to remove all for this user").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List stored birthdays")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("Filter to a specific user").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("announce").setDescription("Post today's birthday announcements now"),
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
          const targetUser = interaction.options.getUser("user", true);
          const person = interaction.options.getString("person") ?? null;

          const result = await birthdayEngine.addBirthday({
            guildId,
            userId: targetUser.id,
            personName: person,
            month,
            day,
          });

          if (result.reason === "invalid_date") {
            await interaction.reply({ content: "That's not a valid date.", flags: 64 });
            return;
          }

          const who = person ? `<@${targetUser.id}>'s ${person}'s birthday` : `<@${targetUser.id}>'s birthday`;
          const verb = result.reason === "updated" ? "Updated" : "Added";
          await interaction.reply({
            content: `${verb} ${who}: **${MONTH_NAMES[month]} ${day}**`,
            flags: 64,
          });
          break;
        }

        case "remove": {
          const targetUser = interaction.options.getUser("user", true);
          const person = interaction.options.getString("person") ?? null;

          if (person === null) {
            const count = await birthdayEngine.removeAllForUser(guildId, targetUser.id);
            await interaction.reply({
              content: count > 0
                ? `Removed ${count} birthday entr${count === 1 ? "y" : "ies"} for <@${targetUser.id}>.`
                : `No birthday data found for <@${targetUser.id}>.`,
              flags: 64,
            });
            return;
          }

          const result = await birthdayEngine.removeBirthday({
            guildId,
            userId: targetUser.id,
            personName: person,
          });

          if (!result.removed) {
            await interaction.reply({ content: "No matching birthday found.", flags: 64 });
            return;
          }

          await interaction.reply({
            content: `Removed ${person}'s birthday for <@${targetUser.id}>.`,
            flags: 64,
          });
          break;
        }

        case "list": {
          const targetUser = interaction.options.getUser("user");

          if (targetUser) {
            const entries = await birthdayEngine.listBirthdays(guildId, targetUser.id);
            if (entries.length === 0) {
              await interaction.reply({ content: `No birthdays stored for <@${targetUser.id}>.`, flags: 64 });
              return;
            }
            const lines = entries.map(formatBirthday);
            const embed = new EmbedBuilder()
              .setTitle(`Birthdays for ${targetUser.displayName}`)
              .setDescription(lines.join("\n"))
              .setColor(EMBED_COLOR);
            await interaction.reply({ embeds: [embed], flags: 64 });
          } else {
            const allEntries = await birthdayEngine.getAllBirthdays(guildId);
            if (allEntries.length === 0) {
              await interaction.reply({ content: "No birthdays stored yet.", flags: 64 });
              return;
            }
            const lines = allEntries.map(formatBirthday);
            const embed = new EmbedBuilder()
              .setTitle("All Stored Birthdays")
              .setDescription(lines.join("\n").slice(0, 4096))
              .setColor(EMBED_COLOR);
            await interaction.reply({ embeds: [embed], flags: 64 });
          }
          break;
        }

        case "announce": {
          const now = new Date();
          const month = now.getMonth() + 1;
          const day = now.getDate();
          const entries = await birthdayEngine.getTodaysBirthdays(guildId, month, day);

          if (entries.length === 0) {
            await interaction.reply({ content: "No birthdays today.", flags: 64 });
            return;
          }

          await interaction.deferReply();
          const embeds = await buildBirthdayEmbeds(ollamaAccessor, entries, month, day);
          await interaction.editReply({ embeds });
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

      const member = await message.guild!.members.fetch(message.author.id);
      if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await message.reply("This command requires **Manage Messages** permission.");
        return;
      }

      const [subcommand, ...rest] = context.args;

      if (subcommand === "help") {
        await message.reply({ embeds: [buildHelpEmbed()] });
        return;
      }

      if (subcommand === "add") {
        const month = parseInt(rest[0], 10);
        const day = parseInt(rest[1], 10);
        const mentionedUser = message.mentions.users.first();
        if (isNaN(month) || isNaN(day) || !mentionedUser) {
          await message.reply("Usage: `!birthday add <month> <day> <@user> [person]`");
          return;
        }
        const nonMentionArgs = rest.slice(2).filter((a) => !a.startsWith("<@"));
        const person = nonMentionArgs.length > 0 ? nonMentionArgs.join(" ") : null;

        const result = await birthdayEngine.addBirthday({
          guildId,
          userId: mentionedUser.id,
          personName: person,
          month,
          day,
        });

        if (result.reason === "invalid_date") {
          await message.reply("That's not a valid date.");
          return;
        }

        const who = person ? `<@${mentionedUser.id}>'s ${person}'s birthday` : `<@${mentionedUser.id}>'s birthday`;
        const verb = result.reason === "updated" ? "Updated" : "Added";
        await message.reply(`${verb} ${who}: **${MONTH_NAMES[month]} ${day}**`);
        return;
      }

      if (subcommand === "remove") {
        const mentionedUser = message.mentions.users.first();
        if (!mentionedUser) {
          await message.reply("Usage: `!birthday remove <@user> [person]`");
          return;
        }

        const nonMentionArgs = rest.filter((a) => !a.startsWith("<@"));
        const person = nonMentionArgs.length > 0 ? nonMentionArgs.join(" ") : null;

        if (person === null) {
          const count = await birthdayEngine.removeAllForUser(guildId, mentionedUser.id);
          await message.reply(
            count > 0
              ? `Removed ${count} birthday entr${count === 1 ? "y" : "ies"} for <@${mentionedUser.id}>.`
              : `No birthday data found for <@${mentionedUser.id}>.`,
          );
          return;
        }

        const result = await birthdayEngine.removeBirthday({
          guildId,
          userId: mentionedUser.id,
          personName: person,
        });

        if (!result.removed) {
          await message.reply("No matching birthday found.");
          return;
        }

        await message.reply(`Removed ${person}'s birthday for <@${mentionedUser.id}>.`);
        return;
      }

      if (subcommand === "list") {
        const mentionedUser = message.mentions.users.first();
        if (mentionedUser) {
          const entries = await birthdayEngine.listBirthdays(guildId, mentionedUser.id);
          if (entries.length === 0) {
            await message.reply(`No birthdays stored for <@${mentionedUser.id}>.`);
            return;
          }
          const lines = entries.map(formatBirthday);
          const embed = new EmbedBuilder()
            .setTitle("Birthdays")
            .setDescription(lines.join("\n"))
            .setColor(EMBED_COLOR);
          await message.reply({ embeds: [embed] });
        } else {
          const allEntries = await birthdayEngine.getAllBirthdays(guildId);
          if (allEntries.length === 0) {
            await message.reply("No birthdays stored yet.");
            return;
          }
          const lines = allEntries.map(formatBirthday);
          const embed = new EmbedBuilder()
            .setTitle("All Stored Birthdays")
            .setDescription(lines.join("\n").slice(0, 4096))
            .setColor(EMBED_COLOR);
          await message.reply({ embeds: [embed] });
        }
        return;
      }

      if (subcommand === "announce") {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const entries = await birthdayEngine.getTodaysBirthdays(guildId, month, day);

        if (entries.length === 0) {
          await message.reply("No birthdays today.");
          return;
        }

        const embeds = await buildBirthdayEmbeds(ollamaAccessor, entries, month, day);
        await message.channel.send({ embeds });
        return;
      }

      // Unknown subcommand — show help
      await message.reply({ embeds: [buildHelpEmbed()] });
    },
  };
}
