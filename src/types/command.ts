import type {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";

export interface CommandContext {
  args: string[];
}

export interface Command {
  name: string;
  description: string;
  slashData: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  executeSlash(interaction: ChatInputCommandInteraction): Promise<void>;
  executePrefix(message: Message, context: CommandContext): Promise<void>;
}
