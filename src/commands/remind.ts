import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { ReminderEngine } from "../engines/reminder-engine.js";
import * as chrono from "chrono-node";

const EMBED_COLOR = 0x5865f2;
const PAGE_SIZE = 10;

const HELP_DESCRIPTION = [
  "**How it works:**",
  "Set personal reminders and the bot will notify you when the time comes. " +
  "By default, reminders are delivered via DM. Use `public: true` to have the reminder posted in the channel instead.",
  "",
  "**Commands:**",
  "`/remind create when:\"in 2 hours\" message:\"Take out the trash\"` — Remind you via DM in 2 hours",
  "`/remind create when:\"tomorrow at 3pm\" message:\"Call dentist\" public:true` — Public reminder in this channel",
  "`/remind create when:\"next Friday at 5pm\" message:\"Submit timesheet\"` — Natural language dates work",
  "`/remind list` — Show your pending reminders",
  "`/remind cancel id:5` — Cancel a pending reminder",
  "`/remind help` — Show this help message",
  "",
  "**Prefix usage:**",
  "`!remind create in 2 hours | Take out the trash`",
  "`!remind create public tomorrow at 3pm | Call dentist`",
  "`!remind list`",
  "`!remind cancel 5`",
  "",
  "**Tips:**",
  "- Times are parsed as natural language — try things like \"tonight at 8\", \"in 30 minutes\", \"next Monday at noon\"",
  "- Reminders use Discord timestamps so they display in your local time",
  "- You can have up to 25 active reminders at a time",
  "- Minimum reminder time is 1 minute; maximum is 1 year",
].join("\n");

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Remind Me — Help")
    .setDescription(HELP_DESCRIPTION)
    .setColor(EMBED_COLOR);
}

function formatReasonMessage(reason: string): string {
  switch (reason) {
    case "past_date":
      return "That time is in the past. Please pick a future time.";
    case "too_soon":
      return "Reminders must be at least 1 minute in the future.";
    case "too_far":
      return "Reminders can't be more than 1 year in the future.";
    case "too_many":
      return "You have too many active reminders (max 25). Cancel some first.";
    case "empty_message":
      return "You need to provide a reminder message.";
    case "message_too_long":
      return "Reminder message is too long (max 1000 characters).";
    default:
      return "Something went wrong creating the reminder.";
  }
}

export function createRemindCommand(reminderEngine: ReminderEngine): Command {
  return {
    name: "remind",
    description: "Set personal reminders",
    slashData: new SlashCommandBuilder()
      .setName("remind")
      .setDescription("Set personal reminders")
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new reminder")
          .addStringOption((opt) =>
            opt
              .setName("when")
              .setDescription("When to remind you (e.g. \"in 2 hours\", \"tomorrow at 3pm\")")
              .setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("message")
              .setDescription("What to remind you about")
              .setRequired(true),
          )
          .addBooleanOption((opt) =>
            opt
              .setName("public")
              .setDescription("Post the reminder publicly in this channel (default: DM)")
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List your pending reminders")
          .addIntegerOption((opt) =>
            opt
              .setName("page")
              .setDescription("Page number")
              .setRequired(false)
              .setMinValue(1),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("cancel")
          .setDescription("Cancel a pending reminder")
          .addIntegerOption((opt) =>
            opt
              .setName("id")
              .setDescription("Reminder ID (from /remind list)")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show remind command help"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: 64 });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case "create": {
          const whenInput = interaction.options.getString("when", true);
          const message = interaction.options.getString("message", true);
          const isPublic = interaction.options.getBoolean("public") ?? false;

          const parsed = chrono.parseDate(whenInput, new Date(), { forwardDate: true });
          if (!parsed) {
            await interaction.reply({
              content: "I couldn't understand that time. Try something like \"in 2 hours\" or \"tomorrow at 3pm\".",
              flags: 64,
            });
            return;
          }

          const result = await reminderEngine.createReminder({
            guildId,
            channelId: interaction.channelId,
            userId: interaction.user.id,
            message,
            deliverAt: parsed.getTime(),
            isPublic,
          });

          if (!result.success) {
            await interaction.reply({ content: formatReasonMessage(result.reason), flags: 64 });
            return;
          }

          const timestamp = Math.floor(result.deliverAt! / 1000);
          const where = isPublic ? "in this channel" : "via DM";
          await interaction.reply({
            content: `Reminder set for <t:${timestamp}:F> (<t:${timestamp}:R>) ${where}.\nID: **${result.reminderId}**`,
            flags: 64,
          });
          break;
        }

        case "list": {
          const page = interaction.options.getInteger("page") ?? 1;
          const result = await reminderEngine.listReminders(interaction.user.id, page, PAGE_SIZE);

          if (result.total === 0) {
            await interaction.reply({ content: "You have no pending reminders.", flags: 64 });
            return;
          }

          const lines = result.reminders.map((r) => {
            const ts = Math.floor(r.deliverAt / 1000);
            const delivery = r.isPublic ? "public" : "DM";
            return `**#${r.id}** — <t:${ts}:F> (<t:${ts}:R>) [${delivery}]\n${r.message}`;
          });

          const totalPages = Math.ceil(result.total / PAGE_SIZE);
          const embed = new EmbedBuilder()
            .setTitle("Your Pending Reminders")
            .setDescription(lines.join("\n\n"))
            .setFooter({ text: `Page ${page}/${totalPages} — ${result.total} reminder(s)` })
            .setColor(EMBED_COLOR);

          await interaction.reply({ embeds: [embed], flags: 64 });
          break;
        }

        case "cancel": {
          const reminderId = interaction.options.getInteger("id", true);
          const result = await reminderEngine.cancelReminder(reminderId, interaction.user.id);

          if (!result.success) {
            const msg =
              result.reason === "not_found"
                ? "Reminder not found."
                : result.reason === "not_owner"
                  ? "You can only cancel your own reminders."
                  : "That reminder has already been delivered or cancelled.";
            await interaction.reply({ content: msg, flags: 64 });
            return;
          }

          await interaction.reply({ content: `Reminder **#${reminderId}** cancelled.`, flags: 64 });
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

      if (!subcommand || subcommand === "help") {
        await message.reply({ embeds: [buildHelpEmbed()] });
        return;
      }

      if (subcommand === "create") {
        let isPublic = false;
        let remaining = rest;

        // Check for "public" flag as first word
        if (remaining[0]?.toLowerCase() === "public") {
          isPublic = true;
          remaining = remaining.slice(1);
        }

        const raw = remaining.join(" ");
        const pipeIndex = raw.indexOf("|");
        if (pipeIndex === -1) {
          await message.reply(
            "Usage: `!remind create [public] <when> | <message>`\nExample: `!remind create in 2 hours | Take out the trash`",
          );
          return;
        }

        const whenInput = raw.slice(0, pipeIndex).trim();
        const reminderMessage = raw.slice(pipeIndex + 1).trim();

        if (!whenInput || !reminderMessage) {
          await message.reply(
            "Usage: `!remind create [public] <when> | <message>`\nExample: `!remind create in 2 hours | Take out the trash`",
          );
          return;
        }

        const parsed = chrono.parseDate(whenInput, new Date(), { forwardDate: true });
        if (!parsed) {
          await message.reply(
            "I couldn't understand that time. Try something like \"in 2 hours\" or \"tomorrow at 3pm\".",
          );
          return;
        }

        const result = await reminderEngine.createReminder({
          guildId,
          channelId: message.channelId,
          userId: message.author.id,
          message: reminderMessage,
          deliverAt: parsed.getTime(),
          isPublic,
        });

        if (!result.success) {
          await message.reply(formatReasonMessage(result.reason));
          return;
        }

        const timestamp = Math.floor(result.deliverAt! / 1000);
        const where = isPublic ? "in this channel" : "via DM";
        await message.reply(
          `Reminder set for <t:${timestamp}:F> (<t:${timestamp}:R>) ${where}.\nID: **${result.reminderId}**`,
        );
        return;
      }

      if (subcommand === "list") {
        const page = parseInt(rest[0], 10) || 1;
        const result = await reminderEngine.listReminders(message.author.id, page, PAGE_SIZE);

        if (result.total === 0) {
          await message.reply("You have no pending reminders.");
          return;
        }

        const lines = result.reminders.map((r) => {
          const ts = Math.floor(r.deliverAt / 1000);
          const delivery = r.isPublic ? "public" : "DM";
          return `**#${r.id}** — <t:${ts}:F> (<t:${ts}:R>) [${delivery}]\n${r.message}`;
        });

        const totalPages = Math.ceil(result.total / PAGE_SIZE);
        const embed = new EmbedBuilder()
          .setTitle("Your Pending Reminders")
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: `Page ${page}/${totalPages} — ${result.total} reminder(s)` })
          .setColor(EMBED_COLOR);

        await message.reply({ embeds: [embed] });
        return;
      }

      if (subcommand === "cancel") {
        const reminderId = parseInt(rest[0], 10);
        if (isNaN(reminderId)) {
          await message.reply("Usage: `!remind cancel <id>`");
          return;
        }

        const result = await reminderEngine.cancelReminder(reminderId, message.author.id);

        if (!result.success) {
          const msg =
            result.reason === "not_found"
              ? "Reminder not found."
              : result.reason === "not_owner"
                ? "You can only cancel your own reminders."
                : "That reminder has already been delivered or cancelled.";
          await message.reply(msg);
          return;
        }

        await message.reply(`Reminder **#${reminderId}** cancelled.`);
        return;
      }

      // Unknown subcommand — show help
      await message.reply({ embeds: [buildHelpEmbed()] });
    },
  };
}
