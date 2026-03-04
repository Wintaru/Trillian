import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import type { ChatInputCommandInteraction, Message, GuildTextBasedChannel } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { PurgeRequest, PurgeResponse } from "../types/channel-contracts.js";
import { ChannelAccessor } from "../accessors/channel-accessor.js";
import { ChannelEngine } from "../engines/channel-engine.js";
import { config } from "../utilities/config.js";

const channelAccessor = new ChannelAccessor();
const channelEngine = new ChannelEngine(channelAccessor);

function isAllowedChannel(channelId: string): boolean {
  if (config.purgeChannelIds.length === 0) return false;
  return config.purgeChannelIds.includes(channelId);
}

function formatPurgeResponse(response: PurgeResponse): string {
  const parts = [`Deleted **${response.deletedCount}** messages.`];
  if (response.skippedCount > 0) {
    parts.push(`Skipped **${response.skippedCount}** messages (older than 14 days).`);
  }
  if (response.errors.length > 0) {
    parts.push(`Encountered **${response.errors.length}** error(s).`);
  }
  return parts.join("\n");
}

const NOT_ALLOWED_MESSAGE =
  "Purge is not allowed in this channel. Check `PURGE_CHANNEL_IDS` in the bot configuration.";

const purge: Command = {
  name: "purge",
  description: "Delete messages from a configured channel",
  slashData: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages from a configured channel")
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription("Number of messages to delete (default: 100)")
        .setMinValue(1)
        .setMaxValue(1000),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel || !interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server channel.", flags: 64 });
      return;
    }

    if (!isAllowedChannel(interaction.channelId)) {
      await interaction.reply({ content: NOT_ALLOWED_MESSAGE, flags: 64 });
      return;
    }

    const count = interaction.options.getInteger("count") ?? 100;
    const request: PurgeRequest = { channelId: interaction.channelId, count };

    await interaction.deferReply({ flags: 64 });

    const response = await channelEngine.purge(request, interaction.channel as GuildTextBasedChannel);
    await interaction.editReply(formatPurgeResponse(response));
  },

  async executePrefix(message: Message, context: CommandContext): Promise<void> {
    if (!message.guild || !message.channel || message.channel.type === ChannelType.DM) {
      await message.reply("This command can only be used in a server channel.");
      return;
    }

    if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.reply("You need the Manage Messages permission to use this command.");
      return;
    }

    if (!isAllowedChannel(message.channelId)) {
      await message.reply(NOT_ALLOWED_MESSAGE);
      return;
    }

    const count = context.args[0] ? parseInt(context.args[0], 10) : 100;
    if (isNaN(count) || count < 1 || count > 1000) {
      await message.reply("Please provide a number between 1 and 1000.");
      return;
    }

    const request: PurgeRequest = { channelId: message.channelId, count };
    const response = await channelEngine.purge(request, message.channel as GuildTextBasedChannel);

    const channel = message.channel as GuildTextBasedChannel;
    await channel.send(formatPurgeResponse(response));
  },
};

export default purge;
