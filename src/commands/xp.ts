import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { XpEngine } from "../engines/xp-engine.js";
import type { AdminXpResponse } from "../types/xp-contracts.js";

function formatAdminResponse(action: string, response: AdminXpResponse): string {
  return [
    `**XP ${action}** for <@${response.userId}>`,
    `Before: Level ${response.previousLevel} (${response.previousXp.toLocaleString()} XP)`,
    `After: Level ${response.currentLevel} (${response.currentXp.toLocaleString()} XP)`,
  ].join("\n");
}

export function createXpCommand(xpEngine: XpEngine): Command {
  return {
    name: "xp",
    description: "Manage user XP",
    slashData: new SlashCommandBuilder()
      .setName("xp")
      .setDescription("Manage user XP")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Set a user's XP")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("Target user").setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt.setName("amount").setDescription("XP amount").setRequired(true).setMinValue(0),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add XP to a user")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("Target user").setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("amount")
              .setDescription("XP to add")
              .setRequired(true)
              .setMinValue(1),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("reset")
          .setDescription("Reset a user's XP to zero")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("Target user").setRequired(true),
          ),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guildId) {
        await interaction.reply({
          content: "This command can only be used in a server.",
          flags: 64,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser("user", true);
      const guildId = interaction.guildId;

      let response: AdminXpResponse;

      switch (subcommand) {
        case "set": {
          const amount = interaction.options.getInteger("amount", true);
          response = await xpEngine.setXp({ userId: targetUser.id, guildId, xp: amount });
          break;
        }
        case "add": {
          const amount = interaction.options.getInteger("amount", true);
          response = await xpEngine.addXp({ userId: targetUser.id, guildId, xp: amount });
          break;
        }
        case "reset": {
          response = await xpEngine.resetXp({ userId: targetUser.id, guildId });
          break;
        }
        default:
          await interaction.reply({ content: "Unknown subcommand.", flags: 64 });
          return;
      }

      await interaction.reply({ content: formatAdminResponse(subcommand, response), flags: 64 });
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      if (!message.guild || !message.channel || message.channel.type === ChannelType.DM) {
        await message.reply("This command can only be used in a server channel.");
        return;
      }

      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await message.reply("You need the Manage Server permission to use this command.");
        return;
      }

      const [subcommand, , amountStr] = context.args;
      if (!subcommand || !["set", "add", "reset"].includes(subcommand)) {
        await message.reply("Usage: `!xp <set|add|reset> @user [amount]`");
        return;
      }

      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        await message.reply("Please mention a user.");
        return;
      }

      const guildId = message.guild.id;
      let response: AdminXpResponse;

      switch (subcommand) {
        case "set": {
          const amount = parseInt(amountStr, 10);
          if (isNaN(amount) || amount < 0) {
            await message.reply("Please provide a valid XP amount (0 or greater).");
            return;
          }
          response = await xpEngine.setXp({ userId: targetUser.id, guildId, xp: amount });
          break;
        }
        case "add": {
          const amount = parseInt(amountStr, 10);
          if (isNaN(amount) || amount < 1) {
            await message.reply("Please provide a valid XP amount (1 or greater).");
            return;
          }
          response = await xpEngine.addXp({ userId: targetUser.id, guildId, xp: amount });
          break;
        }
        case "reset": {
          response = await xpEngine.resetXp({ userId: targetUser.id, guildId });
          break;
        }
        default:
          return;
      }

      await message.reply(formatAdminResponse(subcommand, response));
    },
  };
}
