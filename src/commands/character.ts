import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { CharacterAccessor } from "../accessors/character-accessor.js";
import type { CampaignAccessor } from "../accessors/campaign-accessor.js";
import type { CharacterCreationEngine } from "../engines/character-creation-engine.js";
import { formatCharacterSheet, formatCharacterSummaryEmbed } from "../utilities/shadowrun-format.js";
import * as logger from "../utilities/logger.js";

export function createCharacterCommand(
  characterAccessor: CharacterAccessor,
  campaignAccessor: CampaignAccessor,
  characterCreationEngine: CharacterCreationEngine,
): Command {
  return {
    name: "character",
    description: "Manage Shadowrun characters",
    slashData: new SlashCommandBuilder()
      .setName("character")
      .setDescription("Manage Shadowrun characters")
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new Shadowrun character (starts DM wizard)")
          .addStringOption((opt) => opt.setName("name").setDescription("Character name").setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName("sheet")
          .setDescription("View a character sheet")
          .addUserOption((opt) => opt.setName("user").setDescription("View another player's character (public summary)")),
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Delete one of your characters")
          .addStringOption((opt) => opt.setName("name").setDescription("Character name to delete").setRequired(true)),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const sub = interaction.options.getSubcommand();

      switch (sub) {
        case "create":
          await handleCreate(interaction);
          break;
        case "sheet":
          await handleSheet(interaction);
          break;
        case "delete":
          await handleDelete(interaction);
          break;
        default:
          await interaction.reply({ content: `Unknown subcommand: ${sub}`, flags: 64 });
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const sub = context.args[0]?.toLowerCase();

      switch (sub) {
        case "create":
          await handleCreatePrefix(message, context.args.slice(1).join(" "));
          break;
        case "sheet":
          await handleSheetPrefix(message);
          break;
        case "delete":
          await handleDeletePrefix(message, context.args.slice(1).join(" "));
          break;
        default:
          await message.reply("Usage: `!character <create|sheet|delete> [args]`");
      }
    },
  };

  async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString("name", true);

    try {
      const dmChannel = await interaction.user.createDM();
      const { prompt } = await characterCreationEngine.startCreation(interaction.user.id, null, name);
      await dmChannel.send(`Let's create **${name}**!\n\n${prompt}`);
      await interaction.reply({ content: "Check your DMs — character creation has started!", flags: 64 });
    } catch (error) {
      logger.error("Failed to start character creation:", error);
      await interaction.reply({ content: "Failed to start character creation. Make sure your DMs are open.", flags: 64 });
    }
  }

  async function handleCreatePrefix(message: Message, name: string): Promise<void> {
    if (!name) {
      await message.reply("Usage: `!character create <name>`");
      return;
    }

    try {
      const dmChannel = await message.author.createDM();
      const { prompt } = await characterCreationEngine.startCreation(message.author.id, null, name);
      await dmChannel.send(`Let's create **${name}**!\n\n${prompt}`);
      await message.reply("Check your DMs — character creation has started!");
    } catch (error) {
      logger.error("Failed to start character creation:", error);
      await message.reply("Failed to start character creation. Make sure your DMs are open.");
    }
  }

  async function handleSheet(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: 64 });
      return;
    }

    const targetUser = interaction.options.getUser("user") ?? interaction.user;
    const isSelf = targetUser.id === interaction.user.id;

    const campaign = await campaignAccessor.getActiveCampaignForChannel(interaction.guildId, interaction.channelId)
      ?? await campaignAccessor.getPausedCampaignForChannel(interaction.guildId, interaction.channelId);

    if (!campaign) {
      await interaction.reply({ content: "No campaign in this channel.", flags: 64 });
      return;
    }

    const character = await characterAccessor.getCharacterByUserAndCampaign(targetUser.id, campaign.id);
    if (!character || character.creationStatus !== "complete") {
      await interaction.reply({
        content: isSelf ? "You don't have a completed character in this campaign." : `${targetUser.displayName} doesn't have a completed character.`,
        flags: 64,
      });
      return;
    }

    if (isSelf) {
      const embed = formatCharacterSheet(character);
      await interaction.reply({ embeds: [embed], flags: 64 });
    } else {
      const embed = formatCharacterSummaryEmbed(character);
      await interaction.reply({ embeds: [embed] });
    }
  }

  async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString("name", true);
    const characters = await characterAccessor.getCharactersForUser(interaction.user.id);
    const match = characters.find((c) => c.name.toLowerCase() === name.toLowerCase());

    if (!match) {
      await interaction.reply({ content: `No character named "${name}" found. Your characters: ${characters.map((c) => `**${c.name}**`).join(", ") || "none"}`, flags: 64 });
      return;
    }

    if (match.campaignId !== null) {
      await interaction.reply({ content: `**${match.name}** is linked to an active campaign and can't be deleted. Remove them from the campaign first.`, flags: 64 });
      return;
    }

    const deleted = await characterAccessor.deleteCharacter(match.id, interaction.user.id);
    if (deleted) {
      await interaction.reply({ content: `**${match.name}** has been deleted.`, flags: 64 });
    } else {
      await interaction.reply({ content: "Failed to delete character.", flags: 64 });
    }
  }

  async function handleDeletePrefix(message: Message, name: string): Promise<void> {
    if (!name) {
      await message.reply("Usage: `!character delete <name>`");
      return;
    }

    const characters = await characterAccessor.getCharactersForUser(message.author.id);
    const match = characters.find((c) => c.name.toLowerCase() === name.toLowerCase());

    if (!match) {
      await message.reply(`No character named "${name}" found. Your characters: ${characters.map((c) => `**${c.name}**`).join(", ") || "none"}`);
      return;
    }

    if (match.campaignId !== null) {
      await message.reply(`**${match.name}** is linked to an active campaign and can't be deleted. Remove them from the campaign first.`);
      return;
    }

    const deleted = await characterAccessor.deleteCharacter(match.id, message.author.id);
    if (deleted) {
      await message.reply(`**${match.name}** has been deleted.`);
    } else {
      await message.reply("Failed to delete character.");
    }
  }

  async function handleSheetPrefix(message: Message): Promise<void> {
    if (!message.guild) {
      await message.reply("This command can only be used in a server.");
      return;
    }

    const targetUser = message.mentions.users.first() ?? message.author;
    const isSelf = targetUser.id === message.author.id;

    const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild.id, message.channelId)
      ?? await campaignAccessor.getPausedCampaignForChannel(message.guild.id, message.channelId);

    if (!campaign) {
      await message.reply("No campaign in this channel.");
      return;
    }

    const character = await characterAccessor.getCharacterByUserAndCampaign(targetUser.id, campaign.id);
    if (!character || character.creationStatus !== "complete") {
      await message.reply(
        isSelf ? "You don't have a completed character in this campaign." : `${targetUser.displayName} doesn't have a completed character.`,
      );
      return;
    }

    if (isSelf) {
      const embed = formatCharacterSheet(character);
      try {
        const dm = await message.author.createDM();
        await dm.send({ embeds: [embed] });
        await message.reply("Character sheet sent to your DMs!");
      } catch {
        await message.reply({ embeds: [embed] });
      }
    } else {
      const embed = formatCharacterSummaryEmbed(character);
      await message.reply({ embeds: [embed] });
    }
  }
}
