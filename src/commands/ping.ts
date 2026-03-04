import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";

const ping: Command = {
  name: "ping",
  description: "Replies with Pong!",
  slashData: new SlashCommandBuilder().setName("ping").setDescription("Replies with Pong!"),

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply("Pong!");
  },

  async executePrefix(message: Message, _context: CommandContext): Promise<void> {
    await message.reply("Pong!");
  },
};

export default ping;
