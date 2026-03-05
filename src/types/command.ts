import type {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export interface CommandContext {
  args: string[];
}

export interface Command {
  name: string;
  description: string;
  slashData: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  executeSlash(interaction: ChatInputCommandInteraction): Promise<void>;
  executePrefix(message: Message, context: CommandContext): Promise<void>;
}
