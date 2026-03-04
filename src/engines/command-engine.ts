import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command } from "../types/command.js";
import * as logger from "../utilities/logger.js";

export class CommandEngine {
  private commands: Map<string, Command>;

  constructor(commands: Command[]) {
    this.commands = new Map(commands.map((cmd) => [cmd.name, cmd]));
  }

  async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown slash command: ${interaction.commandName}`);
      await interaction.reply({ content: "Unknown command.", flags: 64 });
      return;
    }

    try {
      await command.executeSlash(interaction);
    } catch (err) {
      logger.error(`Error executing slash command "${command.name}":`, err);
      const reply = { content: "An error occurred while executing this command.", flags: 64 };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }

  async handlePrefixCommand(message: Message, prefix: string): Promise<void> {
    if (!message.content.startsWith(prefix)) return;
    if (message.author.bot) return;

    const content = message.content.slice(prefix.length).trim();
    const [commandName, ...args] = content.split(/\s+/);
    if (!commandName) return;

    const command = this.commands.get(commandName.toLowerCase());
    if (!command) return;

    try {
      await command.executePrefix(message, { args });
    } catch (err) {
      logger.error(`Error executing prefix command "${command.name}":`, err);
      await message.reply("An error occurred while executing this command.");
    }
  }

  getSlashCommandData(): unknown[] {
    return Array.from(this.commands.values()).map((cmd) => cmd.slashData.toJSON());
  }
}
