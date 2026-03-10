import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { ChallengeEngine } from "../engines/challenge-engine.js";
import { buildResultsEmbed, buildChallengeLeaderboardEmbed } from "../utilities/challenge-embed.js";

export function createChallengeCommand(challengeEngine: ChallengeEngine): Command {
  return {
    name: "challenge",
    description: "View translation challenge results and leaderboards",
    slashData: new SlashCommandBuilder()
      .setName("challenge")
      .setDescription("View translation challenge results and leaderboards")
      .addSubcommand((sub) =>
        sub
          .setName("results")
          .setDescription("View results for a challenge")
          .addIntegerOption((opt) =>
            opt
              .setName("id")
              .setDescription("Challenge ID (defaults to most recent)")
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("leaderboard").setDescription("View the translation challenge leaderboard"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "results") {
        await handleResults(interaction, challengeEngine);
      } else if (subcommand === "leaderboard") {
        await handleLeaderboard(interaction, challengeEngine);
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const subcommand = context.args[0]?.toLowerCase();

      if (!subcommand || !["results", "leaderboard"].includes(subcommand)) {
        await message.reply("Usage: `!challenge results [id]` or `!challenge leaderboard`");
        return;
      }

      if (subcommand === "results") {
        await handleResultsPrefix(message, context, challengeEngine);
      } else if (subcommand === "leaderboard") {
        await handleLeaderboardPrefix(message, challengeEngine);
      }
    },
  };
}

async function handleResults(
  interaction: ChatInputCommandInteraction,
  challengeEngine: ChallengeEngine,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  try {
    const challengeId = interaction.options.getInteger("id");

    const results = challengeId
      ? await challengeEngine.getResults({ challengeId })
      : await challengeEngine.getLatestResults(interaction.guildId ?? "");

    if (!results) {
      await interaction.editReply("Challenge not found.");
      return;
    }

    const embed = buildResultsEmbed(results);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await interaction.editReply(`Failed to load results: ${msg}`);
  }
}

async function handleLeaderboard(
  interaction: ChatInputCommandInteraction,
  challengeEngine: ChallengeEngine,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  try {
    const response = await challengeEngine.getLeaderboard({
      guildId: interaction.guildId ?? "",
    });
    const embed = buildChallengeLeaderboardEmbed(response);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await interaction.editReply(`Failed to load leaderboard: ${msg}`);
  }
}

async function handleResultsPrefix(
  message: Message,
  context: CommandContext,
  challengeEngine: ChallengeEngine,
): Promise<void> {
  try {
    const challengeId = parseInt(context.args[1], 10);
    if (isNaN(challengeId)) {
      await message.reply(
        "Please provide a challenge ID: `!challenge results <id>`",
      );
      return;
    }

    const results = await challengeEngine.getResults({ challengeId });
    if (!results) {
      await message.reply("Challenge not found.");
      return;
    }

    const embed = buildResultsEmbed(results);
    if (message.channel.isSendable()) {
      await message.channel.send({ embeds: [embed] });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await message.reply(`Failed to load results: ${msg}`);
  }
}

async function handleLeaderboardPrefix(
  message: Message,
  challengeEngine: ChallengeEngine,
): Promise<void> {
  try {
    const response = await challengeEngine.getLeaderboard({
      guildId: message.guildId ?? "",
    });
    const embed = buildChallengeLeaderboardEmbed(response);
    if (message.channel.isSendable()) {
      await message.channel.send({ embeds: [embed] });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await message.reply(`Failed to load leaderboard: ${msg}`);
  }
}
